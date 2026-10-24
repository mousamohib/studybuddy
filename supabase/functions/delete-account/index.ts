// Deletes the signed-in user's files and account. Database rows go with it (on delete cascade).
// Required by the App Store and Google Play.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response(JSON.stringify({ code: "not_signed_in" }), { status: 401, headers: cors });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Remove every file in the user's folder (paged, 1000 at a time).
  for (;;) {
    const { data: files } = await admin.storage.from("materials").list(user.id, { limit: 1000 });
    if (!files || files.length === 0) break;
    await admin.storage.from("materials").remove(files.map((f) => `${user.id}/${f.name}`));
    if (files.length < 1000) break;
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(JSON.stringify({ code: "failed", message: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
});
