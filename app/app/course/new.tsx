// "Upload your syllabuses, and your semester is set up": the main hook.
// Several files at once: each becomes its own course, all checked on one review screen.
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, Card, Field, Icon, ic, Pressy, Row, Screen, Stickers, T } from '@/components/ui';
import { useMenu } from '@/components/Menu';
import { DateField } from '@/components/DateField';
import { ApiError, ERROR_UPGRADE, pickDocuments, pickPhoto, runJob, uploadMaterial, waitMaterial, type Picked } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import { KIND_LABEL, localToISO, rebuildPlan, type DeadlineKind } from '@/lib/data';
import { refreshPhoneSchedule } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

type Draft = {
  key: string; file: string; state: 'working' | 'ready' | 'error'; status: string; error?: string;
  courseId?: string; materialId?: string; keep: boolean; open: boolean;
  code: string; name: string; policy: string; rules: string; note: string; found: Found[];
};
type Found = { kind: DeadlineKind; label: string; due: string; covers: string; weight: string; keep: boolean };
const KINDS: DeadlineKind[] = ['assignment', 'quiz', 'midterm', 'final', 'test', 'lab', 'project', 'other'];

export default function NewCourse() {
  const t = useTheme();
  const { refresh, plan } = useAccount();
  const { open } = useMenu();
  const [step, setStep] = useState<'start' | 'manual' | 'drafts'>('start');
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const live = useRef<Draft[]>([]);
  const upgradeShown = useRef(false);

  const patch = (key: string, p: Partial<Draft>) => {
    live.current = live.current.map((d) => (d.key === key ? { ...d, ...p } : d));
    setDrafts(live.current);
  };

  async function createCourse(c: string, n: string | null) {
    const { data, error } = await supabase.from('courses').insert({ code: c, name: n }).select('id').single();
    if (error) throw new ApiError(error.message.includes('course_limit') ? 'limit_reached' : 'failed', error.message.includes('course_limit') ? 'The free plan allows 2 courses. Upgrade to Pro for more.' : error.message);
    return data!.id as string;
  }

  function fail(e: unknown) {
    const a = e as ApiError;
    if (ERROR_UPGRADE.has(a.code) && !upgradeShown.current) { upgradeShown.current = true; open(a.message, [{ label: 'See Pro', onPress: () => router.push('/paywall') }, { label: 'OK' }]); }
    return a.message ?? 'Something went wrong.';
  }

  /** One syllabus file → a course with its deadlines found (not saved until the student checks them). */
  async function readOne(d: Draft, file: Picked) {
    try {
      patch(d.key, { status: 'Creating the course…' });
      const courseId = await createCourse('NEW COURSE', null);
      patch(d.key, { courseId, status: 'Uploading…' });
      const materialId = await uploadMaterial(courseId, file);
      patch(d.key, { materialId, status: 'Reading it…' });
      await waitMaterial(materialId);
      patch(d.key, { status: 'Finding deadlines, exams and topics…' });
      const r = await runJob('syllabus', { material_id: materialId, course_id: courseId });
      patch(d.key, {
        state: 'ready', status: '', code: r.course?.code || '', name: r.course?.name || '', policy: r.ai_policy || '', rules: r.rules || '', note: r.note || '',
        found: (r.deadlines ?? []).map((x: any) => ({ kind: KINDS.includes(x.kind) ? x.kind : 'other', label: x.label || '', due: String(x.due_at || '').replace('T', ' ').slice(0, 16), covers: x.covers || '', weight: x.weight || '', keep: true })),
      });
    } catch (e) {
      const cur = live.current.find((x) => x.key === d.key);
      if (cur?.courseId) await removeCourse(cur.courseId);
      patch(d.key, { state: 'error', keep: false, courseId: undefined, error: fail(e) });
    }
  }

  async function fromSyllabus(get: () => Promise<Picked[]>) {
    setErr('');
    let picked: Picked[];
    try { picked = await get(); } catch (e) { setErr((e as ApiError).message); return; }
    if (!picked.length) return;
    upgradeShown.current = false;
    const fresh: Draft[] = picked.map((f, i) => ({ key: `${Date.now()}-${i}`, file: f.name, state: 'working', status: 'Waiting…', keep: true, open: picked.length === 1, code: '', name: '', policy: '', rules: '', note: '', found: [] }));
    live.current = [...live.current, ...fresh];
    setDrafts(live.current);
    setStep('drafts');
    // Read up to three at a time; course creation stays in order so plan limits apply predictably.
    let next = 0;
    const worker = async () => { while (next < fresh.length) { const i = next++; await readOne(fresh[i], picked[i]); } };
    await Promise.all([worker(), worker(), worker()].slice(0, Math.min(3, fresh.length)));
    refresh();
  }

  async function removeCourse(id: string) {
    const { data: mats } = await supabase.from('materials').select('storage_path').eq('course_id', id);
    const paths = (mats ?? []).map((x) => x.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('materials').remove(paths);
    await supabase.from('courses').delete().eq('id', id);
  }

  async function save() {
    const keep = drafts.filter((d) => d.state === 'ready' && d.keep);
    const noCode = keep.find((d) => !d.code.trim());
    if (noCode) { setErr(`Add the course code for ${noCode.file}.`); patch(noCode.key, { open: true }); return; }
    for (const d of keep) {
      const bad = d.found.find((f) => f.keep && !localToISO(f.due));
      if (bad) { setErr(`${d.code}: fix the date for "${bad.label || KIND_LABEL[bad.kind]}" or untick it.`); patch(d.key, { open: true }); return; }
    }
    setSaving(true); setErr('');
    for (const d of keep) {
      await supabase.from('courses').update({ code: d.code.trim().toUpperCase(), name: d.name.trim() || null, ai_policy: d.policy.trim() || null, rules: d.rules.trim() || null }).eq('id', d.courseId!);
      const rows = d.found.filter((f) => f.keep).map((f) => ({ course_id: d.courseId!, kind: f.kind, label: f.label.trim() || null, due_at: localToISO(f.due)!, covers: [f.covers.trim(), f.weight ? `Weight: ${f.weight}` : ''].filter(Boolean).join('. ') || null }));
      if (rows.length) await supabase.from('deadlines').insert(rows);
      const { data: m } = await supabase.from('materials').select('outline').eq('id', d.materialId!).maybeSingle();
      await supabase.from('materials').update({ outline: { ...(m?.outline ?? {}), kind: 'syllabus' } }).eq('id', d.materialId!);
    }
    for (const d of drafts.filter((x) => x.courseId && !(x.state === 'ready' && x.keep))) await removeCourse(d.courseId!);
    rebuildPlan().catch(() => {});
    refreshPhoneSchedule().catch(() => {});
    setSaving(false); live.current = [];
    if (keep.length === 1) router.replace({ pathname: '/course/[id]', params: { id: keep[0].courseId! } });
    else router.replace('/courses');
  }

  async function cancel() {
    for (const d of drafts) if (d.courseId) await removeCourse(d.courseId);
    live.current = [];
    router.back();
  }

  async function manual() {
    if (!code.trim()) { setErr('Enter a course code, e.g. COMP 535.'); return; }
    setSaving(true);
    try { const id = await createCourse(code.trim().toUpperCase(), name.trim() || null); router.replace({ pathname: '/course/[id]', params: { id } }); }
    catch (e) { setErr(fail(e)); setStep('manual'); }
    setSaving(false);
  }

  const working = drafts.filter((d) => d.state === 'working').length;
  const ready = drafts.filter((d) => d.state === 'ready' && d.keep);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Add courses' }} />
      {step === 'start' && (
        <>
          <Stickers size={48} />
          <T variant="display">Start from your syllabuses</T>
          <T muted style={{ fontSize: 17, lineHeight: 25 }}>Pick all your course outlines at once. Scrawlie makes a course for each one and finds every deadline and exam, what each covers, the exam rules and the AI policy. You check it all before anything is saved.</T>
          <Button title="Upload syllabus files" icon={ic('arrow.up.doc.fill', 'upload_file')} onPress={() => fromSyllabus(pickDocuments)} />
          <T variant="small" muted style={{ textAlign: 'center', marginTop: -4 }}>Select several files to add several courses.</T>
          <Button title="Take a photo of one" kind="soft" icon={ic('camera.fill', 'photo_camera')} onPress={() => fromSyllabus(async () => (await pickPhoto(false)).slice(0, 1))} />
          <Pressy onPress={() => router.push('/connect-calendar')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: 12, backgroundColor: t.accentSoft }}>
            <Icon name={ic('arrow.triangle.2.circlepath', 'sync')} size={28} color={t.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="strong">Connect your school calendar</T>
              <T variant="small" muted>On Brightspace (myCourses), Canvas, Moodle or Blackboard? Deadlines your profs post appear by themselves and stay up to date.</T>
            </View>
            <Icon name={ic('chevron.right', 'chevron_right')} size={18} color={t.muted} />
          </Pressy>
          <Card flat style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}><T variant="strong">No syllabus?</T><T variant="small" muted>Add the course by name and type in the deadlines.</T></View>
            <Button title="Add by hand" small kind="secondary" onPress={() => setStep('manual')} />
          </Card>
          {plan === 'free' && <T variant="small" muted>The free plan includes 2 courses.</T>}
        </>
      )}
      {step === 'manual' && (
        <Card style={{ gap: space.md }}>
          <Field label="Course code" placeholder="COMP 535" value={code} onChangeText={setCode} autoCapitalize="characters" />
          <Field label="Course name (optional)" placeholder="Computer Networks" value={name} onChangeText={setName} />
          <Row><Button title="Add course" onPress={manual} loading={saving} /><Button title="Back" kind="ghost" onPress={() => setStep('start')} /></Row>
        </Card>
      )}
      {step === 'drafts' && (
        <>
          <T variant="title">{working ? `Reading ${drafts.length === 1 ? 'your syllabus' : `${drafts.length} syllabuses`}…` : 'Check what we found'}</T>
          <T variant="small" muted>{working ? 'This usually takes under a minute. You can start checking the ones that are done.' : 'Fix anything that looks wrong, untick what you don\'t want, then save.'}</T>
          {drafts.map((d) => <DraftCard key={d.key} d={d} set={(p) => patch(d.key, p)} single={drafts.length === 1} />)}
          {err ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
          <Button title={working ? `Still reading ${working}…` : ready.length > 1 ? `Save ${ready.length} courses and build my plan` : 'Save and build my plan'} onPress={save} loading={saving} disabled={!!working || !ready.length} />
          <Row style={{ justifyContent: 'center' }}>
            <Button title="Add another syllabus" kind="ghost" icon={ic('plus', 'add')} onPress={() => fromSyllabus(pickDocuments)} />
            <Button title="Cancel" kind="ghost" onPress={cancel} />
          </Row>
        </>
      )}
      {err && step !== 'drafts' ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
    </Screen>
  );
}

function DraftCard({ d, set, single }: { d: Draft; set: (p: Partial<Draft>) => void; single: boolean }) {
  const t = useTheme();
  if (d.state === 'working') return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <ActivityIndicator color={t.accent} />
      <View style={{ flex: 1 }}><T variant="strong" numberOfLines={1}>{d.file}</T><T variant="small" muted>{d.status}</T></View>
    </Card>
  );
  if (d.state === 'error') return (
    <Card style={{ gap: 4, borderColor: t.danger }}>
      <T variant="strong" numberOfLines={1}>{d.file}</T>
      <T variant="small" style={{ color: t.danger }}>{d.error}</T>
    </Card>
  );
  const kept = d.found.filter((f) => f.keep).length;
  const setF = (i: number, p: Partial<Found>) => set({ found: d.found.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <Card style={{ gap: space.md, opacity: d.keep ? 1 : 0.55 }}>
      <Row style={{ flexWrap: 'nowrap' }}>
        {!single && (
          <Pressable onPress={() => set({ keep: !d.keep })} accessibilityRole="checkbox" accessibilityState={{ checked: d.keep }} accessibilityLabel={`Keep ${d.code || d.file}`}
            style={{ width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: d.keep ? t.accent : t.muted, backgroundColor: d.keep ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {d.keep && <Icon name={ic('checkmark', 'check')} size={16} color={t.onAccent} />}
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <T variant="heading">{d.code || 'Course code?'}{d.name ? ` · ${d.name}` : ''}</T>
          <T variant="small" muted numberOfLines={1}>{kept} deadline{kept === 1 ? '' : 's'} · from {d.file}</T>
        </View>
        {!single && <Button title={d.open ? 'Hide' : 'Check'} small kind="soft" onPress={() => set({ open: !d.open })} />}
      </Row>
      {d.note ? <T variant="small" style={{ color: t.warn }}>{d.note}</T> : null}
      {(d.open || single) && d.keep && (
        <View style={{ gap: space.md }}>
          <Field label="Course code" value={d.code} onChangeText={(v) => set({ code: v })} autoCapitalize="characters" />
          <Field label="Course name" value={d.name} onChangeText={(v) => set({ name: v })} />
          <T variant="label" muted>Deadlines and exams ({kept})</T>
          {d.found.length === 0 && <T muted>None found. You can add them in the course later, or connect your school calendar.</T>}
          {d.found.map((f, i) => (
            <View key={i} style={{ gap: space.sm, opacity: f.keep ? 1 : 0.5, padding: space.md, backgroundColor: t.surface, borderRadius: 10 }}>
              <Pressable onPress={() => setF(i, { keep: !f.keep })} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: f.keep }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: f.keep ? t.accent : t.muted, backgroundColor: f.keep ? t.accent : 'transparent' }} />
                <T style={{ fontWeight: '600', flex: 1 }}>{KIND_LABEL[f.kind]}{f.weight ? ` · ${f.weight}` : ''}</T>
              </Pressable>
              <Field placeholder="Label" value={f.label} onChangeText={(v) => setF(i, { label: v })} />
              <DateField value={f.due} onChange={(v) => setF(i, { due: v })} />
              <Field placeholder="What it covers" value={f.covers} onChangeText={(v) => setF(i, { covers: v })} multiline />
            </View>
          ))}
          <Field label="Course rules for the tutor (exam format, textbook…)" value={d.rules} onChangeText={(v) => set({ rules: v })} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
          <Field label="AI policy" value={d.policy} onChangeText={(v) => set({ policy: v })} multiline />
        </View>
      )}
    </Card>
  );
}
