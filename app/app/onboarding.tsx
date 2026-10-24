import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { askNotificationPermission } from '@/lib/reminders';
import { STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

export default function Onboarding() {
  const t = useTheme();
  const { session, refresh } = useAccount();
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

  const Stepper = ({ label, value, set }: { label: string; value: number; set: (n: number) => void }) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <T>{label}</T>
      <Row>
        <Button title="−" kind="secondary" onPress={() => set(Math.max(0, value - 0.5))} style={{ paddingHorizontal: 14 }} />
        <T style={{ width: 60, textAlign: 'center', fontWeight: '600' }}>{value} h</T>
        <Button title="+" kind="secondary" onPress={() => set(Math.min(12, value + 0.5))} style={{ paddingHorizontal: 14 }} />
      </Row>
    </Row>
  );

  return (
    <Screen style={{ paddingTop: 64, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <T variant="label" muted>Step {step + 1} of 3</T>
      {step === 0 && (
        <>
          <T variant="title">Welcome to StudyBuddy</T>
          <T muted>Upload a syllabus and course files, and StudyBuddy plans your study, teaches every topic, and makes cheat sheets and practice papers for your exams.</T>
          <Field label="Your university or college (optional)" placeholder="McGill University" value={school} onChangeText={setSchool} />
          <Button title="Next" onPress={() => setStep(1)} />
        </>
      )}
      {step === 1 && (
        <>
          <T variant="title">How should it teach you?</T>
          <T muted>You can change this per course, per chat, or on any single answer.</T>
          {STYLE_OPTIONS.filter((s) => s.key !== 'custom').map((s) => (
            <Pressable key={s.key} onPress={() => setStyle(s.key)}>
              <Card style={{ borderColor: style === s.key ? t.accent : t.border, borderWidth: style === s.key ? 2 : 1 }}>
                <T style={{ fontWeight: '600' }}>{s.name}</T>
                <T variant="small" muted>{s.blurb}</T>
              </Card>
            </Pressable>
          ))}
          <Row><Button title="Next" onPress={() => setStep(2)} /><Button title="Back" kind="ghost" onPress={() => setStep(0)} /></Row>
        </>
      )}
      {step === 2 && (
        <>
          <T variant="title">How much time do you have?</T>
          <T muted>Roughly how many hours a day you can study. The plan stays within this and leaves room for events in your calendar.</T>
          <Card style={{ gap: space.md }}>
            <Stepper label="Weekdays" value={weekday} set={setWeekday} />
            <Stepper label="Weekends" value={weekend} set={setWeekend} />
          </Card>
          <T variant="small" muted>Next, StudyBuddy asks to send reminders: today's plan, deadlines and exam countdowns. You can turn each off in Profile.</T>
          <View style={{ gap: space.sm }}>
            <Button title="Add my first course" onPress={() => finish(true)} loading={busy} />
            <Button title="Skip for now" kind="ghost" onPress={() => finish(false)} />
          </View>
        </>
      )}
    </Screen>
  );
}
