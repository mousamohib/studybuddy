import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Button, Card, Meter, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { USAGE_LABELS, type UsageField } from '@/lib/limits';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

export default function Profile() {
  const t = useTheme();
  const { session, plan, trialEndsAt, usage, limits, refresh } = useAccount();
  const [integrity, setIntegrity] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(useCallback(() => {
    refresh();
    supabase.from('profiles').select('integrity_mode').maybeSingle().then(({ data }) => setIntegrity(!!data?.integrity_mode));
  }, [refresh]));

  async function toggleIntegrity(v: boolean) {
    setIntegrity(v);
    await supabase.from('profiles').update({ integrity_mode: v }).eq('id', session!.user.id);
    if (!v) Alert.alert('Integrity mode off', "Your school's rules on AI still apply to graded work.");
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', 'This permanently deletes your courses, files, chats and sheets. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: async () => {
        setDeleting(true);
        const { error } = await supabase.functions.invoke('delete-account');
        setDeleting(false);
        if (error) { Alert.alert("Couldn't delete", 'Try again in a moment.'); return; }
        await supabase.auth.signOut();
      } },
    ]);
  }

  const fields: UsageField[] = ['uploads', 'tutor_messages', 'weekly_sheets', 'exam_sheets', 'papers'];

  return (
    <Screen>
      <T variant="title">Profile</T>
      <Card>
        <T variant="label" muted>Account</T>
        <T>{session?.user.email}</T>
      </Card>
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T variant="heading">{plan === 'pro' ? (trialEndsAt ? 'Pro trial' : 'Pro') : 'Free'}</T>
          {plan === 'free' && <Button title="Upgrade" onPress={() => router.push('/paywall')} />}
        </View>
        {trialEndsAt && <T variant="small" muted>Trial ends {new Date(trialEndsAt).toLocaleDateString()}</T>}
        <T variant="label" muted>This month</T>
        {fields.map((f) => <Meter key={f} label={USAGE_LABELS[f]} used={usage[f]} limit={limits[f]} />)}
      </Card>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '600' }}>Integrity mode</T>
          <T variant="small" muted>For assignments, the tutor explains and reviews your work but won't write answers you'd submit.</T>
        </View>
        <Switch value={integrity} onValueChange={toggleIntegrity} trackColor={{ true: t.accent, false: t.border }} />
      </Card>
      <Card style={{ gap: space.md }}>
        <T variant="small" muted>Notifications, calendar sync and teaching styles arrive in build steps 3 and 4. Dark mode follows your phone.</T>
        <Button title="Sign out" kind="secondary" onPress={() => supabase.auth.signOut()} />
        <Button title="Delete account" kind="danger" onPress={confirmDelete} loading={deleting} />
      </Card>
    </Screen>
  );
}
