import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Button, Card, Field, LinkText, Pill, Row, T, useAccent } from '@/components/ui';
import { Text } from 'react-native';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, runJob } from '@/lib/api';
import { daysUntil, fmtDay, fmtTime, isoToLocalInput, KIND_LABEL, localToISO, relDays, type Deadline, type DeadlineKind } from '@/lib/data';
import { refreshPhoneSchedule } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import { font as F, ink as INK, tint as TINT } from '@/lib/theme';
import type { CourseData } from './useCourse';

const KINDS: DeadlineKind[] = ['assignment', 'quiz', 'midterm', 'final', 'test', 'lab', 'project', 'other'];
type Draft = { id?: string; kind: DeadlineKind; label: string; due: string; covers: string };
type Change = { id: string | null; kind: DeadlineKind; label: string; due_at: string; covers: string; apply: boolean };

export function Deadlines({ data }: { data: CourseData }) {
  const t = useTheme();
  const { confirm } = useMenu();
  const notice = useNotice();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<{ summary: string; changes: Change[]; memory: string[]; rules: string } | null>(null);
  const c = data.course!;

  async function save() {
    if (!draft) return;
    const due = localToISO(draft.due.trim());
    if (!due) { notice('Check the date', 'Use the format 2026-11-02 23:59.'); return; }
    const row = { course_id: c.id, kind: draft.kind, label: draft.label.trim() || null, due_at: due, covers: draft.covers.trim() || null };
    const { error } = draft.id ? await supabase.from('deadlines').update(row).eq('id', draft.id) : await supabase.from('deadlines').insert(row);
    if (error) { notice("Couldn't save", error.message); return; }
    setDraft(null); await data.reload(); refreshPhoneSchedule();
  }

  async function toggleDone(d: Deadline) { await supabase.from('deadlines').update({ done: !d.done }).eq('id', d.id); data.reload(); refreshPhoneSchedule(); }
  async function remove(d: Deadline) {
    if (await confirm(`Delete ${d.label || KIND_LABEL[d.kind]}?`, 'Files filed under it move back to study material.', 'Delete')) {
      await supabase.from('deadlines').delete().eq('id', d.id); setDraft(null); data.reload(); refreshPhoneSchedule();
    }
  }

  async function readAnnouncement() {
    if (!paste?.trim()) return;
    setReading(true);
    try {
      const r = await runJob('announcement', { course_id: c.id, text: paste });
      setReview({
        summary: r.summary ?? '',
        changes: (r.deadlines ?? []).map((d: any) => ({ id: d.id && data.deadlines.some((x) => x.id === d.id) ? d.id : null, kind: KINDS.includes(d.kind) ? d.kind : 'other', label: d.label ?? '', due_at: d.due_at ?? '', covers: d.covers ?? '', apply: true })),
        memory: (r.memory ?? []).map(String), rules: r.rules_add ?? '',
      });
      setPaste(null);
    } catch (e) { notice("Couldn't read that message", (e as ApiError).message); }
    setReading(false);
  }

  async function applyReview() {
    if (!review) return;
    for (const ch of review.changes.filter((x) => x.apply)) {
      const due = localToISO(ch.due_at);
      if (!due) continue;
      const row = { course_id: c.id, kind: ch.kind, label: ch.label || null, due_at: due, covers: ch.covers || null };
      if (ch.id) await supabase.from('deadlines').update(row).eq('id', ch.id); else await supabase.from('deadlines').insert(row);
    }
    if (review.memory.length) await supabase.from('memory').insert(review.memory.map((text) => ({ course_id: c.id, kind: 'fact', text, source: 'announcement' })));
    if (review.rules.trim()) await supabase.from('courses').update({ rules: [c.rules, review.rules.trim()].filter(Boolean).join('\n') }).eq('id', c.id);
    setReview(null); await data.reload(); refreshPhoneSchedule();
  }

  const upcoming = data.deadlines.filter((d) => !d.done && daysUntil(d.due_at) >= 0);
  const past = data.deadlines.filter((d) => d.done || daysUntil(d.due_at) < 0);

  return (
    <View style={{ gap: space.md }}>
      {review ? (
        <Card style={{ gap: space.md }}>
          <T variant="heading">What the message changes</T>
          <T>{review.summary}</T>
          {review.changes.map((ch, i) => (
            <Pressable key={i} onPress={() => setReview({ ...review, changes: review.changes.map((x, j) => j === i ? { ...x, apply: !x.apply } : x) })}>
              <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: ch.apply ? t.accent : t.muted, backgroundColor: ch.apply ? t.accent : 'transparent', marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{ch.id ? 'Update' : 'Add'}: {KIND_LABEL[ch.kind]}{ch.label ? ` · ${ch.label}` : ''}</T>
                  <T variant="small" muted>{ch.due_at.replace('T', ' ')}{ch.covers ? ` · ${ch.covers}` : ''}</T>
                </View>
              </Row>
            </Pressable>
          ))}
          {review.memory.length > 0 && <T variant="small">Will remember: {review.memory.join(' · ')}</T>}
          {review.rules ? <T variant="small">Course rule added: {review.rules}</T> : null}
          <Row><Button title="Apply" onPress={applyReview} /><Button title="Discard" kind="ghost" onPress={() => setReview(null)} /></Row>
        </Card>
      ) : paste !== null ? (
        <Card style={{ gap: space.md }}>
          <T variant="heading">Paste a message from your professor</T>
          <T variant="small" muted>An email or announcement about an exam, a new deadline or a change. StudyBuddy works out what changes and asks before applying it.</T>
          <Field value={paste} onChangeText={setPaste} multiline style={{ minHeight: 140, textAlignVertical: 'top' }} placeholder="Midterm 1 is on Wednesday Oct 21 at 11:30…" />
          <Row><Button title="Read it" onPress={readAnnouncement} loading={reading} /><Button title="Cancel" kind="ghost" onPress={() => setPaste(null)} /></Row>
        </Card>
      ) : draft ? (
        <Card style={{ gap: space.md }}>
          <T variant="heading">{draft.id ? 'Edit deadline' : 'New deadline'}</T>
          <Row>{KINDS.map((k) => (
            <Pressable key={k} onPress={() => setDraft({ ...draft, kind: k })} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: draft.kind === k ? t.accent : t.border }}>
              <T variant="small">{KIND_LABEL[k]}</T>
            </Pressable>
          ))}</Row>
          <Field label="Label (optional)" placeholder="Midterm 1" value={draft.label} onChangeText={(v) => setDraft({ ...draft, label: v })} />
          <Field label="Date and time (YYYY-MM-DD HH:MM)" placeholder="2026-10-21 11:30" value={draft.due} onChangeText={(v) => setDraft({ ...draft, due: v })} autoCapitalize="none" />
          <Field label="What it covers" placeholder="Lectures 1-7: framing, CRC, Ethernet, routing" value={draft.covers} onChangeText={(v) => setDraft({ ...draft, covers: v })} multiline />
          <Row>
            <Button title="Save" onPress={save} />
            <Button title="Cancel" kind="ghost" onPress={() => setDraft(null)} />
            {draft.id ? <LinkText title="Delete" color={t.danger} onPress={() => remove(data.deadlines.find((x) => x.id === draft.id)!)} /> : null}
          </Row>
        </Card>
      ) : (
        <Row style={{ flexWrap: 'nowrap' }}>
          <Button title="Add" style={{ flex: 1 }} icon={{ ios: 'plus', android: 'add', web: 'add' }} onPress={() => setDraft({ kind: 'assignment', label: '', due: '', covers: '' })} />
          <Button title="Paste prof's message" kind="soft" style={{ flex: 2 }} icon={{ ios: 'doc.on.clipboard', android: 'content_paste', web: 'content_paste' }} onPress={() => setPaste('')} />
        </Row>
      )}
      {reading && <Row><ActivityIndicator /><T variant="small" muted>Reading the message…</T></Row>}
      {upcoming.length === 0 && !draft && <T muted>No upcoming deadlines. Upload the syllabus or add them here.</T>}
      {upcoming.map((d) => <DeadlineCard key={d.id} d={d} onEdit={() => setDraft({ id: d.id, kind: d.kind, label: d.label ?? '', due: isoToLocalInput(d.due_at), covers: d.covers ?? '' })} onDone={() => toggleDone(d)} />)}
      {past.length > 0 && <T variant="label" muted>Done or past</T>}
      {past.map((d) => <DeadlineCard key={d.id} d={d} onEdit={() => setDraft({ id: d.id, kind: d.kind, label: d.label ?? '', due: isoToLocalInput(d.due_at), covers: d.covers ?? '' })} onDone={() => toggleDone(d)} />)}
    </View>
  );
}

