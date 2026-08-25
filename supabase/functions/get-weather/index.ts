// get-weather Edge Function
//
// Requires a signed-in Supabase user (checked below) so a public GitHub
// repo doesn't let strangers burn your free OpenWeatherMap quota — the
// anon key alone isn't a secret, it's readable in your deployed frontend.
//
// Secrets used (set via `supabase secrets set`): OWM_API_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), { status, headers: jsonHeaders });
}

async function geocode(address: string, apiKey: string) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(address)}&limit=1&appid=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.length) throw new Error(`Could not find location for "${address}"`);
  const { lat, lon, name, country } = data[0];
  return { lat, lon, label: [name, country].filter(Boolean).join(", ") };
}

function rainChanceToday(forecastList: any[]) {
  const today = new Date().toDateString();
  const todaySteps = forecastList.filter((s) => new Date(s.dt * 1000).toDateString() === today);
  if (!todaySteps.length) return null;
  const maxPop = Math.max(...todaySteps.map((s) => s.pop ?? 0));
  return Math.round(maxPop * 100);
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

    const { address } = await req.json();
    if (!address) return errorResponse("address is required");

    const owmKey = Deno.env.get("OWM_API_KEY");
    if (!owmKey) return errorResponse("Server is missing OWM_API_KEY — run `supabase secrets set OWM_API_KEY=...`", 500);

    const { lat, lon, label } = await geocode(address, owmKey);

    const [currentRes, forecastRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${owmKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${owmKey}`),
    ]);
    if (!currentRes.ok) return errorResponse(`Weather lookup failed (${currentRes.status})`);
    const current = await currentRes.json();
    const forecast = forecastRes.ok ? await forecastRes.json() : { list: [] };

    const payload = {
      location: label,
      tempC: Math.round(current.main?.temp ?? 0),
      feelsLikeC: Math.round(current.main?.feels_like ?? 0),
      description: current.weather?.[0]?.description ?? "",
      icon: current.weather?.[0]?.icon ?? "01d",
      humidity: current.main?.humidity ?? null,
      windKph: current.wind?.speed != null ? Math.round(current.wind.speed * 3.6) : null,
      rainChance: rainChanceToday(forecast.list || []),
    };

    return new Response(JSON.stringify(payload), { headers: jsonHeaders });
  } catch (err) {
    console.error(err);
    return errorResponse(err.message || "Unexpected error", 500);
  }
});
