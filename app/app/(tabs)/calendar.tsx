import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Card, LinkText, Row, Screen, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { PlanSession, type FullSession } from '@/components/PlanSession';
import { daysUntil, fmtDay, fmtTime, KIND_LABEL, localISO } from '@/lib/data';
import { askCalendarPermission, refreshPhoneSchedule } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { usePlan } from '@/lib/usePlan';
import { radius, space, useTheme } from '@/lib/theme';
import { Platform } from 'react-native';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarTab() {
  const t = useTheme();
  const notice = useNotice();
  const { width } = useWindowDimensions();
  const p = usePlan();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(localISO(new Date()));
  const byDate = useMemo(() => new Map((p.plan?.days ?? []).map((d) => [d.date, d.sessions])), [p.plan]);
  const dueBy = useMemo(() => {
    const m = new Map<string, typeof p.deadlines>();
    for (const d of p.deadlines) { const k = localISO(new Date(d.due_at)); m.set(k, [...(m.get(k) ?? []), d]); }
    return m;
  }, [p.deadlines]);

  const cells: (Date | null)[] = [];
  const lead = (month.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  const cellW = (Math.min(width, 720) - space.lg * 2) / 7;
  const todayKey = localISO(new Date());
  const selSessions = byDate.get(sel) ?? [];
  const selDue = dueBy.get(sel) ?? [];
  const codeOf = (id: string) => p.courses.find((c) => c.id === id)?.code ?? '';

  async function sync() {
    if (Platform.OS === 'web') { notice('Calendar sync works in the phone app', 'Open StudyBuddy on your iPhone or Android phone to sync.'); return; }
    if (!(await askCalendarPermission())) { notice('Calendar access is off', 'Allow calendar access in your phone settings to sync.'); return; }
    await supabase.from('profiles').update({ calendar_sync: true }).not('id', 'is', null);
    await refreshPhoneSchedule();
    notice('Synced', 'Your plan and deadlines are in a "StudyBuddy" calendar on your phone. It stays in sync as your plan changes.');
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="title">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</T>
        <Row>
          <LinkText title="‹" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <LinkText title="Today" onPress={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(localISO(d)); }} />
          <LinkText title="›" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </Row>
      </Row>
      <View>
        <View style={{ flexDirection: 'row' }}>{DOW.map((d) => <T key={d} variant="label" muted style={{ width: cellW, textAlign: 'center' }}>{d}</T>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: cellW, height: 64 }} />;
            const k = localISO(d), ss = byDate.get(k) ?? [], dues = dueBy.get(k) ?? [];
            const mins = ss.reduce((a, s) => a + s.minutes, 0);
            const isSel = k === sel, isToday = k === todayKey;
            return (
              <Pressable key={i} onPress={() => setSel(k)} accessibilityLabel={`${fmtDay(k)}: ${ss.length} sessions, ${dues.length} due`}
                style={{ width: cellW, height: 64, padding: 3 }}>
                <View style={{ flex: 1, borderRadius: radius.sm, borderWidth: isSel ? 2 : 1, borderColor: isSel ? t.accent : t.border, padding: 3, gap: 2, opacity: k < todayKey ? 0.5 : 1, backgroundColor: t.card }}>
                  <T variant="small" style={{ fontWeight: isToday ? '700' : '400', color: isToday ? t.accent : t.text }}>{d.getDate()}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
                    {dues.map((x) => <View key={x.id} style={{ height: 4, width: '100%', borderRadius: 2, backgroundColor: p.colourOf(codeOf(x.course_id)) }} />)}
                    {ss.slice(0, 4).map((s) => <View key={s.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.colourOf(s.course), opacity: p.plan?.done[s.id] ? 0.3 : 1 }} />)}
                  </View>
                  {mins > 0 && <T variant="small" muted style={{ fontSize: 10, marginTop: 'auto' }}>{Math.round(mins / 6) / 10}h</T>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <T variant="heading">{fmtDay(sel)}</T>
      {selDue.map((d) => (
        <Card key={d.id} style={{ borderLeftWidth: 4, borderLeftColor: p.colourOf(codeOf(d.course_id)), gap: 2 }}>
          <T variant="small" style={{ fontWeight: '700', color: p.colourOf(codeOf(d.course_id)) }}>{codeOf(d.course_id)} · {KIND_LABEL[d.kind]} {d.done ? '✓' : ''}</T>
          <T style={{ fontWeight: '600' }}>{d.label || KIND_LABEL[d.kind]} at {fmtTime(d.due_at)}</T>
          {d.covers ? <T variant="small" muted>{d.covers}</T> : null}
        </Card>
      ))}
      {selSessions.map((s) => <PlanSession key={s.id} s={s as FullSession} done={!!p.plan?.done[s.id]} colour={p.colourOf(s.course)} onToggle={() => p.toggleDone(s.id)} courses={p.courses} deadlines={p.deadlines} />)}
      {!selSessions.length && !selDue.length && <T muted>{daysUntil(sel) < 0 ? 'Nothing was planned.' : 'Nothing planned. A rest day.'}</T>}
      <Card style={{ gap: space.sm }}>
        <T style={{ fontWeight: '600' }}>Phone calendar</T>
        <T variant="small" muted>Put your plan and deadlines in a "StudyBuddy" calendar on your phone, next to your classes. Your other events are read so the planner leaves room for them.</T>
        <LinkText title="Sync with my calendar" onPress={sync} />
      </Card>
    </Screen>
  );
}
