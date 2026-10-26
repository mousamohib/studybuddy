// Called right after the app uploads a file to storage.
// Counts the upload, then in the background: reads the file's text, transcribes photos,
// saves the text in chunks and asks the AI for a topic outline.
import { callAI, checkAllowed, isDemo, LimitError, recordUsage } from "../_shared/ai.ts";
import { DEMO_TRANSCRIPT, demoOutline, demoRecording } from "../_shared/demo.ts";
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

async function processFile(ctx: Ctx, m: { id: string; storage_path: string; file_name: string; deadline_id: string | null; course_id: string }) {
  const { user, admin } = ctx;
  try {
    const { data: blob, error } = await admin.storage.from("materials").download(m.storage_path);
    if (error || !blob) throw new Error(`download failed: ${error?.message}`);
    const ex = await extract(new Uint8Array(await blob.arrayBuffer()), m.file_name);

    // Lecture recordings: turn speech into text, then drop the big video/audio file to save storage.
    if (ex.media) {
      ex.text = await transcribe(ctx, ex.media);
      await admin.storage.from("materials").remove([m.storage_path]);
      await admin.from("materials").update({ storage_path: null, size_bytes: ex.text.length }).eq("id", m.id);
    }

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
    if (ex.recording) outline = isDemo() ? demoRecording(text, m.file_name) : await outlineRecording(ctx, m.file_name, text);
    else if (isDemo()) outline = demoOutline(text, m.file_name);
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
    // Things the lecturer said about the exam go into the course memory, so the tutor and exam prep use them.
    if (outline.kind === "recording" && outline.exam_hints?.length) {
      await admin.from("memory").insert(outline.exam_hints.slice(0, 8).map((h) => ({
        user_id: user.id, course_id: m.course_id, kind: "fact", source: "lecture", text: `Lecturer (${(outline!.title || m.file_name).slice(0, 60)}): ${h}`.slice(0, 300),
      })));
    }
    outline.topics = (outline.topics ?? []).slice(0, 40);
    await admin.from("materials").update({ status: "ready", outline: { ...outline, skipped: ex.skipped.slice(0, 50) } }).eq("id", m.id);
  } catch (e) {
    console.error("process-file", m.id, e);
    await admin.from("materials").update({ status: "error", outline: { error: String((e as Error).message ?? e) } }).eq("id", m.id);
  }
}

const TRANSCRIBE_MAX = 25 * 1024 * 1024;

/** Speech to text with timestamps. Needs OPENAI_API_KEY (Whisper); otherwise asks for the captions file. */
async function transcribe({ user, admin }: Ctx, media: { name: string; mediaType: string; data: Uint8Array }): Promise<string> {
  if (isDemo()) return DEMO_TRANSCRIPT;
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("needs captions");
  if (media.data.length > TRANSCRIBE_MAX) throw new Error("recording too large");
  const form = new FormData();
  form.append("file", new Blob([media.data as Uint8Array<ArrayBuffer>], { type: media.mediaType }), media.name);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) { console.error("transcribe", r.status, (await r.text()).slice(0, 300)); throw new Error("transcription failed"); }
  const out = await r.json() as { duration?: number; text: string; segments?: { start: number; text: string }[] };
  // Whisper costs about $0.006 a minute; count it against the user's monthly AI cost cap.
  await admin.rpc("add_usage", { uid: user.id, field: "none", amount: 0, in_tok: 0, out_tok: 0, cost: ((out.duration ?? 0) / 60) * 0.006 });
  if (!out.segments?.length) return out.text;
  let last = -1e9; const parts: string[] = [];
  for (const sg of out.segments) {
    if (sg.start - last >= 90) { parts.push(`\n[t. ${Math.floor(sg.start / 60)}:${String(Math.floor(sg.start % 60)).padStart(2, "0")}]`); last = sg.start; }
    parts.push(sg.text.trim());
  }
  return parts.join(" ").trim();
}

/** Outline for a lecture transcript: topics with times, what the lecturer said about the exam, and how they explain things. */
async function outlineRecording({ user, admin }: Ctx, name: string, text: string): Promise<Outline | null> {
  const r = await callAI({ tier: "fast", maxTokens: JOBS.outline.maxTokens, messages: [{ role: "user", content:
`This is the transcript of a recorded lecture ("${name}"). [t. mm:ss] markers are times in the recording.
1. List the distinct topics taught, in order (at most 40), each with its time range and a summary of at most 15 words.
2. exam_hints: everything the lecturer says about exams, tests or assignments, or stresses as important ("this will be on the midterm", "you don't need to know this", "make sure you can derive…"), each with its time. Empty list if none.
3. style: at most 8 short notes on HOW this lecturer explains things, so a tutor can explain the same way: their analogies and running examples, notation and symbols, the order they build ideas in, phrases they repeat.
Reply with only JSON: {"kind":"recording","title":"…","topics":[{"name":"…","where":"12:30-18:00","summary":"…"}],"exam_hints":["…"],"style":["…"]}

TRANSCRIPT:
${text.slice(0, 150_000)}` }] });
  await recordUsage(admin, user.id, "outline", "fast", r.inTok, r.outTok, false);
  const o = parseJSON<Outline>(r.text);
  return o ? { ...o, kind: "recording" } : null;
}
