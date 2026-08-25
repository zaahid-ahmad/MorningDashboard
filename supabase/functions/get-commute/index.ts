// get-commute Edge Function
//
// Requires a signed-in Supabase user (see get-weather for why).
// Secrets used: TOMTOM_API_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

async function geocode(address: string, apiKey: string) {
  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json?key=${apiKey}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Could not find location for "${address}"`);
  const { lat, lon } = data.results[0].position;
  return { lat, lon };
}

async function routeBetween(from: { lat: number; lon: number }, to: { lat: number; lon: number }, apiKey: string) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lon}:${to.lat},${to.lon}/json?key=${apiKey}&traffic=true&computeTravelTimeFor=all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  const summary = data.routes?.[0]?.summary;
  if (!summary) throw new Error("No route found between those addresses.");
  return {
    travelTimeSec: summary.travelTimeInSeconds,
    normalTimeSec: summary.noTrafficTravelTimeInSeconds ?? summary.travelTimeInSeconds,
    delaySec: summary.trafficDelayInSeconds ?? 0,
    distanceKm: Math.round((summary.lengthInMeters ?? 0) / 100) / 10,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { home, work } = await req.json();
    if (!home || !work) return errorResponse("home and work are required");

    const tomtomKey = Deno.env.get("TOMTOM_API_KEY");
    if (!tomtomKey) return errorResponse("Server is missing TOMTOM_API_KEY — run `supabase secrets set TOMTOM_API_KEY=...`", 500);

    const [homePos, workPos] = await Promise.all([geocode(home, tomtomKey), geocode(work, tomtomKey)]);
    const [toWork, toHome] = await Promise.all([
      routeBetween(homePos, workPos, tomtomKey),
      routeBetween(workPos, homePos, tomtomKey),
    ]);

    return new Response(JSON.stringify({ toWork, toHome }), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return errorResponse(err.message || "Unexpected error", 500);
  }
});
