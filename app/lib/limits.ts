// Mirror of supabase/functions/_shared/limits.ts for showing meters in the app.
// The server is the one that enforces limits; keep these numbers in sync with it.
export type Plan = 'free' | 'pro';
export type UsageField = 'uploads' | 'tutor_messages' | 'weekly_sheets' | 'exam_sheets' | 'papers';

export const LIMITS: Record<Plan, { courses: number; storageMB: number } & Record<UsageField, number>> = {
  free: { courses: 2, storageMB: 500, uploads: 7, tutor_messages: 20, weekly_sheets: 4, exam_sheets: 1, papers: 1 },
  pro: { courses: 1000, storageMB: 5000, uploads: 200, tutor_messages: 1500, weekly_sheets: 1000, exam_sheets: 10, papers: 20 },
};

export const USAGE_LABELS: Record<UsageField, string> = {
  uploads: 'File uploads',
  tutor_messages: 'Tutor messages',
  weekly_sheets: 'Weekly revision sheets',
  exam_sheets: 'Exam & derivation sheets',
  papers: 'Practice papers',
};
