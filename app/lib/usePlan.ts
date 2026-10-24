import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { waitJob } from './api';
import { courseColour, planInputsKey, rebuildPlan, runningPlanJob, type Course, type Deadline } from './data';
import { refreshPhoneSchedule, type PlanDay } from './reminders';
import { supabase } from './supabase';

export type PlanRow = { summary: string | null; days: PlanDay[]; done: Record<string, boolean>; instructions: { id: string; text: string; until?: string }[]; change_log: { q: string; a: string; ts: number }[]; generated_at: string | null };

/** The study plan plus everything shown next to it. Rebuilds the plan by itself when its inputs change. */
export function usePlan() {
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const watching = useRef(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: c }, { data: d }] = await Promise.all([
      supabase.from('plans').select('summary, days, done, instructions, change_log, generated_at').maybeSingle(),
      supabase.from('courses').select('*').order('created_at'),
      supabase.from('deadlines').select('*').order('due_at'),
    ]);
    setPlan(p as PlanRow | null); setCourses((c ?? []) as Course[]); setDeadlines((d ?? []) as Deadline[]);
  }, []);

  const watch = useCallback(async (jobId: string, label: string) => {
    if (watching.current) return;
    watching.current = true; setBusy(label); setError('');
    try { const r = await waitJob(jobId); await load(); refreshPhoneSchedule().catch(() => {}); return r?.reply as string | undefined; }
    catch (e) { setError((e as Error).message); }
    finally { watching.current = false; setBusy(null); }
  }, [load]);

  const autoUpdate = useCallback(async () => {
    const running = await runningPlanJob();
    if (running) { watch(running, 'Updating your plan…'); return; }
    const k = await planInputsKey();
    if (k.hasDeadlines && !k.filesBusy && k.key !== k.current) {
      try { watch(await rebuildPlan(), 'Updating your plan with your latest material…'); } catch (e) { setError((e as Error).message); }
    }
  }, [watch]);

  useFocusEffect(useCallback(() => { load().then(autoUpdate); }, [load, autoUpdate]));

  const change = useCallback(async (request: string) => {
    try { return await watch(await rebuildPlan(request), 'Changing your plan…'); }
    catch (e) { setError((e as Error).message); }
  }, [watch]);

  const toggleDone = useCallback(async (id: string) => {
    if (!plan) return;
    const done = { ...plan.done, [id]: !plan.done[id] };
    setPlan({ ...plan, done });
    await supabase.from('plans').update({ done }).not('user_id', 'is', null);
  }, [plan]);

  const removeInstruction = useCallback(async (id: string) => {
    if (!plan) return;
    const instructions = plan.instructions.filter((i) => i.id !== id);
    setPlan({ ...plan, instructions });
    await supabase.from('plans').update({ instructions }).not('user_id', 'is', null);
    autoUpdate();
  }, [plan, autoUpdate]);

  const colourOf = (code: string) => { const i = courses.findIndex((c) => c.code === code); return courseColour(courses[i], Math.max(0, i)); };
  return { plan, courses, deadlines, busy, error, change, toggleDone, removeInstruction, reload: load, colourOf, rebuild: () => rebuildPlan().then((id) => watch(id, 'Rebuilding your plan…')) };
}
