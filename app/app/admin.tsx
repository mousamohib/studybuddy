// Admin dashboard: stats, users, reports and controls. Only reachable for admins (the server checks every call).
// Shows account-level information only: never students' chats, files or notes.
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Button, Card, Field, Icon, ic, Pill, Pressy, Row, Screen, Segments, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError } from '@/lib/api';
import { adminApi, type AdminUser, type LogRow, type Overview, type Report, type Settings } from '@/lib/admin';
import { useWide } from '@/lib/useWide';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

type Tab = 'overview' | 'users' | 'reports' | 'controls';

const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : Math.round(n)}`;
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  return m < 60 ? `${Math.max(1, Math.round(m))}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 43200 ? `${Math.round(m / 1440)}d ago` : new Date(iso).toLocaleDateString();
};
const PLAN: Record<AdminUser['plan'], { label: string; color: string }> = {
  pro: { label: 'Pro (paying)', color: '#0F9F74' }, granted: { label: 'Pro (given)', color: '#8B4DF0' }, trial: { label: 'Trial', color: '#F07A12' }, free: { label: 'Free', color: '#8A8FB5' },
};

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, padding: space.lg, gap: 4, borderRadius: radius.md, backgroundColor: tint(color, t.dark ? 0.2 : 0.12), borderLeftWidth: 5, borderLeftColor: color }}>
      <T variant="label" muted>{label}</T>
      <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 34, color: t.text }}>{value}</Text>
      {sub ? <T variant="small" muted>{sub}</T> : null}
    </View>
  );
}

