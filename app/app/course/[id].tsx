import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Screen, Segments, T } from '@/components/ui';
import { Chats } from '@/components/course/Chats';
import { Deadlines } from '@/components/course/Deadlines';
import { Materials } from '@/components/course/Materials';
import { Memory } from '@/components/course/Memory';
import { Revision } from '@/components/course/Revision';
import { Settings } from '@/components/course/Settings';
import { useCourse } from '@/components/course/useCourse';
import { space } from '@/lib/theme';

type Section = 'materials' | 'deadlines' | 'revision' | 'chats' | 'memory' | 'settings';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'materials', label: 'Materials' }, { key: 'deadlines', label: 'Deadlines' }, { key: 'revision', label: 'Revision' },
  { key: 'chats', label: 'Chats' }, { key: 'memory', label: 'Memory' }, { key: 'settings', label: 'Settings' },
];

export default function CourseHub() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: Section }>();
  const data = useCourse(id);
  const [tab, setTab] = useState<Section>(section && SECTIONS.some((s) => s.key === section) ? section : 'materials');

  if (data.loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!data.course) return <Screen><T>This course no longer exists.</T></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: data.course.code }} />
      {data.course.name ? <T muted>{data.course.name}</T> : null}
      <View style={{ marginHorizontal: -space.lg, paddingHorizontal: space.lg }}><Segments items={SECTIONS} value={tab} onChange={setTab} /></View>
      {tab === 'materials' && <Materials data={data} />}
      {tab === 'deadlines' && <Deadlines data={data} />}
      {tab === 'revision' && <Revision data={data} />}
      {tab === 'chats' && <Chats data={data} />}
      {tab === 'memory' && <Memory data={data} />}
      {tab === 'settings' && <Settings data={data} />}
    </Screen>
  );
}
