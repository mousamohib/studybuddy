import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, Card, Field, LinkText, Pill, Row, Segments, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, deleteMaterial, ERROR_UPGRADE, pickDocuments, pickPhoto, uploadMaterial, type Picked } from '@/lib/api';
import { fmtDay, isAssignment, KIND_LABEL, localToISO, type Deadline, type Material } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import { useAccount } from '@/lib/auth';
import type { CourseData } from './useCourse';

const STATUS: Record<Material['status'], string> = { uploaded: 'Uploading…', reading: 'Reading…', outlining: 'Outlining…', ready: 'Ready', error: "Couldn't read" };

export function Materials({ data }: { data: CourseData }) {
  const t = useTheme();
  const { refresh } = useAccount();
  const { open, confirm } = useMenu();
  const notice = useNotice();
  const assignments = data.deadlines.filter(isAssignment);
  const [tab, setTab] = useState<string>('study');
  const [uploading, setUploading] = useState(0);
  const [openOutline, setOpenOutline] = useState<string | null>(null);
  const [newAsg, setNewAsg] = useState({ label: '', due: '', covers: '' });
  const current = tab === 'study' || tab === 'new' ? null : assignments.find((d) => d.id === tab) ?? null;
  const files = data.materials.filter((m) => (current ? m.deadline_id === current.id : !m.deadline_id));

  async function upload(get: () => Promise<Picked[]>) {
    let picked: Picked[];
    try { picked = await get(); } catch (e) { notice((e as ApiError).message); return; }
    if (!picked.length) return;
    setUploading((n) => n + picked.length);
    for (const p of picked) {
      try { await uploadMaterial(data.course!.id, p, current?.id ?? null); }
      catch (e) {
        const a = e as ApiError;
        if (ERROR_UPGRADE.has(a.code)) open(a.message, [{ label: 'See Pro', onPress: () => router.push('/paywall') }, { label: 'Cancel' }]);
        else notice(`Couldn't upload ${p.name}`, a.message);
      } finally { setUploading((n) => n - 1); data.reload(); }
    }
    refresh();
  }

  function addMenu() {
    open(current ? `Add to ${current.label || 'this assignment'}` : 'Add study material', [
      { label: 'Files (PDF, PowerPoint, Word, zip, code)', onPress: () => upload(pickDocuments) },
      { label: 'Photos of notes or slides', onPress: () => upload(() => pickPhoto(false)) },
      { label: 'Take a photo', onPress: () => upload(() => pickPhoto(true)) },
      { label: 'Cancel' },
    ]);
  }

  async function remove(m: Material) {
    if (await confirm(`Delete ${m.file_name}?`, 'The file and its outline are removed.', 'Delete')) { await deleteMaterial(m.id, m.storage_path); data.reload(); }
  }

  async function createAssignment() {
    const due = localToISO(newAsg.due.trim());
    if (!newAsg.label.trim() || !due) { notice('Add a name and a due date', 'Use the format 2026-11-02 23:59.'); return; }
    const { data: row, error } = await supabase.from('deadlines').insert({ course_id: data.course!.id, kind: 'assignment', label: newAsg.label.trim(), due_at: due, covers: newAsg.covers.trim() || null }).select('id').single();
    if (error) { notice("Couldn't add it", error.message); return; }
    setNewAsg({ label: '', due: '', covers: '' }); await data.reload(); setTab(row!.id);
  }

  const items = [{ key: 'study', label: `Study material (${data.materials.filter((m) => !m.deadline_id).length})` },
    ...assignments.map((d) => ({ key: d.id, label: `${d.label || KIND_LABEL[d.kind]} · ${fmtDay(d.due_at)}` })), { key: 'new', label: '+ Assignment' }];

  return (
    <View style={{ gap: space.md }}>
      <Segments items={items} value={tab} onChange={setTab} />
      {tab === 'new' ? (
        <Card style={{ gap: space.md }}>
          <T variant="heading">New assignment</T>
          <T variant="small" muted>Each assignment gets its own place for the handout, starter code and your group's progress, so it never mixes with lecture material.</T>
          <Field label="Name" placeholder="PA2" value={newAsg.label} onChangeText={(v) => setNewAsg({ ...newAsg, label: v })} />
          <Field label="Due (YYYY-MM-DD HH:MM)" placeholder="2026-11-02 23:59" value={newAsg.due} onChangeText={(v) => setNewAsg({ ...newAsg, due: v })} autoCapitalize="none" />
          <Field label="Short description (optional)" placeholder="Link-state routing, part 2" value={newAsg.covers} onChangeText={(v) => setNewAsg({ ...newAsg, covers: v })} />
          <Button title="Create assignment" onPress={createAssignment} />
        </Card>
      ) : (
        <>
          <T variant="small" muted>{current
            ? `Files for ${current.label || 'this assignment'} (due ${fmtDay(current.due_at)}). Assignment chats only use these plus what was taught.`
            : 'Lecture slides, notes, readings, sample exams and practice sheets. Everything here is treated as the syllabus for this course\'s tests.'}</T>
          {files.map((m) => (
            <Card key={m.id} style={{ gap: 6 }}>
              <Pressable onPress={() => setOpenOutline(openOutline === m.id ? null : m.id)} onLongPress={() => remove(m)}>
                <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                  <T style={{ flex: 1, fontWeight: '600' }}>{m.file_name}</T>
                  {['uploaded', 'reading', 'outlining'].includes(m.status) ? <ActivityIndicator size="small" /> : null}
                </Row>
                <Row>
                  <Pill label={STATUS[m.status]} color={m.status === 'error' ? t.danger : m.status === 'ready' ? t.good : undefined} />
                  {m.outline?.kind && m.status === 'ready' ? <Pill label={m.outline.kind} /> : null}
                  {m.status === 'ready' ? <T variant="small" muted>{(m.outline?.topics ?? []).length} topics</T> : null}
                </Row>
              </Pressable>
              {openOutline === m.id && m.status === 'ready' && (
                <View style={{ gap: 4, paddingTop: 4 }}>
                  {(m.outline?.topics ?? []).map((tp, i) => (
                    <T key={i} variant="small">{`• ${tp.name}`}{tp.where ? <T variant="small" muted>{`  ${tp.where}`}</T> : null}</T>
                  ))}
                  {m.outline?.skipped?.length ? <T variant="small" muted>Skipped inside the file: {m.outline.skipped.slice(0, 8).join(', ')}</T> : null}
                </View>
              )}
              {m.status === 'error' && <T variant="small" muted>{m.outline?.error === 'no readable text' ? 'No readable text (maybe a scanned PDF). Try uploading photos of the pages instead.' : 'Something went wrong reading this file. Delete it and try again.'}</T>}
              {openOutline === m.id && <LinkText title="Delete file" color={t.danger} onPress={() => remove(m)} />}
            </Card>
          ))}
          {!files.length && <T muted>Nothing here yet.</T>}
          {uploading > 0 && <Row><ActivityIndicator /><T variant="small" muted>Uploading {uploading} file{uploading > 1 ? 's' : ''}…</T></Row>}
          <Button title={current ? 'Add handout, code or group progress' : 'Add study material'} kind="secondary" onPress={addMenu} />
          {current && <AssignmentInfo d={current} />}
        </>
      )}
    </View>
  );
}

function AssignmentInfo({ d }: { d: Deadline }) {
  return (
    <Card style={{ gap: 4 }}>
      <T variant="label" muted>About this assignment</T>
      <T>{d.covers || 'No description yet. Edit it in Deadlines.'}</T>
      <T variant="small" muted>Group projects and "my part" memory arrive in a later version.</T>
    </Card>
  );
}