function DeadlineCard({ d, onEdit, onDone }: { d: Deadline; onEdit: () => void; onDone: () => void }) {
  const t = useTheme();
  const accent = useAccent().color;
  const n = daysUntil(d.due_at), due = new Date(d.due_at), soon = !d.done && n <= 3 && n >= 0;
  return (
    <Card style={{ flexDirection: 'row', gap: space.md, opacity: d.done ? 0.55 : 1, padding: space.md }}>
      <View style={{ width: 58, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: TINT(accent, 0.3), alignSelf: 'flex-start' }}>
        <View style={{ backgroundColor: accent, paddingVertical: 3, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: 11.5 }}>{due.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 4, backgroundColor: t.card }}>
          <Text style={{ color: t.text, fontFamily: F.display, fontSize: 24, lineHeight: 28 }}>{due.getDate()}</Text>
          <Text style={{ color: t.muted, fontFamily: F.semi, fontSize: 11 }}>{due.toLocaleDateString(undefined, { weekday: 'short' })}</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <Pill label={KIND_LABEL[d.kind]} color={accent} />
          <T variant="label" color={soon ? t.danger : t.muted}>{d.done ? 'Done' : relDays(n)}</T>
        </Row>
        <T variant="heading" style={{ fontSize: 17 }}>{d.label || KIND_LABEL[d.kind]}</T>
        <T variant="small" muted>{fmtTime(d.due_at)}{d.covers ? ` · ${d.covers}` : ''}</T>
        {!d.covers && <T variant="small" color={INK(t.warn, t)}>Add what it covers so the plan can target it.</T>}
        <Row style={{ marginTop: 4, gap: space.lg }}><LinkText title="Edit" onPress={onEdit} /><LinkText title={d.done ? 'Mark not done' : 'Mark done'} onPress={onDone} color={t.muted} /></Row>
      </View>
    </Card>
  );
}
