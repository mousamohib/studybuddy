import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Button, Card, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { LIMITS, USAGE_LABELS, type UsageField } from '@/lib/limits';
import { space, useTheme } from '@/lib/theme';

// PAYMENTS PLACEHOLDER. The real purchase flow (RevenueCat in the app, Stripe on the web) plugs in at
// `startPurchase`. It must end by writing plan='pro' to the user's row in the `subscriptions` table
// (server side), then calling refresh(). Nothing else in the app needs to change.
async function startPurchase(period: 'monthly' | 'yearly'): Promise<boolean> {
  Alert.alert('Coming soon', `Payments aren't connected yet (${period}). This button is a placeholder.`);
  return false;
}

export default function Paywall() {
  const t = useTheme();
  const { plan, refresh } = useAccount();
  const rows: UsageField[] = ['uploads', 'tutor_messages', 'weekly_sheets', 'exam_sheets', 'papers'];

  async function buy(period: 'monthly' | 'yearly') {
    if (await startPurchase(period)) { await refresh(); router.back(); }
  }

  return (
    <Screen>
      <T variant="title">Study without limits</T>
      <T muted>Pro gives you room for a whole semester of courses, files, tutoring and exam prep.</T>
      <Card>
        <View style={{ flexDirection: 'row', paddingBottom: space.sm }}>
          <T variant="label" muted style={{ flex: 1 }}>Each month</T>
          <T variant="label" muted style={{ width: 64, textAlign: 'right' }}>Free</T>
          <T variant="label" style={{ width: 72, textAlign: 'right', color: t.accent }}>Pro</T>
        </View>
        {[['Courses', LIMITS.free.courses, LIMITS.pro.courses] as const, ...rows.map((r) => [USAGE_LABELS[r], LIMITS.free[r], LIMITS.pro[r]] as const)].map(([label, f, p]) => (
          <View key={label} style={{ flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderColor: t.border }}>
            <T variant="small" style={{ flex: 1 }}>{label}</T>
            <T variant="small" muted style={{ width: 64, textAlign: 'right' }}>{f}</T>
            <T variant="small" style={{ width: 72, textAlign: 'right', fontWeight: '600' }}>{p >= 1000 ? 'Unlimited' : p}</T>
          </View>
        ))}
      </Card>
      {plan === 'pro' ? (
        <Card><T>You're on Pro. Thanks for supporting StudyBuddy.</T></Card>
      ) : (
        <View style={{ gap: space.md }}>
          <Button title="C$9.99 / £6.99 a month" onPress={() => buy('monthly')} />
          <Button title="C$69.99 / £49.99 a year (save 40%)" kind="secondary" onPress={() => buy('yearly')} />
          <T variant="small" muted>New accounts start with a 7-day Pro trial. Cancel any time in your app store settings.</T>
        </View>
      )}
    </Screen>
  );
}
