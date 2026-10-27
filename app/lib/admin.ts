// Admin dashboard calls. The server decides who is an admin (ADMIN_EMAILS secret); the app only asks.
import { post } from './api';
import { supabase } from './supabase';

export type AdminUser = {
  id: string; email: string; name: string | null; school: string | null; country: string | null;
  plan: 'free' | 'pro' | 'granted' | 'trial'; created_at: string; last_active: string | null; banned: boolean; onboarded: boolean;
  courses: number; files: number; month: { cost: number; messages: number; uploads: number; sheets: number; papers: number };
};
export type Overview = {
  users: { total: number; today: number; week: number; month: number; onboarded: number; active7: number; active30: number; banned: number };
  plans: { free: number; pro: number; granted: number; trial: number }; revenue_estimate_gbp: number;
  ai: { spent: number; budget: number; paused: boolean; per_active: number; top: { id: string; email: string; cost: number; messages: number }[] };
  usage: { uploads: number; messages: number; sheets: number; papers: number };
  content: { courses: number; files: number; storage_mb: number; chats: number; calendar_feeds: number };
  signups: { date: string; n: number }[]; schools: { name: string; n: number }[]; countries: { name: string; n: number }[];
  open_reports: number; month: string;
};
export type Report = { id: string; email: string | null; reason: string | null; excerpt: string | null; created_at: string; resolved_at: string | null };
export type Settings = { ai_paused: boolean; ai_budget_usd: number; free_cap_usd: number; pro_cap_usd: number };
export type LogRow = { admin_email: string; action: string; target: string | null; detail: unknown; created_at: string };

const call = <T>(action: string, body: Record<string, unknown> = {}) => post<T>('admin', { action, ...body });

const cached = new Map<string, boolean>();
/** True when the signed-in account is an admin. Remembered per account for this session. */
export async function isAdmin(): Promise<boolean> {
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) return false;
  if (cached.has(uid)) return cached.get(uid)!;
  let ok = false;
  try { await call('me'); ok = true; } catch { ok = false; }
  cached.set(uid, ok);
  return ok;
}

export const adminApi = {
  overview: () => call<Overview>('overview'),
  users: (q: string, sort: 'new' | 'active' | 'cost', page = 0) => call<{ total: number; users: AdminUser[] }>('users', { q, sort, page }),
  setPlan: (id: string, plan: 'pro' | 'free') => call('set_plan', { id, plan }),
  resetUsage: (id: string) => call('reset_usage', { id }),
  ban: (id: string, on: boolean) => call(on ? 'ban' : 'unban', { id }),
  deleteUser: (id: string) => call('delete_user', { id }),
  reports: () => call<{ reports: Report[] }>('reports'),
  resolve: (id: string, undo = false) => call('resolve_report', { id, undo }),
  settings: () => call<{ settings: Settings }>('settings'),
  saveSettings: (settings: Partial<Settings>) => call<{ settings: Settings }>('save_settings', { settings }),
  log: () => call<{ log: LogRow[] }>('log'),
};