function Bars({ data }: { data: { date: string; n: number }[] }) {
  const t = useTheme();
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110 }}>
        {data.map((d) => (
          <View key={d.date} accessibilityLabel={`${d.date}: ${d.n}`} style={{ flex: 1, height: `${Math.max(4, (d.n / max) * 100)}%`, backgroundColor: d.n ? t.accent : t.surface, borderRadius: 2 }} />
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="tiny" muted>{new Date(data[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T>
        <T variant="tiny" muted>today</T>
      </Row>
    </View>
  );
}

function List({ rows, empty }: { rows: { name: string; n: number | string }[]; empty: string }) {
  if (!rows.length) return <T variant="small" muted>{empty}</T>;
  return <View style={{ gap: 6 }}>{rows.map((r) => <Row key={r.name} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><T numberOfLines={1} style={{ flex: 1 }}>{r.name}</T><T variant="strong">{r.n}</T></Row>)}</View>;
}

function OverviewTab({ go }: { go: (t: Tab) => void }) {
  const t = useTheme();
  const [o, setO] = useState<Overview | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { setErr(''); adminApi.overview().then(setO).catch((e) => setErr((e as ApiError).message)); }, []);
  useEffect(load, [load]);
  if (err) return <Card><T style={{ color: t.danger }}>{err}</T><Button title="Try again" small kind="soft" onPress={load} /></Card>;
  if (!o) return <ActivityIndicator style={{ marginTop: 40 }} />;
  const pct = Math.min(1, o.ai.spent / Math.max(0.01, o.ai.budget));
  return (
    <View style={{ gap: space.lg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="small" muted>This month: {o.month}</T>
        <Button title="Refresh" small kind="soft" icon={ic('arrow.clockwise', 'refresh')} onPress={() => { setO(null); load(); }} />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <Stat label="Users" value={o.users.total} sub={`+${o.users.week} this week · +${o.users.today} today`} color="#3442F5" />
        <Stat label="Active (7 days)" value={o.users.active7} sub={`${o.users.active30} in 30 days`} color="#0F9F74" />
        <Stat label="Paying Pro" value={o.plans.pro} sub={`${o.plans.granted} given free · ${o.plans.trial} on trial`} color="#8B4DF0" />
        <Stat label="Revenue (est.)" value={`£${o.revenue_estimate_gbp.toFixed(2)}`} sub="per month, until payments report real amounts" color="#C99A00" />
        <Stat label="Open reports" value={o.open_reports} sub={o.open_reports ? 'Tap Reports to review' : 'All clear'} color={o.open_reports ? '#E5385F' : '#8A8FB5'} />
        <Stat label="Finished sign-up" value={`${o.users.total ? Math.round((o.users.onboarded / o.users.total) * 100) : 0}%`} sub={`${o.users.onboarded} of ${o.users.total}`} color="#F07A12" />
      </View>

      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="heading">AI spend</T>
          {o.ai.paused ? <Pill label="AI paused" color={t.danger} /> : null}
        </Row>
        <Text style={{ fontFamily: font.display, fontSize: 26, color: t.text }}>{usd(o.ai.spent)} <Text style={{ fontFamily: font.medium, fontSize: 16, color: t.muted }}>of {usd(o.ai.budget)} budget</Text></Text>
        <View style={{ height: 12, borderRadius: 6, backgroundColor: t.surface, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: pct > 0.85 ? t.danger : pct > 0.6 ? t.warn : t.good }} />
        </View>
        <T variant="small" muted>About {usd(o.ai.per_active)} per active student this month. Change the budget in Controls.</T>
        {o.ai.top.length > 0 && <T variant="label" muted style={{ marginTop: 6 }}>Biggest AI users this month</T>}
        {o.ai.top.map((u) => <Row key={u.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}><T numberOfLines={1} style={{ flex: 1 }}>{u.email}</T><T variant="small" muted>{u.messages} msgs · </T><T variant="strong">{usd(u.cost)}</T></Row>)}
      </Card>

      <Card style={{ gap: space.md }}>
        <T variant="heading">Sign-ups, last 30 days</T>
        <Bars data={o.signups} />
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <Card style={{ flexGrow: 1, flexBasis: 240, gap: space.sm }}>
          <T variant="heading">This month's use</T>
          <List rows={[{ name: 'Files uploaded', n: o.usage.uploads }, { name: 'Tutor messages', n: o.usage.messages }, { name: 'Revision & cheat sheets', n: o.usage.sheets }, { name: 'Practice papers', n: o.usage.papers }]} empty="" />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 240, gap: space.sm }}>
          <T variant="heading">Content</T>
          <List rows={[{ name: 'Courses', n: o.content.courses }, { name: 'Files', n: o.content.files }, { name: 'Storage', n: `${o.content.storage_mb} MB` }, { name: 'Chats', n: o.content.chats }, { name: 'School calendars connected', n: o.content.calendar_feeds }]} empty="" />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 240, gap: space.sm }}>
          <T variant="heading">Top schools</T>
          <List rows={o.schools} empty="No schools yet." />
          <T variant="label" muted style={{ marginTop: 6 }}>Countries</T>
          <List rows={o.countries.map((c) => ({ name: c.name === 'CA' ? 'Canada' : c.name === 'GB' ? 'United Kingdom' : c.name, n: c.n }))} empty="None yet." />
        </Card>
      </View>
      <Button title="See all users" kind="soft" onPress={() => go('users')} />
    </View>
  );
}

function UserCard({ u, reload }: { u: AdminUser; reload: () => void }) {
  const t = useTheme();
  const { confirm } = useMenu();
  const notice = useNotice();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try { await fn(); notice(done); reload(); } catch (e) { notice("Couldn't do that", (e as ApiError).message); }
    setBusy('');
  };
  const pro = u.plan === 'pro' || u.plan === 'granted';
  return (
    <Card style={{ gap: space.sm, opacity: u.banned ? 0.6 : 1 }}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ gap: 4 }}>
        <Row style={{ flexWrap: 'nowrap' }}>
          <T variant="strong" numberOfLines={1} style={{ flex: 1 }}>{u.email}</T>
          <Pill label={PLAN[u.plan].label} color={PLAN[u.plan].color} />
          {u.banned ? <Pill label="Banned" color={t.danger} /> : null}
          <Icon name={open ? ic('chevron.up', 'expand_less') : ic('chevron.down', 'expand_more')} size={18} color={t.muted} />
        </Row>
        <T variant="small" muted numberOfLines={1}>{[u.name, u.school, u.country].filter(Boolean).join(' · ') || 'No profile yet'}</T>
        <T variant="small" muted>Joined {ago(u.created_at)} · active {ago(u.last_active)} · {u.courses} courses · {u.files} files · AI {usd(u.month.cost)}</T>
      </Pressable>
      {open && (
        <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderColor: t.border }}>
          <T variant="small">This month: {u.month.messages} tutor messages · {u.month.uploads} uploads · {u.month.sheets} sheets · {u.month.papers} papers{u.onboarded ? '' : ' · hasn\'t finished sign-up'}</T>
          <Row>
            <Button title={pro ? 'Remove Pro' : 'Give Pro free'} small kind="soft" loading={busy === 'plan'}
              onPress={() => act('plan', () => adminApi.setPlan(u.id, pro ? 'free' : 'pro'), pro ? 'Moved to Free' : 'Pro given')} />
            <Button title="Reset this month's limits" small kind="soft" loading={busy === 'reset'}
              onPress={() => act('reset', () => adminApi.resetUsage(u.id), 'Limits reset')} />
            <Button title={u.banned ? 'Unban' : 'Ban'} small kind="soft" color={t.warn} loading={busy === 'ban'}
              onPress={async () => { if (u.banned || await confirm(`Ban ${u.email}?`, "They won't be able to sign in until you unban them. Their data stays.", 'Ban')) act('ban', () => adminApi.ban(u.id, !u.banned), u.banned ? 'Unbanned' : 'Banned'); }} />
            <Button title="Delete account" small kind="soft" color={t.danger} loading={busy === 'del'}
              onPress={async () => { if (await confirm(`Delete ${u.email}?`, 'This permanently deletes their account, courses, files and chats. It cannot be undone.', 'Delete forever')) act('del', () => adminApi.deleteUser(u.id), 'Account deleted'); }} />
          </Row>
        </View>
      )}
    </Card>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'new' | 'active' | 'cost'>('new');
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const load = useCallback((p = 0) => {
    adminApi.users(q, sort, p).then((r) => { setTotal(r.total); setRows((prev) => (p ? [...(prev ?? []), ...r.users] : r.users)); setPage(p); }).catch(() => setRows([]));
  }, [q, sort]);
  useEffect(() => { const h = setTimeout(() => load(0), 250); return () => clearTimeout(h); }, [load]);
  return (
    <View style={{ gap: space.md }}>
      <Field placeholder="Search by email, name or school" value={q} onChangeText={setQ} autoCapitalize="none" />
      <Segments items={[{ key: 'new', label: 'Newest' }, { key: 'active', label: 'Recently active' }, { key: 'cost', label: 'Most AI used' }]} value={sort} onChange={setSort} />
      {rows === null ? <ActivityIndicator /> : <T variant="small" muted>{total} user{total === 1 ? '' : 's'}</T>}
      {rows?.map((u) => <UserCard key={u.id} u={u} reload={() => load(0)} />)}
      {rows && rows.length < total && <Button title="Load more" kind="soft" onPress={() => load(page + 1)} />}
    </View>
  );
}

