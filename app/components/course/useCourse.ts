import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatRow, Course, Deadline, Doc, Material, MemoryItem } from '@/lib/data';
import type { JobRow } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type CourseData = {
  course: Course | null; deadlines: Deadline[]; materials: Material[]; docs: Doc[]; memory: MemoryItem[]; chats: ChatRow[]; jobs: JobRow[];
  loading: boolean; reload: () => Promise<void>;
};

/** Loads everything for one course and keeps polling while files are being read or jobs are running. */
export function useCourse(id: string): CourseData {
  const [state, setState] = useState<Omit<CourseData, 'reload'>>({ course: null, deadlines: [], materials: [], docs: [], memory: [], chats: [], jobs: [], loading: true });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 60000).toISOString();
    const [c, d, m, docs, mem, chats, jobs] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id).maybeSingle(),
      supabase.from('deadlines').select('*').eq('course_id', id).order('due_at'),
      supabase.from('materials').select('id, course_id, deadline_id, file_name, storage_path, status, chars, outline, created_at').eq('course_id', id).order('created_at'),
      supabase.from('documents').select('id, course_id, kind, title, meta, share_token, created_at').eq('course_id', id).order('created_at'),
      supabase.from('memory').select('*').eq('course_id', id).order('created_at'),
      supabase.from('chats').select('id, course_id, mode, title, style, modifier, material_ids, deadline_id, updated_at').eq('course_id', id).order('updated_at', { ascending: false }),
      supabase.from('jobs').select('id, kind, status, result, error, created_at, input').eq('input->>course_id', id).gte('created_at', since).order('created_at', { ascending: false }),
    ]);
    if (!alive.current) return;
    const next = {
      course: c.data as Course | null, deadlines: (d.data ?? []) as Deadline[], materials: (m.data ?? []) as Material[],
      docs: (docs.data ?? []) as Doc[], memory: (mem.data ?? []) as MemoryItem[], chats: (chats.data ?? []) as ChatRow[], jobs: (jobs.data ?? []) as JobRow[], loading: false,
    };
    setState(next);
    const busy = next.materials.some((x) => ['uploaded', 'reading', 'outlining'].includes(x.status)) || next.jobs.some((j) => j.status === 'running' || j.status === 'queued');
    if (timer.current) clearTimeout(timer.current);
    if (busy) timer.current = setTimeout(() => { reload(); }, 3000);
  }, [id]);

  useFocusEffect(useCallback(() => { alive.current = true; reload(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [reload]));
  useEffect(() => () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }, []);
  return { ...state, reload };
}
