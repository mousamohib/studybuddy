// A shared sheet or paper, readable by anyone with the link (no account needed).
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DocView } from '@/components/DocView';
import { Card, Screen, T } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function Shared() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [doc, setDoc] = useState<{ title: string; body: string; kind: string; course_code: string } | null | undefined>(undefined);
  useEffect(() => { supabase.rpc('get_shared_document', { token }).then(({ data }) => setDoc((data as any)?.[0] ?? null)); }, [token]);
  if (doc === undefined) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  return (
    <Screen style={{ maxWidth: 820, width: '100%', alignSelf: 'center' }}>
      <Stack.Screen options={{ title: doc?.title ?? 'StudyBuddy' }} />
      {doc ? (
        <>
          <T variant="title">{doc.title}</T>
          <T muted>{doc.course_code} · shared from StudyBuddy</T>
          <DocView kind={doc.kind} body={doc.body} />
        </>
      ) : <Card><T variant="heading">This link doesn't work</T><T muted>It may have been turned off by the person who shared it.</T></Card>}
    </Screen>
  );
}
