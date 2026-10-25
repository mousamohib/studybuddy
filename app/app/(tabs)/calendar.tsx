import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Button, Card, CourseTag, IconButton, ic, Row, Screen, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { PlanSession, type FullSession } from '@/components/PlanSession';
import { daysUntil, fmtDay, fmtTime, KIND_LABEL, localISO } from '@/lib/data';
import { askCalendarPermission, refreshPhoneSchedule } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { usePlan } from '@/lib/usePlan';
import { font, radius, space, tint, useTheme } from '@/lib/theme';
import { Text } from 'react-native';
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
  const cellW = Math.floor((Math.min(width, 760) - space.lg * 2 - space.sm * 2 - 2) / 7);
  const todayKey = localISO(new Date());
  const selSessions = byDate.get(sel) ?? [];
  const selDue = dueBy.get(sel) ?? [];
  const codeOf = (id: string) => p.courses.find((c) => c.id === id)?.code ?? '';

  async function sync() {
    if (Platform.OS === 'web') { notice('Calendar sync works in the phone app', 'Open Scrawlie on your iPhone or Android phone to sync.'); return; }
    if (!(await askCalendarPermission())) { notice('Calendar access is off', 'Allow calendar access in your phone settings to sync.'); return; }
    await supabase.from('profiles').update({ calendar_sync: true }).not('id', 'is', null);
    await refreshPhoneSchedule();
    notice('Synced', 'Your plan and deadlines are in a "Scrawlie" calendar on your phone. It stays in sync as your plan changes.');
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <View>
          <T variant="small" muted>{month.getFullYear()}</T>
          <T variant="display">{month.toLocaleDateString(undefined, { month: 'long' })}</T>
        </View>
        <Row>
          <IconButton icon={ic('chevron.left', 'chevron_left')} label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <Button title="Today" small kind="soft" onPress={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(localISO(d)); }} />
          <IconButton icon={ic('chevron.right', 'chevron_right')} label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </Row>
      </Row>
      <Card style={{ padding: space.sm, gap: 4 }}>
        <View style={{ flexDirection: 'row' }}>{DOW.map((d) => <T key={d} variant="tiny" muted style={{ width: cellW, textAlign: 'center', paddingVertical: 6 }}>{d}</T>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={{ width: cellW, height: 62 }} />;
            const k = localISO(d), ss = byDate.get(k) ?? [], dues = dueBy.get(k) ?? [];
            const isSel = k === sel, isToday = k === todayKey, past = k < todayKey;
            return (
              <Pressable key={i} onPress={() => setSel(k)} accessibilityLabel={`${fmtDay(k)}: ${ss.length} sessions, ${dues.length} due`}
                style={{ width: cellW, height: 62, alignItems: 'center', paddingTop: 4, gap: 4, borderRadius: radius.md, backgroundColor: isSel ? tint(t.highlight, t.dark ? 0.22 : 0.5) : 'transparent', opacity: past && !isSel ? 0.45 : 1 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? t.accent : 'transparent' }}>
                  <Text style={{ fontFamily: isToday || isSel ? font.bold : font.medium, fontSize: 15, color: isToday ? t.onAccent : t.text }}>{d.getDate()}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', paddingHorizontal: 4 }}>
                  {dues.map((x) => <View key={x.id} style={{ height: 5, width: cellW - 14, borderRadius: 3, backgroundColor: p.colourOf(codeOf(x.course_id)) }} />)}
                  {ss.slice(0, 4).map((s) => <View key={s.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.colourOf(s.course), opacity: p.plan?.done[s.id] ? 0.3 : 1 }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="title">{sel === todayKey ? 'Today' : new Date(sel + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</T>
        {selSessions.length > 0 && <T variant="small" muted>{Math.round(selSessions.reduce((a, s) => a + s.minutes, 0) / 6) / 10} h planned</T>}
      </Row>
      {selDue.map((d) => {
        const col = p.colourOf(codeOf(d.course_id));
        return (
          <Card key={d.id} tint={col} style={{ gap: 6 }}>
            <Row><CourseTag code={codeOf(d.course_id)} color={col} /><T variant="label" color={col}>{KIND_LABEL[d.kind]} due {fmtTime(d.due_at)}{d.done ? ' · done' : ''}</T></Row>
            <T variant="heading">{d.label || KIND_LABEL[d.kind]}</T>
            {d.covers ? <T variant="small" muted>{d.covers}</T> : null}
          </Card>
        );
      })}
      {selSessions.map((s) => <PlanSession key={s.id} s={s as FullSession} done={!!p.plan?.done[s.id]} colour={p.colourOf(s.course)} onToggle={() => p.toggleDone(s.id)} courses={p.courses} deadlines={p.deadlines} />)}
      {!selSessions.length && !selDue.length && <Card flat><T muted>{daysUntil(sel) < 0 ? 'Nothing was planned.' : 'Nothing planned. A rest day.'}</T></Card>}
      <Card style={{ gap: space.md }}>
        <T variant="heading">Phone calendar</T>
        <T variant="small" muted>Put your plan and deadlines in a "Scrawlie" calendar on your phone, next to your classes. Your other events are read so the planner leaves room for them.</T>
        <Button title="Sync with my calendar" kind="soft" icon={ic('arrow.triangle.2.circlepath', 'sync')} onPress={sync} />
      </Card>
    </Screen>
  );
}
