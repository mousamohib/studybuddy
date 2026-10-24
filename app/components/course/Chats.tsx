import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Field, Pill, Row, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { isAssignment, MODE_LABEL, type ChatMode } from '@/lib/data';
import { openNewChat } from '@/lib/chats';
import { space, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

const MODES: ChatMode[] = ['ask', 'lesson', 'practice', 'coding', 'assignment'];
const PLACEHOLDER: Record<ChatMode, string> = {
  ask: 'Your question', lesson: 'Topic to learn (blank = Claude picks)', practice: 'Topic to practise (optional)',
  coding: 'What to practise coding (optional)', assignment: 'What you need help with (optional)',
};

export function Chats({ data }: { data: CourseData }) {
  const t = useTheme();
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
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.md }}>
        <T variant="heading">New chat</T>
        <Row>{MODES.map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: mode === m ? t.text : t.surface }}>
            <T variant="small" style={{ color: mode === m ? t.bg : t.text, fontWeight: '600' }}>{MODE_LABEL[m]}</T>
          </Pressable>
        ))}</Row>
        {mode === 'assignment' && (asg.length ? (
          <Row>{asg.map((d) => (
            <Pressable key={d.id} onPress={() => setAsgId(d.id)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: (asgId ?? asg[0].id) === d.id ? t.accent : t.border }}>
              <T variant="small">{d.label || d.kind}</T>
            </Pressable>
          ))}</Row>
        ) : <T variant="small" muted>No assignments in this course yet.</T>)}
        <Field placeholder={PLACEHOLDER[mode]} value={topic} onChangeText={setTopic} multiline />
        <Button title="Start chat" onPress={start} />
      </Card>
      {data.chats.map((ch) => (
        <Pressable key={ch.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: ch.id } })}>
          <Card style={{ gap: 4 }}>
            <T style={{ fontWeight: '600' }} >{ch.title}</T>
            <Row><Pill label={MODE_LABEL[ch.mode]} /><T variant="small" muted>{new Date(ch.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T></Row>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