function ReportsTab() {
  const t = useTheme();
  const [rows, setRows] = useState<Report[] | null>(null);
  const [show, setShow] = useState<'open' | 'all'>('open');
  const load = useCallback(() => { adminApi.reports().then((r) => setRows(r.reports)).catch(() => setRows([])); }, []);
  useEffect(load, [load]);
  const list = (rows ?? []).filter((r) => show === 'all' || !r.resolved_at);
  return (
    <View style={{ gap: space.md }}>
      <T variant="small" muted>Answers and sheets students flagged as wrong or inappropriate. Only the flagged text is shown, never the rest of their chat.</T>
      <Segments items={[{ key: 'open', label: 'Open' }, { key: 'all', label: 'All' }]} value={show} onChange={setShow} />
      {rows === null && <ActivityIndicator />}
      {rows && !list.length && <Card flat><T muted>{show === 'open' ? 'No open reports.' : 'No reports yet.'}</T></Card>}
      {list.map((r) => (
        <Card key={r.id} style={{ gap: space.sm, opacity: r.resolved_at ? 0.6 : 1 }}>
          <Row style={{ flexWrap: 'nowrap' }}>
            <Pill label={r.reason || 'report'} color={t.danger} />
            <T variant="small" muted style={{ flex: 1 }} numberOfLines={1}>{r.email ?? 'deleted user'} · {ago(r.created_at)}</T>
          </Row>
          <T variant="small" numberOfLines={8}>{r.excerpt || '(no text)'}</T>
          <Button title={r.resolved_at ? 'Reopen' : 'Mark as dealt with'} small kind="soft" onPress={() => adminApi.resolve(r.id, !!r.resolved_at).then(load)} />
        </Card>
      ))}
    </View>
  );
}

