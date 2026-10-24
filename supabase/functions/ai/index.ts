// The AI gateway. Every AI request from the app comes here.
// It checks who is asking, their plan and monthly limits, picks the model tier for the job,
// calls the AI provider (or returns a demo answer), and records usage and cost.
import { createClient } from "npm:@supabase/supabase-js@2";
import { JOBS, LIMITS, modelFor, pricePerMTok, type Plan } from "../_shared/limits.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { code: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1. Who is asking?
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { code: "not_signed_in", message: "Sign in again." });
  const admin = createClient(url, service);

  // 2. What job?
  let body: { job?: string; system?: string; messages?: Msg[] };
  try { body = await req.json(); } catch { return json(400, { code: "bad_request", message: "Body must be JSON." }); }
  const job = JOBS[body.job ?? ""];
  if (!job) return json(400, { code: "bad_job", message: `Unknown job "${body.job}".` });
  const messages = (body.messages ?? []).filter((m) => m && typeof m.content === "string" && m.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json(400, { code: "bad_request", message: "messages must end with a user message." });
  }
  const promptChars = messages.reduce((a, m) => a + m.content.length, 0) + (body.system?.length ?? 0);
  if (promptChars > 600_000) return json(413, { code: "too_large", message: "Too much material for one request. Untick some files." });

  // 3. Plan and limits
  const { data: planRow } = await admin.rpc("effective_plan", { uid: user.id });
  const plan: Plan = planRow === "pro" ? "pro" : "free";
  const month = new Date().toISOString().slice(0, 7);
  const { data: usage } = await admin.from("usage").select("*").eq("user_id", user.id).eq("month", month).maybeSingle();
  if (job.counts) {
    const used = (usage?.[job.counts] as number | undefined) ?? 0;
    const limit = LIMITS[plan][job.counts];
    if (used >= limit) {
      return json(402, { code: "limit_reached", field: job.counts, used, limit, plan,
        message: plan === "free" ? "You've used this month's free allowance. Upgrade to Pro for more." : "You've reached this month's limit." });
    }
  }
  const userCap = Number(Deno.env.get(plan === "pro" ? "USER_MONTHLY_COST_USD_PRO" : "USER_MONTHLY_COST_USD_FREE") ?? (plan === "pro" ? 8 : 0.5));
  if (Number(usage?.cost_usd ?? 0) >= userCap) {
    return json(402, { code: "cost_cap", message: "You've reached this month's AI usage cap." });
  }
  const budget = Number(Deno.env.get("AI_MONTHLY_BUDGET_USD") ?? 50);
  const { data: totalRows } = await admin.from("usage").select("cost_usd").eq("month", month);
  const spent = (totalRows ?? []).reduce((a: number, r: { cost_usd: number }) => a + Number(r.cost_usd), 0);
  if (spent >= budget) return json(503, { code: "budget_reached", message: "StudyBuddy has hit its AI budget for this month. Try again later." });

  // 4. Demo mode (no API key yet, or AI_MODE=demo): realistic placeholder, no cost.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const demo = Deno.env.get("AI_MODE") === "demo" || !apiKey;
  const model = modelFor(job.tier);
  if (demo) {
    await admin.rpc("add_usage", { uid: user.id, field: job.counts ?? "none", amount: job.counts ? 1 : 0 });
    return json(200, { text: demoAnswer(body.job!, messages.at(-1)!.content), model: "demo", tier: job.tier, demo: true });
  }

  // 5. Real AI call
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: job.maxTokens, system: body.system ?? undefined, messages }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("AI provider error", r.status, detail.slice(0, 500));
    return json(502, { code: r.status === 429 ? "busy" : "provider_error", message: "The AI service had a problem. Try again in a moment." });
  }
  const out = await r.json();
  const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const inTok = out.usage?.input_tokens ?? 0, outTok = out.usage?.output_tokens ?? 0;
  const price = pricePerMTok(job.tier);
  const cost = (inTok * price.input + outTok * price.output) / 1_000_000;
  await admin.rpc("add_usage", { uid: user.id, field: job.counts ?? "none", amount: job.counts ? 1 : 0, in_tok: inTok, out_tok: outTok, cost });
  return json(200, { text, model, tier: job.tier, demo: false, truncated: out.stop_reason === "max_tokens" });
});

function demoAnswer(job: string, question: string): string {
  const q = question.length > 120 ? question.slice(0, 120) + "…" : question;
  if (job === "chat" || job === "reshape") {
    return `**Demo answer** (real AI isn't switched on yet)\n\nYou asked: _${q}_\n\nHere's how a real answer will look:\n\n**The big idea:** a short, plain-English explanation comes first.\n\n**Example:** then a small, concrete example.\n\n**The formula:** $E = mc^2$, with every symbol explained.\n\n**In simple terms:** a one-line summary to remember.`;
  }
  return `**Demo ${job.replace("_", " ")}** (real AI isn't switched on yet)\n\nThis is placeholder content so the screens can be tested end to end.`;
}
