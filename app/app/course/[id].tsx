import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, Platform } from 'react-native';
import { AccentProvider, Button, Icon, ic, Pressy, Row, Screen, T, useSlab, onNote, onNoteSoft, noteChip, noteBg, Tape, type IconName } from '@/components/ui';
import { SECTIONS, type Section } from '@/components/course/sections';
import type { ChatMode } from '@/lib/data';
import { Chats } from '@/components/course/Chats';
import { Deadlines } from '@/components/course/Deadlines';
import { Materials } from '@/components/course/Materials';
import { Memory } from '@/components/course/Memory';
import { Revision } from '@/components/course/Revision';
import { Settings } from '@/components/course/Settings';
import { useCourse } from '@/components/course/useCourse';
import { openNewChat } from '@/lib/chats';
import { courseColour, daysUntil, KIND_LABEL, type Course } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useWide } from '@/lib/useWide';
import { font, radius, space, tint, useTheme } from '@/lib/theme';


/** A big quick-action button on the course's sticky note. */
function Quick({ icon, label, sub, onPress, main }: { icon: IconName; label: string; sub: string; onPress: () => void; main?: boolean }) {
  return (
    <Pressy lift onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={[{ flexGrow: 1, flexBasis: 140, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: main ? '#1B1E3F' : noteChip },
        Platform.OS === 'web' ? { boxShadow: main ? '0 4px 0 rgba(0,0,0,0.35)' : '0 3px 0 rgba(27,30,63,0.18)' } as object : {}]}>
      <Icon name={icon} size={26} color={main ? '#FFE45E' : onNote} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: main ? '#FFFFFF' : onNote, fontFamily: font.bold, fontSize: 15 }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: main ? 'rgba(255,255,255,0.75)' : onNoteSoft, fontFamily: font.medium, fontSize: 12.5 }}>{sub}</Text>
      </View>
    </Pressy>
  );
}

