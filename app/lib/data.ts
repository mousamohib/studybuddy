// Shared types, small helpers and the "keep the plan up to date" logic.
import { busyMinutes } from './reminders';
import { startJob } from './api';
import { supabase } from './supabase';

export type Course = { id: string; code: string; name: string | null; colour: string | null; rules: string | null; ai_policy: string | null; teaching_style: string | null; created_at: string };
export type DeadlineKind = 'assignment' | 'quiz' | 'midterm' | 'final' | 'test' | 'lab' | 'project' | 'other';
export type Deadline = { id: string; course_id: string; kind: DeadlineKind; label: string | null; due_at: string; covers: string | null; done: boolean; calendar_event_id: string | null };
export type Topic = { name: string; where?: string; summary?: string };
export type Material = { id: string; course_id: string; deadline_id: string | null; file_name: string; storage_path: string | null; status: 'uploaded' | 'reading' | 'outlining' | 'ready' | 'error'; chars: number | null; outline: { kind?: string; title?: string; topics?: Topic[]; error?: string; skipped?: string[] } | null; created_at: string };
export type Doc = { id: string; course_id: string; kind: 'weekly_sheet' | 'exam_sheet' | 'derivation_sheet' | 'paper'; title: string | null; body: string | null; meta: any; share_token: string | null; created_at: string };
export type MemoryItem = { id: string; course_id: string | null; kind: 'fact' | 'revisit'; text: string; done: boolean; source: string; created_at: string };
export type ChatRow = { id: string; course_id: string | null; mode: ChatMode; title: string; style: string | null; modifier: string | null; material_ids: string[]; deadline_id: string | null; messages: any[]; updated_at: string };
export type ChatMode = 'ask' | 'lesson' | 'practice' | 'coding' | 'assignment';

export const ASSIGNMENT_KINDS: DeadlineKind[] = ['assignment', 'project', 'lab'];
export const isAssignment = (d: Pick<Deadline, 'kind'>) => ASSIGNMENT_KINDS.includes(d.kind);
export const KIND_LABEL: Record<DeadlineKind, string> = { assignment: 'Assignment', quiz: 'Quiz', midterm: 'Midterm', final: 'Final exam', test: 'Test', lab: 'Lab', project: 'Project', other: 'Other' };
export const MODE_LABEL: Record<ChatMode, string> = { ask: 'Ask', lesson: 'Teach me', practice: 'Practice', coding: 'Coding', assignment: 'Assignment' };

// Highlighter colours. Each is dark enough for white text on top.
export const COURSE_COLOURS = ['#3442F5', '#F0457E', '#0F9F74', '#F07A12', '#8B4DF0', '#0B93D6', '#C99A00', '#E5385F'];
const OLD_COLOURS = ['#E16259', '#0F7B6C', '#D9730D', '#6940A5', '#2383E2', '#AD1A72', '#64473A', '#337EA9'];
export const courseColour = (c: Pick<Course, 'colour' | 'created_at'> | undefined, i = 0) => {
  const old = c?.colour ? OLD_COLOURS.indexOf(c.colour.toUpperCase()) : -1;
  return old >= 0 ? COURSE_COLOURS[old] : c?.colour || COURSE_COLOURS[i % COURSE_COLOURS.length];
};

export const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysUntil = (iso: string) => { const a = new Date(); a.setHours(0, 0, 0, 0); const b = new Date(iso); b.setHours(0, 0, 0, 0); return Math.round((b.getTime() - a.getTime()) / 86400000); };
export const relDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 1 ? `in ${n} days` : n === -1 ? 'yesterday' : `${-n} days ago`);
export const fmtDay = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** "2026-10-21T11:30" (local, from the AI) → ISO with timezone. */
export const localToISO = (s: string) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/); if (!m) return null; return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 23, m[5] ? +m[5] : 59).toISOString(); };
export const isoToLocalInput = (iso: string) => { const d = new Date(iso); return `${localISO(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function hashStr(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/** A fingerprint of everything the plan depends on; when it changes the plan rebuilds itself. */
export async function planInputsKey() {
  const [{ data: ms }, { data: ds }, { data: plan }] = await Promise.all([
    supabase.from('materials').select('id, deadline_id, status'),
    supabase.from('deadlines').select('id, course_id, kind, label, due_at, covers, done'),
    supabase.from('plans').select('instructions, inputs_key, generated_at').maybeSingle(),
  ]);
  const busy = (ms ?? []).some((m) => m.status === 'reading' || m.status === 'outlining' || m.status === 'uploaded');
  const key = hashStr([
    (ms ?? []).filter((m) => m.status === 'ready').map((m) => `${m.id}:${m.deadline_id ?? ''}`).sort().join(','),
    (ds ?? []).map((d) => [d.id, d.course_id, d.kind, d.label, d.due_at, d.covers, d.done ? 1 : 0].join('|')).sort().join(';'),
    ((plan?.instructions ?? []) as { id: string }[]).map((i) => i.id).join(','),
  ].join('#'));
  return { key, current: plan?.inputs_key ?? null, filesBusy: busy, hasDeadlines: (ds ?? []).some((d) => !d.done) };
}

/** Starts a plan rebuild with the student's calendar busy time. Returns the job id. */
export async function rebuildPlan(request?: string) {
  const { key } = await planInputsKey();
  const busy = await busyMinutes().catch(() => []);
  return startJob('plan', { request: request || undefined, busy, inputs_key: key });
}

/** The newest still-running plan job, if any (so we never start two). */
export async function runningPlanJob(): Promise<string | null> {
  const since = new Date(Date.now() - 6 * 60000).toISOString();
  const { data } = await supabase.from('jobs').select('id').eq('kind', 'plan').eq('status', 'running').gte('created_at', since).order('created_at', { ascending: false }).limit(1);
  return data?.[0]?.id ?? null;
}
