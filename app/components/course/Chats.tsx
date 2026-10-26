import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Icon, ic, ListRow, Pressy, Row, T, useAccent } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { isAssignment, MODE_LABEL, type ChatMode } from '@/lib/data';
import { openNewChat } from '@/lib/chats';
import { ink, radius, space, tint, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

const MODES: ChatMode[] = ['ask', 'lesson', 'practice', 'coding', 'assignment'];
const MODE_INFO: Record<ChatMode, { blurb: string; icon: ReturnType<typeof ic> }> = {
  ask: { blurb: 'Quick answer to a question', icon: ic('questionmark.bubble.fill', 'help') },
  lesson: { blurb: 'Learn a topic step by step', icon: ic('graduationcap.fill', 'school') },
  practice: { blurb: 'Questions, then it marks you', icon: ic('checkmark.circle.fill', 'task_alt') },
  coding: { blurb: 'Coding exercises with feedback', icon: ic('chevron.left.forwardslash.chevron.right', 'code') },
  assignment: { blurb: 'Help with one assignment', icon: ic('doc.text.fill', 'assignment') },
};
const PLACEHOLDER: Record<ChatMode, string> = {
  ask: 'Your question', lesson: 'Topic to learn (blank = Claude picks)', practice: 'Topic to practise (optional)',
  coding: 'What to practise coding (optional)', assignment: 'What you need help with (optional)',
};

export function Chats({ data }: { data: CourseData }) {
  const t = useTheme();
  const accent = useAccent().color;
  const notice = useNotice();
  const [mode, setMode] = useState<ChatMode>('ask');
  const hasRec = data.materials.some((m) => m.status === 'ready' && m.outline?.kind === 'recording');
  const [likeLecture, setLikeLecture] = useState(false);
  const [topic, setTopic] = useState('');
  const asg = data.deadlines.filter(isAssignment);
  const [asgId, setAsgId] = useState<string | null>(null);
  const c = data.course!;

  async function start() {
    const d = mode === 'assignment' ? asg.find((x) => x.id === (asgId ?? asg[0]?.id)) : null;
    if (mode === 'assignment' && !d) { notice('Add an assignment first', 'Create it in Materials or Deadlines.'); return; }
    if (mode === 'ask' && !topic.trim()) { notice('Type your question first'); return; }
    try { await openNewChat({ courseId: c.id, mode, topic, deadline: d, courseCode: c.code, modifier: likeLecture && hasRec ? 'like_lecture' : undefined }); setTopic(''); }
    catch (e) { notice("Couldn't start the chat", (e as Error).message); }
  }

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <T variant="heading">Start a new chat</T>
        <T variant="small" muted>Pick what kind of help you want. The tutor uses this course's files and remembers what you tell it.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MODES.map((m) => {
            const on = mode === m;
            return (
              <Pressy key={m} onPress={() => setMode(m)} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ flexGrow: 1, flexBasis: 150, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: on ? accent : 'transparent', backgroundColor: on ? tint(accent, t.dark ? 0.24 : 0.12) : t.surface }}>
                <Icon name={MODE_INFO[m].icon} size={26} color={on ? ink(accent, t) : t.muted} />
                <View style={{ flex: 1 }}>
                  <T variant="strong" color={on ? ink(accent, t) : t.text}>{MODE_LABEL[m]}</T>
                  <T variant="small" muted>{MODE_INFO[m].blurb}</T>
                </View>
              </Pressy>
            );
          })}
        </View>
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
        {hasRec && (
          <Pressy onPress={() => setLikeLecture(!likeLecture)} accessibilityRole="switch" accessibilityState={{ checked: likeLecture }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: likeLecture ? '#E5385F' : 'transparent', backgroundColor: likeLecture ? tint('#E5385F', t.dark ? 0.2 : 0.1) : t.surface }}>
            <Icon name={ic('mic.fill', 'mic')} size={24} color={likeLecture ? '#FF7AA8' : t.muted} />
            <View style={{ flex: 1 }}>
              <T variant="strong">Explain it like my lecture</T>
              <T variant="small" muted>Uses your lecture recordings: the same order, examples and wording your lecturer used.</T>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: likeLecture ? '#E5385F' : t.muted, backgroundColor: likeLecture ? '#E5385F' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {likeLecture && <Icon name={ic('checkmark', 'check')} size={14} color="#FFFFFF" />}
            </View>
          </Pressy>
        )}
        <Field placeholder={PLACEHOLDER[mode]} value={topic} onChangeText={setTopic} multiline />
        <Button title="Start chat" icon={ic('arrow.right', 'arrow_forward')} onPress={start} />
      </View>
      <View>
        {data.chats.length > 0 && <T variant="heading" style={{ marginBottom: space.sm }}>Your chats</T>}
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
