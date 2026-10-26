// School calendar feeds (Brightspace, Canvas, Moodle, Blackboard): connect once, deadlines stay up to date.
import { post } from './api';
import { rebuildPlan } from './data';
import { refreshPhoneSchedule } from './reminders';
import { supabase } from './supabase';

export type FeedResult = { added: number; updated: number; linked: number; matched: number; skipped: number; unmatched: { code: string; count: number }[]; error?: string };
export type Feed = { id: string; url: string; label: string | null; last_synced_at: string | null; last_result: FeedResult | null };

const tz = () => new Date().getTimezoneOffset();

export async function listFeeds(): Promise<Feed[]> {
  const { data } = await supabase.from('calendar_feeds').select('id, url, label, last_synced_at, last_result').order('created_at');
  return (data ?? []) as Feed[];
}

async function afterSync(results: FeedResult[]) {
  if (results.some((r) => r.added || r.updated || r.linked)) {
    await rebuildPlan().catch(() => {});
    refreshPhoneSchedule().catch(() => {});
  }
}

export async function addFeed(url: string) {
  const r = await post<{ feed: Feed; result: FeedResult }>('calendar-sync', { action: 'add', url, tz: tz() });
  await afterSync([r.result]);
  return r;
}

export async function syncFeeds(id?: string) {
  const r = await post<{ results: Record<string, FeedResult> }>('calendar-sync', { action: 'sync', id, tz: tz() });
  await afterSync(Object.values(r.results));
  return r.results;
}

export const removeFeed = (id: string) => post('calendar-sync', { action: 'remove', id });

/** Runs when the app opens: re-syncs feeds not checked in the last 6 hours. Quiet on failure. */
export async function syncFeedsIfStale() {
  try {
    const feeds = await listFeeds();
    const stale = feeds.some((f) => !f.last_synced_at || Date.now() - new Date(f.last_synced_at).getTime() > 6 * 3600e3);
    if (stale) await syncFeeds();
  } catch { /* offline or table not there yet */ }
}

export const HOW_TO: { name: string; where: string; steps: string[] }[] = [
  { name: 'Brightspace (D2L)', where: 'e.g. McGill myCourses, many Canadian schools', steps: ['Open Calendar (on the homepage or inside any course).', 'Click Subscribe (bottom of the calendar, or in Settings).', 'Choose "All Courses", then copy the link it shows.'] },
  { name: 'Canvas', where: 'e.g. UBC, U of T Quercus', steps: ['Open Calendar in the left menu.', 'Click "Calendar Feed" at the bottom right.', 'Copy the link.'] },
  { name: 'Moodle', where: 'many UK universities and colleges', steps: ['Open Calendar, then "Import or export calendars".', 'Click "Export calendar", pick "All courses" and "Recent and next 60 days" (or Custom range).', 'Click "Get calendar URL" and copy it.'] },
  { name: 'Blackboard', where: 'Blackboard Learn / Ultra', steps: ['Open Calendar.', 'Open the settings (gear), then "Share calendar" or "Get external calendar link".', 'Copy the link.'] },
];
