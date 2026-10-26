// Long AI jobs that run in the background: syllabus reading, announcements, the study plan,
// weekly revision sheets, exam cheat sheets, derivation sheets and practice papers.
// The app creates a job, gets its id back at once, and watches the `jobs` row for progress.
import { callAI, checkAllowed, isDemo, LimitError, recordUsage } from "../_shared/ai.ts";
import { demoDoc, demoPlan, demoSyllabus } from "../_shared/demo.ts";
import { background, cors, getCtx, json, parseJSON, type Ctx } from "../_shared/http.ts";
import { JOBS } from "../_shared/limits.ts";
import {
  type Course, daysUntil, deadlinesText, fmtDate, lectureHints, materialsText, type Outline, outlineText, type Profile, rulesBlock,
} from "../_shared/prompts.ts";

const KINDS = ["syllabus", "announcement", "plan", "weekly_sheet", "exam_sheet", "derivation_sheet", "paper"] as const;
type Kind = typeof KINDS[number];
type Job = { id: string; kind: Kind; input: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await getCtx(req);
  if (ctx instanceof Response) return ctx;
  const { kind, input = {} } = await req.json().catch(() => ({}));
  if (!KINDS.includes(kind)) return json(400, { code: "bad_job", message: `Unknown job "${kind}".` });
  try { await checkAllowed(ctx.admin, ctx.user.id, kind); } catch (e) {
    if (e instanceof LimitError) return json(e.status, { code: e.code, message: e.message, ...e.extra });
    throw e;
  }
  const { data: job, error } = await ctx.admin.from("jobs").insert({ user_id: ctx.user.id, kind, input, status: "running" }).select("id, kind, input").single();
  if (error) return json(500, { code: "failed", message: error.message });
  background(run(ctx, job as Job));
  return json(202, { job_id: job.id });
});

async function run(ctx: Ctx, job: Job) {
  const { admin, user } = ctx;
  try {
    const result = await RUNNERS[job.kind](ctx, job);
    await admin.from("jobs").update({ status: "done", progress: 100, result, updated_at: new Date().toISOString() }).eq("id", job.id);
  } catch (e) {
    console.error("job", job.kind, job.id, e);
    const message = e instanceof LimitError ? e.message : "Something went wrong. Try again.";
    await admin.from("jobs").update({ status: "error", error: message, updated_at: new Date().toISOString() }).eq("id", job.id);
  }
  void user;
}

// ---------- shared loading ----------
async function load(ctx: Ctx) {
  const { admin, user } = ctx;
  const [{ data: profile }, { data: courses }, { data: deadlines }, { data: materials }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).single(),
    admin.from("courses").select("*").eq("user_id", user.id),
    admin.from("deadlines").select("*").eq("user_id", user.id),
    admin.from("materials").select("id, course_id, deadline_id, file_name, outline, status, created_at").eq("user_id", user.id).order("created_at"),
  ]);
  const codeOf = (id: string) => (courses ?? []).find((c: Course) => c.id === id)?.code ?? "?";
  return { profile: profile as Profile, courses: (courses ?? []) as Course[], deadlines: deadlines ?? [], materials: materials ?? [], codeOf };
}
type Mat = { id: string; course_id: string; deadline_id: string | null; file_name: string; outline: Outline | null; status: string };
const isQuestionSource = (m: Mat) => m.outline?.kind === "practice" || /sample|midterm|practice|past.?(paper|exam)|mock/i.test(m.file_name);
const studyMats = (all: Mat[], courseId: string) => all.filter((m) => m.course_id === courseId && !m.deadline_id && m.status === "ready" && m.outline?.kind !== "assignment" && m.outline?.kind !== "syllabus" && !isQuestionSource(m));
const questionMats = (all: Mat[], courseId: string) => all.filter((m) => m.course_id === courseId && !m.deadline_id && m.status === "ready" && isQuestionSource(m));
const today = () => new Date().toISOString().slice(0, 10);

async function ask(ctx: Ctx, kind: Kind | "announcement", prompt: string, system?: string) {
  const job = JOBS[kind];
  const r = await callAI({ tier: job.tier, maxTokens: job.maxTokens, system, messages: [{ role: "user", content: prompt }] });
  await recordUsage(ctx.admin, ctx.user.id, kind, job.tier, r.inTok, r.outTok, false);
  return r;
}
const countUse = (ctx: Ctx, kind: Kind) => recordUsage(ctx.admin, ctx.user.id, kind, JOBS[kind].tier, 0, 0, true);

