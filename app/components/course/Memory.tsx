import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Check, Field, IconButton, ic, LinkText, Row, T, useAccent } from '@/components/ui';
import { openNewChat } from '@/lib/chats';
import type { MemoryItem } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

export function Memory({ data }: { data: CourseData }) {
  const t = useTheme();
  const accent = useAccent().color;
  const [fact, setFact] = useState('');
  const [rev, setRev] = useState('');
  const c = data.course!;
  const facts = data.memory.filter((m) => m.kind === 'fact');
  const revisit = data.memory.filter((m) => m.kind === 'revisit').sort((a, b) => Number(a.done) - Number(b.done));

  async function add(kind: 'fact' | 'revisit', text: string, clear: () => void) {
    if (!text.trim()) return;
    await supabase.from('memory').insert({ course_id: c.id, kind, text: text.trim(), source: 'you' });
    clear(); data.reload();
  }
  const remove = async (m: MemoryItem) => { await supabase.from('memory').delete().eq('id', m.id); data.reload(); };
  const toggle = async (m: MemoryItem) => { await supabase.from('memory').update({ done: !m.done }).eq('id', m.id); data.reload(); };

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <T variant="heading">What the tutor remembers</T>
        <T variant="small" muted>Every {c.code} chat sees these. The tutor adds facts when you tell it something lasting, like a weak spot or exam details.</T>
        {facts.map((m) => (
          <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: accent }} />
            <T style={{ flex: 1 }}>{m.text}</T>
            <LinkText title="Forget" color={t.muted} onPress={() => remove(m)} />
          </Card>
        ))}
        <Row style={{ flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}><Field placeholder="Something the tutor should always remember" value={fact} onChangeText={setFact} /></View>
          <Button title="Add" kind="soft" onPress={() => add('fact', fact, () => setFact(''))} />
        </Row>
      </View>
      <View style={{ gap: space.sm }}>
        <T variant="heading">Revisit later</T>
        <T variant="small" muted>Topics to come back to. The plan fits them in after the syllabus is covered.</T>
        {revisit.map((m) => (
          <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, opacity: m.done ? 0.5 : 1 }}>
            <Check checked={m.done} onPress={() => toggle(m)} color={accent} />
            <T style={{ flex: 1, textDecorationLine: m.done ? 'line-through' : 'none' }}>{m.text}</T>
            {!m.done && <Button title="Study it" small kind="soft" onPress={() => openNewChat({ courseId: c.id, mode: 'lesson', topic: `${m.text} (a topic I flagged to revisit: re-teach it from the start, then give me practice questions)`, courseCode: c.code, title: `Revisit: ${m.text.slice(0, 50)}` })} />}
            <IconButton icon={ic('xmark', 'close')} label="Remove" size={32} bg={t.surface} color={t.muted} onPress={() => remove(m)} />
          </Card>
        ))}
        <Row style={{ flexWrap: 'nowrap' }}>
          <View style={{ flex: 1 }}><Field placeholder="e.g. Harris corner derivation" value={rev} onChangeText={setRev} /></View>
          <Button title="Add" kind="soft" onPress={() => add('revisit', rev, () => setRev(''))} />
        </Row>
      </View>
    </View>
  );
}
