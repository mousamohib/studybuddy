import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, Empty, Field, LinkText, Row, Screen, T } from '@/components/ui';
import { PlanSession, type FullSession } from '@/components/PlanSession';
import { useAccount } from '@/lib/auth';
import { daysUntil, fmtDay, isAssignment, KIND_LABEL, localISO, relDays } from '@/lib/data';
import { Rich } from '@/components/Rich';
import { usePlan } from '@/lib/usePlan';
import { space, useTheme } from '@/lib/theme';

const CHIPS = ['Only my next exam for the next 2 days', 'Make today lighter, I only have 2 hours', 'Take tomorrow off', "I'm behind, fold missed sessions into this week"];

export default function Today() {
  const t = useTheme();
  const { session, trialEndsAt } = useAccount();
  const p = usePlan();
  const [req, setReq] = useState('');
  const [reply, setReply] = useState('');
  const todayKey = localISO(new Date());
  const today = p.plan?.days.find((d) => d.date === todayKey);
  const missed = (p.plan?.days ?? []).filter((d) => d.date < todayKey).flatMap((d) => d.sessions).filter((s) => !p.plan?.done[s.id]);
  const next = p.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0).slice(0, 4);
  const name = (session?.user.user_metadata?.display_name as string | undefined)?.split(' ')[0];

  async function ask() {
    if (!req.trim()) return;
    const r = await p.change(req.trim());
    if (r) setReply(r);
    setReq('');
  }

  if (!p.courses.length && p.plan) {
    return (
      <Screen>
        <T variant="title">{name ? `Hi ${name}` : 'Welcome'}</T>
        <Empty title="Set up your semester" body="Add your first course from its syllabus. StudyBuddy pulls out the deadlines and exams and builds your study plan."
          action={<Button title="Add a course" onPress={() => router.push('/course/new')} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T variant="title">{name ? `Hi ${name}` : 'Today'}</T>
        <T muted>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
      </View>
      {trialEndsAt && <T variant="small" muted>Pro trial until {fmtDay(trialEndsAt)}.</T>}

      {next.length > 0 && (
        <View style={{ gap: space.sm }}>
          <T variant="label" muted>Next up</T>
          <Row style={{ alignItems: 'stretch' }}>
            {next.map((d) => {
              const n = daysUntil(d.due_at), code = p.courses.find((c) => c.id === d.course_id)?.code ?? '';
              return (
                <Card key={d.id} style={{ flexGrow: 1, flexBasis: 150, gap: 2, borderTopWidth: 3, borderTopColor: p.colourOf(code) }}>
                  <T variant="small" style={{ color: p.colourOf(code), fontWeight: '700' }}>{code}</T>
                  <T style={{ fontWeight: '600' }}>{d.label || KIND_LABEL[d.kind]}</T>
                  <T variant="small" style={{ color: n <= 3 ? t.danger : t.muted }}>{fmtDay(d.due_at)} · {relDays(n)}{isAssignment(d) ? '' : ''}</T>
                </Card>
              );
            })}
          </Row>
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="label" muted>Today's plan</T>
          {!p.busy && p.plan?.generated_at ? <LinkText title="Update" onPress={() => p.rebuild()} /> : null}
        </Row>
        {p.busy && <Row><ActivityIndicator /><T variant="small" muted>{p.busy}</T></Row>}
        {p.error ? <T variant="small" style={{ color: t.danger }}>{p.error}</T> : null}
        {today?.sessions.length ? today.sessions.map((s) => (
          <PlanSession key={s.id} s={s as FullSession} done={!!p.plan?.done[s.id]} colour={p.colourOf(s.course)} onToggle={() => p.toggleDone(s.id)} courses={p.courses} deadlines={p.deadlines} />
        )) : !p.busy && <T muted>{p.plan?.generated_at ? 'Nothing planned today. Rest, or get ahead.' : next.length ? 'Your plan will appear here shortly.' : 'Add deadlines to a course and your plan builds itself.'}</T>}
        {missed.length > 0 && <T variant="small" style={{ color: t.warn }}>{missed.length} earlier session{missed.length > 1 ? 's' : ''} not ticked off. Tell the planner "I'm behind" to fold {missed.length > 1 ? 'them' : 'it'} in.</T>}
      </View>

      <Card style={{ gap: space.md }}>
        <T variant="heading">Tell the planner</T>
        <Field placeholder="e.g. I'd rather focus fully on the COMP 558 midterm for the next 2 days" value={req} onChangeText={setReq} multiline />
        <Row>{CHIPS.map((c) => <LinkText key={c} title={c} onPress={() => setReq(c)} color={t.muted} />)}</Row>
        <Button title="Change plan" onPress={ask} disabled={!req.trim() || !!p.busy} />
        {reply ? <T variant="small">{reply}</T> : null}
        {(p.plan?.instructions ?? []).length > 0 && (
          <View style={{ gap: 6 }}>
            <T variant="label" muted>Standing instructions</T>
            {p.plan!.instructions.map((i) => (
              <Row key={i.id} style={{ flexWrap: 'nowrap' }}>
                <T variant="small" style={{ flex: 1 }}>{i.text}{i.until ? ` (until ${fmtDay(i.until)})` : ''}</T>
                <LinkText title="Remove" color={t.muted} onPress={() => p.removeInstruction(i.id)} />
              </Row>
            ))}
          </View>
        )}
      </Card>

      {p.plan?.summary ? (
        <Card style={{ gap: 4 }}>
          <T variant="label" muted>Strategy</T>
          <Rich text={p.plan.summary} fontSize={14} />
        </Card>
      ) : null}
      <LinkText title="See the whole calendar →" onPress={() => router.push('/calendar')} />
    </Screen>
  );
}
