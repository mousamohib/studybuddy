// The tutor. Builds each chat's context on the server (teaching style, course rules, memory,
// deadlines, today's plan, the chat's files), streams the answer back as newline-delimited JSON,
// saves the conversation, and files [[remember: …]] / [[revisit: …]] notes.
//   {"t":"delta","v":"text"} … then {"t":"done","message":{…},"saved":[…]}  or  {"t":"error","code","message"}
import { checkAllowed, isDemo, LimitError, recordUsage, streamAI, type Msg } from "../_shared/ai.ts";
import { demoChat } from "../_shared/demo.ts";
import { cors, getCtx, json } from "../_shared/http.ts";
import { JOBS } from "../_shared/limits.ts";
import { type Course, deadlinesText, materialsText, type Outline, outlineText, type Profile, RESHAPE, rulesBlock } from "../_shared/prompts.ts";

type ChatMsg = { role: "user" | "assistant"; content: string; ts?: number; saved?: string[]; original?: string; shape?: string; interrupted?: boolean };
const MODIFIER_TEXT: Record<string, string> = {
  simpler: "explain everything more simply, with plainer words and everyday analogies",
  detail: "go into more detail and depth",
  maths: "be more mathematical: precise notation and every derivation step",
  intuition: "focus on intuition and theory: why things work",
  example: "build explanations around fully worked examples",
  like_lecture: "explain things the way the lecturer did in the lecture recordings: follow their order, running examples, analogies, notation and phrasing (see the transcripts and the lecturer's style notes), quote short phrases they used, and point out what they said matters for the exam. If the recordings don't cover a point, say so briefly, then explain it in the same spirit",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await getCtx(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const body = await req.json().catch(() => ({}));
  const mode: "chat" | "reshape" = body.mode === "reshape" ? "reshape" : "chat";

  const { data: chat } = await admin.from("chats").select("*").eq("id", body.chat_id).eq("user_id", user.id).maybeSingle();
  if (!chat) return json(404, { code: "not_found", message: "Chat not found." });
  try { await checkAllowed(admin, user.id, mode); } catch (e) {
    if (e instanceof LimitError) return json(e.status, { code: e.code, message: e.message, ...e.extra });
    throw e;
  }

  const [{ data: profile }, { data: course }, { data: memory }, { data: deadlines }, { data: courses }, { data: plan }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    chat.course_id ? admin.from("courses").select("*").eq("id", chat.course_id).single() : Promise.resolve({ data: null }),
    admin.from("memory").select("kind, text").eq("user_id", user.id).eq("done", false).or(chat.course_id ? `course_id.eq.${chat.course_id}` : "course_id.is.null"),
    admin.from("deadlines").select("*").eq("user_id", user.id),
    admin.from("courses").select("id, code").eq("user_id", user.id),
    admin.from("plans").select("days, done").eq("user_id", user.id).maybeSingle(),
  ]);
  const codeOf = (id: string) => (courses ?? []).find((c: { id: string }) => c.id === id)?.code ?? "?";
  const c = course as Course | null;
  const dl = chat.deadline_id ? (deadlines ?? []).find((d: { id: string }) => d.id === chat.deadline_id) : null;

  // What has been taught in this course, so assignment help stays within it.
  let scope = "";
  if (c) {
    const { data: mats } = await admin.from("materials").select("file_name, outline").eq("user_id", user.id).eq("course_id", c.id).is("deadline_id", null).eq("status", "ready");
    const taught = (mats ?? []).filter((m: { outline: Outline | null }) => !["assignment", "syllabus"].includes(m.outline?.kind ?? ""));
    scope = chat.mode === "assignment"
      ? `# What has been taught in ${c.code}\n${taught.map((m: { file_name: string; outline: Outline }) => `- ${m.file_name}\n${outlineText(m.outline)}`).join("\n") || "(no lecture material uploaded yet)"}\nFor this assignment, only use concepts and techniques from the taught material above or the assignment's own files. If the task seems to need something beyond that, say so and point to the closest taught topic.`
      : `# Syllabus\nThe ${c.code} study materials are the syllabus for its tests${taught.length ? `: ${taught.map((m: { file_name: string }) => m.file_name).join(", ")}` : ""}. Keep teaching and practice within that scope unless asked to go further.`;
  }
  // Group project memory for assignment chats: who does what, the student's part, progress so far.
  let project = "";
  if (dl) {
    const { data: pb } = await admin.from("project_briefs").select("is_group, role, brief").eq("deadline_id", dl.id).eq("user_id", user.id).maybeSingle();
    const b = (pb?.brief ?? {}) as { members?: { name: string; part: string }[]; log?: { date: string; text: string }[]; notes?: string };
    if (pb) {
      project = `# ${pb.is_group ? "Group project" : "Project"} memory
${pb.is_group ? `Team:\n${(b.members ?? []).map((m) => `- ${m.name}: ${m.part || "(part not set)"}`).join("\n") || "(not set)"}\n` : ""}The student's part: ${pb.role || "(not set; ask once if it matters)"}
${b.notes ? `Notes: ${b.notes}\n` : ""}Progress so far:\n${(b.log ?? []).slice(-15).map((l) => `- ${l.date}: ${l.text}`).join("\n") || "(nothing logged yet)"}
${pb.is_group ? "Focus help on the student's own part. Use teammates' parts only to keep interfaces and integration consistent. " : ""}When the student reports progress or a decision on this project, end your reply with [[progress: short note]].`;
    }
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = ((plan?.days ?? []) as { date: string; sessions: { id: string; course: string; title: string; minutes: number }[] }[]).find((d) => d.date === todayKey)?.sessions ?? [];
  // Lecture recordings: in "like my lecture" mode, the most relevant transcripts get most of the room,
  // plus notes on how this lecturer explains things.
  const likeLecture = chat.modifier === "like_lecture" || (body.mode === "reshape" && body.style === "like_lecture");
  const budget = chat.mode === "assignment" ? 110_000 : 140_000;
  let mats = "", lectureStyle = "";
  if (likeLecture && c) {
    const { data: recs } = await admin.from("materials").select("id, file_name, outline").eq("user_id", user.id).eq("course_id", c.id).eq("status", "ready").filter("outline->>kind", "eq", "recording");
    const words = new Set(`${chat.title} ${body.text ?? ""} ${(Array.isArray(chat.messages) ? String(chat.messages.at(-1)?.content ?? "") : "").slice(0, 400)}`.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const score = (o: Outline | null) => [o?.title ?? "", ...(o?.topics ?? []).map((t) => t.name)].join(" ").toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => words.has(w)).length ?? 0;
    const ranked = ((recs ?? []) as { id: string; file_name: string; outline: Outline | null }[]).sort((a, b) => score(b.outline) - score(a.outline)).slice(0, 2);
    const recIds = new Set((recs ?? []).map((r: { id: string }) => r.id));
    const recText = ranked.length ? await materialsText(admin, user.id, ranked.map((r) => r.id), 75_000) : "";
    const rest = await materialsText(admin, user.id, (chat.material_ids ?? []).filter((id: string) => !recIds.has(id)), budget - recText.length);
    mats = [recText && `# Lecture recording transcripts ([t. mm:ss] = time in the recording)\n${recText}`, rest].filter(Boolean).join("\n\n");
    const notes = ((recs ?? []) as { outline: Outline | null }[]).flatMap((r) => (r.outline as { style?: string[] } | null)?.style ?? []).slice(0, 16);
    lectureStyle = recs?.length
      ? `\n# How this lecturer explains things (from their recordings)\n${notes.map((n) => `- ${n}`).join("\n") || "(use the transcripts)"}`
      : "\n# Lecture recordings\nNo lecture recordings or transcripts have been uploaded for this course yet. Say so in one line and suggest uploading the captions (.vtt/.srt) or recording, then explain as well as you can.";
  } else {
    mats = await materialsText(admin, user.id, chat.material_ids ?? [], budget);
  }
  const facts = (memory ?? []).filter((m: { kind: string }) => m.kind === "fact").map((m: { text: string }) => `- ${m.text}`).join("\n");

  const system = `You are Scrawlie, a study tutor inside a student app${c ? `, in the student's ${c.code} workspace` : ""}. Today is ${todayKey}.
${rulesBlock(profile as Profile, c, chat.style, chat.modifier ? MODIFIER_TEXT[chat.modifier] ?? chat.modifier : null)}

# ${c ? `${c.code} memory` : "Memory"} (keep in mind)
${facts || "(empty)"}

# Upcoming deadlines${c ? ` for ${c.code}` : ""}
${deadlinesText((deadlines ?? []).filter((d: { course_id: string }) => !c || d.course_id === c.id), codeOf)}

# Today's planned sessions
${todays.map((s) => `- ${s.course}: ${s.title} (${s.minutes} min)`).join("\n") || "(none)"}
${dl ? `\n# This chat is about: ${codeOf(dl.course_id)} ${dl.kind}${dl.label ? ` ${dl.label}` : ""}, due ${dl.due_at.slice(0, 10)}${dl.covers ? `. ${dl.covers}` : ""}` : ""}
${chat.mode === "lesson" ? "\n# Mode: teach a topic in full, following the teaching rules." : chat.mode === "practice" ? "\n# Mode: practice. Give questions first; hold worked solutions until the student answers or asks." : chat.mode === "coding" ? "\n# Mode: coding practice. Short recap, one worked example, then exercises of increasing difficulty with hints; full solutions only on request." : chat.mode === "assignment" ? "\n# Mode: assignment help." : ""}
${scope}
${project}${lectureStyle}
${mats ? `\n# Course materials for this chat ([p. N] / [slide N] markers are page numbers: use them only to name the source once)\n${mats}` : ""}

# Remembering things
If the student tells you a lasting fact about their situation (a weak spot, a decision, exam details, a preference), end your reply with one line per NEW fact: [[remember: the fact]]. If they say they want to come back to a topic later, add [[revisit: the topic]]. Most replies need neither.

# Format
Markdown. All maths in LaTeX: $…$ inline, $$…$$ on its own line. Code in fenced blocks with a language.`;

  const history: ChatMsg[] = Array.isArray(chat.messages) ? chat.messages : [];
  let base: ChatMsg[], prompt: string, reshapeIndex = -1;
  if (mode === "reshape") {
    reshapeIndex = Number(body.index);
    if (history[reshapeIndex]?.role !== "assistant" || !RESHAPE[body.style]) return json(400, { code: "bad_request", message: "Can't reshape that message." });
    base = history.slice(0, reshapeIndex + 1).map((m, i) => i === reshapeIndex && m.original ? { ...m, content: m.original } : m);
    prompt = RESHAPE[body.style];
  } else if (body.regenerate) {
    const i = history.map((m) => m.role).lastIndexOf("user");
    if (i < 0) return json(400, { code: "bad_request", message: "Nothing to regenerate." });
    base = history.slice(0, i); prompt = history[i].content;
  } else {
    prompt = String(body.text ?? "").trim();
    if (!prompt) return json(400, { code: "bad_request", message: "Type a message first." });
    base = history;
  }
  // Keep the last ~60k characters of conversation, starting on a user turn.
  let hist = base.map((m) => ({ role: m.role, content: m.content }));
  let size = hist.reduce((a, m) => a + m.content.length, 0);
  while (size > 60_000 && hist.length > 2) { size -= hist[0].content.length; hist = hist.slice(1); }
  while (hist.length && hist[0].role !== "user") hist = hist.slice(1);
  const messages: Msg[] = [...hist, { role: "user", content: prompt }];

  const job = JOBS[mode];
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      let text = "", inTok = 0, outTok = 0, truncated = false;
      try {
        if (isDemo()) {
          const demo = mode === "reshape" ? `**Demo rewrite (${body.style})**\n\n${history[reshapeIndex].original ?? history[reshapeIndex].content}` : demoChat(prompt);
          for (const piece of demo.match(/.{1,24}/gs) ?? []) { text += piece; send({ t: "delta", v: piece }); await new Promise((r) => setTimeout(r, 25)); }
        } else {
          for await (const ev of streamAI({ tier: job.tier, maxTokens: job.maxTokens, system, messages, cache: true })) {
            if (ev.delta) { text += ev.delta; send({ t: "delta", v: ev.delta }); }
            if (ev.done) ({ inTok, outTok, truncated } = ev.done);
          }
        }
      } catch (e) {
        send({ t: "error", code: e instanceof LimitError ? e.code : "provider_error", message: e instanceof LimitError ? e.message : "The AI service had a problem. Try again." });
        if (!text) { ctrl.close(); return; }
      }

      // File memory notes and strip the tags.
      const saved: string[] = [];
      const rows: { user_id: string; course_id: string | null; kind: string; text: string; source: string }[] = [];
      for (const m of text.matchAll(/\[\[(remember|revisit):\s*([\s\S]*?)\]\]/gi)) {
        const fact = m[2].trim().slice(0, 300);
        if (!fact) continue;
        const kind = m[1].toLowerCase() === "revisit" ? "revisit" : "fact";
        rows.push({ user_id: user.id, course_id: chat.course_id, kind, text: fact, source: "chat" });
        saved.push(kind === "revisit" ? `Revisit later: ${fact}` : fact);
      }
      if (rows.length) await admin.from("memory").insert(rows);
      const progress = [...text.matchAll(/\[\[progress:\s*([\s\S]*?)\]\]/gi)].map((m) => m[1].trim().slice(0, 300)).filter(Boolean);
      if (progress.length && chat.deadline_id) {
        const { data: pb } = await admin.from("project_briefs").select("brief").eq("deadline_id", chat.deadline_id).eq("user_id", user.id).maybeSingle();
        const brief = (pb?.brief ?? {}) as { log?: { date: string; text: string }[] };
        const log = [...(brief.log ?? []), ...progress.map((p) => ({ date: new Date().toISOString().slice(0, 10), text: p }))].slice(-60);
        await admin.from("project_briefs").upsert({ deadline_id: chat.deadline_id, user_id: user.id, brief: { ...brief, log }, updated_at: new Date().toISOString() });
        saved.push(...progress.map((p) => `Project progress: ${p}`));
      }
      const clean = text.replace(/\[\[(remember|revisit|progress):[\s\S]*?(\]\]|$)/gi, "").trimEnd();

      let msgs: ChatMsg[], message: ChatMsg;
      if (mode === "reshape") {
        const old = history[reshapeIndex];
        message = { ...old, content: clean, original: old.original ?? old.content, shape: body.style };
        msgs = history.map((m, i) => (i === reshapeIndex ? message : m));
      } else {
        message = { role: "assistant", content: clean, ts: Date.now(), ...(saved.length ? { saved } : {}), ...(truncated ? { interrupted: true } : {}) };
        msgs = [...base, { role: "user", content: prompt, ts: Date.now() }, message];
      }
      while (JSON.stringify(msgs).length > 220_000 && msgs.length > 2) msgs = msgs.slice(1);
      const update: Record<string, unknown> = { messages: msgs, updated_at: new Date().toISOString() };
      if (chat.title === "New chat" && mode === "chat") update.title = prompt.slice(0, 60);
      if (mode === "reshape" && body.keep && MODIFIER_TEXT[body.style]) update.modifier = body.style;
      await admin.from("chats").update(update).eq("id", chat.id);
      await recordUsage(admin, user.id, mode, job.tier, inTok, outTok, true);
      send({ t: "done", message, saved, title: update.title ?? chat.title });
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { ...cors, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
});
