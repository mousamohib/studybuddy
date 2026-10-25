import { View } from 'react-native';
import { Check, CourseTag, IconButton, ic, Row, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { openNewChat } from '@/lib/chats';
import type { Course, Deadline } from '@/lib/data';
import type { Session } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { ink, radius, space, tint, useTheme } from '@/lib/theme';

export type FullSession = Session & { topics?: string[]; goal?: string; deadlineId?: string; materials?: string[] };

const TYPE_LABEL: Record<string, string> = { lesson: 'Lesson', practice: 'Practice', review: 'Review', assignment: 'Assignment', coding: 'Coding', reading: 'Reading' };

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
    <View style={{ flexDirection: 'row', gap: space.md, padding: space.md, paddingLeft: space.md + 2, borderRadius: radius.lg, backgroundColor: done ? tint(colour, t.dark ? 0.08 : 0.05) : t.card, borderWidth: 1, borderColor: done ? 'transparent' : t.border, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colour, opacity: done ? 0.4 : 1 }} />
      <View style={{ paddingTop: 2 }}><Check checked={done} onPress={onToggle} color={colour} /></View>
      <View style={{ flex: 1, gap: 4, opacity: done ? 0.55 : 1 }}>
        <Row style={{ gap: 6 }}>
          <CourseTag code={s.course} color={colour} />
          <T variant="small" muted>{TYPE_LABEL[s.type] ?? s.type} · {s.minutes} min</T>
        </Row>
        <T variant="strong" style={{ textDecorationLine: done ? 'line-through' : 'none' }}>{s.title}</T>
        {s.topics?.length ? <T variant="small" muted>{s.topics.join(', ')}</T> : null}
        {s.goal && !done ? <T variant="small" color={ink(colour, t)}>Goal: {s.goal}</T> : null}
      </View>
      {!done && <View style={{ alignSelf: 'center' }}><IconButton icon={ic('play.fill', 'play_arrow')} label={`Start ${s.title}`} bg={colour} color="#FFFFFF" size={44} onPress={start} /></View>}
    </View>
  );
}
