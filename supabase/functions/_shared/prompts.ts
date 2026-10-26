// The teaching rules and context every AI request is built from (ported from the Study Hub).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const STYLE_PRESETS: Record<string, { name: string; rules: string }> = {
  simple: { name: "Explain simply", rules: `- Use plain, everyday English: short sentences, common words, one idea per sentence.
- Explain every technical term in simple words the first time it appears.
- For each new idea: first say what it is and why it matters, then give an everyday example or analogy, and only then the formal definition or formula.
- For every formula, say what each symbol means and what the formula is telling us.
- After a hard idea, add a one-line "In simple terms:" summary.` },
  exam: { name: "Exam-focused", rules: `- Focus on what gets examined: definitions, formulas, standard question types and how to answer them.
- For each topic show: how it is usually asked, the steps to answer, a worked example, and common traps.
- End with a few exam-style practice questions; give the questions first and the solutions only after the student answers or asks.` },
  maths: { name: "Step-by-step maths", rules: `- Teach the background maths a topic needs before the topic itself.
- Show every step of every derivation and calculation, with a short reason for each step.
- Never show a formula before it has been motivated from things the student already knows.
- Make each transition explicit: say why we move from one idea or formula to the next.` },
  lecture: { name: "Lecture style", rules: `- Go through the material one lecture or topic at a time, in the order it was taught; never skip ahead.
- Before teaching, list every sub-topic the lecture contains (every definition, formula, algorithm, worked example) and teach them all in order.
- Split a long lecture into about 3 parts and stop at the end of each part until the student says continue.
- End each lecture with a short coverage checklist and a few practice questions (questions first, solutions after).` },
  quick: { name: "Quick revision", rules: `- Be brief and dense: bullet points, key formulas, the must-know facts.
- One short example only when it really helps. No long explanations unless asked.` },
};

export const UNIVERSAL_RULES = `- Nothing examinable in the material may be skipped. If something is left for later, say so.
- The chat must stand on its own: name the source once at the top of a topic (e.g. "Source: Lecture 9 slides"), then teach the content itself. Never say "see slide 12" or "as shown in the figure"; rebuild diagrams, tables and examples in text.
- Use simple, plain language and explain technical terms in simple words.`;

export const RESHAPE: Record<string, string> = {
  simpler: "Rewrite your previous answer more simply: plainer words, shorter sentences, an everyday analogy, and no unexplained jargon. Keep everything that matters.",
  detail: "Rewrite your previous answer with more detail and depth: fill in steps, edge cases and the reasoning behind each point.",
  maths: "Rewrite your previous answer more mathematically: precise definitions, notation, and every derivation step shown with reasons.",
  intuition: "Rewrite your previous answer with more intuition and theory: why it works, the big-picture idea, and how it connects to other topics.",
  example: "Rewrite your previous answer around concrete worked examples: show at least one fully worked example step by step.",
  like_lecture: "Rewrite your previous answer the way my lecturer explained it in the lecture recordings: use their order, running examples, analogies, notation and phrasing from the transcripts, and point out anything they said matters for the exam. If the recordings don't cover a point, say so briefly and explain it in the same spirit.",
  quiz: "Turn your previous answer into a short quiz: 3-5 questions that test the key points. Give the questions only; hold the answers until I reply.",
};

export type Profile = { teaching_style: string; custom_rules: string | null; integrity_mode: boolean; school: string | null; country: string | null; study_hours: Record<string, number> };
export type Course = { id: string; code: string; name: string | null; rules: string | null; ai_policy: string | null; teaching_style: string | null };

export function rulesBlock(p: Profile, c: Course | null, styleOverride?: string | null, modifier?: string | null): string {
  const key = styleOverride || c?.teaching_style || p.teaching_style || "simple";
  const style = key === "custom" ? { name: "Custom", rules: p.custom_rules || STYLE_PRESETS.simple.rules } : (STYLE_PRESETS[key] ?? STYLE_PRESETS.simple);
  let out = `# How to teach (style: ${style.name})\n${style.rules}\n${UNIVERSAL_RULES}`;
  if (modifier) out += `\n- The student asked for this for the rest of the chat: ${modifier}`;
  if (p.integrity_mode) out += `\n\n# Academic integrity (on)\nFor graded work (assignments, projects, take-home tests): explain concepts, help understand the task, help plan an approach, and review or debug work the student wrote. Do not write answers, code or text the student would submit. Studying for tests: anything goes.`;
  out += `\n\n# The student\n${p.school ? `Studies at ${p.school}` : "University or college student"}${p.country === "GB" ? " in the UK" : p.country === "CA" ? " in Canada" : ""}.`;
  if (c) out += `\n\n# ${c.code}${c.name ? ` — ${c.name}` : ""}\nCourse AI policy: ${c.ai_policy || "not recorded"}${c.rules ? `\nCourse rules: ${c.rules}` : ""}`;
  return out;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
export const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

type Deadline = { id: string; course_id: string; kind: string; label: string | null; due_at: string; covers: string | null; done: boolean };
export function deadlinesText(ds: Deadline[], codeOf: (id: string) => string): string {
  const up = ds.filter((d) => !d.done && daysUntil(d.due_at) >= 0).sort((a, b) => a.due_at.localeCompare(b.due_at));
  return up.length ? up.map((d) => `- [${d.id}] ${codeOf(d.course_id)} ${d.kind}${d.label ? ` (${d.label})` : ""} due ${fmtDate(d.due_at)} (in ${daysUntil(d.due_at)} days)${d.covers ? `. Covers: ${d.covers}` : ""}`).join("\n") : "(none)";
}

export type Outline = { kind?: string; title?: string; topics?: { name: string; where?: string; summary?: string }[]; exam_hints?: string[]; style?: string[] };
export const outlineText = (o: Outline | null) => (o?.topics ?? []).map((t) => `  - ${t.name}${t.where ? ` [${t.where}]` : ""}`).join("\n");

/** Loads the full text of materials and shrinks them evenly to fit a character budget. */
export async function materialsText(admin: SupabaseClient, uid: string, ids: string[], budget: number): Promise<string> {
  if (!ids.length) return "";
  const { data: mats } = await admin.from("materials").select("id, file_name").eq("user_id", uid).in("id", ids);
  const { data: chunks } = await admin.from("material_chunks").select("material_id, n, text").eq("user_id", uid).in("material_id", ids).order("n");
  const texts = new Map<string, string>();
  for (const c of chunks ?? []) texts.set(c.material_id, (texts.get(c.material_id) ?? "") + c.text);
  const total = [...texts.values()].reduce((a, t) => a + t.length, 0);
  const k = total > budget ? budget / total : 1;
  return (mats ?? []).map((m) => {
    const t = texts.get(m.id) ?? "";
    const n = Math.floor(t.length * k);
    return `## ${m.file_name}\n${t.slice(0, n)}${n < t.length ? "\n[…shortened to fit]" : ""}`;
  }).join("\n\n");
}

/** What lecturers said about the exam in their recordings, for exam prep prompts. */
export async function lectureHints(admin: SupabaseClient, uid: string, courseId: string): Promise<string> {
  const { data } = await admin.from("memory").select("text").eq("user_id", uid).eq("course_id", courseId).eq("source", "lecture").eq("done", false).limit(40);
  return data?.length ? `\n\n# What the lecturer said about the exam (from lecture recordings: weigh these heavily)\n${data.map((m: { text: string }) => `- ${m.text}`).join("\n")}` : "";
}
