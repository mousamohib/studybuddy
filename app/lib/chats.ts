import { router } from 'expo-router';
import type { ChatMode, Deadline } from './data';
import { supabase } from './supabase';

export function starterFor(mode: ChatMode, topic: string, courseCode?: string, d?: Deadline | null): string {
  const pick = courseCode ? `the most useful next ${courseCode} topic given my deadlines and plan (tell me which you picked and why first)` : 'something useful given my upcoming deadlines';
  const what = topic.trim() || pick;
  switch (mode) {
    case 'lesson': return `Teach me this, following my teaching style: ${what}\nName the source once at the top, list every sub-topic it contains, then teach them all in order so I understand it from this chat alone.`;
    case 'practice': return `Give me a practice set on: ${what}\nQuestions first; hold the worked solutions until I answer or ask.`;
    case 'coding': return `Create a hands-on coding practice tutorial on: ${what}\nShort recap, one worked example, then 3-5 exercises of increasing difficulty with hints. Full solutions only when I ask.`;
    case 'assignment': return d ? `${topic.trim() ? `About ${d.label || d.kind}: ${topic.trim()}` : `Help me with ${d.label || d.kind} (due ${new Date(d.due_at).toDateString()}). Explain what's being asked and break it into steps.`}` : what;
    default: return topic.trim();
  }
}

/** Creates a chat with the right files attached and opens it, optionally sending a first message. */
export async function openNewChat(o: { courseId: string | null; mode: ChatMode; topic?: string; deadline?: Deadline | null; courseCode?: string; materialIds?: string[]; title?: string; modifier?: string }) {
  let ids = o.materialIds;
  if (!ids && o.courseId) {
    const q = supabase.from('materials').select('id, deadline_id, outline').eq('course_id', o.courseId).eq('status', 'ready');
    const { data } = await q;
    ids = (data ?? []).filter((m) => (o.mode === 'assignment' && o.deadline ? m.deadline_id === o.deadline.id : !m.deadline_id)).map((m) => m.id);
  }
  const title = o.title || (o.topic?.trim() ? o.topic.trim().slice(0, 60) : o.mode === 'assignment' && o.deadline ? `${o.deadline.label || o.deadline.kind} help` : 'New chat');
  const { data: row, error } = await supabase.from('chats').insert({ course_id: o.courseId, mode: o.mode, title, material_ids: ids ?? [], deadline_id: o.deadline?.id ?? null, modifier: o.modifier ?? null }).select('id').single();
  if (error || !row) throw new Error(error?.message ?? "Couldn't start the chat.");
  const start = o.mode === 'ask' ? (o.topic?.trim() || '') : starterFor(o.mode, o.topic ?? '', o.courseCode, o.deadline);
  router.push({ pathname: '/chat/[id]', params: { id: row.id, start } });
}
