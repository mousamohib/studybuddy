// Connects a school calendar feed and keeps deadlines in step with it. No AI, so it's free to run.
//   {action:"add", url, tz}     save the link, then sync it
//   {action:"sync", tz, id?}    sync one or all of the student's feeds
//   {action:"remove", id}       forget a feed (deadlines it added stay)
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { cors, getCtx, json } from "../_shared/http.ts";
import { cleanLabel, codesIn, guessLabel, isAssessment, kindOf, matchCourse, normCode, parseIcs } from "../_shared/ics.ts";

type Feed = { id: string; url: string; label: string | null };
type Result = { added: number; updated: number; linked: number; matched: number; skipped: number; unmatched: { code: string; count: number }[]; error?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await getCtx(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const body = await req.json().catch(() => ({}));
  const tz = Number.isFinite(body.tz) ? Number(body.tz) : 0;

  if (body.action === "remove") {
    await admin.from("calendar_feeds").delete().eq("id", body.id).eq("user_id", user.id);
    return json(200, { ok: true });
  }

  if (body.action === "add") {
    const url = normaliseUrl(String(body.url ?? ""));
    if (!url) return json(400, { code: "bad_url", message: "That doesn't look like a calendar link. It should start with https:// or webcal://." });
    // Check it really is a calendar before saving it.
    const probe = await fetchIcs(url);
    if ("error" in probe) return json(400, { code: "bad_feed", message: probe.error });
    const { data: feed, error } = await admin.from("calendar_feeds").upsert({ user_id: user.id, url, label: guessLabel(url) }, { onConflict: "user_id,url" }).select("id, url, label").single();
    if (error) return json(500, { code: "failed", message: error.message });
    const result = await syncFeed(admin, user.id, feed as Feed, tz, probe.text);
    return json(200, { feed, result });
  }

  // sync
  let q = admin.from("calendar_feeds").select("id, url, label").eq("user_id", user.id);
  if (body.id) q = q.eq("id", body.id);
  const { data: feeds } = await q;
  const results: Record<string, Result> = {};
  for (const f of (feeds ?? []) as Feed[]) results[f.id] = await syncFeed(admin, user.id, f, tz);
  return json(200, { results });
});

function normaliseUrl(raw: string): string | null {
  let u = raw.trim().replace(/^webcals?:\/\//i, "https://");
  if (!/^https?:\/\//i.test(u)) return null;
  try { const p = new URL(u); if (["localhost", "127.0.0.1"].includes(p.hostname) || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(p.hostname)) return null; u = p.toString(); } catch { return null; }
  return u;
}

async function fetchIcs(url: string): Promise<{ text: string } | { error: string }> {
  try {
    const r = await fetch(url, { headers: { accept: "text/calendar, */*" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (r.status === 401 || r.status === 403) return { error: "Your school's site refused the link. Copy a fresh calendar link (the private subscribe/export one) and try again." };
    if (!r.ok) return { error: `Your school's site answered with an error (${r.status}). Check the link and try again.` };
    const text = (await r.text()).slice(0, 6_000_000);
    if (!/BEGIN:VCALENDAR/i.test(text)) return { error: "That link opens a web page, not a calendar feed. Use the Subscribe / Export / Calendar feed link instead." };
    return { text };
  } catch {
    return { error: "Couldn't reach that link. Check it, or try again in a minute." };
  }
}

async function syncFeed(admin: SupabaseClient, uid: string, feed: Feed, tz: number, prefetched?: string): Promise<Result> {
  const res: Result = { added: 0, updated: 0, linked: 0, matched: 0, skipped: 0, unmatched: [] };
  const got = prefetched ? { text: prefetched } : await fetchIcs(feed.url);
  if ("error" in got) {
    res.error = got.error;
    await admin.from("calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_result: res }).eq("id", feed.id);
    return res;
  }
  const [{ data: courses }, { data: existing }] = await Promise.all([
    admin.from("courses").select("id, code").eq("user_id", uid),
    admin.from("deadlines").select("id, course_id, kind, label, due_at, done, source_uid").eq("user_id", uid),
  ]);
  const ds = (existing ?? []) as { id: string; course_id: string; kind: string; label: string | null; due_at: string; done: boolean; source_uid: string | null }[];
  const now = Date.now();
  const unmatched = new Map<string, number>();
  const seen = new Set<string>();

  for (const e of parseIcs(got.text, tz)) {
    if (!e.due || !e.uid) continue;
    const t = e.due.getTime();
    if (t < now - 14 * 864e5 || t > now + 240 * 864e5) continue;      // only this term
    if (!isAssessment(e)) { res.skipped++; continue; }
    const course = matchCourse(e, (courses ?? []) as { id: string; code: string }[]);
    if (!course) {
      const code = codesIn([e.summary, e.location, e.categories, e.description.slice(0, 300)].join(" "))[0];
      if (code) unmatched.set(code, (unmatched.get(code) ?? 0) + 1); else res.skipped++;
      continue;
    }
    res.matched++;
    const kind = kindOf(e.summary);
    const label = cleanLabel(e.summary) || null;
    const due_at = e.due.toISOString();
    const key = `${course.id}|${normCode(label ?? "")}|${due_at.slice(0, 10)}`;
    if (seen.has(key)) continue;                                        // "Due" and "Availability ends" for the same thing
    seen.add(key);
    const source_uid = `${feed.id}:${e.uid}`.slice(0, 300);

    const mine = ds.find((d) => d.source_uid === source_uid);
    if (mine) {
      if (Math.abs(new Date(mine.due_at).getTime() - t) > 60_000 || mine.label !== label) {
        await admin.from("deadlines").update({ due_at, label }).eq("id", mine.id);
        res.updated++;
      }
      continue;
    }
    // Same thing already added from the syllabus (same course and kind, within 2 days)? Link it instead of duplicating.
    const twin = ds.find((d) => !d.source_uid && d.course_id === course.id && d.kind === kind && Math.abs(new Date(d.due_at).getTime() - t) < 2 * 864e5);
    if (twin) {
      await admin.from("deadlines").update({ source_uid, due_at, label: twin.label || label }).eq("id", twin.id);
      twin.source_uid = source_uid; res.linked++;
      continue;
    }
    const { error } = await admin.from("deadlines").insert({ user_id: uid, course_id: course.id, kind, label, due_at, covers: null, source: "calendar", source_uid });
    if (!error) res.added++;
  }
  res.unmatched = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, count]) => ({ code, count }));
  await admin.from("calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_result: res }).eq("id", feed.id);
  return res;
}
