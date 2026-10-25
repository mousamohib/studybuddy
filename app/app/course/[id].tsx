import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AccentProvider, Button, ic, Row, Screen, Segments, T } from '@/components/ui';
import { Chats } from '@/components/course/Chats';
import { Deadlines } from '@/components/course/Deadlines';
import { Materials } from '@/components/course/Materials';
import { Memory } from '@/components/course/Memory';
import { Revision } from '@/components/course/Revision';
import { Settings } from '@/components/course/Settings';
import { useCourse } from '@/components/course/useCourse';
import { openNewChat } from '@/lib/chats';
import { courseColour, daysUntil, KIND_LABEL, type Course } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { font, radius, space, useTheme } from '@/lib/theme';

type Section = 'materials' | 'deadlines' | 'revision' | 'chats' | 'memory' | 'settings';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'materials', label: 'Files' }, { key: 'deadlines', label: 'Deadlines' }, { key: 'revision', label: 'Exam prep' },
  { key: 'chats', label: 'Chats' }, { key: 'memory', label: 'Memory' }, { key: 'settings', label: 'Settings' },
];

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Text style={{ color: '#fff', fontFamily: font.display, fontSize: 22, lineHeight: 26 }}>{n}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: font.semi, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

export default function CourseHub() {
  const t = useTheme();
  const { id, section } = useLocalSearchParams<{ id: string; section?: Section }>();
  const data = useCourse(id);
  const [tab, setTab] = useState<Section>(section && SECTIONS.some((s) => s.key === section) ? section : 'materials');
  const [col, setCol] = useState<string | null>(null);

  // The course's colour depends on its place in the list, so look that up once.
  useEffect(() => {
    if (!data.course) return;
    supabase.from('courses').select('*').order('created_at').then(({ data: cs }) => {
      const i = (cs ?? []).findIndex((c) => c.id === id);
      setCol(courseColour((cs?.[i] ?? data.course) as Course, Math.max(0, i)));
    });
  }, [data.course, id]);

  if (data.loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.accent} /></View>;
  if (!data.course) return <Screen><T>This course no longer exists.</T></Screen>;
  const c = data.course, colour = col ?? courseColour(c, 0);
  const next = data.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0)[0];
  const ready = data.materials.filter((m) => m.status === 'ready').length;
  const topics = data.materials.reduce((a, m) => a + (m.outline?.topics?.length ?? 0), 0);

  return (
    <Screen>
      <Stack.Screen options={{ title: '', headerStyle: { backgroundColor: colour }, headerTintColor: '#FFFFFF' }} />
      <View style={{ backgroundColor: colour, marginHorizontal: -space.lg, marginTop: -space.lg, paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, gap: space.lg, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#fff', fontFamily: font.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.2 }}>{c.code}</Text>
          {c.name ? <Text style={{ color: 'rgba(255,255,255,0.9)', fontFamily: font.medium, fontSize: 16 }}>{c.name}</Text> : null}
        </View>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Stat n={ready} label={ready === 1 ? 'file' : 'files'} />
          <Stat n={topics} label="topics" />
          <Stat n={next ? (daysUntil(next.due_at) === 0 ? 'Today' : `${daysUntil(next.due_at)}d`) : '–'} label={next ? `to ${next.label || KIND_LABEL[next.kind]}` : 'no deadlines'} />
        </Row>
        <Button title={`Ask about ${c.code}`} kind="highlight" icon={ic('bubble.left.fill', 'chat_bubble')}
          onPress={() => openNewChat({ courseId: c.id, mode: 'ask', topic: '', courseCode: c.code }).catch(() => router.push({ pathname: '/course/[id]', params: { id: c.id, section: 'chats' } }))} />
      </View>
      <View style={{ marginHorizontal: -space.lg, paddingHorizontal: space.lg }}><Segments items={SECTIONS} value={tab} onChange={setTab} color={colour} /></View>
      <AccentProvider value={colour}>
        {tab === 'materials' && <Materials data={data} />}
        {tab === 'deadlines' && <Deadlines data={data} />}
        {tab === 'revision' && <Revision data={data} />}
        {tab === 'chats' && <Chats data={data} />}
        {tab === 'memory' && <Memory data={data} />}
        {tab === 'settings' && <Settings data={data} />}
      </AccentProvider>
    </Screen>
  );
}
