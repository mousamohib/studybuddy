// Shared AI plumbing: limit checks, the provider call (plain and streaming), demo mode and cost tracking.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { JOBS, LIMITS, modelFor, pricePerMTok, type Plan, type Tier } from "./limits.ts";

export type Content = string | Array<
  { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
>;
export type Msg = { role: "user" | "assistant"; content: Content };

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
  const cap = Number(Deno.env.get(plan === "pro" ? "USER_MONTHLY_COST_USD_PRO" : "USER_MONTHLY_COST_USD_FREE") ?? (plan === "pro" ? 8 : 0.5));
  if (Number(usage?.cost_usd ?? 0) >= cap) throw new LimitError(402, "cost_cap", "You've reached this month's AI usage cap.");
  const budget = Number(Deno.env.get("AI_MONTHLY_BUDGET_USD") ?? 50);
  const { data: rows } = await admin.from("usage").select("cost_usd").eq("month", month);
  const spent = (rows ?? []).reduce((a: number, r: { cost_usd: number }) => a + Number(r.cost_usd), 0);
  if (spent >= budget) throw new LimitError(503, "budget_reached", "Scrawlie has hit its AI budget for this month. Try again later.");
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

type CallOpts = { tier: Tier; system?: string; messages: Msg[]; maxTokens: number };
export type CallResult = { text: string; inTok: number; outTok: number; truncated: boolean };

/** One complete answer from the provider. Retries once on overload. */
export async function callAI(o: CallOpts): Promise<CallResult> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: modelFor(o.tier), max_tokens: o.maxTokens, system: o.system, messages: o.messages }),
    });
    if ((r.status === 429 || r.status === 529) && attempt === 0) { await new Promise((s) => setTimeout(s, 4000)); continue; }
    if (!r.ok) {
      console.error("AI provider error", r.status, (await r.text()).slice(0, 500));
      throw new LimitError(502, r.status === 429 ? "busy" : "provider_error", "The AI service had a problem. Try again in a moment.");
    }
    const out = await r.json();
    const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    return { text, inTok: out.usage?.input_tokens ?? 0, outTok: out.usage?.output_tokens ?? 0, truncated: out.stop_reason === "max_tokens" };
  }
}

/** Streams text deltas from the provider; the final yield carries token counts. */
export async function* streamAI(o: CallOpts): AsyncGenerator<{ delta?: string; done?: CallResult }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modelFor(o.tier), max_tokens: o.maxTokens, system: o.system, messages: o.messages, stream: true }),
  });
  if (!r.ok || !r.body) {
    console.error("AI provider error", r.status, (await r.text()).slice(0, 500));
    throw new LimitError(502, r.status === 429 ? "busy" : "provider_error", "The AI service had a problem. Try again in a moment.");
  }
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
      if (d.type === "message_start") inTok = d.message?.usage?.input_tokens ?? 0;
      else if (d.type === "content_block_delta" && d.delta?.type === "text_delta") { text += d.delta.text; yield { delta: d.delta.text }; }
      else if (d.type === "message_delta") { outTok = d.usage?.output_tokens ?? outTok; truncated = d.delta?.stop_reason === "max_tokens"; }
      else if (d.type === "error") throw new LimitError(502, "provider_error", "The AI service had a problem. Try again in a moment.");
    }
  }
  yield { done: { text, inTok, outTok, truncated } };
}
