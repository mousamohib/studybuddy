// Plan limits from the spec (Free = about 70% of the first suggestion). Change numbers here only.
export type Plan = "free" | "pro";
export type UsageField = "uploads" | "tutor_messages" | "weekly_sheets" | "exam_sheets" | "papers";

export const LIMITS: Record<Plan, { courses: number; storageMB: number } & Record<UsageField, number>> = {
  free: { courses: 2, storageMB: 500, uploads: 7, tutor_messages: 20, weekly_sheets: 4, exam_sheets: 1, papers: 1 },
  pro: { courses: 1000, storageMB: 5000, uploads: 200, tutor_messages: 1500, weekly_sheets: 1000, exam_sheets: 10, papers: 20 },
};

// Which AI tier each job uses (spec: Version 1 features).
export type Tier = "fast" | "standard" | "strong";
export const JOBS: Record<string, { tier: Tier; counts: UsageField | null; maxTokens: number }> = {
  // Tutor chats use the fast, cheaper model during the beta (switch back to "standard" for higher quality).
  chat: { tier: "fast", counts: "tutor_messages", maxTokens: 4000 },
  reshape: { tier: "fast", counts: "tutor_messages", maxTokens: 4000 },
  upload: { tier: "fast", counts: "uploads", maxTokens: 3000 },
  outline: { tier: "fast", counts: null, maxTokens: 3000 },
  vision: { tier: "standard", counts: null, maxTokens: 4000 },
  announcement: { tier: "standard", counts: null, maxTokens: 4000 },
  memory: { tier: "fast", counts: null, maxTokens: 500 },
  syllabus: { tier: "standard", counts: null, maxTokens: 6000 },
  plan: { tier: "strong", counts: null, maxTokens: 14000 },
  weekly_sheet: { tier: "standard", counts: "weekly_sheets", maxTokens: 8000 },
  exam_sheet: { tier: "strong", counts: "exam_sheets", maxTokens: 12000 },
  derivation_sheet: { tier: "strong", counts: "exam_sheets", maxTokens: 12000 },
  paper: { tier: "strong", counts: "papers", maxTokens: 14000 },
};

// Model per tier: set in Supabase secrets so you can switch without an app update.
export function modelFor(tier: Tier): string {
  const env = Deno.env.get(`AI_MODEL_${tier.toUpperCase()}`);
  if (env) return env;
  return { fast: "claude-haiku-5-5", standard: "claude-sonnet-5-5", strong: "claude-sonnet-5-5" }[tier];
}

// Price per million tokens (USD) per tier, for cost tracking. Set real prices in secrets once known.
export function pricePerMTok(tier: Tier): { input: number; output: number } {
  const i = Number(Deno.env.get(`AI_PRICE_${tier.toUpperCase()}_IN`) ?? "");
  const o = Number(Deno.env.get(`AI_PRICE_${tier.toUpperCase()}_OUT`) ?? "");
  const fallback = { fast: { input: 1, output: 5 }, standard: { input: 3, output: 15 }, strong: { input: 3, output: 15 } }[tier];
  return { input: Number.isFinite(i) && i > 0 ? i : fallback.input, output: Number.isFinite(o) && o > 0 ? o : fallback.output };
}
