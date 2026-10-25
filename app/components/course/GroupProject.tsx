// Project memory for one assignment: solo or group, who does what, the student's part, progress log.
// Assignment chats read this so help stays on the student's part and fits the team's plan.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Field, IconButton, ic, Row, Segments, T, useAccent } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import type { Deadline } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';

type Member = { name: string; part: string };
type Brief = { members?: Member[]; log?: { date: string; text: string }[]; notes?: string };

export function GroupProject({ d }: { d: Deadline }) {
  const t = useTheme();
  const accent = useAccent().color;
  const notice = useNotice();
  const [group, setGroup] = useState(false);
  const [role, setRole] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [notes, setNotes] = useState('');
  const [log, setLog] = useState<Brief['log']>([]);
  const [entry, setEntry] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('project_briefs').select('is_group, role, brief').eq('deadline_id', d.id).maybeSingle();
    const b = (data?.brief ?? {}) as Brief;
    setGroup(!!data?.is_group); setRole(data?.role ?? ''); setMembers(b.members ?? []); setNotes(b.notes ?? ''); setLog(b.log ?? []); setDirty(false);
  }, [d.id]);
  useEffect(() => { load(); }, [load]);

  async function save(extraLog?: Brief['log']) {
    setSaving(true);
    const brief: Brief = { members: members.filter((m) => m.name.trim()), notes: notes.trim() || undefined, log: extraLog ?? log };
    const { error } = await supabase.from('project_briefs').upsert({ deadline_id: d.id, is_group: group, role: role.trim() || null, brief, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) { notice("Couldn't save", error.message); return; }
    setDirty(false);
  }

  async function addLog() {
    if (!entry.trim()) return;
    const next = [...(log ?? []), { date: new Date().toISOString().slice(0, 10), text: entry.trim() }];
    setLog(next); setEntry('');
    await save(next);
  }

  const change = <K,>(set: (v: K) => void) => (v: K) => { set(v); setDirty(true); };

  return (
    <View style={{ gap: space.md, paddingTop: space.lg }}>
      <T variant="heading">Project memory</T>
      <T variant="small" muted>Chats for this assignment remember this, so help stays on your part and fits the team's plan.</T>
      <Segments items={[{ key: 'solo', label: 'Just me' }, { key: 'group', label: 'Group project' }]} value={group ? 'group' : 'solo'} onChange={(k) => change(setGroup)(k === 'group')} />
      <Field label="My part" placeholder={group ? 'e.g. the routing table and LSAUPDATE handling' : 'e.g. all of it, starting with part 1'} value={role} onChangeText={change(setRole)} multiline />
      {group && (
        <View style={{ gap: space.sm }}>
          <T variant="label">Teammates</T>
          {members.map((m, i) => (
            <Row key={i} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <View style={{ flex: 2 }}><Field placeholder="Name" value={m.name} onChangeText={(v) => change(setMembers)(members.map((x, j) => (j === i ? { ...x, name: v } : x)))} /></View>
              <View style={{ flex: 3 }}><Field placeholder="Their part" value={m.part} onChangeText={(v) => change(setMembers)(members.map((x, j) => (j === i ? { ...x, part: v } : x)))} /></View>
              <View style={{ paddingTop: 6 }}><IconButton icon={ic('xmark', 'close')} label="Remove teammate" size={36} onPress={() => change(setMembers)(members.filter((_, j) => j !== i))} /></View>
            </Row>
          ))}
          <Button title="Add a teammate" small kind="soft" icon={ic('person.badge.plus', 'person_add')} onPress={() => change(setMembers)([...members, { name: '', part: '' }])} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
      <Field label="Notes" placeholder="Decisions, interfaces you agreed on, what the TA said…" value={notes} onChangeText={change(setNotes)} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      {dirty && <Button title="Save project memory" onPress={() => save()} loading={saving} />}

      <T variant="label" style={{ marginTop: space.sm }}>Progress</T>
      {(log ?? []).slice(-8).reverse().map((l, i) => (
        <Row key={i} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent, marginTop: 7 }} />
          <T variant="small" style={{ flex: 1 }}><T variant="small" muted>{new Date(l.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}  </T>{l.text}</T>
        </Row>
      ))}
      {!(log ?? []).length && <T variant="small" muted>Nothing yet. Add a note here, or just tell the tutor what you finished.</T>}
      <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field placeholder="e.g. Finished the HELLO handshake" value={entry} onChangeText={setEntry} onSubmitEditing={addLog} /></View>
        <IconButton icon={ic('plus', 'add')} label="Add progress note" size={48} bg={entry.trim() ? accent : t.surface} color={entry.trim() ? '#FFFFFF' : t.muted} onPress={addLog} />
      </Row>
      <View style={{ height: 1, borderRadius: radius.sm }} />
    </View>
  );
}
