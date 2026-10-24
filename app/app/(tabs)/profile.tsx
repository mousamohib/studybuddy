import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Button, Card, Field, LinkText, Meter, Row, Screen, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { useAccount } from '@/lib/auth';
import { downloadMarkdown } from '@/lib/export';
import { USAGE_LABELS, type UsageField } from '@/lib/limits';
import { askCalendarPermission, askNotificationPermission, refreshPhoneSchedule } from '@/lib/reminders';
import { STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Prof = { teaching_style: string; custom_rules: string | null; integrity_mode: boolean; study_hours: Record<string, number>; notify: { daily: boolean; deadlines: boolean; exams: boolean }; calendar_sync: boolean; school: string | null };

export default function Profile() {
  const t = useTheme();
  const { session, plan, trialEndsAt, usage, limits, refresh } = useAccount();
  const { confirm } = useMenu();
  const notice = useNotice();
  const [p, setP] = useState<Prof | null>(null);
  const [rules, setRules] = useState('');
  const [deleting, setDeleting] = useState(false);
  const uid = session!.user.id;

  useFocusEffect(useCallback(() => {
    refresh();
    supabase.from('profiles').select('*').maybeSingle().then(({ data }) => { if (data) { setP(data as Prof); setRules(data.custom_rules ?? ''); } });
  }, [refresh]));

  async function update(patch: Partial<Prof>, after?: () => void) {
    if (!p) return;
    setP({ ...p, ...patch });
    await supabase.from('profiles').update(patch).eq('id', uid);
    after?.();
  }

  async function toggleNotify(k: keyof Prof['notify'], v: boolean) {
    if (v && !(await askNotificationPermission())) { notice('Notifications are off', 'Allow notifications for StudyBuddy in your phone settings.'); return; }
    update({ notify: { ...p!.notify, [k]: v } }, () => refreshPhoneSchedule());
  }
  async function toggleCalendar(v: boolean) {
    if (v && !(await askCalendarPermission())) { notice('Calendar access is off', 'Allow calendar access in your phone settings.'); return; }
    update({ calendar_sync: v }, () => refreshPhoneSchedule());
  }
  async function toggleIntegrity(v: boolean) {
    await update({ integrity_mode: v });
    if (!v) notice('Integrity mode off', "Your school's rules on AI still apply to graded work.");
  }

  async function exportData() {
    const tables = ['profiles', 'courses', 'deadlines', 'materials', 'plans', 'chats', 'memory', 'documents'] as const;
    const out: Record<string, unknown> = {};
    for (const tb of tables) out[tb] = (await supabase.from(tb).select('*')).data;
    await downloadMarkdown('StudyBuddy data export', '```json\n' + JSON.stringify(out, null, 2) + '\n```');
  }

  async function deleteAccount() {
    if (!(await confirm('Delete your account?', 'This permanently deletes your courses, files, chats, sheets and papers. It cannot be undone.', 'Delete everything'))) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    setDeleting(false);
    if (error) { notice("Couldn't delete", 'Try again in a moment.'); return; }
    await supabase.auth.signOut();
  }

  const fields: UsageField[] = ['uploads', 'tutor_messages', 'weekly_sheets', 'exam_sheets', 'papers'];
  const native = Platform.OS !== 'web';

  return (
    <Screen>
      <T variant="title">Profile</T>
      <Card>
        <T variant="label" muted>Account</T>
        <T>{session?.user.email}</T>
        {p?.school ? <T variant="small" muted>{p.school}</T> : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="heading">{plan === 'pro' ? (trialEndsAt ? 'Pro trial' : 'Pro') : 'Free'}</T>
          {plan === 'free' || trialEndsAt ? <Button title="Upgrade" onPress={() => router.push('/paywall')} /> : null}
        </Row>
        {trialEndsAt && <T variant="small" muted>Trial ends {new Date(trialEndsAt).toLocaleDateString()}</T>}
        <T variant="label" muted>This month</T>
        {fields.map((f) => <Meter key={f} label={USAGE_LABELS[f]} used={usage[f]} limit={limits[f]} />)}
      </Card>

      {p && (
        <>
          <Card style={{ gap: space.md }}>
            <T variant="heading">Teaching style</T>
            <T variant="small" muted>Your default. Each course and chat can override it, and you can reshape any single answer by tapping it.</T>
            <Row>{STYLE_OPTIONS.map((s) => (
              <Pressable key={s.key} onPress={() => update({ teaching_style: s.key })} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: p.teaching_style === s.key ? t.accent : t.border }}>
                <T variant="small">{s.name}</T>
              </Pressable>
            ))}</Row>
            {p.teaching_style === 'custom' && (
              <>
                <Field label="Your rules" placeholder="e.g. Teach background maths first, show every step, put source references only at the top…" value={rules} onChangeText={setRules} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
                <Button title="Save rules" kind="secondary" onPress={() => update({ custom_rules: rules.trim() || null }, () => notice('Saved'))} />
              </>
            )}
          </Card>

          <Card style={{ gap: space.md }}>
            <T variant="heading">Study hours per day</T>
            <Row>{DAYS.map((d) => (
              <View key={d} style={{ alignItems: 'center', gap: 4 }}>
                <T variant="small" muted>{d}</T>
                <Field value={String(p.study_hours[d] ?? 3)} keyboardType="decimal-pad" style={{ width: 52, textAlign: 'center', paddingHorizontal: 4 }}
                  onChangeText={(v) => setP({ ...p, study_hours: { ...p.study_hours, [d]: Math.max(0, Math.min(16, Number(v.replace(',', '.')) || 0)) } })}
                  onEndEditing={() => update({ study_hours: p.study_hours })} onBlur={() => update({ study_hours: p.study_hours })} />
              </View>
            ))}</Row>
          </Card>

          <Card style={{ gap: space.md }}>
            <T variant="heading">Reminders and calendar</T>
            {!native && <T variant="small" muted>Reminders and calendar sync work in the phone app.</T>}
            {([['daily', "Today's plan, each morning"], ['deadlines', 'Assignment deadlines'], ['exams', 'Exam countdowns']] as const).map(([k, label]) => (
              <Row key={k} style={{ justifyContent: 'space-between' }}><T>{label}</T><Switch disabled={!native} value={p.notify?.[k] ?? false} onValueChange={(v) => toggleNotify(k, v)} trackColor={{ true: t.accent, false: t.border }} /></Row>
            ))}
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}><T>Sync with my phone calendar</T><T variant="small" muted>Adds a "StudyBuddy" calendar with your plan and deadlines.</T></View>
              <Switch disabled={!native} value={p.calendar_sync} onValueChange={toggleCalendar} trackColor={{ true: t.accent, false: t.border }} />
            </Row>
          </Card>

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={{ fontWeight: '600' }}>Integrity mode</T>
              <T variant="small" muted>For assignments, the tutor explains and reviews your work but won't write answers you'd submit.</T>
            </View>
            <Switch value={p.integrity_mode} onValueChange={toggleIntegrity} trackColor={{ true: t.accent, false: t.border }} />
          </Card>
        </>
      )}

      <Card style={{ gap: space.md }}>
        <Row><LinkText title="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} /><LinkText title="Terms of Use" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} /></Row>
        <Button title="Export my data" kind="secondary" onPress={exportData} />
        <Button title="Sign out" kind="secondary" onPress={() => supabase.auth.signOut()} />
        <Button title="Delete account" kind="danger" onPress={deleteAccount} loading={deleting} />
      </Card>
    </Screen>
  );
}
