// Demo mode: realistic, free stand-ins for every AI job so the whole app can be tested without an API key.
import type { Outline } from "./prompts.ts";

export function demoOutline(text: string, name: string): Outline {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const topics: { name: string; where?: string }[] = [];
  let where = "";
  for (const l of lines) {
    const m = l.match(/^\[(p\.|slide) (\d+)\]$/);
    if (m) { where = `${m[1] === "p." ? "p." : "slide"} ${m[2]}`; continue; }
    if (l.length >= 4 && l.length <= 60 && /^[A-Z0-9]/.test(l) && !/[.,;:]$/.test(l) && !topics.some((t) => t.name === l)) {
      topics.push({ name: l, where });
      if (topics.length >= 15) break;
    }
  }
  return { kind: /assign|lab|project|homework|pa\d/i.test(name) ? "assignment" : "lecture", title: name.replace(/\.[a-z0-9]+$/i, ""), topics: topics.length ? topics : [{ name: "Main ideas (demo outline)" }] };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function demoSyllabus(text: string) {
  const code = text.match(/\b([A-Z]{3,4})[\s-]?(\d{3}[A-Z]?)\b/);
  const deadlines: { kind: string; label: string; due_at: string; covers: string; weight: string }[] = [];
  const re = /(midterm|final exam|quiz|assignment|project|lab|test)[^\n]{0,80}?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/gi;
  const now = new Date();
  for (const m of text.matchAll(re)) {
    const month = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3));
    let year = now.getUTCFullYear();
    const d = new Date(Date.UTC(year, month, Number(m[3]), 23, 59));
    if (d.getTime() < now.getTime() - 120 * 86400000) d.setUTCFullYear(++year);
    const k = m[1].toLowerCase();
    deadlines.push({ kind: k.startsWith("final") ? "final" : k === "test" ? "test" : k, label: m[0].slice(0, 40).trim(), due_at: d.toISOString(), covers: "", weight: "" });
    if (deadlines.length >= 12) break;
  }
  return {
    course: { code: code ? `${code[1]} ${code[2]}` : "", name: "" },
    deadlines: deadlines.length ? deadlines : [{ kind: "assignment", label: "Demo assignment", due_at: new Date(Date.now() + 9 * 86400000).toISOString(), covers: "", weight: "" }],
    ai_policy: "", rules: "", topics: [],
    note: "Demo mode: deadlines were found with simple pattern matching. Real AI reads the whole syllabus.",
  };
}

type D = { id: string; course_code: string; kind: string; label: string | null; due_at: string };
export function demoPlan(deadlines: D[], hours: Record<string, number>, days: string[]) {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let n = 0;
  return {
    reply: "Demo plan: one session a day for each upcoming deadline, spread out until it's due.",
    summary: "Demo plan built without AI: each deadline gets a daily session until its due date, within your study hours.",
    days: days.map((date) => {
      const cap = (hours[dow[new Date(date + "T12:00:00Z").getUTCDay()]] ?? 3) * 60;
      let used = 0;
      const sessions = [];
      for (const d of deadlines) {
        if (d.due_at.slice(0, 10) < date || used + 60 > cap) continue;
        used += 60;
        sessions.push({ id: `n${++n}`, course: d.course_code, deadlineId: d.id, type: d.kind === "assignment" || d.kind === "project" || d.kind === "lab" ? "assignment" : "review", title: `${d.kind[0].toUpperCase() + d.kind.slice(1)} prep${d.label ? `: ${d.label}` : ""}`, topics: [], minutes: 60, goal: "Demo session" });
      }
      return { date, sessions };
    }),
  };
}

export function demoDoc(kind: string, title: string, topics: string[]): string {
  const list = topics.slice(0, 8).map((t) => `- ${t}`).join("\n") || "- (topics from your outlines appear here)";
  if (kind === "paper") {
    return `===PAPER===\n# ${title}\n*Demo paper (real AI is off). 60 minutes, 30 marks.*\n\n### Question 1 (10 marks)\nExplain the first key idea in your own words and give an example.\n===ANSWER===\n**What the question is really asking:** a plain explanation plus an example.\n\n**How to do it in the exam:**\n1. Define the idea in one sentence.\n2. Give a small concrete example.\n\n**Final answer:** (real answers appear once AI is on)\n===END ANSWER===\n### Question 2 (20 marks)\nCalculate $x$ when $2x + 3 = 11$.\n===ANSWER===\n**How to do it in the exam:**\n1. Subtract 3: $2x = 8$.\n2. Divide by 2: $x = 4$.\n\n**Final answer:** $x = 4$\n===END ANSWER===\n===META===\n{"covered":[],"qlist":["Q1 (explain): key idea","Q2 (calculation): linear equation"]}`;
  }
  return `## ${title}\n*Demo ${kind.replace("_", " ")} (real AI is off). With AI on, every topic below is explained simply, with examples and exam questions.*\n\n**Topics covered:**\n${list}\n\n**Example formula:** $$a^2 + b^2 = c^2$$\n\n**In simple terms:** this is placeholder text so the screens can be tested.\n===SKIPPED===\n- none`;
}

export function demoChat(question: string): string {
  const q = question.length > 120 ? question.slice(0, 120) + "…" : question;
  return `**Demo answer** (real AI isn't switched on yet)\n\nYou asked: _${q}_\n\n**The big idea:** a short, plain-English explanation comes first.\n\n**Example:** then a small, concrete example.\n\n**The formula:** $$E = mc^2$$ where $E$ is energy, $m$ is mass and $c$ is the speed of light.\n\n**In simple terms:** a one-line summary to remember.`;
}

export function demoRecording(text: string, name: string): Outline {
  const o = demoOutline(text, name);
  const hints = (text.match(/[^.!?\n]*(exam|midterm|final|important|will be on|know this|test you)[^.!?\n]*[.!?]/gi) ?? []).map((x) => x.trim()).slice(0, 4);
  return { ...o, kind: "recording", exam_hints: hints, style: ["(Demo mode: real AI notes how your lecturer explains things here.)"] };
}
export const DEMO_TRANSCRIPT = "[t. 0:00]\n(Demo mode: the recording would be transcribed here once transcription is turned on. For now, upload the captions file (.vtt or .srt) from Panopto, Zoom, YouTube or Echo360 instead.)";
