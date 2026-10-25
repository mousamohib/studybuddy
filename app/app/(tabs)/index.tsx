import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Button, Card, CourseTag, Empty, Field, IconButton, ic, Pressy, Ring, Row, Screen, Section, T, LinkText } from '@/components/ui';
import { PlanSession, type FullSession } from '@/components/PlanSession';
import { Rich } from '@/components/Rich';
import { useAccount } from '@/lib/auth';
import { daysUntil, fmtDay, fmtTime, KIND_LABEL, localISO } from '@/lib/data';
import { usePlan } from '@/lib/usePlan';
import { font, radius, space, tint, useTheme } from '@/lib/theme';

const CHIPS = ['Make today lighter', 'Take tomorrow off', "I'm behind, catch me up", 'Focus on my next exam'];
const CHIP_TEXT: Record<string, string> = {
  'Make today lighter': 'Make today lighter, I only have 2 hours',
  'Take tomorrow off': 'Take tomorrow off',
  "I'm behind, catch me up": "I'm behind, fold missed sessions into this week",
  'Focus on my next exam': 'Only my next exam for the next 2 days',
};

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const t = useTheme();
  const { session, trialEndsAt } = useAccount();
  const p = usePlan();
  const [req, setReq] = useState('');
  const [reply, setReply] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const todayKey = localISO(new Date());
  const today = p.plan?.days.find((d) => d.date === todayKey);
  const sessions = today?.sessions ?? [];
  const doneCount = sessions.filter((s) => p.plan?.done[s.id]).length;
  const minsLeft = sessions.filter((s) => !p.plan?.done[s.id]).reduce((a, s) => a + s.minutes, 0);
  const missed = (p.plan?.days ?? []).filter((d) => d.date < todayKey).flatMap((d) => d.sessions).filter((s) => !p.plan?.done[s.id]);
  const upcoming = p.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0);
  const [first, ...rest] = upcoming;
  const name = (session?.user.user_metadata?.display_name as string | undefined)?.split(' ')[0];
  const codeOf = (id: string) => p.courses.find((c) => c.id === id)?.code ?? '';

  async function ask(text = req) {
    if (!text.trim()) return;
    const r = await p.change(text.trim());
    if (r) setReply(r);
    setReq('');
  }

  const header = (
    <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="small" muted>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
        <T variant="display">{greeting()}{name ? `,\n${name}` : ''}</T>
      </View>
      {sessions.length > 0 && (
        <Ring value={doneCount / sessions.length} size={74} stroke={9} color={doneCount === sessions.length ? t.good : t.accent}>
          <T variant="heading" style={{ fontSize: 18 }}>{doneCount}/{sessions.length}</T>
        </Ring>
      )}
    </Row>
  );

  if (p.loaded && !p.courses.length && !p.busy) {
    return (
      <Screen>
        {header}
        <Empty title="Set up your semester" body="Add your first course from its syllabus. StudyBuddy finds the deadlines and exams and builds your study plan."
          action={<Button title="Add a course" icon={ic('plus', 'add')} onPress={() => router.push('/course/new')} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {first && (() => {
        const code = codeOf(first.course_id), col = p.colourOf(code), n = daysUntil(first.due_at);
        return (
          <Pressy onPress={() => router.push({ pathname: '/course/[id]', params: { id: first.course_id, section: 'deadlines' } })}
            style={{ backgroundColor: col, borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <View style={{ position: 'absolute', right: 40, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ color: '#fff', fontFamily: font.heading, fontSize: 13 }}>{code}</Text>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: font.semi, fontSize: 13 }}>{KIND_LABEL[first.kind]}</Text>
            </Row>
            <Row style={{ alignItems: 'flex-end', gap: space.md, flexWrap: 'nowrap' }}>
              <Text style={{ color: '#fff', fontFamily: font.display, fontSize: n > 99 ? 56 : 76, lineHeight: n > 99 ? 58 : 76, letterSpacing: -3 }}>{n === 0 ? 'Today' : n}</Text>
              {n > 0 && <Text style={{ color: '#fff', fontFamily: font.heading, fontSize: 20, marginBottom: 10 }}>{n === 1 ? 'day to go' : 'days to go'}</Text>}
            </Row>
            <View>
              <Text style={{ color: '#fff', fontFamily: font.heading, fontSize: 22 }}>{first.label || KIND_LABEL[first.kind]}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: font.medium, fontSize: 14 }}>{fmtDay(first.due_at)} at {fmtTime(first.due_at)}{first.covers ? ` · ${first.covers}` : ''}</Text>
            </View>
          </Pressy>
        );
      })()}

      {rest.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
          {rest.slice(0, 8).map((d) => {
            const code = codeOf(d.course_id), col = p.colourOf(code), n = daysUntil(d.due_at);
            return (
              <Card key={d.id} tint={col} onPress={() => router.push({ pathname: '/course/[id]', params: { id: d.course_id, section: 'deadlines' } })} style={{ width: 170, gap: 6, padding: space.md }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <CourseTag code={code} color={col} />
                  <T variant="tiny" color={n <= 3 ? t.danger : col}>{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `${n} days`}</T>
                </Row>
                <T variant="strong" numberOfLines={2}>{d.label || KIND_LABEL[d.kind]}</T>
                <T variant="small" muted>{fmtDay(d.due_at)}</T>
              </Card>
            );
          })}
        </ScrollView>
      )}

      {trialEndsAt && (
        <Pressy onPress={() => router.push('/paywall')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: tint(t.highlight, t.dark ? 0.18 : 0.45), borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: space.md }}>
          <T variant="label" style={{ flex: 1 }}>Pro trial: {Math.max(0, daysUntil(trialEndsAt))} days left</T>
          <T variant="label" color={t.accent}>See plans</T>
        </Pressy>
      )}

      <Section title="Today's plan" action={
        <Row>
          {minsLeft > 0 && <T variant="small" muted>{Math.floor(minsLeft / 60) ? `${Math.floor(minsLeft / 60)}h ` : ''}{minsLeft % 60 ? `${minsLeft % 60}m` : ''} left</T>}
          {!p.busy && p.plan?.generated_at ? <IconButton icon={ic('arrow.clockwise', 'refresh')} label="Rebuild plan" size={34} onPress={() => p.rebuild()} /> : null}
        </Row>
      }>
        {p.busy && (
          <Card tint={t.accent} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <ActivityIndicator color={t.accent} /><T variant="label" color={t.accent}>{p.busy}</T>
          </Card>
        )}
        {p.error ? <T variant="small" color={t.danger}>{p.error}</T> : null}
        {sessions.map((s) => (
          <PlanSession key={s.id} s={s as FullSession} done={!!p.plan?.done[s.id]} colour={p.colourOf(s.course)} onToggle={() => p.toggleDone(s.id)} courses={p.courses} deadlines={p.deadlines} />
        ))}
        {!sessions.length && !p.busy && (
          <Card flat><T muted>{p.plan?.generated_at ? 'Nothing planned today. Rest, or get ahead on something.' : upcoming.length ? 'Your plan will appear here shortly.' : 'Add deadlines to a course and your plan builds itself.'}</T></Card>
        )}
        {sessions.length > 0 && doneCount === sessions.length && (
          <Card tint={t.good}><T variant="strong" color={t.good}>All done for today. Nice work.</T></Card>
        )}
        {missed.length > 0 && (
          <Pressy onPress={() => ask("I'm behind, fold missed sessions into this week")} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: tint(t.warn, t.dark ? 0.16 : 0.12) }}>
            <T variant="small" style={{ flex: 1 }}>{missed.length} earlier session{missed.length > 1 ? 's' : ''} not ticked off.</T>
            <T variant="label" color={t.warn}>Catch me up</T>
          </Pressy>
        )}
      </Section>

      <Card style={{ gap: space.md, padding: space.lg }}>
        <T variant="heading">Change the plan</T>
        <T variant="small" muted>Say it in your own words. The plan updates around your deadlines.</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: 8, paddingHorizontal: space.lg }}>
          {CHIPS.map((c) => (
            <Pressy key={c} onPress={() => ask(CHIP_TEXT[c])} disabled={!!p.busy}
              style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill, backgroundColor: t.accentSoft }}>
              <Text style={{ color: t.accent, fontFamily: font.semi, fontSize: 14 }}>{c}</Text>
            </Pressy>
          ))}
        </ScrollView>
        <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><Field placeholder="e.g. I have a lab all Thursday" value={req} onChangeText={setReq} onSubmitEditing={() => ask()} returnKeyType="send" /></View>
          <IconButton icon={ic('arrow.up', 'arrow_upward')} label="Send" bg={req.trim() ? t.accent : t.surface} color={req.trim() ? t.onAccent : t.muted} size={50} onPress={() => ask()} />
        </Row>
        {reply ? <Card tint={t.accent} style={{ padding: space.md }}><T variant="small">{reply}</T></Card> : null}
        {(p.plan?.instructions ?? []).length > 0 && (
          <View style={{ gap: 6 }}>
            <T variant="label" muted>Always remembered</T>
            {p.plan!.instructions.map((i) => (
              <Row key={i.id} style={{ flexWrap: 'nowrap', backgroundColor: t.surface, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: space.md }}>
                <T variant="small" style={{ flex: 1 }}>{i.text}{i.until ? ` (until ${fmtDay(i.until)})` : ''}</T>
                <LinkText title="Remove" color={t.muted} onPress={() => p.removeInstruction(i.id)} />
              </Row>
            ))}
          </View>
        )}
      </Card>

      {p.plan?.summary ? (
        <Card style={{ gap: space.sm, backgroundColor: tint(t.highlight, t.dark ? 0.12 : 0.28), borderColor: tint(t.highlight, 0.6) }}>
          <Pressy haptics={false} onPress={() => setShowWhy(!showWhy)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="heading" style={{ flex: 1 }}>Why this plan</T>
            <T variant="label" muted>{showWhy ? 'Hide' : 'Show'}</T>
          </Pressy>
          {showWhy && <Rich text={p.plan.summary} fontSize={15} />}
        </Card>
      ) : null}

      <Button title="Open the calendar" kind="soft" icon={ic('calendar', 'calendar_month')} onPress={() => router.push('/calendar')} />
    </Screen>
  );
}
