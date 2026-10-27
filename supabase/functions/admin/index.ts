// Admin dashboard API. Only accounts whose email is in the ADMIN_EMAILS secret get in.
// Gives aggregate stats and account-level controls. It never returns students' chats, files or notes.
//   {action:"me"} → {admin:true}           {action:"overview"}
//   {action:"users", q?, page?}             {action:"user", id}
//   {action:"set_plan", id, plan}           {action:"reset_usage", id}
//   {action:"ban", id} / {action:"unban", id}   {action:"delete_user", id}
//   {action:"reports"} / {action:"resolve_report", id}
//   {action:"settings"} / {action:"save_settings", settings}   {action:"log"}
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";
import { getSettings } from "../_shared/ai.ts";
import { cors, getCtx, json } from "../_shared/http.ts";

const PRICE_GBP = 6.99; // monthly Pro price, for the revenue estimate until payments report real amounts

const admins = () => (Deno.env.get("ADMIN_EMAILS") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const month = () => new Date().toISOString().slice(0, 7);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

/** Reads every row of a table (PostgREST returns at most 1000 per request). */
async function all<T>(admin: SupabaseClient, table: string, cols: string, filter?: (q: any) => any): Promise<T[]> { // deno-lint-ignore no-explicit-any
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function allUsers(admin: SupabaseClient): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

type Prof = { id: string; display_name: string | null; school: string | null; country: string | null; onboarded: boolean };
type Sub = { user_id: string; plan: string; trial_ends_at: string | null; granted_by_admin: boolean };
type Use = { user_id: string; uploads: number; tutor_messages: number; weekly_sheets: number; exam_sheets: number; papers: number; cost_usd: number };

/** Everything the dashboard needs, loaded once per request. */
async function load(admin: SupabaseClient) {
  const [users, profiles, subs, usage, courses, materials, chats, jobs, feeds] = await Promise.all([
    allUsers(admin),
    all<Prof>(admin, "profiles", "id, display_name, school, country, onboarded"),
    all<Sub>(admin, "subscriptions", "user_id, plan, trial_ends_at, granted_by_admin"),
    all<Use>(admin, "usage", "user_id, uploads, tutor_messages, weekly_sheets, exam_sheets, papers, cost_usd", (q) => q.eq("month", month())),
    all<{ user_id: string }>(admin, "courses", "user_id"),
    all<{ user_id: string; size_bytes: number | null; created_at: string }>(admin, "materials", "user_id, size_bytes, created_at"),
    all<{ user_id: string; updated_at: string }>(admin, "chats", "user_id, updated_at"),
    all<{ user_id: string; created_at: string }>(admin, "jobs", "user_id, created_at", (q) => q.gte("created_at", daysAgo(31))),
    all<{ user_id: string }>(admin, "calendar_feeds", "user_id").catch(() => []),
  ]);
  const by = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => new Map(rows.map((r) => [r[key] as string, r]));
  const count = (rows: { user_id: string }[]) => rows.reduce((m, r) => m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1), new Map<string, number>());
  const lastActive = new Map<string, string>();
  const bump = (id: string, t: string | null | undefined) => { if (t && (!lastActive.has(id) || t > lastActive.get(id)!)) lastActive.set(id, t); };
  for (const u of users) bump(u.id, u.last_sign_in_at);
  for (const c of chats) bump(c.user_id, c.updated_at);
  for (const m of materials) bump(m.user_id, m.created_at);
  for (const j of jobs) bump(j.user_id, j.created_at);
  return {
    users, prof: by(profiles, "id"), sub: by(subs, "user_id"), use: by(usage, "user_id"), usage,
    courses: count(courses), files: count(materials), chats, materials, feeds, lastActive,
  };
}

function planOf(s: Sub | undefined): "pro" | "granted" | "trial" | "free" {
  if (!s) return "free";
  if (s.plan === "pro") return s.granted_by_admin ? "granted" : "pro";
  if (s.plan === "trial" && s.trial_ends_at && s.trial_ends_at > new Date().toISOString()) return "trial";
  return "free";
}
const banned = (u: User) => !!(u as User & { banned_until?: string }).banned_until && (u as User & { banned_until?: string }).banned_until! > new Date().toISOString();

function row(d: Awaited<ReturnType<typeof load>>, u: User) {
  const p = d.prof.get(u.id) as Prof | undefined, use = d.use.get(u.id) as Use | undefined;
  return {
    id: u.id, email: u.email ?? "", name: p?.display_name ?? (u.user_metadata?.display_name as string | undefined) ?? null,
    school: p?.school ?? null, country: p?.country ?? null, plan: planOf(d.sub.get(u.id) as Sub | undefined),
    created_at: u.created_at, last_active: d.lastActive.get(u.id) ?? null, banned: banned(u), onboarded: !!p?.onboarded,
    courses: d.courses.get(u.id) ?? 0, files: d.files.get(u.id) ?? 0,
    month: { cost: Number(use?.cost_usd ?? 0), messages: use?.tutor_messages ?? 0, uploads: use?.uploads ?? 0, sheets: (use?.weekly_sheets ?? 0) + (use?.exam_sheets ?? 0), papers: use?.papers ?? 0 },
  };
}

async function overview(admin: SupabaseClient) {
  const d = await load(admin);
  const st = await getSettings(admin);
  const now = Date.now(), within = (t: string | null | undefined, days: number) => !!t && now - new Date(t).getTime() < days * 864e5;
  const plans = { free: 0, pro: 0, granted: 0, trial: 0 };
  for (const u of d.users) plans[planOf(d.sub.get(u.id) as Sub | undefined)]++;
  const spent = d.usage.reduce((a, r) => a + Number(r.cost_usd), 0);
  const active7 = d.users.filter((u) => within(d.lastActive.get(u.id), 7)).length;
  const days: { date: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) { const k = new Date(now - i * 864e5).toISOString().slice(0, 10); days.push({ date: k, n: 0 }); }
  for (const u of d.users) { const k = u.created_at.slice(0, 10); const day = days.find((x) => x.date === k); if (day) day.n++; }
  const tally = (vals: (string | null | undefined)[]) => [...vals.filter(Boolean).reduce((m, v) => m.set(v!, (m.get(v!) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n }));
  const sum = (k: keyof Use) => d.usage.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const { count: openReports } = await admin.from("reports").select("id", { count: "exact", head: true }).is("resolved_at", null);
  const top = d.users.map((u) => row(d, u)).filter((r) => r.month.cost > 0).sort((a, b) => b.month.cost - a.month.cost).slice(0, 5)
    .map((r) => ({ id: r.id, email: r.email, cost: r.month.cost, messages: r.month.messages }));
  return {
    users: {
      total: d.users.length, today: d.users.filter((u) => within(u.created_at, 1)).length, week: d.users.filter((u) => within(u.created_at, 7)).length,
      month: d.users.filter((u) => within(u.created_at, 30)).length, onboarded: [...d.prof.values()].filter((p) => (p as Prof).onboarded).length,
      active7, active30: d.users.filter((u) => within(d.lastActive.get(u.id), 30)).length, banned: d.users.filter(banned).length,
    },
    plans, revenue_estimate_gbp: Math.round(plans.pro * PRICE_GBP * 100) / 100,
    ai: { spent, budget: st.ai_budget_usd, paused: st.ai_paused, per_active: active7 ? spent / active7 : 0, top },
    usage: { uploads: sum("uploads"), messages: sum("tutor_messages"), sheets: sum("weekly_sheets") + sum("exam_sheets"), papers: sum("papers") },
    content: {
      courses: [...d.courses.values()].reduce((a, n) => a + n, 0), files: d.materials.length,
      storage_mb: Math.round(d.materials.reduce((a, m) => a + Number(m.size_bytes ?? 0), 0) / 1048576), chats: d.chats.length, calendar_feeds: d.feeds.length,
    },
    signups: days, schools: tally([...d.prof.values()].map((p) => (p as Prof).school)), countries: tally([...d.prof.values()].map((p) => (p as Prof).country)),
    open_reports: openReports ?? 0, month: month(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ctx = await getCtx(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const me = (user.email ?? "").toLowerCase();
  if (!me || !admins().includes(me)) return json(403, { code: "not_admin", message: "Admins only." });
  const b = await req.json().catch(() => ({}));
  const log = (action: string, target?: string, detail?: unknown) => admin.from("admin_actions").insert({ admin_email: me, action, target: target ?? null, detail: detail ?? null });
  const notSelf = () => b.id && b.id !== user.id;

  try {
    switch (b.action) {
      case "me": return json(200, { admin: true, email: me });
      case "overview": return json(200, await overview(admin));

      case "users": {
        const d = await load(admin);
        const q = String(b.q ?? "").trim().toLowerCase();
        const rows = d.users.map((u) => row(d, u))
          .filter((r) => !q || r.email.toLowerCase().includes(q) || (r.name ?? "").toLowerCase().includes(q) || (r.school ?? "").toLowerCase().includes(q))
          .sort((a, b2) => (b.sort === "active" ? (b2.last_active ?? "").localeCompare(a.last_active ?? "") : b.sort === "cost" ? b2.month.cost - a.month.cost : b2.created_at.localeCompare(a.created_at)));
        const page = Math.max(0, Number(b.page ?? 0));
        return json(200, { total: rows.length, users: rows.slice(page * 50, page * 50 + 50) });
      }

      case "set_plan": {
        if (!["pro", "free"].includes(b.plan)) return json(400, { code: "bad_request", message: "Plan must be pro or free." });
        const { error } = await admin.from("subscriptions").upsert({ user_id: b.id, plan: b.plan, trial_ends_at: null, granted_by_admin: b.plan === "pro" }, { onConflict: "user_id" });
        if (error) throw error;
        await log(b.plan === "pro" ? "give_pro" : "remove_pro", b.id);
        return json(200, { ok: true });
      }

      case "reset_usage": {
        // Resets the monthly counters (uploads, messages, sheets, papers). AI cost stays, so budgets stay honest.
        await admin.from("usage").update({ uploads: 0, tutor_messages: 0, weekly_sheets: 0, exam_sheets: 0, papers: 0 }).eq("user_id", b.id).eq("month", month());
        await log("reset_usage", b.id);
        return json(200, { ok: true });
      }

      case "ban": case "unban": {
        if (!notSelf()) return json(400, { code: "bad_request", message: "You can't ban your own account." });
        const { error } = await admin.auth.admin.updateUserById(b.id, { ban_duration: b.action === "ban" ? "876000h" : "none" });
        if (error) throw error;
        await log(b.action, b.id);
        return json(200, { ok: true });
      }

      case "delete_user": {
        if (!notSelf()) return json(400, { code: "bad_request", message: "Delete your own account from the You tab instead." });
        const { data: target } = await admin.auth.admin.getUserById(b.id);
        for (;;) {
          const { data: files } = await admin.storage.from("materials").list(b.id, { limit: 1000 });
          if (!files?.length) break;
          await admin.storage.from("materials").remove(files.map((f) => `${b.id}/${f.name}`));
          if (files.length < 1000) break;
        }
        const { error } = await admin.auth.admin.deleteUser(b.id);
        if (error) throw error;
        await log("delete_user", b.id, { email: target?.user?.email ?? null });
        return json(200, { ok: true });
      }

      case "reports": {
        const { data } = await admin.from("reports").select("id, user_id, reason, excerpt, created_at, resolved_at, chat_id, document_id").order("created_at", { ascending: false }).limit(100);
        const ids = [...new Set((data ?? []).map((r) => r.user_id))];
        const emails = new Map<string, string>();
        for (const id of ids) { const { data: u } = await admin.auth.admin.getUserById(id); if (u?.user) emails.set(id, u.user.email ?? ""); }
        return json(200, { reports: (data ?? []).map((r) => ({ ...r, email: emails.get(r.user_id) ?? null })) });
      }
      case "resolve_report": {
        await admin.from("reports").update({ resolved_at: b.undo ? null : new Date().toISOString() }).eq("id", b.id);
        await log(b.undo ? "reopen_report" : "resolve_report", b.id);
        return json(200, { ok: true });
      }

      case "settings": return json(200, { settings: await getSettings(admin) });
      case "save_settings": {
        const s = b.settings ?? {};
        const num = (v: unknown, min: number, max: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined; };
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (typeof s.ai_paused === "boolean") patch.ai_paused = s.ai_paused;
        for (const [k, max] of [["ai_budget_usd", 100000], ["free_cap_usd", 100], ["pro_cap_usd", 1000]] as const) { const n = num(s[k], 0, max); if (n !== undefined) patch[k] = n; }
        const { error } = await admin.from("app_settings").upsert({ id: 1, ...patch });
        if (error) throw error;
        await log("save_settings", null as unknown as string, patch);
        return json(200, { settings: await getSettings(admin) });
      }

      case "log": {
        const { data } = await admin.from("admin_actions").select("admin_email, action, target, detail, created_at").order("created_at", { ascending: false }).limit(50);
        return json(200, { log: data ?? [] });
      }
      default: return json(400, { code: "bad_request", message: "Unknown admin action." });
    }
  } catch (e) {
    console.error("admin", b.action, e);
    return json(500, { code: "failed", message: (e as Error).message ?? "Something went wrong." });
  }
});
