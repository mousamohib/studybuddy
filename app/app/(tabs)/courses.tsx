import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Empty, Row, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { courseColour, daysUntil, relDays, type Course } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

type C = Course & { deadlines: { kind: string; label: string | null; due_at: string; done: boolean }[]; materials: { id: string }[] };

export default function Courses() {
  const t = useTheme();
  const { plan, limits } = useAccount();
  const [courses, setCourses] = useState<C[] | null>(null);

  useFocusEffect(useCallback(() => {
    supabase.from('courses').select('*, deadlines(kind, label, due_at, done), materials(id)').order('created_at')
      .then(({ data }) => setCourses((data ?? []) as C[]));
  }, []));

  const atLimit = (courses?.length ?? 0) >= limits.courses;

  return (
    <Screen>
      <T variant="title">Courses</T>
      {courses?.length === 0 && (
        <Empty title="No courses yet" body="Add a course from its syllabus: StudyBuddy pulls out the deadlines and exams and builds your plan."
          action={<Button title="Add a course" onPress={() => router.push('/course/new')} />} />
      )}
      {courses?.map((c, i) => {
        const next = c.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0).sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
        return (
          <Pressable key={c.id} onPress={() => router.push({ pathname: '/course/[id]', params: { id: c.id } })}>
            <Card style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 6, borderRadius: 3, backgroundColor: courseColour(c, i) }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontWeight: '600' }}>{c.code}</T>
                {c.name ? <T variant="small" muted>{c.name}</T> : null}
                <Row style={{ marginTop: 4 }}>
                  <T variant="small" muted>{c.materials.length} file{c.materials.length === 1 ? '' : 's'}</T>
                  {next ? <T variant="small" style={{ color: daysUntil(next.due_at) <= 3 ? t.danger : t.muted }}>· Next: {next.label || next.kind} {relDays(daysUntil(next.due_at))}</T> : null}
                </Row>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {courses && courses.length > 0 && (atLimit && plan === 'free'
        ? <Button title="Upgrade to add more courses" kind="secondary" onPress={() => router.push('/paywall')} />
        : <Button title="Add a course" kind="secondary" onPress={() => router.push('/course/new')} />)}
    </Screen>
  );
}
