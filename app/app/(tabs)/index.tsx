import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Platform } from 'react-native';
import { Button, Card, CourseTag, Empty, Field, Icon, IconButton, ic, ListRow, Pressy, Ring, Row, Screen, Section, T, LinkText , useSlab , onNote, onNoteSoft, noteChip, noteBg, Tape } from '@/components/ui';
import { PlanSession, type FullSession } from '@/components/PlanSession';
import { Rich } from '@/components/Rich';
import { Confetti } from '@/components/Confetti';
import { useWide } from '@/lib/useWide';
import { openNewChat } from '@/lib/chats';
import { useAccount } from '@/lib/auth';
import { daysUntil, fmtDay, fmtTime, KIND_LABEL, localISO } from '@/lib/data';
import { usePlan } from '@/lib/usePlan';
import { font, ink, radius, space, tint, useTheme } from '@/lib/theme';

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
  const wide = useWide();
  const slab = useSlab();
  const [burst, setBurst] = useState({ n: 0, big: false });
  const nextUp = sessions.find((s) => !p.plan?.done[s.id]) as FullSession | undefined;

  // Days in a row with at least one session ticked off (today counts once something is done).
  const streak = (() => {
    const days = [...(p.plan?.days ?? [])].filter((d) => d.date <= todayKey).sort((a, b) => b.date.localeCompare(a.date));
    let n = 0;
    for (const d of days) {
      const any = d.sessions.some((s) => p.plan?.done[s.id]);
      if (any) n++; else if (d.date !== todayKey) break;
    }
    return n;
  })();

  function toggle(id: string) {
    const willBeDone = !p.plan?.done[id];
    p.toggleDone(id);
    if (willBeDone) {
      const left = sessions.filter((s) => s.id !== id && !p.plan?.done[s.id]).length;
      setBurst((b) => ({ n: b.n + 1, big: left === 0 }));
    }
  }

  async function startNext() {
    if (!nextUp) return;
    const course = p.courses.find((c) => c.code === nextUp.course);
    const mode = nextUp.type === 'assignment' ? 'assignment' : nextUp.type === 'coding' ? 'coding' : nextUp.type === 'practice' || nextUp.type === 'review' ? 'practice' : 'lesson';
    const d = p.deadlines.find((x) => x.id === nextUp.deadlineId) ?? null;
    await openNewChat({ courseId: course?.id ?? null, mode: mode === 'assignment' && !d ? 'lesson' : mode, topic: `${nextUp.title}${nextUp.topics?.length ? ` — topics: ${nextUp.topics.join(', ')}` : ''}`, deadline: d, courseCode: nextUp.course, title: nextUp.title }).catch(() => {});
  }

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
      <Row style={{ gap: space.md, flexWrap: 'nowrap' }}>
        {streak > 0 && (
          <View style={{ alignItems: 'center', backgroundColor: tint('#F07A12', t.dark ? 0.2 : 0.12), borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, transform: [{ rotate: '3deg' }] }}>
            <Icon name={ic('flame.fill', 'local_fire_department')} size={22} color="#F07A12" />
            <Text style={{ fontFamily: font.display, fontSize: 20, color: '#F07A12', lineHeight: 22 }}>{streak}</Text>
            <T variant="tiny" muted>{streak === 1 ? 'day' : 'days'}</T>
          </View>
        )}
        {sessions.length > 0 && (
          <Ring value={doneCount / sessions.length} size={74} stroke={9} color={doneCount === sessions.length ? t.good : t.accent}>
            <T variant="heading" style={{ fontSize: 18 }}>{doneCount}/{sessions.length}</T>
          </Ring>
        )}
      </Row>
    </Row>
  );

  const startBtn = nextUp ? (
    <Pressy lift onPress={startNext} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: t.text, borderRadius: radius.xl, padding: space.lg, paddingRight: space.xl }, slab, Platform.OS === 'web' ? { boxShadow: `7px 7px 0 ${t.accent}` } as object : null]}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: p.colourOf(nextUp.course), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={ic('play.fill', 'play_arrow')} size={28} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.semi, fontSize: 13, color: t.bg, opacity: 0.7 }}>Start next · {nextUp.course} · {nextUp.minutes} min</Text>
        <Text numberOfLines={1} style={{ fontFamily: font.display, fontSize: 22, color: t.bg, letterSpacing: -0.4 }}>{nextUp.title}</Text>
      </View>
    </Pressy>
  ) : null;

  if (p.loaded && !p.courses.length && !p.busy) {
    return (
      <Screen>
        {header}
        <Empty title="Set up your semester" body="Add your first course from its syllabus. StudyBuddy finds the deadlines and exams and builds your study plan."
          action={<Button title="Add a course" icon={ic('plus', 'add')} onPress={() => router.push('/course/new')} />} />
      </Screen>
    );
  }

  const blocks = { countdown: <>
      {first && (() => {
        const code = codeOf(first.course_id), col = p.colourOf(code), n = daysUntil(first.due_at);
        return (
          <Pressy lift onPress={() => router.push({ pathname: '/course/[id]', params: { id: first.course_id, section: 'deadlines' } })}
            style={[{ backgroundColor: noteBg(col), borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: Platform.OS === 'web' ? 'visible' : 'hidden' }, slab]}>
            <Tape />
            {Platform.OS !== 'web' && <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.12)' }} />}
            {Platform.OS !== 'web' && <View style={{ position: 'absolute', right: 40, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />}
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ backgroundColor: noteChip, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ color: onNote, fontFamily: font.heading, fontSize: 13 }}>{code}</Text>
              </View>
              <Text style={{ color: onNoteSoft, fontFamily: font.semi, fontSize: 13 }}>{KIND_LABEL[first.kind]}</Text>
            </Row>
            <Row style={{ alignItems: 'flex-end', gap: space.md, flexWrap: 'nowrap' }}>
              <Text style={{ color: onNote, fontFamily: font.display, fontSize: n > 99 ? 56 : 76, lineHeight: n > 99 ? 58 : 76, letterSpacing: -3 }}>{n === 0 ? 'Today' : n}</Text>
              {n > 0 && <Text style={{ color: onNote, fontFamily: font.heading, fontSize: 20, marginBottom: 10 }}>{n === 1 ? 'day to go' : 'days to go'}</Text>}
            </Row>
            <View>
              <Text style={{ color: onNote, fontFamily: font.heading, fontSize: 22 }}>{first.label || KIND_LABEL[first.kind]}</Text>
              <Text style={{ color: onNoteSoft, fontFamily: font.medium, fontSize: 14 }}>{fmtDay(first.due_at)} at {fmtTime(first.due_at)}{first.covers ? ` · ${first.covers}` : ''}</Text>
            </View>
          </Pressy>
        );
      })()}

</>, coming: <>
      {rest.length > 0 && (
        <Section title="Coming up">
          <View>
            {rest.slice(0, 5).map((d, i) => {
              const code = codeOf(d.course_id), col = p.colourOf(code), n = daysUntil(d.due_at);
              return (
                <ListRow key={d.id} last={i === Math.min(rest.length, 5) - 1} onPress={() => router.push({ pathname: '/course/[id]', params: { id: d.course_id, section: 'deadlines' } })}>
                  <View style={{ width: 44, alignItems: 'center' }}>
                    <Text style={{ fontFamily: font.display, fontSize: 22, lineHeight: 24, color: n <= 3 ? t.danger : t.text }}>{n}</Text>
                    <T variant="tiny" muted>{n === 1 ? 'day' : 'days'}</T>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T variant="strong" numberOfLines={1}>{d.label || KIND_LABEL[d.kind]}</T>
                    <Row style={{ gap: 6 }}><CourseTag code={code} color={col} /><T variant="small" muted>{fmtDay(d.due_at)}</T></Row>
                  </View>
                </ListRow>
              );
            })}
          </View>
        </Section>
      )}

</>, trial: <>
      {trialEndsAt && (
        <Pressy onPress={() => router.push('/paywall')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: tint(t.highlight, t.dark ? 0.18 : 0.45), borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: space.md }}>
          <T variant="label" style={{ flex: 1 }}>Pro trial: {Math.max(0, daysUntil(trialEndsAt))} days left</T>
          <T variant="label" color={t.accent}>See plans</T>
        </Pressy>
      )}

