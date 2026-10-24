// Talks to the "ai" server function. The app never holds an AI key.
import { supabase } from './supabase';

export type Job =
  | 'chat' | 'reshape' | 'outline' | 'memory' | 'syllabus' | 'plan'
  | 'weekly_sheet' | 'exam_sheet' | 'derivation_sheet' | 'paper';
export type Msg = { role: 'user' | 'assistant'; content: string };

export type AIResult = { text: string; model: string; tier: string; demo: boolean; truncated?: boolean };
export class AIError extends Error {
  constructor(public code: string, message: string, public detail?: Record<string, unknown>) { super(message); }
}

export async function askAI(job: Job, messages: Msg[], system?: string): Promise<AIResult> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { job, messages, system } });
  if (error) {
    // Error responses carry a JSON body with { code, message }.
    let body: { code?: string; message?: string } | undefined;
    try { body = await (error as { context?: Response }).context?.json(); } catch { /* not JSON */ }
    throw new AIError(body?.code ?? 'network', body?.message ?? "Couldn't reach StudyBuddy. Check your connection.", body);
  }
  return data as AIResult;
}
