import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Icon, ic, Pressy, Row, Screen, Stickers, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { useAccount } from '@/lib/auth';
import { LIMITS, USAGE_LABELS, type UsageField } from '@/lib/limits';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

// PAYMENTS PLACEHOLDER. The real purchase flow (RevenueCat in the app, Stripe on the web) plugs in at
// `startPurchase`. It must end by writing plan='pro' to the user's row in the `subscriptions` table
// (server side), then calling refresh(). Nothing else in the app needs to change.
async function startPurchase(_period: 'monthly' | 'yearly'): Promise<boolean> {
  return false;
}

export default function Paywall() {
  const t = useTheme();
  const notice = useNotice();
  const { plan, trialEndsAt, refresh } = useAccount();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const rows: UsageField[] = ['uploads', 'tutor_messages', 'weekly_sheets', 'exam_sheets', 'papers'];

  async function buy() {
    if (await startPurchase(period)) { await refresh(); router.back(); }
    else notice('Payments are coming soon', "Subscriptions aren't switched on yet. Everything in Pro is unlocked during your trial.");
  }

  const Option = ({ k, title, price, note }: { k: 'monthly' | 'yearly'; title: string; price: string; note?: string }) => {
    const on = period === k;
    return (
      <Pressy onPress={() => setPeriod(k)} accessibilityRole="radio" accessibilityState={{ checked: on }}
        style={{ flex: 1, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? t.accent : 'transparent', backgroundColor: on ? t.accentSoft : t.surface, gap: 4 }}>
        {note ? <View style={{ position: 'absolute', top: -11, right: 12, backgroundColor: t.highlight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}><Text style={{ fontFamily: font.bold, fontSize: 11.5, color: t.onHighlight }}>{note}</Text></View> : null}
        <T variant="label" muted>{title}</T>
        <T variant="heading">{price}</T>
      </Pressy>
    );
  };

  return (
    <Screen>
      <View style={{ alignItems: 'flex-start', gap: space.md, paddingTop: space.md }}>
        <Stickers size={44} />
        <T variant="display">A whole semester, no limits</T>
        <T muted style={{ fontSize: 17, lineHeight: 25 }}>Room for every course, file and exam, with a tutor you can ask as often as you need.</T>
      </View>

      <View>
        <Row style={{ paddingVertical: space.sm, flexWrap: 'nowrap', borderBottomWidth: 2, borderColor: t.text }}>
          <T variant="label" muted style={{ flex: 1 }}>Each month</T>
          <T variant="label" muted style={{ width: 56, textAlign: 'center' }}>Free</T>
          <T variant="label" color={t.accent} style={{ width: 84, textAlign: 'center' }}>Pro</T>
        </Row>
        {[['Courses', LIMITS.free.courses, LIMITS.pro.courses] as const, ...rows.map((r) => [USAGE_LABELS[r], LIMITS.free[r], LIMITS.pro[r]] as const)].map(([label, f, p], i) => (
          <Row key={label} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: t.border, flexWrap: 'nowrap' }}>
            <T variant="small" style={{ flex: 1 }}>{label}</T>
            <T variant="small" muted style={{ width: 56, textAlign: 'center' }}>{f}</T>
            <View style={{ width: 84, alignItems: 'center' }}>
              <View style={{ backgroundColor: tint(t.accent, 0.12), borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.accent }}>{p >= 1000 ? 'No limit' : p}</Text>
              </View>
            </View>
          </Row>
        ))}
      </View>

      {plan === 'pro' && !trialEndsAt ? (
        <Card tint={t.good}><Row><Icon name={ic('checkmark.seal.fill', 'verified')} color={t.good} /><T variant="strong">You're on Pro. Thanks for supporting Scrawlie.</T></Row></Card>
      ) : (
        <View style={{ gap: space.md }}>
          <Row style={{ flexWrap: 'nowrap', gap: space.md, paddingTop: 8 }}>
            <Option k="monthly" title="Monthly" price="C$9.99 / £6.99" />
            <Option k="yearly" title="Yearly" price="C$69.99 / £49.99" note="Save 40%" />
          </Row>
          <Button title={period === 'yearly' ? 'Get Pro for a year' : 'Get Pro monthly'} onPress={buy} />
          <T variant="small" muted style={{ textAlign: 'center' }}>{trialEndsAt ? `Your free Pro trial runs until ${new Date(trialEndsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}. ` : ''}Cancel any time in your app store settings.</T>
        </View>
      )}
    </Screen>
  );
}
