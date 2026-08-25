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

// Picks the road/street mentioned in the most turn-by-turn instructions, as
// a human-readable stand-in for "this route" (TomTom doesn't otherwise name
// a route as a whole, only leg-by-leg).
function mainRoadLabel(route: any): string {
  const instructions = route.guidance?.instructions ?? [];
  const tally = new Map<string, number>();
  for (const instr of instructions) {
    const roads: string[] = instr.roadNumbers?.length ? instr.roadNumbers : instr.street ? [instr.street] : [];
    for (const road of roads) tally.set(road, (tally.get(road) ?? 0) + 1);
  }
  if (!tally.size) return "Route";
  const [topRoad] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return `via ${topRoad}`;
}

async function routeBetween(from: { lat: number; lon: number }, to: { lat: number; lon: number }, apiKey: string) {
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lon}:${to.lat},${to.lon}/json?key=${apiKey}&traffic=true&computeTravelTimeFor=all&maxAlternatives=2&instructionsType=text&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);
  const data = await res.json();
  const routes = data.routes ?? [];
  if (!routes.length) throw new Error("No route found between those addresses.");

  return routes
    .map((route: any) => ({
      via: mainRoadLabel(route),
      travelTimeSec: route.summary.travelTimeInSeconds,
      normalTimeSec: route.summary.noTrafficTravelTimeInSeconds ?? route.summary.travelTimeInSeconds,
      delaySec: route.summary.trafficDelayInSeconds ?? 0,
      distanceKm: Math.round((route.summary.lengthInMeters ?? 0) / 100) / 10,
    }))
    .sort((a: any, b: any) => a.travelTimeSec - b.travelTimeSec);
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
