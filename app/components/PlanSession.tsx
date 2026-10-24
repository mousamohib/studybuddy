import { Pressable, View } from 'react-native';
import { LinkText, Pill, Row, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { openNewChat } from '@/lib/chats';
import type { Course, Deadline } from '@/lib/data';
import type { Session } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';

export type FullSession = Session & { topics?: string[]; goal?: string; deadlineId?: string; materials?: string[] };

export function PlanSession({ s, done, colour, onToggle, courses, deadlines }: {
  s: FullSession; done: boolean; colour: string; onToggle: () => void; courses: Course[]; deadlines: Deadline[];
}) {
  const t = useTheme();
  const notice = useNotice();

  async function start() {
    const course = courses.find((c) => c.code === s.course);
    const d = deadlines.find((x) => x.id === s.deadlineId) ?? null;
    let materialIds: string[] | undefined;
    if (course && s.materials?.length) {
      const { data } = await supabase.from('materials').select('id, file_name, deadline_id').eq('course_id', course.id).eq('status', 'ready');
      const named = (data ?? []).filter((m) => s.materials!.some((n) => n.toLowerCase() === m.file_name.toLowerCase())).map((m) => m.id);
      const asg = d ? (data ?? []).filter((m) => m.deadline_id === d.id).map((m) => m.id) : [];
      if (named.length || asg.length) materialIds = [...new Set([...asg, ...named])];
    }
    const mode = s.type === 'assignment' ? 'assignment' : s.type === 'coding' ? 'coding' : s.type === 'practice' || s.type === 'review' ? 'practice' : 'lesson';
    const topic = `${s.title}${s.topics?.length ? ` — topics: ${s.topics.join(', ')}` : ''}${s.goal ? `. Goal: ${s.goal}` : ''}${d ? `. This prepares for ${s.course} ${d.label || d.kind}.` : ''}`;
    try { await openNewChat({ courseId: course?.id ?? null, mode: mode === 'assignment' && !d ? 'lesson' : mode, topic, deadline: d, courseCode: s.course, materialIds, title: s.title }); }
    catch (e) { notice("Couldn't start the session", (e as Error).message); }
  }

  return (
    <View style={{ flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderLeftWidth: 4, borderLeftColor: colour, opacity: done ? 0.55 : 1 }}>
      <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: done }} hitSlop={8}
        style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: done ? t.good : t.muted, backgroundColor: done ? t.good : 'transparent', marginTop: 2 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Row><T variant="small" style={{ color: colour, fontWeight: '700' }}>{s.course}</T><Pill label={s.type} /><T variant="small" muted>{s.minutes} min</T></Row>
        <T style={{ fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{s.title}</T>
        {s.topics?.length ? <T variant="small" muted>{s.topics.join(' · ')}</T> : null}
        {s.goal ? <T variant="small" muted>Goal: {s.goal}</T> : null}
      </View>
      {!done && <LinkText title="Start" onPress={start} />}
    </View>
  );
}
