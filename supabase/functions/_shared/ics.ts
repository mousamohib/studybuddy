// Reads school calendar feeds (.ics) from Brightspace/D2L, Canvas, Moodle and Blackboard and turns
// their events into deadlines: which course, what kind, a clean label and the due time.

export type IcsEvent = { uid: string; summary: string; description: string; location: string; categories: string; url: string; due: Date | null; allDay: boolean };
export type Kind = "assignment" | "quiz" | "midterm" | "final" | "test" | "lab" | "project" | "other";

/** Unfolds and parses the VEVENTs. tzOffsetMin is the student's offset (Date.getTimezoneOffset) for floating times. */
export function parseIcs(text: string, tzOffsetMin = 0): IcsEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur) {
        const start = cur["DTSTART"], end = cur["DTEND"] ?? cur["DUE"];
        // Due-date events usually put the due time in DTSTART; all-day events are due by the end of that day.
        const pick = start ?? end;
        const parsed = pick ? parseDate(pick.value, pick.params, tzOffsetMin) : null;
        out.push({
          uid: unescape(cur["UID"]?.value ?? ""), summary: unescape(cur["SUMMARY"]?.value ?? ""),
          description: unescape(cur["DESCRIPTION"]?.value ?? ""), location: unescape(cur["LOCATION"]?.value ?? ""),
          categories: unescape(cur["CATEGORIES"]?.value ?? ""), url: unescape(cur["URL"]?.value ?? ""),
          due: parsed?.date ?? null, allDay: parsed?.allDay ?? false,
        });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const [name, ...params] = head.split(";");
    cur[name.toUpperCase()] = { params: params.join(";"), value };
  }
  return out;
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

function parseDate(v: string, params: string, tzOffsetMin: number): { date: Date; allDay: boolean } | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) {
    // All-day: due at 23:59 the student's local time.
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, 23, 59) + tzOffsetMin * 60000), allDay: true };
  }
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), allDay: false };
  const tz = params.match(/TZID=("?)([^";:]+)\1/)?.[2];
  if (tz) { const dt = zoned(+y, +mo, +d, +h, +mi, tz); if (dt) return { date: dt, allDay: false }; }
  return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi) + tzOffsetMin * 60000), allDay: false };
}

/** Wall-clock time in an IANA zone → the real instant. */
function zoned(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date | null {
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi);
    const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const offsetAt = (t: number) => {
      const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - t;
    };
    let t = guess - offsetAt(guess);
    t = guess - offsetAt(t);
    return new Date(t);
  } catch { return null; }
}

const ASSESS = /\b(assignment|assign|quiz|midterm|mid-term|exam|final|test|lab|project|homework|hw\s?\d|due|submission|submit|deliverable|report|presentation|essay|paper|problem set|pset|ps\s?\d|pa\s?\d|a\s?\d{1,2}\b|tutorial \d|worksheet|reflection|proposal|milestone|demo|portfolio|coursework)/i;
const NOT_DUE = /(availability (starts|begins)|\bopens?\b|start date|unlock|release[sd]?\b|office hours?|lecture\b|class meeting|\bseminar\b(?!.*due))/i;

export function isAssessment(e: IcsEvent): boolean {
  if (NOT_DUE.test(e.summary)) return false;
  if (/\/assignments?\/|\/quiz(zes)?\/|mod\/(assign|quiz)|dropbox|grades/i.test(e.url)) return true;
  return ASSESS.test(e.summary);
}

export function kindOf(s: string): Kind {
  const t = s.toLowerCase();
  if (/\bfinal\b/.test(t) && /exam|test|\bfinal\b$/.test(t)) return "final";
  if (/mid-?term/.test(t)) return "midterm";
  if (/\bquiz/.test(t)) return "quiz";
  if (/\bexam\b|\btest\b/.test(t)) return "test";
  if (/\blab\b/.test(t)) return "lab";
  if (/project|milestone|proposal|presentation|demo\b/.test(t)) return "project";
  return "assignment";
}

/** "PA2 - Due [COMP 535-001 Fall 2026]" → "PA2" */
export function cleanLabel(s: string): string {
  return s.replace(/\[[^\]]*\]/g, "")
    .replace(/\s*[-–:]\s*(due|availability ends|ends|end date|deadline|closes?)\s*$/i, "")
    .replace(/^(due|deadline)\s*[:\-–]\s*/i, "")
    .replace(/\s+is due$/i, "")
    .replace(/\s{2,}/g, " ").trim().slice(0, 80);
}

/** Course codes like "COMP 535", "ECSE-551", "MATH1001", "CS 61A". */
const CODE = /\b([A-Z]{2,5})[\s\-_]?(\d{3,4}[A-Z]?)\b/g;
export const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");
const NOT_CODES = /^(FALL|TERM|YEAR|ROOM|SEM|SECT|SEC|AUT|AUTU|SPR|SUM|WIN|WINT|LEC|PAGE|WEEK|UNIT|DUE|CLASS|LAB|QUIZ|PART|CH|CHAP|PG|PP|NOV|DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|AT|BY|ON|TO|UTC|EST|EDT|BST|GMT|PST|PDT|MST|CST|CDT|ID|NO|TEL|EXT)$/;
export function codesIn(text: string): string[] {
  return [...text.toUpperCase().matchAll(CODE)].filter((m) => !NOT_CODES.test(m[1])).map((m) => `${m[1]} ${m[2]}`);
}

/** Finds which of the student's courses an event belongs to. */
export function matchCourse<C extends { id: string; code: string }>(e: IcsEvent, courses: C[]): C | null {
  const hay = [e.summary, e.location, e.categories, e.url, e.description.slice(0, 400)].join(" \n ");
  const found = new Set(codesIn(hay).map(normCode));
  const hit = courses.find((c) => found.has(normCode(c.code)));
  if (hit) return hit;
  // Codes written oddly in the app (e.g. "COMP535" vs "COMP-535") are handled by normCode; last try: plain substring.
  const flat = normCode(hay);
  return courses.find((c) => normCode(c.code).length >= 6 && flat.includes(normCode(c.code))) ?? null;
}

export function guessLabel(url: string): string {
  if (/instructure|canvas/i.test(url)) return "Canvas";
  if (/d2l|brightspace|mycourses|\/feed\/calendar/i.test(url)) return "Brightspace";
  if (/moodle|calendar\/export_execute/i.test(url)) return "Moodle";
  if (/blackboard|bbcswebdav|learn\./i.test(url)) return "Blackboard";
  return "School calendar";
}
