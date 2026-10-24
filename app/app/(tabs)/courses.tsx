import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Card, Empty, Field, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

type Course = { id: string; code: string; name: string | null; created_at: string };

export default function Courses() {
  const t = useTheme();
  const { plan, limits } = useAccount();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('courses').select('id, code, name, created_at').order('created_at');
    setCourses(data ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const atLimit = (courses?.length ?? 0) >= limits.courses;

  async function add() {
    setErr('');
    const c = code.trim().toUpperCase().replace(/\s+/g, ' ');
    if (!c) { setErr('Enter a course code, e.g. COMP 535.'); return; }
    setBusy(true);
    const { error } = await supabase.from('courses').insert({ code: c, name: name.trim() || null });
    setBusy(false);
    if (error) { setErr(error.message.includes('course_limit') ? 'The free plan allows 2 courses. Upgrade to Pro for more.' : error.message); return; }
    setCode(''); setName(''); setAdding(false); load();
  }

  function remove(c: Course) {
    Alert.alert(`Delete ${c.code}?`, 'This deletes its files, deadlines, chats and sheets. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('courses').delete().eq('id', c.id); load(); } },
    ]);
  }

  return (
    <Screen>
      <T variant="title">Courses</T>
      {courses?.length === 0 && !adding && (
        <Empty title="No courses yet" body="Add a course to upload its syllabus, slides and assignments." action={<Button title="Add a course" onPress={() => setAdding(true)} />} />
      )}
      {courses?.map((c) => (
        <Pressable key={c.id} onLongPress={() => remove(c)}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: t.accent }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '600' }}>{c.code}</T>
              {c.name ? <T variant="small" muted>{c.name}</T> : null}
            </View>
            <T variant="small" muted>Files, deadlines and chats in step 2</T>
          </Card>
        </Pressable>
      ))}
      {adding ? (
        <Card style={{ gap: space.md }}>
          <T variant="heading">New course</T>
          <Field label="Course code" placeholder="COMP 535" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <Field label="Course name (optional)" placeholder="Computer Networks" value={name} onChangeText={setName} />
          {err ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Add course" onPress={add} loading={busy} style={{ flex: 1 }} />
            <Button title="Cancel" kind="ghost" onPress={() => { setAdding(false); setErr(''); }} />
          </View>
        </Card>
      ) : courses && courses.length > 0 ? (
        atLimit && plan === 'free'
          ? <Button title="Upgrade to add more courses" kind="secondary" onPress={() => router.push('/paywall')} />
          : <Button title="Add a course" kind="secondary" onPress={() => setAdding(true)} />
      ) : null}
      {courses && courses.length > 0 && <T variant="small" muted>Long-press a course to delete it.</T>}
    </Screen>
  );
}
