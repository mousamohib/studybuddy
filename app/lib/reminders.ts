// Phone calendar sync and local reminders. Both run on the phone, so they work in Expo Go.
import * as Calendar from 'expo-calendar/legacy';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type Session = { id: string; course: string; title: string; minutes: number; type: string };
export type PlanDay = { date: string; sessions: Session[] };
type Deadline = { id: string; kind: string; label: string | null; due_at: string; done: boolean; course_id: string; calendar_event_id: string | null };

const CAL_TITLE = 'Scrawlie';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

// ---------- notifications ----------
export async function askNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Study reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

type Prefs = { daily: boolean; deadlines: boolean; exams: boolean };
const EXAMS = new Set(['midterm', 'final', 'test', 'quiz']);

/** Replaces all scheduled reminders with fresh ones from the plan and deadlines. */
export async function scheduleReminders(days: PlanDay[], deadlines: (Deadline & { code: string })[], prefs: Prefs) {
  if (Platform.OS === 'web') return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const at = async (date: Date, title: string, body: string) => {
    if (date.getTime() <= now + 60_000) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date } });
  };
  if (prefs.daily) {
    for (const d of days.slice(0, 14)) {
      if (!d.sessions.length) continue;
      const [y, m, day] = d.date.split('-').map(Number);
      const mins = d.sessions.reduce((a, s) => a + s.minutes, 0);
      await at(new Date(y, m - 1, day, 8, 30), "Today's study plan", `${d.sessions.length} session${d.sessions.length > 1 ? 's' : ''}, about ${Math.round(mins / 6) / 10} h: ${d.sessions.map((s) => s.course).filter((c, i, a) => a.indexOf(c) === i).join(', ')}`);
    }
  }
  for (const d of deadlines.filter((x) => !x.done)) {
    const due = new Date(d.due_at);
    const name = `${d.code} ${d.label || d.kind}`;
    if (EXAMS.has(d.kind) && prefs.exams) {
      await at(new Date(due.getTime() - 3 * 86400000), `${name} in 3 days`, 'Time for mixed practice and your cheat sheet.');
      await at(new Date(due.getTime() - 86400000), `${name} tomorrow`, 'Light review today, then get some sleep.');
    } else if (!EXAMS.has(d.kind) && prefs.deadlines) {
      await at(new Date(due.getTime() - 2 * 86400000), `${name} due in 2 days`, 'Aim to finish a day early.');
      await at(new Date(due.getTime() - 3 * 3600000), `${name} due in 3 hours`, "Don't forget to submit.");
    }
  }
}

// ---------- calendar ----------
export async function askCalendarPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

async function studyCalendarId(): Promise<string> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const found = cals.find((c) => c.title === CAL_TITLE);
  if (found) return found.id;
  const source = Platform.OS === 'ios'
    ? (await Calendar.getDefaultCalendarAsync()).source
    : { isLocalAccount: true, name: CAL_TITLE, type: Calendar.SourceType.LOCAL as unknown as string };
  return Calendar.createCalendarAsync({
    title: CAL_TITLE, name: CAL_TITLE, color: '#2383E2', entityType: Calendar.EntityTypes.EVENT,
    sourceId: Platform.OS === 'ios' ? source.id : undefined, source, ownerAccount: 'personal', accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
}

/** Writes deadlines and the next 14 days of sessions into a "Scrawlie" calendar on the phone. */
export async function syncCalendar(days: PlanDay[], deadlines: (Deadline & { code: string })[]) {
  if (Platform.OS === 'web') return 0;
  const calId = await studyCalendarId();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 120 * 86400000);
  // Clear what we wrote before, then write it fresh (simple and always consistent).
  for (const e of await Calendar.getEventsAsync([calId], new Date(start.getTime() - 86400000), end)) await Calendar.deleteEventAsync(e.id).catch(() => {});
  let n = 0;
  for (const d of deadlines.filter((x) => !x.done && new Date(x.due_at) >= start)) {
    const due = new Date(d.due_at);
    await Calendar.createEventAsync(calId, { title: `${d.code}: ${d.label || d.kind}${EXAMS.has(d.kind) ? '' : ' due'}`, startDate: new Date(due.getTime() - (EXAMS.has(d.kind) ? 0 : 30 * 60000)), endDate: new Date(due.getTime() + (EXAMS.has(d.kind) ? 90 * 60000 : 0)), alarms: [{ relativeOffset: -24 * 60 }] });
    n++;
  }
  for (const day of days.slice(0, 14)) {
    const [y, m, dd] = day.date.split('-').map(Number);
    let cursor = new Date(y, m - 1, dd, 17, 0);
    for (const s of day.sessions) {
      const startAt = cursor, endAt = new Date(cursor.getTime() + s.minutes * 60000);
      if (endAt < new Date()) { cursor = endAt; continue; }
      await Calendar.createEventAsync(calId, { title: `${s.course}: ${s.title}`, startDate: startAt, endDate: endAt, notes: 'Planned by Scrawlie' });
      cursor = new Date(endAt.getTime() + 10 * 60000); n++;
    }
  }
  return n;
}

/** Minutes already booked per day in the student's other calendars (so the planner leaves room). */
export async function busyMinutes(daysAhead = 21): Promise<{ date: string; minutes: number }[]> {
  if (Platform.OS === 'web') return [];
  const perm = await Calendar.getCalendarPermissionsAsync();
  if (!perm.granted) return [];
  const cals = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).filter((c) => c.title !== CAL_TITLE);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const events = await Calendar.getEventsAsync(cals.map((c) => c.id), start, new Date(start.getTime() + daysAhead * 86400000));
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.startDate), en = new Date(e.endDate);
    const mins = Math.max(0, (en.getTime() - s.getTime()) / 60000);
    if (mins > 12 * 60) continue;
    const key = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) ?? 0) + mins);
  }
  return [...byDay].map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }));
}

/** Refreshes reminders (and the calendar if sync is on) from the latest data. Safe to call often. */
export async function refreshPhoneSchedule() {
  if (Platform.OS === 'web') return;
  const [{ data: profile }, { data: plan }, { data: ds }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('notify, calendar_sync').maybeSingle(),
    supabase.from('plans').select('days').maybeSingle(),
    supabase.from('deadlines').select('*'),
    supabase.from('courses').select('id, code'),
  ]);
  const code = (id: string) => courses?.find((c) => c.id === id)?.code ?? '';
  const deadlines = (ds ?? []).map((d) => ({ ...d, code: code(d.course_id) }));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const days = ((plan?.days ?? []) as PlanDay[]).filter((d) => d.date >= iso);
  await scheduleReminders(days, deadlines, profile?.notify ?? { daily: true, deadlines: true, exams: true }).catch(() => {});
  if (profile?.calendar_sync) {
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (perm.granted) await syncCalendar(days, deadlines).catch(() => {});
  }
}
