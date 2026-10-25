// "Upload your syllabus, and your semester is set up": the main hook.
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, Card, Field, ic, Row, Screen, Stickers, T } from '@/components/ui';
import { useMenu } from '@/components/Menu';
import { DateField } from '@/components/DateField';
import { ApiError, ERROR_UPGRADE, pickDocuments, pickPhoto, runJob, uploadMaterial, waitMaterial, type Picked } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import { KIND_LABEL, localToISO, rebuildPlan, type DeadlineKind } from '@/lib/data';
import { refreshPhoneSchedule } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

type Found = { kind: DeadlineKind; label: string; due: string; covers: string; weight: string; keep: boolean };
const KINDS: DeadlineKind[] = ['assignment', 'quiz', 'midterm', 'final', 'test', 'lab', 'project', 'other'];

export default function NewCourse() {
  const t = useTheme();
  const { refresh, plan } = useAccount();
  const { open } = useMenu();
  const [step, setStep] = useState<'start' | 'manual' | 'working' | 'review'>('start');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState('');
  const [rules, setRules] = useState('');
  const [note, setNote] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [saving, setSaving] = useState(false);
  const ids = useRef<{ course?: string; material?: string }>({});

  async function createCourse(c: string, n: string | null) {
    const { data, error } = await supabase.from('courses').insert({ code: c, name: n }).select('id').single();
    if (error) throw new ApiError(error.message.includes('course_limit') ? 'limit_reached' : 'failed', error.message.includes('course_limit') ? 'The free plan allows 2 courses. Upgrade to Pro for more.' : error.message);
    return data!.id as string;
  }

  function fail(e: unknown) {
    const a = e as ApiError;
    if (ERROR_UPGRADE.has(a.code)) open(a.message, [{ label: 'See Pro', onPress: () => router.push('/paywall') }, { label: 'OK' }]);
    setErr(a.message ?? 'Something went wrong.'); setStep('start');
  }

  async function fromSyllabus(get: () => Promise<Picked[]>) {
    setErr('');
    let picked: Picked[];
    try { picked = await get(); } catch (e) { setErr((e as ApiError).message); return; }
    if (!picked.length) return;
    setStep('working');
    try {
      setStatus('Creating the course…');
      ids.current.course = await createCourse('NEW COURSE', null);
      setStatus('Uploading the syllabus…');
      ids.current.material = await uploadMaterial(ids.current.course, picked[0]);
      setStatus('Reading it…');
      await waitMaterial(ids.current.material);
      setStatus('Finding deadlines, exams and topics…');
      const r = await runJob('syllabus', { material_id: ids.current.material, course_id: ids.current.course });
      setCode(r.course?.code || ''); setName(r.course?.name || ''); setPolicy(r.ai_policy || ''); setRules(r.rules || ''); setNote(r.note || '');
      setFound((r.deadlines ?? []).map((d: any) => ({ kind: KINDS.includes(d.kind) ? d.kind : 'other', label: d.label || '', due: String(d.due_at || '').replace('T', ' ').slice(0, 16), covers: d.covers || '', weight: d.weight || '', keep: true })));
      setStep('review');
    } catch (e) {
      if (ids.current.course) await supabase.from('courses').delete().eq('id', ids.current.course);
      ids.current = {};
      fail(e);
    } finally { refresh(); }
  }

  async function save() {
    if (!code.trim()) { setErr('Add the course code.'); return; }
    const bad = found.filter((f) => f.keep && !localToISO(f.due));
    if (bad.length) { setErr(`Fix the date for "${bad[0].label || KIND_LABEL[bad[0].kind]}" (pick a date and time) or untick it.`); return; }
    setSaving(true); setErr('');
    const courseId = ids.current.course!;
    await supabase.from('courses').update({ code: code.trim().toUpperCase(), name: name.trim() || null, ai_policy: policy.trim() || null, rules: rules.trim() || null }).eq('id', courseId);
    const rows = found.filter((f) => f.keep).map((f) => ({ course_id: courseId, kind: f.kind, label: f.label.trim() || null, due_at: localToISO(f.due)!, covers: [f.covers.trim(), f.weight ? `Weight: ${f.weight}` : ''].filter(Boolean).join('. ') || null }));
    if (rows.length) await supabase.from('deadlines').insert(rows);
    const { data: m } = await supabase.from('materials').select('outline').eq('id', ids.current.material!).maybeSingle();
    await supabase.from('materials').update({ outline: { ...(m?.outline ?? {}), kind: 'syllabus' } }).eq('id', ids.current.material!);
    rebuildPlan().catch(() => {});
    refreshPhoneSchedule().catch(() => {});
    setSaving(false);
    router.replace({ pathname: '/course/[id]', params: { id: courseId } });
  }

  async function cancel() {
    if (ids.current.course) {
      const { data: mats } = await supabase.from('materials').select('storage_path').eq('course_id', ids.current.course);
      const paths = (mats ?? []).map((x) => x.storage_path).filter(Boolean) as string[];
      if (paths.length) await supabase.storage.from('materials').remove(paths);
      await supabase.from('courses').delete().eq('id', ids.current.course);
    }
    router.back();
  }

  async function manual() {
    if (!code.trim()) { setErr('Enter a course code, e.g. COMP 535.'); return; }
    setSaving(true);
    try { const id = await createCourse(code.trim().toUpperCase(), name.trim() || null); router.replace({ pathname: '/course/[id]', params: { id } }); }
    catch (e) { fail(e); setStep('manual'); }
    setSaving(false);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Add a course' }} />
      {step === 'start' && (
        <>
          <Stickers size={48} />
          <T variant="display">Start from the syllabus</T>
          <T muted style={{ fontSize: 17, lineHeight: 25 }}>Upload the course outline. StudyBuddy finds every deadline and exam, what each covers, the exam rules and the AI policy. You check it all before anything is saved.</T>
          <Button title="Upload syllabus file" icon={ic('arrow.up.doc.fill', 'upload_file')} onPress={() => fromSyllabus(async () => (await pickDocuments()).slice(0, 1))} />
          <Button title="Take a photo of it" kind="soft" icon={ic('camera.fill', 'photo_camera')} onPress={() => fromSyllabus(() => pickPhoto(false))} />
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
      {step === 'working' && (
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <ActivityIndicator size="large" />
          <T>{status}</T>
          <T variant="small" muted>This usually takes under a minute.</T>
        </Card>
      )}
      {step === 'review' && (
        <>
          <T variant="title">Check what we found</T>
          {note ? <Card><T variant="small" style={{ color: t.warn }}>{note}</T></Card> : null}
          <Card style={{ gap: space.md }}>
            <Field label="Course code" value={code} onChangeText={setCode} autoCapitalize="characters" />
            <Field label="Course name" value={name} onChangeText={setName} />
          </Card>
          <T variant="label" muted>Deadlines and exams ({found.filter((f) => f.keep).length})</T>
          {found.length === 0 && <T muted>None found. You can add them in the course later.</T>}
          {found.map((f, i) => {
            const set = (p: Partial<Found>) => setFound(found.map((x, j) => (j === i ? { ...x, ...p } : x)));
            return (
              <Card key={i} style={{ gap: space.sm, opacity: f.keep ? 1 : 0.5 }}>
                <Pressable onPress={() => set({ keep: !f.keep })} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: f.keep }}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: f.keep ? t.accent : t.muted, backgroundColor: f.keep ? t.accent : 'transparent' }} />
                  <T style={{ fontWeight: '600', flex: 1 }}>{KIND_LABEL[f.kind]}{f.weight ? ` · ${f.weight}` : ''}</T>
                </Pressable>
                <Field placeholder="Label" value={f.label} onChangeText={(v) => set({ label: v })} />
                <DateField value={f.due} onChange={(v) => set({ due: v })} />
                <Field placeholder="What it covers" value={f.covers} onChangeText={(v) => set({ covers: v })} multiline />
              </Card>
            );
          })}
          <Card style={{ gap: space.md }}>
            <Field label="Course rules for the tutor (exam format, textbook…)" value={rules} onChangeText={setRules} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <Field label="AI policy" value={policy} onChangeText={setPolicy} multiline />
          </Card>
          {err ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
          <Button title="Save and build my plan" onPress={save} loading={saving} />
          <Button title="Cancel" kind="ghost" onPress={cancel} />
        </>
      )}
      {err && step !== 'review' ? <T variant="small" style={{ color: t.danger }}>{err}</T> : null}
    </Screen>
  );
}