</>, plan: <>
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
          <PlanSession key={s.id} s={s as FullSession} done={!!p.plan?.done[s.id]} colour={p.colourOf(s.course)} onToggle={() => toggle(s.id)} courses={p.courses} deadlines={p.deadlines} />
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

</>, change: <>
      <Card style={{ gap: space.md }}>
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

</>, why: <>
      {p.plan?.summary ? (
        <Card style={{ gap: space.sm }}>
          <Pressy haptics={false} onPress={() => setShowWhy(!showWhy)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T variant="heading" style={{ flex: 1 }}>Why this plan</T>
            <T variant="label" muted>{showWhy ? 'Hide' : 'Show'}</T>
          </Pressy>
          {showWhy && <Rich text={p.plan.summary} fontSize={15} />}
        </Card>
      ) : null}

</> } satisfies Record<string, ReactNode>;

  return (
    <View style={{ flex: 1 }}>
      <Screen wide>
        {header}
        {wide ? (
          <Row style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: space.xxl }}>
            <View style={{ flex: 3, gap: space.lg }}>
              {startBtn}
              {blocks.plan}
              {blocks.change}
            </View>
            <View style={{ flex: 2, gap: space.lg }}>
              {blocks.countdown}
              {blocks.coming}
              {blocks.trial}
              {blocks.why}
            </View>
          </Row>
        ) : (
          <>
            {blocks.countdown}
            {startBtn}
            {blocks.coming}
            {blocks.trial}
            {blocks.plan}
            {blocks.change}
            {blocks.why}
            <Button title="Open the calendar" kind="soft" icon={ic('calendar', 'calendar_month')} onPress={() => router.push('/calendar')} />
          </>
        )}
      </Screen>
      <Confetti burst={burst.n} big={burst.big} />
    </View>
  );
}
