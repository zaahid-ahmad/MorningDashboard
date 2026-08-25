// store-google-token Edge Function
//
// Called once by the frontend right after a fresh Google sign-in
// (js/auth.js) to persist the Google refresh token server-side. The
// refresh token never stays in the browser — it lives only in the
// user_google_tokens table, written here with the service-role key
// (which bypasses Row Level Security; this is the only code path allowed
// to touch that table).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await asUser.auth.getUser();
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { refresh_token } = await req.json();
    if (!refresh_token) return errorResponse("refresh_token is required");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { error: upsertErr } = await admin
      .from("user_google_tokens")
      .upsert({ user_id: user.id, refresh_token, updated_at: new Date().toISOString() });
    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return errorResponse(err.message || "Unexpected error", 500);
  }
});