function testNote(deadlines: { course_id: string; kind: string; due_at: string; covers: string | null; done: boolean; id: string }[], courseId: string, deadlineId?: string) {
  const ds = deadlines.filter((d) => d.course_id === courseId && !d.done && !["assignment", "project", "lab"].includes(d.kind) && daysUntil(d.due_at) >= 0).sort((a, b) => a.due_at.localeCompare(b.due_at));
  const t = ds.find((d) => d.id === deadlineId) ?? ds[0];
  return t ? `${t.kind} on ${fmtDate(t.due_at)}${t.covers ? ` — covers: ${t.covers}` : ""}` : "the next exam";
}

function splitSkipped(text: string) {
  const i = text.search(/\n?=+\s*SKIPPED\s*=+/i);
  if (i < 0) return { md: text.trim(), skipped: [] as string[] };
  const skipped = text.slice(i).replace(/^\n?=+\s*SKIPPED\s*=+\s*/i, "").split("\n").map((x) => x.replace(/^\s*[-*•]\s*/, "").trim()).filter((x) => x && !/^\(?none\)?\.?$/i.test(x)).slice(0, 30);
  return { md: text.slice(0, i).trim(), skipped };
}

// ---------- runners ----------
const RUNNERS: Record<Kind, (ctx: Ctx, job: Job) => Promise<unknown>> = {
  async syllabus(ctx, job) {
    const id = String(job.input.material_id ?? "");
    const text = await materialsText(ctx.admin, ctx.user.id, [id], 120_000);
    if (!text) throw new LimitError(400, "not_ready", "The syllabus file isn't readable yet.");
    if (isDemo()) return demoSyllabus(text);
    const r = await ask(ctx, "syllabus", `Today is ${today()}. Read this course syllabus or outline and pull out everything a study planner needs.
- Every graded deadline and exam: kind, a short label, the date and time (local time as "YYYY-MM-DDTHH:MM"; if no time is given use 23:59; infer the year from today's date and the term), what it covers (lectures, chapters, topics) and its weight if stated.
- The course code and name.
- The course's AI policy if stated (otherwise "").
- Rules the tutor should follow: exam format (open/closed book, calculator allowed or not, crib sheet), textbook and edition, anything students are told about how to prepare.
- The list of topics in teaching order.
Reply with only JSON: {"course":{"code":"COMP 535","name":"…"},"deadlines":[{"kind":"assignment|quiz|midterm|final|test|lab|project|other","label":"…","due_at":"2026-10-21T11:30","covers":"…","weight":"20%"}],"ai_policy":"…","rules":"…","topics":["…"]}

SYLLABUS:
${text}`);
    const out = parseJSON<Record<string, unknown>>(r.text);
    if (!out) throw new LimitError(500, "invalid_json", "Couldn't read the syllabus. Try again.");
    return out;
  },

  async announcement(ctx, job) {
    const { deadlines, courses } = await load(ctx);
    const course = courses.find((c) => c.id === job.input.course_id);
    if (!course) throw new LimitError(404, "not_found", "Course not found.");
    const ds = deadlines.filter((d: { course_id: string }) => d.course_id === course.id);
    const text = String(job.input.text ?? "").slice(0, 20_000);
    if (isDemo()) return { summary: "Demo mode: real AI would read the message and suggest changes.", deadlines: [], memory: [text.slice(0, 120)], rules_add: "" };
    const r = await ask(ctx, "announcement", `Today is ${today()}. A student pasted this message from their ${course.code} professor. Work out what it changes.
Current deadlines (id in brackets):
${ds.map((d: { id: string; kind: string; label: string | null; due_at: string; covers: string | null }) => `[${d.id}] ${d.kind} ${d.label ?? ""} due ${d.due_at} covers: ${d.covers ?? ""}`).join("\n") || "(none)"}

Reply with only JSON: {"summary":"one or two plain sentences","deadlines":[{"id":"existing id to update, or null for a new one","kind":"…","label":"…","due_at":"YYYY-MM-DDTHH:MM local","covers":"…"}],"memory":["facts worth remembering, e.g. exam room, what you can bring, office hours"],"rules_add":"exam format rules for the tutor (calculator, closed book…) or empty"}
Only include deadlines that are new or changed. Flag anything inconsistent (e.g. a weekday that doesn't match the date) in the summary.

MESSAGE:
${text}`);
    return parseJSON(r.text) ?? { summary: "Couldn't read that message.", deadlines: [], memory: [], rules_add: "" };
  },

  async plan(ctx, job) {
    const { admin, user } = ctx;
    const { profile, courses, deadlines, materials, codeOf } = await load(ctx);
    const { data: plan } = await admin.from("plans").select("*").eq("user_id", user.id).single();
    const request = typeof job.input.request === "string" ? job.input.request.trim() : "";
    const busy = (job.input.busy as { date: string; minutes: number }[] | undefined) ?? [];
    const up = deadlines.filter((d: { done: boolean; due_at: string }) => !d.done && daysUntil(d.due_at) >= 0);
    const t0 = today();
    let end = new Date(Date.now() + 13 * 86400000);
    for (const d of up) { const x = new Date(d.due_at); if (x > end && daysUntil(d.due_at) <= 60) end = x; }
    const days: string[] = [];
    for (let d = new Date(t0 + "T12:00:00Z"); d <= end; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
    const done: Record<string, boolean> = plan?.done ?? {};
    type S = { id: string; course: string; title: string; topics?: string[]; type: string; minutes: number; goal?: string; deadlineId?: string; materials?: string[] };
    const oldDays: { date: string; sessions: S[] }[] = plan?.days ?? [];
    const allOld = oldDays.flatMap((d) => d.sessions.map((s) => ({ ...s, date: d.date })));
    let instructions: { id: string; text: string; until?: string }[] = (plan?.instructions ?? []).filter((i: { until?: string }) => !i.until || i.until >= t0);

    let out: { reply?: string; keep?: string; keepUntil?: string; summary?: string; days?: { date: string; sessions: S[] }[] } | null;
    if (isDemo() || !up.length) {
      out = demoPlan(up.map((d: { id: string; course_id: string; kind: string; label: string | null; due_at: string }) => ({ ...d, course_code: codeOf(d.course_id) })), profile.study_hours, days);
      if (!up.length) out.reply = "No upcoming deadlines yet, so there's nothing to plan. Add deadlines or upload a syllabus.";
    } else {
      const byCourse = courses.map((c) => {
        const ms = (materials as Mat[]).filter((m) => m.course_id === c.id && m.status === "ready");
        const st = studyMats(materials as Mat[], c.id);
        const asg = deadlines.filter((d: { course_id: string; kind: string; done: boolean }) => d.course_id === c.id && ["assignment", "project", "lab"].includes(d.kind) && !d.done);
        return `### ${c.code}${c.name ? ` — ${c.name}` : ""}\nStudy materials (what has been taught; the syllabus for this course's tests):\n${st.length ? st.map((m) => `- "${m.file_name}"\n${outlineText(m.outline)}`).join("\n") : "(none uploaded yet; plan from the test descriptions)"}${asg.map((d: { id: string; label: string | null; kind: string }) => `\nFiles for assignment [${d.id}] ${d.label ?? d.kind}:\n${ms.filter((m) => m.deadline_id === d.id).map((m) => `- "${m.file_name}"\n${outlineText(m.outline)}`).join("\n") || "(handout not uploaded yet)"}`).join("")}`;
      }).join("\n\n");
      const revisit = (await admin.from("memory").select("course_id, text").eq("user_id", user.id).eq("kind", "revisit").eq("done", false)).data ?? [];
      const current = oldDays.filter((d) => d.date >= t0).map((d) => `${d.date}: ${d.sessions.map((s) => `[${s.id}${done[s.id] ? ", done" : ""}] ${s.course} ${s.type} "${s.title}" ${s.minutes}min`).join(" | ") || "(empty)"}`).join("\n");
      const r = await ask(ctx, "plan", `You are planning study time for a university student. Today is ${fmtDate(t0)} (${t0}). Plan every day from ${t0} through ${days.at(-1)} inclusive.

Available study hours per weekday: ${Object.entries(profile.study_hours).map(([k, v]) => `${k} ${v}`).join(", ")}.
${busy.length ? `Already busy (from the student's calendar), subtract from that day's hours:\n${busy.map((b) => `- ${b.date}: ${b.minutes} min`).join("\n")}` : ""}

${rulesBlock(profile, null)}

# Deadlines (id in brackets)
${deadlinesText(deadlines, codeOf)}

# Courses and their materials (topic outlines)
${byCourse}

# Topics the student flagged to revisit (only AFTER that course's syllabus topics are covered)
${revisit.map((r: { course_id: string; text: string }) => `- ${codeOf(r.course_id)}: ${r.text}`).join("\n") || "(none)"}

# Sessions already completed (don't repeat unless as brief review)
${allOld.filter((s) => done[s.id]).map((s) => `- ${s.course}: ${s.title}`).join("\n") || "(none)"}

# Current plan from today on (session ids in brackets)
${current || "(no plan yet)"}

# The student's standing instructions (these OVERRIDE the default rules)
${instructions.map((i) => `- ${i.text}`).join("\n") || "(none)"}
${request ? `\n# NEW REQUEST from the student (apply it now; it overrides the default rules)\n"${request}"\nChange only what the request needs; keep the rest. Turn relative dates into real dates. If it has a real cost (a deadline gets squeezed), still do it but say so in "reply".` : "\n# Why the plan is being rebuilt\nNew or changed material, deadlines or instructions. Keep the current plan where it still works."}

# Default rules
- Treat ALL of a course's study materials as the syllabus for its tests unless a test's "Covers" note narrows it. Cover every topic before the test date, naming concrete topics from the outlines.
- Assignments use what was taught: base assignment sessions on the course's study material topics; schedule a needed "learn" session before the assignment session.
- Finish assignments at least a day early where hours allow, broken into steps (understand spec, design, implement, test, write-up).
- Prioritise by date and weight (final > midterm > test > quiz). Interleave courses; at most about 2 sessions of one course per day.
- A "review" session (mixed exam-style practice) in the 1-2 days before each test.
- Each session 30-120 minutes, within each day's hours. Days with 0 hours stay empty.
- Types: "learn", "practice", "review", "assignment", "coding".
- Reuse the exact id of every current session you keep (even if moved). New sessions get ids starting with "n". Don't drop sessions marked done.

Reply with only JSON:
{"reply":"${request ? "2-4 plain sentences to the student: what changed and any trade-off" : "one sentence on what changed"}",${request ? `"keep":"the request as a short standing instruction with real dates if it should keep applying, else empty","keepUntil":"YYYY-MM-DD or empty",` : ""}"summary":"2-3 sentences on the strategy and the riskiest crunch","days":[{"date":"YYYY-MM-DD","sessions":[{"id":"…","course":"COMP 535","deadlineId":"id or empty","type":"learn","title":"…","topics":["…"],"materials":["exact file name"],"minutes":60,"goal":"…"}]}]}
Include every date in range.`);
      out = parseJSON(r.text);
      if (!out?.days) throw new LimitError(500, "invalid_json", "The plan came back in the wrong format. Try again.");
    }
    const oldIds = new Set(allOld.map((s) => s.id)), used = new Set<string>(), gen = Date.now().toString(36);
    const newDays = (out.days ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= t0).map((d) => ({
      date: d.date,
      sessions: (d.sessions ?? []).map((s) => {
        let id = String(s.id ?? ""); id = oldIds.has(id) && !used.has(id) ? id : `${gen}-${id || crypto.randomUUID().slice(0, 6)}`; used.add(id);
        return { id, course: String(s.course ?? ""), deadlineId: String(s.deadlineId ?? ""), type: String(s.type ?? "learn"), title: String(s.title ?? "Study"), topics: (s.topics ?? []).map(String).slice(0, 8), materials: (s.materials ?? []).map(String).slice(0, 6), minutes: Number(s.minutes) || 60, goal: String(s.goal ?? "") };
      }),
    }));
    const past = oldDays.filter((d) => d.date < t0 && daysUntil(d.date + "T23:59:59Z") >= -14);
    const all = [...past, ...newDays].sort((a, b) => a.date.localeCompare(b.date));
    const keep = new Set(all.flatMap((d) => d.sessions.map((s) => s.id)));
    const nextDone: Record<string, boolean> = {};
    for (const k of Object.keys(done)) if (done[k] && keep.has(k)) nextDone[k] = true;
    if (request && out.keep) instructions = [...instructions, { id: crypto.randomUUID(), text: String(out.keep).slice(0, 240), until: /^\d{4}-\d{2}-\d{2}$/.test(out.keepUntil ?? "") ? out.keepUntil : undefined }].slice(-30);
    const log = [...(plan?.change_log ?? []), ...(request ? [{ q: request, a: out.reply ?? "Done.", ts: Date.now() }] : [])].slice(-20);
    await admin.from("plans").update({ summary: out.summary ?? "", days: all, done: nextDone, instructions, change_log: log, inputs_key: String(job.input.inputs_key ?? ""), generated_at: new Date().toISOString() }).eq("user_id", user.id);
    return { reply: out.reply ?? "" };
  },

  async weekly_sheet(ctx, job) {
    const { profile, courses, deadlines, materials } = await load(ctx);
    const c = courses.find((x) => x.id === job.input.course_id);
    const m = (materials as Mat[]).find((x) => x.id === job.input.material_id && x.course_id === c?.id);
    if (!c || !m) throw new LimitError(404, "not_found", "Course or file not found.");
    const topics = (m.outline?.topics ?? []).map((t) => t.name);
    const title = m.outline?.title || m.file_name.replace(/\.[a-z0-9]+$/i, "");
    let body: string;
    if (isDemo()) body = demoDoc("weekly_sheet", title, topics);
    else {
      const qs = questionMats(materials as Mat[], c.id);
      const qsrc = qs.length ? await materialsText(ctx.admin, ctx.user.id, qs.map((q) => q.id), 15_000) : "";
      const src = await materialsText(ctx.admin, ctx.user.id, [m.id], 40_000);
      const r = await ask(ctx, "weekly_sheet", `${rulesBlock(profile, c)}${await lectureHints(ctx.admin, ctx.user.id, c.id)}

# Task
Write a MIDTERM REVISION SHEET for ${c.code}, "${title}" (preparing for ${testNote(deadlines, c.id)}). It must fully prepare the student for this lecture on the exam: everything examinable, explained openly and clearly with examples, no padding.
Very simple, friendly English. Define every term the first time. Before any formula, explain the idea in words with an everyday example; say what each symbol means. Show calculations and derivations step by step with a reason for each step. Rebuild diagrams and tables as text. Never write "see slide N". This is a written sheet: don't ask questions or pause.
Every topic below must be covered. About ${Math.min(2800, 900 + 100 * topics.length)} words. Markdown and LaTeX ($…$ inline, $$…$$ display).

Topics:
${topics.map((t) => `- ${t}`).join("\n")}

Structure:
## ${title}
**The big picture** — 2-4 sentences.
One ### section per main idea: plain explanation, example or analogy, formula or definition with every symbol explained, a small worked example when there's something to calculate, then "**In simple terms:**".
### Derivations you must be able to do (only if any could be asked; numbered steps with reasons)
### Exam questions and how to answer them (3-5 types: how it's worded → steps → fully worked example${qsrc ? "; name and solve matching sample/practice questions" : ""})
### Traps (2-4 common mistakes)
### 60-second recap (5-7 bullets)

After the sheet write "===SKIPPED===" and list anything left out as not important for the exam ("- what — why"), or "- none".
${qsrc ? `\n# Sample midterm / practice questions\n${qsrc}` : ""}

# Lecture material
${src}`);
      body = r.text;
    }
    const { md, skipped } = splitSkipped(body);
    await countUse(ctx, "weekly_sheet");
    const { data: doc } = await ctx.admin.from("documents").insert({ user_id: ctx.user.id, course_id: c.id, kind: "weekly_sheet", title, body: md, meta: { material_id: m.id, skipped } }).select("id").single();
    return { document_id: doc?.id };
  },

  async exam_sheet(ctx, job) { return examDoc(ctx, job, "exam_sheet"); },
  async derivation_sheet(ctx, job) { return examDoc(ctx, job, "derivation_sheet"); },

  async paper(ctx, job) {
    const { profile, courses, deadlines, materials } = await load(ctx);
    const c = courses.find((x) => x.id === job.input.course_id);
    if (!c) throw new LimitError(404, "not_found", "Course not found.");
    const st = studyMats(materials as Mat[], c.id);
    const idx = st.flatMap((m, i) => (m.outline?.topics ?? []).map((t, j) => ({ id: `L${i + 1}.${j + 1}`, file: m.file_name, t: t.name })));
    const { data: prev } = await ctx.admin.from("documents").select("meta").eq("user_id", ctx.user.id).eq("course_id", c.id).eq("kind", "paper");
    const n = Math.max(0, ...(prev ?? []).map((p: { meta: { n?: number } }) => p.meta?.n ?? 0)) + 1;
    const hit = new Set((prev ?? []).flatMap((p: { meta: { covered?: string[] } }) => p.meta?.covered ?? []));
    const focus = typeof job.input.focus === "string" ? job.input.focus.slice(0, 300) : "";
    let text: string;
    if (isDemo()) text = demoDoc("paper", `Practice paper ${n}`, idx.map((x) => x.t));
    else {
      const qs = questionMats(materials as Mat[], c.id);
      const qsrc = qs.length ? await materialsText(ctx.admin, ctx.user.id, qs.map((q) => q.id), 20_000) : "";
      const r = await ask(ctx, "paper", `${rulesBlock(profile, c)}${await lectureHints(ctx.admin, ctx.user.id, c.id)}

# Task
Write PRACTICE PAPER ${n} for ${c.code} to prepare for: ${testNote(deadlines, c.id, job.input.deadline_id as string | undefined)}.
${qsrc ? "Copy the format, style, difficulty and mark scheme of the real sample paper below, but make it a bit longer, like the real exam." : "No sample paper was uploaded; use a typical university midterm format."} Follow the exam conditions in the course rules (e.g. whether a calculator is allowed); if not stated, assume closed book with no calculator and use clean numbers.

# Syllabus (topic ids in brackets)
${st.map((m) => `## ${m.file_name}\n${idx.filter((x) => x.file === m.file_name).map((x) => `[${x.id}] ${x.t}`).join("\n")}`).join("\n\n") || "(no outlines yet)"}

# Earlier papers (don't repeat their questions; use different scenarios, numbers and styles)
${(prev ?? []).map((p: { meta: { n?: number; qlist?: string[] } }) => `Paper ${p.meta?.n}: ${(p.meta?.qlist ?? []).join(" | ")}`).join("\n") || "(none yet)"}

# Topics no paper has tested yet (prioritise the important ones)
${idx.filter((x) => !hit.has(x.id)).map((x) => `[${x.id}] ${x.t}`).join("\n") || "(all tested once; vary angles and difficulty)"}
${focus ? `\n# The student asked this paper to focus on\n${focus}\n` : ""}
# Rules
- Spread the paper across the whole syllabus, extra weight on untested topics, still including core topics in a fresh form.
- Mix styles: calculations, derivations (if examined), short explanations, compare/contrast, trace an algorithm, "what happens if", true/false with reason. A different mix from earlier papers.
- Marks for every question and part, plus a suggested total time.
- Put each question's answer DIRECTLY AFTER it. Answers in very simple English; explain any term you must use; show all working so anyone could recreate it. Each answer uses these headings: **What the question is really asking**, **What you need to know**, **How to do it in the exam** (numbered steps with working and reasons), **Final answer**, **Quick check**, **If you see this type again**.

# Output format (exact marker lines)
===PAPER===
# Practice paper ${n}
(instructions, time, total marks)
### Question 1 (marks)
…
===ANSWER===
…
===END ANSWER===
…every question the same way…
===META===
{"covered":["L1.2","…every topic id tested"],"qlist":["Q1 (calculation): one-line summary","…"]}
${qsrc ? `\n# Real sample paper (for format and style)\n${qsrc}` : ""}`);
      text = r.text + (r.truncated ? "\n\n> *The paper was cut off because it was very long.*" : "");
    }
    const metaMatch = text.match(/^[ \t]*=+[ \t]*META[ \t]*=+[ \t]*$([\s\S]*)/im);
    let meta: { covered?: string[]; qlist?: string[] } = {};
    if (metaMatch) meta = parseJSON(metaMatch[1]) ?? {};
    const paper = (metaMatch ? text.slice(0, metaMatch.index) : text).replace(/^[\s\S]*?^[ \t]*=+[ \t]*PAPER[ \t]*=+[ \t]*$/im, "").trim();
    const valid = new Set(idx.map((x) => x.id));
    await countUse(ctx, "paper");
    const { data: doc } = await ctx.admin.from("documents").insert({
      user_id: ctx.user.id, course_id: c.id, kind: "paper", title: `Practice paper ${n}`, body: paper,
      meta: { n, focus, covered: (meta.covered ?? []).map(String).filter((x) => valid.has(x)), qlist: (meta.qlist ?? []).map(String).slice(0, 20), total_topics: idx.length },
    }).select("id").single();
    return { document_id: doc?.id };
  },
};

async function examDoc(ctx: Ctx, job: Job, kind: "exam_sheet" | "derivation_sheet") {
  const { profile, courses, deadlines, materials } = await load(ctx);
  const c = courses.find((x) => x.id === job.input.course_id);
  if (!c) throw new LimitError(404, "not_found", "Course not found.");
  const st = studyMats(materials as Mat[], c.id);
  const title = `${c.code} ${kind === "exam_sheet" ? "exam cheat sheet" : "derivation sheet"}`;
  let body: string;
  if (isDemo()) body = demoDoc(kind, title, st.flatMap((m) => (m.outline?.topics ?? []).map((t) => t.name)));
  else {
    const { data: weekly } = await ctx.admin.from("documents").select("body, meta").eq("user_id", ctx.user.id).eq("course_id", c.id).eq("kind", "weekly_sheet");
    const covered = new Set((weekly ?? []).map((w: { meta: { material_id?: string } }) => w.meta?.material_id));
    const src = kind === "exam_sheet" && st.length && st.every((m) => covered.has(m.id))
      ? `# The student's per-lecture revision sheets\n${(weekly ?? []).map((w: { body: string }) => w.body).join("\n\n").slice(0, 90_000)}`
      : `${st.map((m) => `# ${m.file_name}\nTopics:\n${outlineText(m.outline)}`).join("\n\n")}\n\n# Lecture material\n${await materialsText(ctx.admin, ctx.user.id, st.map((m) => m.id), 80_000)}`;
    const qs = questionMats(materials as Mat[], c.id);
    const qsrc = qs.length ? await materialsText(ctx.admin, ctx.user.id, qs.map((q) => q.id), 12_000) : "";
    const task = kind === "exam_sheet"
      ? `Write the complete EXAM CHEAT SHEET for ${c.code}, for: ${testNote(deadlines, c.id, job.input.deadline_id as string | undefined)}. Cover the WHOLE exam syllabus in 3-5 printed pages (about 2000-3000 words).
- Organise by lecture/topic in syllabus order with short headings.
- Per topic: key ideas as one-line bullets in very simple English (define terms in a few words); every formula with what each symbol means and when to use it; "when to use what" rules; comparison tables where things are easy to mix up.
- Short practice examples: one tiny worked example per calculation type (numbers suited to the exam's calculator rules).
- "Common traps" lines where useful. NO derivations (there is a separate derivation sheet). No "see slide N".`
      : `Write the DERIVATION SHEET for ${c.code} (${testNote(deadlines, c.id, job.input.deadline_id as string | undefined)}). The student must rebuild each derivation from memory in a closed-book exam.
For EVERY derivation that could be asked, grouped under a ## heading per lecture:
### <What is being derived>
- **What and why:** one or two plain sentences.
- **Start from:** assumptions and definitions, every symbol explained.
- **Steps:** numbered; each shows the math AND a short plain-English reason.
- **Result:** the final formula as a display equation.
- **Memory hook:** one line summarising the chain of steps.
If a lecture has no derivations, say so in one line. Very simple English. No "see slide N".`;
    const r = await ask(ctx, kind, `${rulesBlock(profile, c)}${await lectureHints(ctx.admin, ctx.user.id, c.id)}\n\n# Task\n${task}\nMarkdown with LaTeX ($…$ inline, $$…$$ display).${qsrc ? `\n\n# Sample questions (to know what matters most)\n${qsrc}` : ""}\n\n${src}`);
    body = r.text + (r.truncated ? "\n\n> *Cut off because it was very long. Generate it again to retry.*" : "");
  }
  const { md } = splitSkipped(body);
  await countUse(ctx, kind);
  const { data: doc } = await ctx.admin.from("documents").insert({ user_id: ctx.user.id, course_id: c.id, kind, title, body: md, meta: { deadline_id: job.input.deadline_id ?? null } }).select("id").single();
  return { document_id: doc?.id };
}
