import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Field, Icon, ic, LinkText, Pill, Pressy, Row, Segments, T, useAccent } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { DateField } from '@/components/DateField';
import { GroupProject } from './GroupProject';
import { useFileDrop } from '@/lib/useFileDrop';
import { ApiError, deleteMaterial, ERROR_UPGRADE, pickDocuments, pickPhoto, uploadMaterial, type Picked } from '@/lib/api';
import { fmtDay, isAssignment, KIND_LABEL, localToISO, type Deadline, type Material } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { ink, radius, space, tint, useTheme } from '@/lib/theme';
import { useAccount } from '@/lib/auth';
import type { CourseData } from './useCourse';

const FILE_LOOK = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { c: '#E5385F', i: ic('doc.richtext.fill', 'picture_as_pdf'), l: 'PDF' };
  if (['ppt', 'pptx', 'key'].includes(ext)) return { c: '#F07A12', i: ic('rectangle.on.rectangle.angled.fill', 'slideshow'), l: 'Slides' };
  if (['doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) return { c: '#3442F5', i: ic('doc.text.fill', 'article'), l: 'Doc' };
  if (['zip'].includes(ext)) return { c: '#8B4DF0', i: ic('archivebox.fill', 'folder_zip'), l: 'Zip' };
  if (['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext)) return { c: '#0F9F74', i: ic('photo.fill', 'image'), l: 'Photo' };
  return { c: '#0B93D6', i: ic('chevron.left.forwardslash.chevron.right', 'code'), l: 'Code' };
};

const STATUS: Record<Material['status'], string> = { uploaded: 'Uploading…', reading: 'Reading…', outlining: 'Outlining…', ready: 'Ready', error: "Couldn't read" };

export function Materials({ data }: { data: CourseData }) {
  const t = useTheme();
  const accent = useAccent().color;
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

  const dropRef = useRef<View>(null);
  const [over, setOver] = useState(false);
  useFileDrop(dropRef, (files) => { if (tab !== 'new') upload(async () => files); }, setOver);

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
    if (!newAsg.label.trim() || !due) { notice('Add a name and a due date'); return; }
    const { data: row, error } = await supabase.from('deadlines').insert({ course_id: data.course!.id, kind: 'assignment', label: newAsg.label.trim(), due_at: due, covers: newAsg.covers.trim() || null }).select('id').single();
    if (error) { notice("Couldn't add it", error.message); return; }
    setNewAsg({ label: '', due: '', covers: '' }); await data.reload(); setTab(row!.id);
  }

  const items = [{ key: 'study', label: `Study material (${data.materials.filter((m) => !m.deadline_id).length})` },
    ...assignments.map((d) => ({ key: d.id, label: `${d.label || KIND_LABEL[d.kind]} · ${fmtDay(d.due_at)}` })), { key: 'new', label: '+ Assignment' }];

  return (
    <View ref={dropRef} style={{ gap: space.md }}>
      {over && (
        <View pointerEvents="none" style={{ position: 'absolute', zIndex: 10, left: -8, right: -8, top: -8, bottom: -8, borderRadius: radius.lg, backgroundColor: tint(accent, 0.12), borderWidth: 3, borderStyle: 'dashed', borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.md }}>
            <T variant="heading" color="#FFFFFF">Drop to add to {current ? current.label || 'this assignment' : 'study material'}</T>
          </View>
        </View>
      )}
      <Segments items={items} value={tab} onChange={setTab} />
      {tab === 'new' ? (
        <View style={{ gap: space.md }}>
          <T variant="heading">New assignment</T>
          <T variant="small" muted>Each assignment gets its own place for the handout, starter code and your group's progress, so it never mixes with lecture material.</T>
          <Field label="Name" placeholder="PA2" value={newAsg.label} onChangeText={(v) => setNewAsg({ ...newAsg, label: v })} />
          <DateField label="Due" value={newAsg.due} onChange={(v) => setNewAsg({ ...newAsg, due: v })} />
          <Field label="Short description (optional)" placeholder="Link-state routing, part 2" value={newAsg.covers} onChangeText={(v) => setNewAsg({ ...newAsg, covers: v })} />
          <Button title="Create assignment" onPress={createAssignment} />
        </View>
      ) : (
        <>
          <T variant="small" muted>{current
            ? `Files for ${current.label || 'this assignment'} (due ${fmtDay(current.due_at)}). Assignment chats only use these plus what was taught.`
            : 'Lecture slides, notes, readings, sample exams and practice sheets. Everything here is treated as the syllabus for this course\'s tests.'}</T>
          {files.map((m) => {
            const look = FILE_LOOK(m.file_name), busy = ['uploaded', 'reading', 'outlining'].includes(m.status), isOpen = openOutline === m.id;
            return (
              <View key={m.id} style={{ gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border }}>
                <Pressy haptics={false} onPress={() => setOpenOutline(isOpen ? null : m.id)} onLongPress={() => remove(m)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tint(look.c, t.dark ? 0.22 : 0.12), alignItems: 'center', justifyContent: 'center' }}>
                    {busy ? <ActivityIndicator size="small" color={look.c} /> : <Icon name={look.i} size={22} color={ink(look.c, t)} />}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T variant="strong" numberOfLines={1}>{m.outline?.title && m.status === 'ready' ? m.outline.title : m.file_name}</T>
                    <Row style={{ gap: 6 }}>
                      {m.status === 'ready'
                        ? <><Pill label={m.outline?.kind === 'practice' ? 'Practice' : m.outline?.kind === 'assignment' ? 'Assignment' : look.l} color={look.c} /><T variant="small" muted>{(m.outline?.topics ?? []).length} topics</T></>
                        : <Pill label={STATUS[m.status]} color={m.status === 'error' ? t.danger : accent} />}
                    </Row>
                  </View>
                  {m.status === 'ready' && <Icon name={isOpen ? ic('chevron.up', 'expand_less') : ic('chevron.down', 'expand_more')} size={20} color={t.muted} />}
                </Pressy>
                {isOpen && m.status === 'ready' && (
                  <View style={{ gap: 6, paddingTop: 4, paddingLeft: 4 }}>
                    <T variant="small" muted numberOfLines={1}>{m.file_name}</T>
                    {(m.outline?.topics ?? []).map((tp, i) => (
                      <Row key={i} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, marginTop: 7 }} />
                        <T variant="small" style={{ flex: 1 }}>{tp.name}{tp.where ? <T variant="small" muted>{`  ${tp.where}`}</T> : null}</T>
                      </Row>
                    ))}
                    {m.outline?.skipped?.length ? <T variant="small" muted>Skipped inside the file: {m.outline.skipped.slice(0, 8).join(', ')}</T> : null}
                  </View>
                )}
                {m.status === 'error' && <T variant="small" muted>{m.outline?.error === 'no readable text' ? 'No readable text (maybe a scanned PDF). Try uploading photos of the pages instead.' : 'Something went wrong reading this file. Delete it and try again.'}</T>}
                {(isOpen || m.status === 'error') && <LinkText title="Delete file" color={t.danger} onPress={() => remove(m)} />}
              </View>
            );
          })}
          {uploading > 0 && <Row><ActivityIndicator color={accent} /><T variant="small" muted>Uploading {uploading} file{uploading > 1 ? 's' : ''}…</T></Row>}
          <View style={{ gap: 6 }}>
            <Button title={current ? 'Add handout, code or group progress' : files.length ? 'Add more files' : 'Add your first file'} icon={ic('arrow.up.doc.fill', 'upload_file')} onPress={addMenu} />
            <T variant="small" muted style={{ textAlign: 'center' }}>PDF, PowerPoint, Word, zip, code or photos of notes{Platform.OS === 'web' ? '. Or drag files anywhere here.' : ''}</T>
          </View>
          {current && <AssignmentInfo d={current} />}
        </>
      )}
    </View>
  );
}

function AssignmentInfo({ d }: { d: Deadline }) {
  return (
    <View style={{ gap: space.sm }}>
      <Card flat style={{ gap: 4 }}>
        <T variant="label" muted>About this assignment</T>
        <T>{d.covers || 'No description yet. Edit it in Deadlines.'}</T>
      </Card>
      <GroupProject d={d} />
    </View>
  );
}
