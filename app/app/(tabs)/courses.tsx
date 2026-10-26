import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View, Platform } from 'react-native';
import { Button, Empty, Icon, ic, Pressy, Row, Screen, T , useSlab , onNote, onNoteSoft, noteChip, noteBg, Tape } from '@/components/ui';
import { useAccount } from '@/lib/auth';
import { courseColour, daysUntil, KIND_LABEL, type Course, type DeadlineKind } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { font, radius, space, useTheme } from '@/lib/theme';

type C = Course & { deadlines: { kind: DeadlineKind; label: string | null; due_at: string; done: boolean }[]; materials: { id: string }[] };

export default function Courses() {
  const t = useTheme();
  const { plan, limits } = useAccount();
  const [courses, setCourses] = useState<C[] | null>(null);
  const slab = useSlab();
  const slabB = useSlab(1.2);

  useFocusEffect(useCallback(() => {
    supabase.from('courses').select('*, deadlines(kind, label, due_at, done), materials(id)').order('created_at')
      .then(({ data }) => setCourses((data ?? []) as C[]));
  }, []));

  const atLimit = (courses?.length ?? 0) >= limits.courses;
  const add = () => router.push(atLimit && plan === 'free' ? '/paywall' : '/course/new');

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <T variant="display">Courses</T>
        {courses && courses.length > 0 && <Button title="Add" small icon={ic('plus', 'add')} onPress={add} />}
      </Row>
      {courses && courses.length > 0 && <T variant="small" muted>Open a course for its files, deadlines, exam prep, tutor and memory.</T>}
      {courses?.length === 0 && (
        <Empty title="No courses yet" body="Add a course from its syllabus. Scrawlie finds the deadlines and exams and builds your plan."
          action={<Button title="Add a course" icon={ic('plus', 'add')} onPress={add} />} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {courses?.map((c, i) => {
          const col = courseColour(c, i);
          const next = c.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0).sort((a, b) => a.due_at.localeCompare(b.due_at))[0];
          const n = next ? daysUntil(next.due_at) : null;
          return (
            <Pressy lift key={c.id} onPress={() => router.push({ pathname: '/course/[id]', params: { id: c.id } })}
              style={[{ flexGrow: 1, flexBasis: 160, minHeight: 190, backgroundColor: noteBg(col), borderRadius: radius.xl, padding: space.lg, justifyContent: 'space-between', overflow: Platform.OS === 'web' ? 'visible' : 'hidden' }, i % 2 ? slabB : slab]}>
              <Tape />
              {/* notebook spine */}
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 10, backgroundColor: 'rgba(0,0,0,0.12)' }} />
              {Platform.OS !== 'web' && <View style={{ position: 'absolute', right: -30, bottom: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)' }} />}
              <View style={{ gap: 4, paddingLeft: 4 }}>
                <Text style={{ color: onNote, fontFamily: font.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.6 }}>{c.code}</Text>
                {c.name ? <Text numberOfLines={2} style={{ color: onNoteSoft, fontFamily: font.medium, fontSize: 14, lineHeight: 19 }}>{c.name}</Text> : null}
              </View>
              <View style={{ gap: 8, paddingLeft: 4 }}>
                {next ? (
                  <View style={{ alignSelf: 'flex-start', backgroundColor: n! <= 3 ? '#FFFFFF' : noteChip, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: n! <= 3 ? (Platform.OS === 'web' ? '#E5385F' : col) : onNote, fontFamily: font.bold, fontSize: 12.5 }}>
                      {next.label || KIND_LABEL[next.kind]} · {n === 0 ? 'today' : n === 1 ? 'tomorrow' : `${n} days`}
                    </Text>
                  </View>
                ) : null}
                <Row style={{ gap: 12 }}>
                  <Row style={{ gap: 4 }}><Icon name={ic('doc.fill', 'description')} size={15} color={onNoteSoft} /><Text style={{ color: onNoteSoft, fontFamily: font.semi, fontSize: 13 }}>{c.materials.length}</Text></Row>
                  <Row style={{ gap: 4 }}><Icon name={ic('flag.fill', 'flag')} size={15} color={onNoteSoft} /><Text style={{ color: onNoteSoft, fontFamily: font.semi, fontSize: 13 }}>{c.deadlines.filter((d) => !d.done).length}</Text></Row>
                </Row>
              </View>
            </Pressy>
          );
        })}
        {courses && courses.length > 0 && (
          <Pressy onPress={add} style={{ flexGrow: 1, flexBasis: 160, minHeight: 190, borderRadius: radius.xl, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', gap: 8, padding: space.lg }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ic('plus', 'add')} size={26} color={t.accent} />
            </View>
            <T variant="strong" color={t.accent}>{atLimit && plan === 'free' ? 'Upgrade for more' : 'Add a course'}</T>
            <T variant="small" muted style={{ textAlign: 'center' }}>From its syllabus</T>
          </Pressy>
        )}
      </View>
    </Screen>
  );
}
