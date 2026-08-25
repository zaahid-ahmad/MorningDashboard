// config.js
//
// Public, safe-to-commit configuration for this specific deployment.
// The Supabase "anon" key is NOT a secret — it identifies your project the
// same way a public API endpoint would, and is meant to ship in frontend
// code. Access is controlled server-side (Edge Functions + RLS), not by
// hiding this key. Real secrets (weather/Google keys, and the server-side
// TomTom routing key) live only in Supabase's Edge Function secrets, never
// in this repo.
//
// Fill these in once, after creating your Supabase project (see README.md).

export const SUPABASE_URL = "https://dewdadyvdndcffgahjcm.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRld2RhZHl2ZG5kY2ZmZ2FoamNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTMzMTMsImV4cCI6MjEwMzIyOTMxM30.AVTVvNSkbcEpU0Uk1edU_6U1Wrj-Lsuls3BdHwGIMR4";

// A SEPARATE TomTom key, meant to be public in this file — it's used
// directly by the browser for the map display and address search in the
// Settings modal. It is NOT the same key as TOMTOM_API_KEY (that one stays
// a private Edge Function secret, used only for server-side routing).
// This one is safe to ship here only because it's locked to specific
// domains in the TomTom dashboard (Dashboard -> your key -> domain
// whitelist), e.g. "https://YOUR-USERNAME.github.io/*, http://localhost:5500/*"
// — see README.md. Without that restriction, treat it as a real secret.
export const TOMTOM_MAP_KEY = "YOUR-BROWSER-RESTRICTED-TOMTOM-KEY";
