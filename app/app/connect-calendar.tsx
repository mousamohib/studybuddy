// Connect a school calendar feed. Deadlines profs post on Brightspace / Canvas / Moodle / Blackboard
// show up in Scrawlie by themselves, and moved dates update the plan.
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, Field, Icon, ic, LinkText, Pressy, Row, Screen, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError } from '@/lib/api';
import { addFeed, HOW_TO, listFeeds, removeFeed, syncFeeds, type Feed, type FeedResult } from '@/lib/calendarFeeds';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';

function summary(r: FeedResult | null) {
  if (!r) return 'Not synced yet';
  if (r.error) return r.error;
  const parts = [`${r.matched} deadline${r.matched === 1 ? '' : 's'} matched to your courses`];
  if (r.added) parts.push(`${r.added} new`);
  if (r.updated) parts.push(`${r.updated} date${r.updated === 1 ? '' : 's'} changed`);
  if (r.linked) parts.push(`${r.linked} joined up with your syllabus`);
  return parts.join(' · ');
}
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString();
};

export default function ConnectCalendar() {
  const t = useTheme();
  const notice = useNotice();
  const { confirm } = useMenu();
  const [feeds, setFeeds] = useState<Feed[] | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');
  const [howOpen, setHowOpen] = useState<string | null>(HOW_TO[0].name);

  const load = useCallback(() => { listFeeds().then(setFeeds); }, []);
  useFocusEffect(load);

  async function connect() {
    if (!url.trim()) { setErr('Paste your calendar link first.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await addFeed(url.trim());
      setUrl('');
      notice('Calendar connected', summary(r.result));
      load();
    } catch (e) { setErr((e as ApiError).message); }
    setBusy(false);
  }

  async function syncNow() {
    setSyncing(true);
    try { await syncFeeds(); load(); } catch (e) { notice("Couldn't sync", (e as ApiError).message); }
    setSyncing(false);
  }

  async function addCourse(code: string) {
    const { error } = await supabase.from('courses').insert({ code, name: null });
    if (error) {
      if (error.message.includes('course_limit')) { notice('Course limit reached', 'The free plan allows 2 courses. Upgrade to Pro for more.'); return; }
      notice("Couldn't add it", error.message); return;
    }
    await syncNow();
  }

  const unmatched = (feeds ?? []).flatMap((f) => f.last_result?.unmatched ?? []);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'School calendar' }} />
      <T variant="display">Connect your school calendar</T>
      <T muted style={{ fontSize: 17, lineHeight: 25 }}>Paste your private calendar link from your school's course site once. Every assignment, quiz and exam your profs post shows up here, and if a date moves, your plan moves with it. Scrawlie checks it again each time you open the app.</T>

      {feeds && feeds.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="heading">Connected</T>
            <Button title={syncing ? 'Syncing…' : 'Sync now'} small kind="soft" icon={ic('arrow.triangle.2.circlepath', 'sync')} loading={syncing} onPress={syncNow} />
          </Row>
          {feeds.map((f) => (
            <Card key={f.id} style={{ gap: 6 }}>
              <Row style={{ flexWrap: 'nowrap' }}>
                <Icon name={ic('calendar', 'calendar_month')} size={26} color={f.last_result?.error ? t.danger : t.good} />
                <View style={{ flex: 1 }}>
                  <T variant="strong">{f.label ?? 'School calendar'}</T>
                  <T variant="small" muted>Last checked {ago(f.last_synced_at)}</T>
                </View>
                <LinkText title="Remove" color={t.muted} onPress={async () => { if (await confirm('Disconnect this calendar?', 'Deadlines it already added stay.', 'Disconnect')) { await removeFeed(f.id); load(); } }} />
              </Row>
              <T variant="small" style={{ color: f.last_result?.error ? t.danger : t.text }}>{summary(f.last_result)}</T>
            </Card>
          ))}
          {unmatched.length > 0 && (
            <Card style={{ gap: space.sm }}>
              <T variant="strong">Deadlines for courses you haven't added</T>
              <T variant="small" muted>Add the course and its deadlines come in on the next sync. Then upload its slides to unlock the tutor.</T>
              {unmatched.map((u) => (
                <Row key={u.code} style={{ flexWrap: 'nowrap' }}>
                  <T style={{ flex: 1 }}>{u.code} · {u.count} deadline{u.count === 1 ? '' : 's'}</T>
                  <Button title="Add course" small onPress={() => addCourse(u.code)} />
                </Row>
              ))}
            </Card>
          )}
        </View>
      )}

      <Card style={{ gap: space.md }}>
        <Field label={feeds?.length ? 'Add another calendar link' : 'Your calendar link'} placeholder="https://… or webcal://…" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        {err ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
        <Button title="Connect" icon={ic('link', 'link')} onPress={connect} loading={busy} />
        <T variant="small" muted>The link is private to you. Scrawlie only reads dates from it and never posts anything to your school's site.</T>
      </Card>

      <T variant="heading">Where to find the link</T>
      {HOW_TO.map((h) => {
        const on = howOpen === h.name;
        return (
          <Pressy key={h.name} haptics={false} onPress={() => setHowOpen(on ? null : h.name)} style={{ padding: space.lg, gap: space.sm, borderRadius: radius.md, backgroundColor: t.surface }}>
            <Row style={{ flexWrap: 'nowrap' }}>
              <View style={{ flex: 1 }}><T variant="strong">{h.name}</T><T variant="small" muted>{h.where}</T></View>
              <Icon name={on ? ic('chevron.up', 'expand_less') : ic('chevron.down', 'expand_more')} size={20} color={t.muted} />
            </Row>
            {on && h.steps.map((s, i) => <T key={i}>{i + 1}. {s}</T>)}
          </Pressy>
        );
      })}
      <T variant="small" muted>Can't find it? Your school may call it Subscribe, Export, iCal or Calendar feed. Some schools turn it off; if so, upload your syllabuses instead.</T>
      {feeds === null && <ActivityIndicator />}
      <Button title="Done" kind="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
