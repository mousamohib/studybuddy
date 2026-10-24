import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export type Ctx = { user: User; admin: SupabaseClient };

/** Resolves the signed-in user from the request, plus an admin client for server-side writes. */
export async function getCtx(req: Request): Promise<Ctx | Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json(401, { code: "not_signed_in", message: "Sign in again." });
  return { user, admin: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) };
}

/** Run work after the response is sent (Supabase Edge Runtime). */
export function background(p: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p);
  else p.catch((e) => console.error(e));
}

/** Pulls the first JSON object or array out of a model reply. */
export function parseJSON<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.search(/[\[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)) as T; } catch { return null; }
}
