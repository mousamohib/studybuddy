// Everything that talks to the server functions: file uploads, background jobs and the streaming tutor.
import * as DocumentPicker from 'expo-document-picker';
import { File as FSFile } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

const base = () => `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;
async function headers() {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    'Content-Type': 'application/json',
  };
}

async function post<T>(fn: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base()}/${fn}`, { method: 'POST', headers: await headers(), body: JSON.stringify(body) });
  } catch {
    throw new ApiError('network', "Couldn't reach StudyBuddy. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.code ?? 'failed', data.message ?? 'Something went wrong. Try again.', data);
  return data as T;
}

// ---------- background jobs ----------
export type JobKind = 'syllabus' | 'announcement' | 'plan' | 'weekly_sheet' | 'exam_sheet' | 'derivation_sheet' | 'paper';
export type JobRow = { id: string; kind: JobKind; status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'; result: any; error: string | null; created_at: string; input: any };

export async function startJob(kind: JobKind, input: Record<string, unknown>): Promise<string> {
  const { job_id } = await post<{ job_id: string }>('jobs', { kind, input });
  return job_id;
}

/** Polls a job until it finishes. Resolves with its result; rejects with ApiError on failure. */
export async function waitJob(id: string, signal?: { cancelled: boolean }): Promise<any> {
  for (let i = 0; i < 400; i++) {
    if (signal?.cancelled) throw new ApiError('cancelled', 'Stopped.');
    const { data } = await supabase.from('jobs').select('status, result, error').eq('id', id).maybeSingle();
    if (data?.status === 'done') return data.result;
    if (data?.status === 'error') throw new ApiError('job_failed', data.error ?? 'Something went wrong. Try again.');
    await new Promise((r) => setTimeout(r, i < 10 ? 1500 : 3000));
  }
  throw new ApiError('timeout', 'This is taking too long. Check back in a few minutes.');
}

export const runJob = async (kind: JobKind, input: Record<string, unknown>) => waitJob(await startJob(kind, input));

// ---------- files ----------
export type Picked = { uri: string; name: string; mimeType?: string; size?: number; file?: Blob };

export async function pickDocuments(): Promise<Picked[]> {
  const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (r.canceled) return [];
  return r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? undefined, size: a.size ?? undefined, file: (a as { file?: Blob }).file }));
}

export async function pickPhoto(fromCamera: boolean): Promise<Picked[]> {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new ApiError('permission', fromCamera ? 'Allow camera access in Settings to take photos of notes.' : 'Allow photo access in Settings to upload pictures.');
  const r = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 6 });
  if (r.canceled) return [];
  const out: Picked[] = [];
  for (const a of r.assets) {
    // Convert everything (HEIC included) to a reasonably sized JPEG the AI can read.
    const img = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: Math.min(a.width || 2000, 2000) } }], { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    out.push({ uri: img.uri, name: `Photo ${stamp}.jpg`, mimeType: 'image/jpeg' });
  }
  return out;
}

async function readBytes(p: Picked): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return p.file ? p.file.arrayBuffer() : (await fetch(p.uri)).arrayBuffer();
  return new FSFile(p.uri).arrayBuffer();
}

const MAX_BYTES = 50 * 1024 * 1024;

/** Uploads one file to a course (or an assignment in it) and starts reading it on the server. */
export async function uploadMaterial(courseId: string, p: Picked, deadlineId: string | null = null): Promise<string> {
  if (p.size && p.size > MAX_BYTES) throw new ApiError('too_large', `${p.name} is over 50 MB.`);
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session!.user.id;
  const { data: row, error } = await supabase.from('materials')
    .insert({ course_id: courseId, deadline_id: deadlineId, file_name: p.name, file_type: p.mimeType ?? null, size_bytes: p.size ?? null })
    .select('id').single();
  if (error || !row) throw new ApiError('failed', error?.message ?? "Couldn't add the file.");
  const path = `${uid}/${row.id}-${p.name.replace(/[^\w.\- ]+/g, '_').slice(-120)}`;
  const bytes = await readBytes(p);
  if (bytes.byteLength > MAX_BYTES) { await supabase.from('materials').delete().eq('id', row.id); throw new ApiError('too_large', `${p.name} is over 50 MB.`); }
  const up = await supabase.storage.from('materials').upload(path, bytes, { contentType: p.mimeType ?? 'application/octet-stream', upsert: true });
  if (up.error) { await supabase.from('materials').delete().eq('id', row.id); throw new ApiError('upload_failed', `Couldn't upload ${p.name}: ${up.error.message}`); }
  await supabase.from('materials').update({ storage_path: path, size_bytes: bytes.byteLength }).eq('id', row.id);
  await post('process-file', { material_id: row.id });
  return row.id;
}

/** Waits until a material has been read and outlined. */
export async function waitMaterial(id: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    const { data } = await supabase.from('materials').select('status, outline').eq('id', id).maybeSingle();
    if (!data) throw new ApiError('gone', 'The file was removed.');
    if (data.status === 'ready') return;
    if (data.status === 'error') throw new ApiError('unreadable', (data.outline as { error?: string } | null)?.error === 'no readable text' ? "That file has no readable text." : "Couldn't read that file.");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new ApiError('timeout', 'Reading the file is taking too long.');
}

export async function deleteMaterial(id: string, storagePath: string | null) {
  if (storagePath) await supabase.storage.from('materials').remove([storagePath]);
  await supabase.from('materials').delete().eq('id', id);
}

// ---------- tutor (streaming) ----------
export type ChatMessage = { role: 'user' | 'assistant'; content: string; ts?: number; saved?: string[]; original?: string; shape?: string; interrupted?: boolean };
type StreamBody = { mode: 'chat'; chat_id: string; text?: string; regenerate?: boolean } | { mode: 'reshape'; chat_id: string; index: number; style: string; keep?: boolean };

export async function streamTutor(body: StreamBody, onDelta: (textSoFar: string) => void, signal?: AbortSignal): Promise<{ message: ChatMessage; saved: string[]; title: string }> {
  const f = (Platform.OS === 'web' ? fetch : expoFetch) as typeof fetch;
  let res: Response;
  try {
    res = await f(`${base()}/ai`, { method: 'POST', headers: await headers(), body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError('cancelled', 'Stopped.');
    throw new ApiError('network', "Couldn't reach StudyBuddy. Check your connection.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.code ?? 'failed', data.message ?? 'Something went wrong. Try again.', data);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '', done: { message: ChatMessage; saved: string[]; title: string } | null = null, err: ApiError | null = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      if (ev.t === 'delta') { text += ev.v; onDelta(text.replace(/\[\[(remember|revisit):[\s\S]*?(\]\]|$)/gi, '')); }
      else if (ev.t === 'done') done = { message: ev.message, saved: ev.saved ?? [], title: ev.title };
      else if (ev.t === 'error') err = new ApiError(ev.code, ev.message);
    }
  }
  if (done) return done;
  throw err ?? new ApiError('failed', 'The answer was cut off. Try again.');
}

export const ERROR_UPGRADE = new Set(['limit_reached', 'storage_full']);
