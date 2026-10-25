import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, Switch, Text, View } from 'react-native';
import { Button, Card, Field, Icon, ic, LinkText, ListRow, Meter, Pressy, Row, Screen, Section, T } from '@/components/ui';
import { SchoolPicker } from '@/components/SchoolPicker';
import { useMenu, useNotice } from '@/components/Menu';
import { useAccount } from '@/lib/auth';
import { downloadMarkdown } from '@/lib/export';
import { USAGE_LABELS, type UsageField } from '@/lib/limits';
import { askCalendarPermission, askNotificationPermission, refreshPhoneSchedule } from '@/lib/reminders';
import { STYLE_LOOK, STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

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
  const [school, setSchool] = useState('');
  const [editSchool, setEditSchool] = useState(false);
  const uid = session!.user.id;

  useFocusEffect(useCallback(() => {
    refresh();
    supabase.from('profiles').select('*').maybeSingle().then(({ data }) => { if (data) { setP(data as Prof); setRules(data.custom_rules ?? ''); setSchool(data.school ?? ''); } });
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
  const displayName = (session?.user.user_metadata?.display_name as string | undefined)?.trim();
  const native = Platform.OS !== 'web';

  return (
    <Screen>
      <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.highlight, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}>
          <Text style={{ fontFamily: font.display, fontSize: 28, color: t.onHighlight }}>{(displayName || session?.user.email || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={1}>{displayName || 'You'}</T>
          <T variant="small" muted numberOfLines={1}>{session?.user.email}</T>
        </View>
      </Row>

      {p && (editSchool ? (
        <View style={{ gap: space.md, zIndex: 5 }}>
          <SchoolPicker value={school} onChange={setSchool} country={session?.user.user_metadata?.country === 'GB' ? 'GB' : 'CA'} />
          <Row><Button title="Save" small onPress={() => update({ school: school.trim() || null }, () => setEditSchool(false))} /><Button title="Cancel" small kind="ghost" onPress={() => { setSchool(p.school ?? ''); setEditSchool(false); }} /></Row>
        </View>
      ) : (
        <ListRow onPress={() => setEditSchool(true)} last>
          <Icon name={ic('building.columns.fill', 'account_balance')} size={22} color={t.accent} />
          <T variant="strong" style={{ flex: 1 }}>{p.school || 'Add your school'}</T>
          <T variant="label" color={t.accent}>Edit</T>
        </ListRow>
      ))}

      <View style={{ backgroundColor: t.accent, borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -50, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <View>
            <Text style={{ color: t.onAccent, fontFamily: font.display, fontSize: 28 }}>{plan === 'pro' ? (trialEndsAt ? 'Pro trial' : 'Pro') : 'Free'}</Text>
            {trialEndsAt && <Text style={{ color: t.onAccent, opacity: 0.85, fontFamily: font.medium }}>Until {new Date(trialEndsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</Text>}
          </View>
          {plan === 'free' || trialEndsAt ? <Button title="Upgrade" kind="highlight" small onPress={() => router.push('/paywall')} /> : null}
        </Row>
      </View>
      <Section title="Used this month">
        {fields.map((f, i) => <Meter key={f} label={USAGE_LABELS[f]} used={usage[f]} limit={limits[f]} color={['#3442F5', '#F0457E', '#0F9F74', '#F07A12', '#8B4DF0'][i]} />)}
      </Section>

      {p && (
        <>
          <Card style={{ gap: space.md }}>
            <T variant="heading">Teaching style</T>
            <T variant="small" muted>Your default. Each course and chat can override it, and you can reshape any single answer by tapping it.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{STYLE_OPTIONS.map((s) => {
              const look = STYLE_LOOK[s.key], on = p.teaching_style === s.key;
              return (
                <Pressy key={s.key} onPress={() => update({ teaching_style: s.key })} accessibilityRole="radio" accessibilityState={{ checked: on }}
                  style={{ flexGrow: 1, flexBasis: 140, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: on ? tint(look.color, t.dark ? 0.2 : 0.12) : t.surface }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: look.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={ic(look.ios, look.material)} size={16} color="#FFFFFF" /></View>
                  <T variant="label" style={{ flex: 1 }}>{s.name}</T>
                </Pressy>
              );
            })}</View>
            {p.teaching_style === 'custom' && (
              <>
                <Field label="Your rules" placeholder="e.g. Teach background maths first, show every step, put source references only at the top…" value={rules} onChangeText={setRules} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
                <Button title="Save rules" kind="secondary" onPress={() => update({ custom_rules: rules.trim() || null }, () => notice('Saved'))} />
              </>
            )}
          </Card>

          <Card style={{ gap: space.md }}>
            <T variant="heading">Study hours per day</T>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: 6 }}>{DAYS.map((d) => (
              <View key={d} style={{ flex: 1, alignItems: 'stretch', gap: 4 }}>
                <T variant="tiny" muted style={{ textAlign: 'center' }}>{d}</T>
                <Field value={String(p.study_hours[d] ?? 3)} keyboardType="decimal-pad" style={{ textAlign: 'center', paddingHorizontal: 2, minWidth: 0 }}
                  onChangeText={(v) => setP({ ...p, study_hours: { ...p.study_hours, [d]: Math.max(0, Math.min(16, Number(v.replace(',', '.')) || 0)) } })}
                  onEndEditing={() => update({ study_hours: p.study_hours })} onBlur={() => update({ study_hours: p.study_hours })} />
              </View>
            ))}</Row>
          </Card>

          <Card style={{ gap: space.md }}>
            <Row><Icon name={ic('bell.fill', 'notifications')} size={20} color={t.warn} /><T variant="heading">Reminders and calendar</T></Row>
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
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint(t.good, 0.15), alignItems: 'center', justifyContent: 'center' }}><Icon name={ic('checkmark.shield.fill', 'verified_user')} size={22} color={t.good} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="strong">Integrity mode</T>
              <T variant="small" muted>For assignments, the tutor explains and reviews your work but won't write answers you'd submit.</T>
            </View>
            <Switch value={p.integrity_mode} onValueChange={toggleIntegrity} trackColor={{ true: t.accent, false: t.border }} />
          </Card>
        </>
      )}

      <Card style={{ gap: space.md }}>
        <Row><LinkText title="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} /><LinkText title="Terms of Use" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} /></Row>
        <Button title="Export my data" kind="soft" icon={ic('square.and.arrow.down', 'download')} onPress={exportData} />
        <Button title="Sign out" kind="soft" icon={ic('rectangle.portrait.and.arrow.right', 'logout')} onPress={() => supabase.auth.signOut()} />
        <Button title="Delete account" kind="ghost" color={t.danger} onPress={deleteAccount} loading={deleting} />
      </Card>
    </Screen>
  );
}
