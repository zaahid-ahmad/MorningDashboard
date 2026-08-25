// get-schedule Edge Function
//
// Looks up the caller's stored Google refresh token, exchanges it for a
// fresh access token, and pulls today's events from their primary
// Google Calendar. The refresh token and Google client secret never
// leave this function.
//
// Secrets used: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

function startEndOfToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
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

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: row } = await admin
      .from("user_google_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .single();

    if (!row?.refresh_token) {
      return new Response(JSON.stringify({ error: "not_connected" }), { status: 409, headers: jsonHeaders });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return errorResponse("Server is missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET — see README.md", 500);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || "Failed to refresh Google token — try signing out and back in.");
    }

    const { timeMin, timeMax } = startEndOfToday();
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    const evRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!evRes.ok) {
      const errBody = await evRes.text();
      throw new Error(`Calendar lookup failed (${evRes.status}): ${errBody}`);
    }
    const evData = await evRes.json();

    const events = (evData.items || []).map((ev: any) => ({
      title: ev.summary || "(No title)",
      location: ev.location || "",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      allDay: Boolean(ev.start?.date && !ev.start?.dateTime),
    }));

    return new Response(JSON.stringify({ events }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return errorResponse(err.message || "Unexpected error", 500);
  }
});
