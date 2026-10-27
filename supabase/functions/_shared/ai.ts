// Shared AI plumbing: limit checks, the provider call (plain and streaming), demo mode and cost tracking.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { JOBS, LIMITS, modelFor, pricePerMTok, type Plan, type Tier } from "./limits.ts";

export type Content = string | Array<
  { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
>;
export type Msg = { role: "user" | "assistant"; content: Content };

export const BUDGET_MESSAGE = "Scrawlie's AI is taking a break: the beta has used this month's AI allowance. Your plan, deadlines, calendar and files all still work, and the AI comes back next month (or sooner as we add more).";

export type Settings = { ai_paused: boolean; ai_budget_usd: number; free_cap_usd: number; pro_cap_usd: number };
/** Admin-set settings (app_settings row), falling back to secrets, then beta defaults. */
export async function getSettings(admin: SupabaseClient): Promise<Settings> {
  const env = (k: string, d: number) => { const v = Number(Deno.env.get(k) ?? ""); return Number.isFinite(v) && v > 0 ? v : d; };
  const base: Settings = { ai_paused: false, ai_budget_usd: env("AI_MONTHLY_BUDGET_USD", 24), free_cap_usd: env("USER_MONTHLY_COST_USD_FREE", 0.5), pro_cap_usd: env("USER_MONTHLY_COST_USD_PRO", 8) };
  const { data } = await admin.from("app_settings").select("ai_paused, ai_budget_usd, free_cap_usd, pro_cap_usd").eq("id", 1).maybeSingle();
  if (!data) return base;
  return { ai_paused: !!data.ai_paused, ai_budget_usd: Number(data.ai_budget_usd), free_cap_usd: Number(data.free_cap_usd), pro_cap_usd: Number(data.pro_cap_usd) };
}

export const isDemo = () => Deno.env.get("AI_MODE") === "demo" || !Deno.env.get("ANTHROPIC_API_KEY");

export class LimitError extends Error {
  constructor(public status: number, public code: string, message: string, public extra: Record<string, unknown> = {}) { super(message); }
}

/** Throws LimitError when the user may not run this job now. Returns their plan. */
export async function checkAllowed(admin: SupabaseClient, uid: string, jobKey: string): Promise<Plan> {
  const job = JOBS[jobKey];
  const { data: planRow } = await admin.rpc("effective_plan", { uid });
  const plan: Plan = planRow === "pro" ? "pro" : "free";
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await admin.from("usage").select("*").eq("user_id", uid).eq("month", month).maybeSingle();
  if (job?.counts) {
    const used = (usage?.[job.counts] as number | undefined) ?? 0;
    const limit = LIMITS[plan][job.counts];
    if (used >= limit) {
      throw new LimitError(402, "limit_reached",
        plan === "free" ? "You've used this month's free allowance for this. Upgrade to Pro for more." : "You've reached this month's limit for this.",
        { field: job.counts, used, limit, plan });
    }
  }
  const st = await getSettings(admin);
  if (st.ai_paused) throw new LimitError(503, "ai_paused", "Scrawlie's AI is paused for a moment. Your plan, deadlines, calendar and files all still work. Try again a bit later.");
  const cap = plan === "pro" ? st.pro_cap_usd : st.free_cap_usd;
  if (Number(usage?.cost_usd ?? 0) >= cap) throw new LimitError(402, "cost_cap", "You've reached this month's AI usage cap.");
  const month2 = month;
  const { data: rows } = await admin.from("usage").select("cost_usd").eq("month", month2);
  const spent = (rows ?? []).reduce((a: number, r: { cost_usd: number }) => a + Number(r.cost_usd), 0);
  if (spent >= st.ai_budget_usd) throw new LimitError(503, "budget_reached", BUDGET_MESSAGE);
  return plan;
}

/** Records one use of a job plus its tokens and cost. */
export async function recordUsage(admin: SupabaseClient, uid: string, jobKey: string, tier: Tier, inTok = 0, outTok = 0, count = true) {
  const job = JOBS[jobKey];
  const p = pricePerMTok(tier);
  const cost = (inTok * p.input + outTok * p.output) / 1_000_000;
  await admin.rpc("add_usage", {
    uid, field: count && job?.counts ? job.counts : "none", amount: count && job?.counts ? 1 : 0,
    in_tok: inTok, out_tok: outTok, cost,
  });
}

type CallOpts = { tier: Tier; system?: string; messages: Msg[]; maxTokens: number; cache?: boolean };

async function providerError(r: Response): Promise<LimitError> {
  const body = (await r.text()).slice(0, 500);
  console.error("AI provider error", r.status, body);
  if (/credit balance|billing|insufficient/i.test(body)) return new LimitError(503, "budget_reached", BUDGET_MESSAGE);
  return new LimitError(502, r.status === 429 ? "busy" : "provider_error", "The AI service had a problem. Try again in a moment.");
}

/** Prompt caching: the big system prompt (rules, memory, course files) and the conversation so far are
 *  stored for a few minutes, so the next message in the same chat pays ~10% for them instead of full price. */
function cachedBody(o: CallOpts) {
  if (!o.cache) return { system: o.system, messages: o.messages };
  const messages = o.messages.map((m, i) => {
    if (i !== o.messages.length - 1) return m;
    const blocks: Record<string, unknown>[] = typeof m.content === "string" ? [{ type: "text", text: m.content }] : [...m.content];
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } };
    return { ...m, content: blocks };
  });
  return { system: o.system ? [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }] : undefined, messages };
}

/** Input tokens priced as plain input: cache writes cost 1.25x, cache reads 0.1x. */
const effectiveIn = (u: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined) =>
  Math.round((u?.input_tokens ?? 0) + 1.25 * (u?.cache_creation_input_tokens ?? 0) + 0.1 * (u?.cache_read_input_tokens ?? 0));
export type CallResult = { text: string; inTok: number; outTok: number; truncated: boolean };

/** One complete answer from the provider. Retries once on overload. */
export async function callAI(o: CallOpts): Promise<CallResult> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modelFor(o.tier), max_tokens: o.maxTokens, ...cachedBody(o) }),
    });
    if ((r.status === 429 || r.status === 529) && attempt === 0) { await new Promise((s) => setTimeout(s, 4000)); continue; }
    if (!r.ok) throw await providerError(r);
    const out = await r.json();
    const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return { text, inTok: effectiveIn(out.usage), outTok: out.usage?.output_tokens ?? 0, truncated: out.stop_reason === "max_tokens" };
  }
}

/** Streams text deltas from the provider; the final yield carries token counts. */
export async function* streamAI(o: CallOpts): AsyncGenerator<{ delta?: string; done?: CallResult }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modelFor(o.tier), max_tokens: o.maxTokens, ...cachedBody(o), stream: true }),
  });
  if (!r.ok || !r.body) throw await providerError(r);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", inTok = 0, outTok = 0, truncated = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const event = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = event.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let d; try { d = JSON.parse(line.slice(6)); } catch { continue; }
      if (d.type === "message_start") inTok = effectiveIn(d.message?.usage);
      else if (d.type === "content_block_delta" && d.delta?.type === "text_delta") { text += d.delta.text; yield { delta: d.delta.text }; }
      else if (d.type === "message_delta") { outTok = d.usage?.output_tokens ?? outTok; truncated = d.delta?.stop_reason === "max_tokens"; }
      else if (d.type === "error") throw new LimitError(502, "provider_error", "The AI service had a problem. Try again in a moment.");
    }
  }
  yield { done: { text, inTok, outTok, truncated } };
}
