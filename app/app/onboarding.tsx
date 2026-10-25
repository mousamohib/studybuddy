import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button, Card, Icon, IconButton, ic, Pressy, Row, T } from '@/components/ui';
import { SchoolPicker } from '@/components/SchoolPicker';
import { useAccount } from '@/lib/auth';
import { askNotificationPermission } from '@/lib/reminders';
import { STYLE_LOOK, STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

const STEP_COLOURS = ['#3442F5', '#F0457E', '#0F9F74'];

export default function Onboarding() {
  const t = useTheme();
  const { session, refresh } = useAccount();
  const meta = session?.user.user_metadata ?? {};
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState('');
  const [style, setStyle] = useState('simple');
  const [weekday, setWeekday] = useState(3);
  const [weekend, setWeekend] = useState(4);
  const [busy, setBusy] = useState(false);

  async function finish(addCourse: boolean) {
    setBusy(true);
    const notify = await askNotificationPermission().catch(() => false);
    await supabase.from('profiles').update({
      school: school.trim() || null, teaching_style: style, onboarded: true,
      study_hours: { Mon: weekday, Tue: weekday, Wed: weekday, Thu: weekday, Fri: weekday, Sat: weekend, Sun: weekend },
      notify: { daily: notify, deadlines: notify, exams: notify },
    }).eq('id', session!.user.id);
    await refresh();
    setBusy(false);
    if (addCourse) setTimeout(() => router.push('/course/new'), 50);
  }

  const Hours = ({ label, value, set, color }: { label: string; value: number; set: (n: number) => void; color: string }) => (
    <View style={{ gap: space.md, paddingVertical: space.sm }}>
      <T variant="heading">{label}</T>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <IconButton icon={ic('minus', 'remove')} label={`Less on ${label}`} onPress={() => set(Math.max(0, value - 0.5))} size={48} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontFamily: font.display, fontSize: 48, lineHeight: 52, color, letterSpacing: -1.5 }}>{value}</Text>
          <T variant="small" muted>hours a day</T>
        </View>
        <IconButton icon={ic('plus', 'add')} label={`More on ${label}`} onPress={() => set(Math.min(12, value + 0.5))} size={48} bg={color} color="#FFFFFF" />
      </Row>
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ padding: space.lg, paddingTop: 56, paddingBottom: 48, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Row style={{ gap: 6, flexWrap: 'nowrap' }}>
        {[0, 1, 2].map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? STEP_COLOURS[i] : t.surface }} />)}
      </Row>

      <Animated.View key={step} entering={FadeInRight.duration(260)} style={{ gap: space.lg }}>
        {step === 0 && (
          <>
            <T variant="display">Welcome{meta.display_name ? `, ${String(meta.display_name).split(' ')[0]}` : ''}</T>
            <T muted style={{ fontSize: 17, lineHeight: 25 }}>Three quick questions so Scrawlie fits how you study.</T>
            <SchoolPicker value={school} onChange={setSchool} country={meta.country === 'GB' ? 'GB' : 'CA'} label="Where do you study?" />
            <T variant="small" muted>Optional. Not in the list? Just type the name.</T>
            <Button title="Next" onPress={() => setStep(1)} />
          </>
        )}
        {step === 1 && (
          <>
            <T variant="display">How should it teach you?</T>
            <T muted>You can change this for any course, chat or single answer later.</T>
            <View style={{ gap: 2, marginHorizontal: -space.md }}>
              {STYLE_OPTIONS.filter((s) => s.key !== 'custom').map((s) => {
                const look = STYLE_LOOK[s.key], on = style === s.key;
                return (
                  <Pressy key={s.key} onPress={() => setStyle(s.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg,
                      backgroundColor: on ? tint(look.color, t.dark ? 0.18 : 0.1) : 'transparent' }}>
                    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: look.color, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={ic(look.ios, look.material)} size={24} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T variant="strong">{s.name}</T>
                      <T variant="small" muted>{s.blurb}</T>
                    </View>
                    {on && <Icon name={ic('checkmark.circle.fill', 'check_circle')} size={24} color={look.color} />}
                  </Pressy>
                );
              })}
            </View>
            <Row style={{ flexWrap: 'nowrap' }}>
              <Button title="Back" kind="ghost" onPress={() => setStep(0)} />
              <Button title="Next" onPress={() => setStep(2)} style={{ flex: 1 }} />
            </Row>
          </>
        )}
        {step === 2 && (
          <>
            <T variant="display">How much time do you have?</T>
            <T muted>Your plan stays within these hours and leaves room for events in your calendar.</T>
            <Hours label="Weekdays" value={weekday} set={setWeekday} color="#3442F5" />
            <Hours label="Weekends" value={weekend} set={setWeekend} color="#F0457E" />
            <Card tint={t.highlight} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon name={ic('bell.fill', 'notifications')} size={22} color={t.dark ? t.highlight : '#8A6D00'} />
              <T variant="small" style={{ flex: 1 }}>Next, Scrawlie asks to send reminders: today's plan, deadlines and exam countdowns. Turn each off any time in your profile.</T>
            </Card>
            <Button title="Add my first course" icon={ic('plus', 'add')} onPress={() => finish(true)} loading={busy} />
            <Row style={{ flexWrap: 'nowrap' }}>
              <Button title="Back" kind="ghost" onPress={() => setStep(1)} />
              <Button title="Skip for now" kind="ghost" onPress={() => finish(false)} style={{ flex: 1 }} />
            </Row>
          </>
        )}
      </Animated.View>
    </ScrollView>
  );
}
