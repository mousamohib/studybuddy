import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

type Deadline = { id: string; kind: string; label: string | null; due_at: string; courses: { code: string } | null };

export default function Today() {
  const t = useTheme();
  const { session, trialEndsAt } = useAccount();
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [next, setNext] = useState<Deadline[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [{ count }, { data }] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('deadlines').select('id, kind, label, due_at, courses(code)').eq('done', false)
          .gte('due_at', new Date().toISOString()).order('due_at').limit(5),
      ]);
      setCourseCount(count ?? 0);
      setNext((data as unknown as Deadline[]) ?? []);
    })();
  }, []));

  const name = (session?.user.user_metadata?.display_name as string | undefined)?.split(' ')[0];
  const days = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T variant="title">{name ? `Hi ${name}` : 'Today'}</T>
        <T muted>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
      </View>
      {trialEndsAt && (
        <Card style={{ borderColor: t.accent }}>
          <T variant="small">Pro trial until {new Date(trialEndsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.</T>
        </Card>
      )}
      {courseCount === 0 ? (
        <Empty title="Set up your semester"
          body="Add your first course and upload its syllabus. StudyBuddy pulls out the deadlines and exams and builds your study plan."
          action={<Button title="Add a course" onPress={() => router.push('/courses')} />} />
      ) : (
        <>
          <T variant="label" muted>Next up</T>
          {next.length === 0 ? (
            <T muted>No upcoming deadlines yet.</T>
          ) : next.map((d) => (
            <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2, flex: 1 }}>
                <T variant="small" muted>{d.courses?.code}</T>
                <T style={{ fontWeight: '600' }}>{d.label || d.kind[0].toUpperCase() + d.kind.slice(1)}</T>
              </View>
              <T variant="small" style={{ color: days(d.due_at) <= 3 ? t.danger : t.muted }}>
                {days(d.due_at) === 0 ? 'today' : `in ${days(d.due_at)} days`}
              </T>
            </Card>
          ))}
          <T variant="label" muted>Today's plan</T>
          <Empty title="Your plan is coming" body="The study plan arrives in build step 3. For now, add courses and deadlines." />
        </>
      )}
    </Screen>
  );
}