function ControlsTab() {
  const t = useTheme();
  const notice = useNotice();
  const [s, setS] = useState<Settings | null>(null);
  const [f, setF] = useState({ budget: '', free: '', pro: '' });
  const [log, setLog] = useState<LogRow[]>([]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    adminApi.settings().then(({ settings }) => { setS(settings); setF({ budget: String(settings.ai_budget_usd), free: String(settings.free_cap_usd), pro: String(settings.pro_cap_usd) }); }).catch(() => {});
    adminApi.log().then((r) => setLog(r.log)).catch(() => {});
  }, []);
  useEffect(load, [load]);
  const save = async (patch: Partial<Settings>, msg: string) => {
    setSaving(true);
    try { const r = await adminApi.saveSettings(patch); setS(r.settings); notice(msg); load(); } catch (e) { notice("Couldn't save", (e as ApiError).message); }
    setSaving(false);
  };
  if (!s) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ gap: space.md, borderColor: s.ai_paused ? t.danger : t.border }}>
        <T variant="heading">{s.ai_paused ? 'AI is paused' : 'AI is on'}</T>
        <T variant="small" muted>Pausing stops every AI feature for everyone at once (tutor, syllabus reading, sheets). Plans, deadlines, calendars and files keep working. Use it if costs spike or something goes wrong.</T>
        <Button title={s.ai_paused ? 'Turn AI back on' : 'Pause AI for everyone'} kind={s.ai_paused ? 'primary' : 'soft'} color={s.ai_paused ? t.good : t.danger} loading={saving}
          onPress={() => save({ ai_paused: !s.ai_paused }, s.ai_paused ? 'AI is back on' : 'AI paused')} />
      </Card>
      <Card style={{ gap: space.md }}>
        <T variant="heading">Spending limits (US$ per month)</T>
        <Field label="Total AI budget for everyone" value={f.budget} onChangeText={(v) => setF({ ...f, budget: v })} keyboardType="decimal-pad" hint="When reached, AI pauses with a friendly message until next month." />
        <Field label="Per free user" value={f.free} onChangeText={(v) => setF({ ...f, free: v })} keyboardType="decimal-pad" />
        <Field label="Per Pro user" value={f.pro} onChangeText={(v) => setF({ ...f, pro: v })} keyboardType="decimal-pad" />
        <Button title="Save limits" loading={saving} onPress={() => save({ ai_budget_usd: Number(f.budget), free_cap_usd: Number(f.free), pro_cap_usd: Number(f.pro) }, 'Limits saved')} />
      </Card>
      <Card style={{ gap: space.sm }}>
        <T variant="heading">Admins</T>
        <T variant="small" muted>Admins are set on the server, not in the app, so nobody can make themselves one. To add or remove someone, run in the project folder:</T>
        <View style={{ padding: space.md, backgroundColor: t.surface, borderRadius: radius.sm }}><T variant="small" style={{ fontFamily: 'monospace' }}>npx supabase secrets set ADMIN_EMAILS=you@email.com,friend@email.com</T></View>
      </Card>
      <Card style={{ gap: space.sm }}>
        <T variant="heading">Recent admin actions</T>
        {!log.length && <T variant="small" muted>Nothing yet.</T>}
        {log.map((l, i) => <T key={i} variant="small"><T variant="small" muted>{ago(l.created_at)} · {l.admin_email}: </T>{l.action.replace(/_/g, ' ')}{l.target ? ` (${l.target.slice(0, 8)}…)` : ''}</T>)}
      </Card>
    </View>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const wide = useWide();
  return (
    <Screen wide={wide}>
      <Stack.Screen options={{ title: 'Admin' }} />
      <Row style={{ flexWrap: 'nowrap' }}>
        <Icon name={ic('checkmark.shield.fill', 'verified_user')} size={32} />
        <T variant="display">Admin</T>
      </Row>
      <Segments items={[{ key: 'overview', label: 'Overview' }, { key: 'users', label: 'Users' }, { key: 'reports', label: 'Reports' }, { key: 'controls', label: 'Controls' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab go={setTab} />}
      {tab === 'users' && <UsersTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'controls' && <ControlsTab />}
    </Screen>
  );
}
