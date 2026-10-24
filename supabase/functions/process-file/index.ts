// Called right after the app uploads a file to storage.
// Counts the upload, then in the background: reads the file's text, transcribes photos,
// saves the text in chunks and asks the AI for a topic outline.
import { callAI, checkAllowed, isDemo, LimitError, recordUsage } from "../_shared/ai.ts";
import { demoOutline } from "../_shared/demo.ts";
import { extract } from "../_shared/extract.ts";
import { background, cors, getCtx, json, parseJSON, type Ctx } from "../_shared/http.ts";
import { JOBS, LIMITS } from "../_shared/limits.ts";
import type { Outline } from "../_shared/prompts.ts";

const CHUNK = 60_000;
const encodeBase64 = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await getCtx(req);
  if (ctx instanceof Response) return ctx;
  const { user, admin } = ctx;
  const { material_id } = await req.json().catch(() => ({}));
  const { data: m } = await admin.from("materials").select("*").eq("id", material_id).eq("user_id", user.id).maybeSingle();
  if (!m) return json(404, { code: "not_found", message: "File not found." });

  try {
    const plan = await checkAllowed(admin, user.id, "upload");
    const { data: sizes } = await admin.from("materials").select("size_bytes").eq("user_id", user.id);
    const usedMB = (sizes ?? []).reduce((a: number, r: { size_bytes: number | null }) => a + Number(r.size_bytes ?? 0), 0) / 1048576;
    if (usedMB > LIMITS[plan].storageMB) throw new LimitError(402, "storage_full", "Your storage is full. Delete some files or upgrade to Pro.");
  } catch (e) {
    if (e instanceof LimitError) {
      await admin.storage.from("materials").remove([m.storage_path]);
      await admin.from("materials").delete().eq("id", m.id);
      return json(e.status, { code: e.code, message: e.message, ...e.extra });
    }
    throw e;
  }
  await recordUsage(admin, user.id, "upload", "fast", 0, 0, true);
  await admin.from("materials").update({ status: "reading" }).eq("id", m.id);
  background(processFile(ctx, m));
  return json(202, { ok: true });
});

async function processFile({ user, admin }: Ctx, m: { id: string; storage_path: string; file_name: string; deadline_id: string | null; course_id: string }) {
  try {
    const { data: blob, error } = await admin.storage.from("materials").download(m.storage_path);
    if (error || !blob) throw new Error(`download failed: ${error?.message}`);
    const ex = await extract(new Uint8Array(await blob.arrayBuffer()), m.file_name);

    // Photos and scanned pages: have the AI read them.
    let text = ex.text;
    for (const img of ex.images.slice(0, 6)) {
      if (isDemo()) { text += `\n\n[photo: ${img.name}]\n(Demo mode: photo text appears here once AI is on.)`; continue; }
      const r = await callAI({ tier: JOBS.vision.tier, maxTokens: JOBS.vision.maxTokens, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: img.mediaType, data: encodeBase64(img.data) } },
        { type: "text", text: "Transcribe everything in this image that a student would need: all text, equations (in LaTeX), and a short description of any diagram. Reply with the transcription only." },
      ] }] });
      await recordUsage(admin, user.id, "vision", "standard", r.inTok, r.outTok, false);
      text += `\n\n[photo: ${img.name}]\n${r.text}`;
    }
    if (!text.replace(/\[(p\.|slide) \d+\]/g, "").trim()) throw new Error("no readable text");

    await admin.from("material_chunks").delete().eq("material_id", m.id);
    const rows = [];
    for (let i = 0; i * CHUNK < text.length; i++) rows.push({ user_id: user.id, material_id: m.id, n: i, text: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    await admin.from("material_chunks").insert(rows);
    await admin.from("materials").update({ status: "outlining", chars: text.length }).eq("id", m.id);

    let outline: Outline | null;
    if (isDemo()) outline = demoOutline(text, m.file_name);
    else {
      const r = await callAI({ tier: "fast", maxTokens: JOBS.outline.maxTokens, messages: [{ role: "user", content:
`Outline this course material ("${m.file_name}") for a study planner. List the distinct topics in the order they appear (at most 40), each with where it is (page or slide range from the [p. N] / [slide N] markers, or section) and a summary of at most 15 words.${m.deadline_id ? " This file was uploaded under an assignment, so treat it as that assignment's handout, spec, starter code or group progress." : ""} If it is an assignment or project handout, list its required parts and tasks as topics and set "kind" to "assignment". If it is a sample exam or practice sheet, set "kind" to "practice".
Reply with only JSON: {"kind":"lecture|notes|assignment|practice|syllabus|other","title":"…","topics":[{"name":"…","where":"pp. 3-7","summary":"…"}]}

MATERIAL:
${text.slice(0, 150_000)}` }] });
      await recordUsage(admin, user.id, "outline", "fast", r.inTok, r.outTok, false);
      outline = parseJSON<Outline>(r.text);
    }
    if (!outline) throw new Error("outline was not valid JSON");
    outline.topics = (outline.topics ?? []).slice(0, 40);
    await admin.from("materials").update({ status: "ready", outline: { ...outline, skipped: ex.skipped.slice(0, 50) } }).eq("id", m.id);
  } catch (e) {
    console.error("process-file", m.id, e);
    await admin.from("materials").update({ status: "error", outline: { error: String((e as Error).message ?? e) } }).eq("id", m.id);
  }
}
