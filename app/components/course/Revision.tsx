import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, Field, Icon, ic, Pressy, Ring, Row, Section, T, useAccent, type IconName } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, ERROR_UPGRADE, startJob, type JobKind } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import type { Doc, Material } from '@/lib/data';
import { ink, radius, space, tint, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

function Tile({ icon, color }: { icon: IconName; color: string }) {
  return (
    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: color, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }}>
      <Icon name={icon} size={23} color="#FFFFFF" />
    </View>
  );
}

const isQuestionSource = (m: Material) => m.outline?.kind === 'practice' || /sample|midterm|practice|past.?(paper|exam)|mock/i.test(m.file_name);
export const studyMaterials = (ms: Material[]) => ms.filter((m) => !m.deadline_id && m.status === 'ready' && !['assignment', 'syllabus'].includes(m.outline?.kind ?? '') && !isQuestionSource(m));

export function Revision({ data }: { data: CourseData }) {
  const t = useTheme();
  const accent = useAccent().color;
  const { refresh } = useAccount();
  const { open } = useMenu();
  const notice = useNotice();
  const [focus, setFocus] = useState('');
  const c = data.course!;
  const study = studyMaterials(data.materials);
  const questions = data.materials.filter((m) => !m.deadline_id && m.status === 'ready' && isQuestionSource(m));
  const running = (kind: JobKind, materialId?: string) => data.jobs.some((j) => j.kind === kind && (j.status === 'running' || j.status === 'queued') && (!materialId || j.input?.material_id === materialId));
  const failed = data.jobs.filter((j) => j.status === 'error' && Date.now() - new Date(j.created_at).getTime() < 10 * 60000);
  const latest = (kind: Doc['kind']) => [...data.docs].reverse().find((d) => d.kind === kind);
  const sheetFor = (m: Material) => [...data.docs].reverse().find((d) => d.kind === 'weekly_sheet' && d.meta?.material_id === m.id);
  const papers = data.docs.filter((d) => d.kind === 'paper').sort((a, b) => (a.meta?.n ?? 0) - (b.meta?.n ?? 0));
  const totalTopics = study.reduce((a, m) => a + (m.outline?.topics?.length ?? 0), 0);
  const hit = new Set(papers.flatMap((p) => (p.meta?.covered ?? []) as string[]));

  async function go(kind: JobKind, input: Record<string, unknown>) {
    try { await startJob(kind, { course_id: c.id, ...input }); data.reload(); }
    catch (e) {
      const a = e as ApiError;
      if (ERROR_UPGRADE.has(a.code)) open(a.message, [{ label: 'See Pro', onPress: () => router.push('/paywall') }, { label: 'Cancel' }]);
      else notice("Couldn't start that", a.message);
    } finally { refresh(); }
  }

  const openDoc = (d?: Doc) => d && router.push({ pathname: '/doc/[id]', params: { id: d.id } });

  if (!study.length) {
    return <Card><T variant="heading">Upload lectures first</T><T muted>Revision sheets and practice papers are built from your study material. Add lecture slides or notes in Materials.</T></Card>;
  }

  return (
    <View style={{ gap: space.lg }}>
      {failed.length > 0 && <Card style={{ borderColor: t.danger }}><T variant="small" style={{ color: t.danger }}>{failed[0].error ?? 'Something went wrong.'} Try again.</T></Card>}

      <Card style={{ gap: space.md }}>
        <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
          <Tile icon={ic('doc.text.fill', 'description')} color="#C99A00" />
          <View style={{ flex: 1 }}><T variant="heading">Exam cheat sheet</T><T variant="small" muted>3-5 pages over the whole syllabus: formulas, rules, short examples.</T></View>
        </Row>
        {running('exam_sheet') ? <Row><ActivityIndicator color={accent} /><T variant="small" muted>Writing your cheat sheet…</T></Row> : (
          <Row style={{ flexWrap: 'nowrap' }}>
            {latest('exam_sheet') && <Button title="Open" style={{ flex: 1 }} onPress={() => openDoc(latest('exam_sheet'))} />}
            <Button title={latest('exam_sheet') ? 'New version' : 'Make cheat sheet'} kind={latest('exam_sheet') ? 'soft' : 'primary'} style={{ flex: 1 }} onPress={() => go('exam_sheet', {})} />
          </Row>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
          <Tile icon={ic('function', 'function')} color="#8B4DF0" />
          <View style={{ flex: 1 }}><T variant="heading">Derivation sheet</T><T variant="small" muted>Every derivation that could be asked, step by step.</T></View>
        </Row>
        {running('derivation_sheet') ? <Row><ActivityIndicator color={accent} /><T variant="small" muted>Working through the derivations…</T></Row> : (
          <Row style={{ flexWrap: 'nowrap' }}>
            {latest('derivation_sheet') && <Button title="Open" style={{ flex: 1 }} onPress={() => openDoc(latest('derivation_sheet'))} />}
            <Button title={latest('derivation_sheet') ? 'New version' : 'Make derivation sheet'} kind={latest('derivation_sheet') ? 'soft' : 'primary'} style={{ flex: 1 }} onPress={() => go('derivation_sheet', {})} />
          </Row>
        )}
      </Card>

      <Card style={{ gap: space.md }}>
        <Row style={{ flexWrap: 'nowrap', gap: space.md }}>
          <Tile icon={ic('pencil.and.list.clipboard', 'quiz')} color="#0F9F74" />
          <View style={{ flex: 1 }}><T variant="heading">Practice papers</T><T variant="small" muted>{questions.length ? `In the style of ${questions.map((q) => q.file_name).join(', ')}.` : "Upload a sample midterm to match your prof's style."}</T></View>
        </Row>
        {totalTopics > 0 && (
          <Row style={{ flexWrap: 'nowrap', gap: space.md, backgroundColor: t.surface, borderRadius: radius.md, padding: space.md }}>
            <Ring value={hit.size / totalTopics} size={56} stroke={7} color={accent}><T variant="label">{Math.round((hit.size / totalTopics) * 100)}%</T></Ring>
            <T variant="small" style={{ flex: 1 }}>{hit.size} of {totalTopics} topics tested across {papers.length} paper{papers.length === 1 ? '' : 's'}. Each new paper aims at the topics not tested yet.</T>
          </Row>
        )}
        {papers.map((p) => (
          <Pressy key={p.id} onPress={() => openDoc(p)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: tint(accent, t.dark ? 0.16 : 0.08) }}>
            <T variant="strong" color={ink(accent, t)} style={{ flex: 1 }}>{p.title}{p.meta?.focus ? ` · ${p.meta.focus}` : ''}</T>
            <Icon name={ic('chevron.right', 'chevron_right')} size={18} color={ink(accent, t)} />
          </Pressy>
        ))}
        <Field placeholder="Optional focus, e.g. more derivations" value={focus} onChangeText={setFocus} />
        <Button title={running('paper') ? 'Writing a paper…' : `Make paper ${papers.length + 1}`} disabled={running('paper')} loading={running('paper')} onPress={() => { go('paper', { focus: focus.trim() || undefined }); setFocus(''); }} />
      </Card>

      <Section title="Weekly revision sheets">
        <T variant="small" muted>One sheet per lecture: the big picture, every idea explained with examples, exam questions and traps.</T>
        {study.map((m) => {
          const s = sheetFor(m), busy = running('weekly_sheet', m.id);
          return (
            <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
              <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: s ? t.good : t.surface }} />
              <View style={{ flex: 1 }}><T variant="strong">{m.outline?.title || m.file_name}</T><T variant="small" muted>{m.outline?.topics?.length ?? 0} topics{s ? ' · sheet ready' : ''}</T></View>
              {busy ? <ActivityIndicator color={accent} /> : s ? <Button title="Open" small kind="soft" onPress={() => openDoc(s)} /> : <Button title="Make" small onPress={() => go('weekly_sheet', { material_id: m.id })} />}
            </Card>
          );
        })}
      </Section>
    </View>
  );
}