function Stat({ n, label }: { n: string | number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: noteChip, borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Text style={{ color: onNote, fontFamily: font.display, fontSize: 22, lineHeight: 26 }}>{n}</Text>
      <Text style={{ color: onNoteSoft, fontFamily: font.semi, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

export default function CourseHub() {
  const t = useTheme();
  const { id, section } = useLocalSearchParams<{ id: string; section?: Section }>();
  const data = useCourse(id);
  const [tab, setTab] = useState<Section>(section && SECTIONS.some((s) => s.key === section) ? section : 'materials');
  const [col, setCol] = useState<string | null>(null);
  const wide = useWide();
  const slab = useSlab();
  const [addNonce, setAddNonce] = useState(0);

  // The course's colour depends on its place in the list, so look that up once.
  useEffect(() => {
    if (!data.course) return;
    supabase.from('courses').select('*').order('created_at').then(({ data: cs }) => {
      const i = (cs ?? []).findIndex((c) => c.id === id);
      setCol(courseColour((cs?.[i] ?? data.course) as Course, Math.max(0, i)));
    });
  }, [data.course, id]);

  if (data.loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.accent} /></View>;
  if (!data.course) return <Screen><T>This course no longer exists.</T></Screen>;
  const c = data.course, colour = col ?? courseColour(c, 0);
  const next = data.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0)[0];
  const ready = data.materials.filter((m) => m.status === 'ready').length;
  const topics = data.materials.reduce((a, m) => a + (m.outline?.topics?.length ?? 0), 0);
  const hasRec = data.materials.some((m) => m.status === 'ready' && m.outline?.kind === 'recording');
  const chat = (mode: ChatMode, modifier?: string) => openNewChat({ courseId: c.id, mode, topic: '', courseCode: c.code, modifier })
    .catch(() => setTab('chats'));
  const counts: Record<Section, string> = {
    materials: `${ready} ready`,
    deadlines: `${data.deadlines.filter((d) => !d.done).length} coming up`,
    revision: `${data.docs.length} made`,
    chats: `${data.chats.length} chat${data.chats.length === 1 ? '' : 's'}`,
    memory: `${data.memory.length} note${data.memory.length === 1 ? '' : 's'}`,
    settings: '',
  };
  const cur = SECTIONS.find((x) => x.key === tab)!;

  return (
    <Screen>
      <Stack.Screen options={wide ? { title: c.code, headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text } : { title: '', headerStyle: { backgroundColor: noteBg(colour) }, headerTintColor: onNote }} />
      <View style={[{ backgroundColor: noteBg(colour), gap: space.lg, overflow: Platform.OS === 'web' ? 'visible' : 'hidden' }, wide ? { borderRadius: radius.xl, padding: space.xl, ...slab } : { marginHorizontal: -space.lg, marginTop: -space.lg, paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }]}>
        {wide && <Tape />}
        {Platform.OS !== 'web' && <View style={{ position: 'absolute', right: -50, top: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)' }} />}
        <View style={{ gap: 4 }}>
          <Text style={{ color: onNote, fontFamily: font.display, fontSize: 38, lineHeight: 42, letterSpacing: -1.2 }}>{c.code}</Text>
          {c.name ? <Text style={{ color: onNoteSoft, fontFamily: font.medium, fontSize: 16 }}>{c.name}</Text> : null}
        </View>
        <Row style={{ flexWrap: 'nowrap' }}>
          <Stat n={ready} label={ready === 1 ? 'file' : 'files'} />
          <Stat n={topics} label="topics" />
          <Stat n={next ? (daysUntil(next.due_at) === 0 ? 'Today' : `${daysUntil(next.due_at)}d`) : '–'} label={next ? `to ${next.label || KIND_LABEL[next.kind]}` : 'no deadlines'} />
        </Row>
        <View style={{ gap: 8 }}>
          <Text style={{ color: onNoteSoft, fontFamily: font.bold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Quick main icon={ic('bubble.left.fill', 'chat_bubble')} label="Ask a question" sub={`About ${c.code}`} onPress={() => chat('ask')} />
            <Quick icon={ic('graduationcap.fill', 'school')} label="Teach me" sub="Learn a topic" onPress={() => chat('lesson')} />
            <Quick icon={ic('checkmark.circle.fill', 'task_alt')} label="Quiz me" sub="Practice questions" onPress={() => chat('practice')} />
            {hasRec && <Quick icon={ic('mic.fill', 'mic')} label="Like my lecture" sub="Explained their way" onPress={() => chat('lesson', 'like_lecture')} />}
            <Quick icon={ic('arrow.up.doc.fill', 'upload_file')} label="Upload files" sub="Slides, notes, PDFs" onPress={() => { setTab('materials'); setAddNonce((n) => n + 1); }} />
          </View>
        </View>
      </View>

      {/* The course toolbox: every part of the course, with what it's for. */}
      <View style={{ gap: 8 }}>
        <T variant="label" muted>Everything in {c.code}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {SECTIONS.map((x) => {
            const on = tab === x.key;
            return (
              <Pressy key={x.key} onPress={() => setTab(x.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`${x.label}: ${x.blurb}`}
                style={[{ flexGrow: 1, flexBasis: wide ? '30%' : '30%', minHeight: wide ? 96 : 84, padding: wide ? 12 : 10, gap: 6, borderRadius: radius.md, borderWidth: 2,
                  borderColor: on ? x.color : 'transparent', backgroundColor: on ? tint(x.color, t.dark ? 0.28 : 0.14) : t.surface },
                  Platform.OS === 'web' && on ? { boxShadow: `0 4px 0 ${x.color}` } as object : {}]}>
                <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'flex-start', gap: wide ? 8 : 6 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: x.color, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${[-5, 4, -3, 5, -4, 3][SECTIONS.indexOf(x)]}deg` }] }}><Icon name={x.icon} size={24} color="#FFFFFF" /></View>
                  <T variant="strong" style={wide ? { flex: 1 } : { fontSize: 14.5 }} numberOfLines={1}>{x.label}</T>
                </View>
                {wide ? <T variant="small" muted numberOfLines={2}>{x.blurb}</T> : null}
                {counts[x.key] ? <T variant="tiny" color={on ? t.text : t.muted}>{counts[x.key]}</T> : null}
              </Pressy>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 2, paddingTop: space.sm, borderTopWidth: 2, borderColor: tint(cur.color, 0.6) }}>
        <Row style={{ flexWrap: 'nowrap', gap: 10 }}>
          <Icon name={cur.icon} size={30} color={cur.color === '#3442F5' && t.dark ? '#9AA2FF' : cur.color} />
          <T variant="title">{cur.label}</T>
        </Row>
        <T variant="small" muted>{cur.blurb}</T>
      </View>
      <AccentProvider value={colour}>
        {tab === 'materials' && <Materials data={data} addNonce={addNonce} />}
        {tab === 'deadlines' && <Deadlines data={data} />}
        {tab === 'revision' && <Revision data={data} />}
        {tab === 'chats' && <Chats data={data} />}
        {tab === 'memory' && <Memory data={data} />}
        {tab === 'settings' && <Settings data={data} />}
      </AccentProvider>
    </Screen>
  );
}
