import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Icon, ic, ListRow, Pressy, Row, Segments, T, useAccent } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { isAssignment, MODE_LABEL, type ChatMode } from '@/lib/data';
import { openNewChat } from '@/lib/chats';
import { ink, radius, space, tint, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

const MODES: ChatMode[] = ['ask', 'lesson', 'practice', 'coding', 'assignment'];
const PLACEHOLDER: Record<ChatMode, string> = {
  ask: 'Your question', lesson: 'Topic to learn (blank = Claude picks)', practice: 'Topic to practise (optional)',
  coding: 'What to practise coding (optional)', assignment: 'What you need help with (optional)',
};

export function Chats({ data }: { data: CourseData }) {
  const t = useTheme();
  const accent = useAccent().color;
  const notice = useNotice();
  const [mode, setMode] = useState<ChatMode>('ask');
  const [topic, setTopic] = useState('');
  const asg = data.deadlines.filter(isAssignment);
  const [asgId, setAsgId] = useState<string | null>(null);
  const c = data.course!;

  async function start() {
    const d = mode === 'assignment' ? asg.find((x) => x.id === (asgId ?? asg[0]?.id)) : null;
    if (mode === 'assignment' && !d) { notice('Add an assignment first', 'Create it in Materials or Deadlines.'); return; }
    if (mode === 'ask' && !topic.trim()) { notice('Type your question first'); return; }
    try { await openNewChat({ courseId: c.id, mode, topic, deadline: d, courseCode: c.code }); setTopic(''); }
    catch (e) { notice("Couldn't start the chat", (e as Error).message); }
  }

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <T variant="heading">New chat</T>
        <Segments items={MODES.map((m) => ({ key: m, label: MODE_LABEL[m] }))} value={mode} onChange={setMode} />
        {mode === 'assignment' && (asg.length ? (
          <Row>{asg.map((d) => {
            const on = (asgId ?? asg[0].id) === d.id;
            return (
              <Pressy key={d.id} onPress={() => setAsgId(d.id)} style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: on ? tint(accent, 0.16) : t.surface }}>
                <T variant="label" color={on ? ink(accent, t) : t.text}>{d.label || d.kind}</T>
              </Pressy>
            );
          })}</Row>
        ) : <T variant="small" muted>No assignments in this course yet.</T>)}
        <Field placeholder={PLACEHOLDER[mode]} value={topic} onChangeText={setTopic} multiline />
        <Button title="Start chat" icon={ic('arrow.right', 'arrow_forward')} onPress={start} />
      </View>
      <View>
        {data.chats.map((ch, i) => (
          <ListRow key={ch.id} last={i === data.chats.length - 1} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: ch.id } })}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="strong" numberOfLines={1}>{ch.title}</T>
              <T variant="small" muted>{MODE_LABEL[ch.mode]} · {new Date(ch.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T>
            </View>
            <Icon name={ic('chevron.right', 'chevron_right')} size={18} color={t.muted} />
          </ListRow>
        ))}
      </View>
    </View>
  );
}
