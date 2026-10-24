import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, Field, LinkText, Progress, Row, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, ERROR_UPGRADE, startJob, type JobKind } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import type { Doc, Material } from '@/lib/data';
import { space, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

const isQuestionSource = (m: Material) => m.outline?.kind === 'practice' || /sample|midterm|practice|past.?(paper|exam)|mock/i.test(m.file_name);
export const studyMaterials = (ms: Material[]) => ms.filter((m) => !m.deadline_id && m.status === 'ready' && !['assignment', 'syllabus'].includes(m.outline?.kind ?? '') && !isQuestionSource(m));

export function Revision({ data }: { data: CourseData }) {
  const t = useTheme();
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

      <View style={{ gap: space.sm }}>
        <T variant="label" muted>Exam prep</T>
        <Card style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Exam cheat sheet</T><T variant="small" muted>3-5 pages over the whole syllabus: formulas, rules, short examples.</T></View>
            {running('exam_sheet') ? <ActivityIndicator /> : latest('exam_sheet') ? <LinkText title="Open" onPress={() => openDoc(latest('exam_sheet'))} /> : null}
          </Row>
          <Button title={latest('exam_sheet') ? 'Make a new version' : 'Make exam cheat sheet'} kind={latest('exam_sheet') ? 'ghost' : 'secondary'} disabled={running('exam_sheet')} onPress={() => go('exam_sheet', {})} />
        </Card>
        <Card style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}><T style={{ fontWeight: '600' }}>Derivation sheet</T><T variant="small" muted>Every derivation that could be asked, step by step.</T></View>
            {running('derivation_sheet') ? <ActivityIndicator /> : latest('derivation_sheet') ? <LinkText title="Open" onPress={() => openDoc(latest('derivation_sheet'))} /> : null}
          </Row>
          <Button title={latest('derivation_sheet') ? 'Make a new version' : 'Make derivation sheet'} kind={latest('derivation_sheet') ? 'ghost' : 'secondary'} disabled={running('derivation_sheet')} onPress={() => go('derivation_sheet', {})} />
        </Card>
        <Card style={{ gap: space.sm }}>
          <T style={{ fontWeight: '600' }}>Practice papers</T>
          <T variant="small" muted>{questions.length ? `Styled on ${questions.map((q) => q.file_name).join(', ')}.` : 'Upload a sample midterm or practice sheet to match your prof\'s style.'} Each new paper targets topics earlier papers haven't tested.</T>
          {totalTopics > 0 && <><Progress value={hit.size / totalTopics} /><T variant="small" muted>{hit.size} of {totalTopics} topics tested across {papers.length} paper{papers.length === 1 ? '' : 's'}</T></>}
          {papers.map((p) => <LinkText key={p.id} title={`${p.title}${p.meta?.focus ? ` (focus: ${p.meta.focus})` : ''}`} onPress={() => openDoc(p)} />)}
          <Field placeholder="Optional focus, e.g. more derivations" value={focus} onChangeText={setFocus} />
          <Button title={running('paper') ? 'Writing a paper…' : `Generate paper ${papers.length + 1}`} disabled={running('paper')} onPress={() => { go('paper', { focus: focus.trim() || undefined }); setFocus(''); }} />
        </Card>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="label" muted>Weekly revision sheets</T>
        <T variant="small" muted>One sheet per lecture: the big picture, every idea explained with examples, exam questions and traps.</T>
        {study.map((m) => {
          const s = sheetFor(m), busy = running('weekly_sheet', m.id);
          return (
            <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}><T>{m.outline?.title || m.file_name}</T><T variant="small" muted>{m.outline?.topics?.length ?? 0} topics</T></View>
              {busy ? <ActivityIndicator /> : s ? <LinkText title="Open" onPress={() => openDoc(s)} /> : <LinkText title="Make sheet" onPress={() => go('weekly_sheet', { material_id: m.id })} />}
            </Card>
          );
        })}
      </View>
    </View>
  );
}
