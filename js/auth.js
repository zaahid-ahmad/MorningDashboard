// auth.js
// Google sign-in via Supabase Auth. This is a *redirect* flow (the browser
// navigates to Google and back), not a popup — Supabase's JS client parses
// the returned session automatically on page load.
//
// access_type=offline + prompt=consent asks Google for a refresh token
// (not just a short-lived access token) so the backend can keep pulling
// your calendar without you signing in again every day. That refresh
// token is captured here, once per sign-in, and handed to the
// store-google-token Edge Function — it is never kept in the browser.

import { getSupabase, invokeFunction } from "./supabaseClient.js";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function signInWithGoogle() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: CALENDAR_SCOPE,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
}

/**
 * Subscribes to auth state. `onChange(session | null)` fires immediately
 * with the current session (if any) and again on every sign-in/sign-out.
 * On a fresh sign-in that includes a Google refresh token, it is stored
 * server-side via the store-google-token Edge Function before onChange
 * fires, so callers can assume the schedule is ready to fetch.
 */
export function watchAuth(onChange) {
  const supabase = getSupabase();
  let initialized = false;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.provider_refresh_token) {
      try {
        await invokeFunction("store-google-token", {
          body: { refresh_token: session.provider_refresh_token },
        });
      } catch (err) {
        console.error("Could not persist Google refresh token:", err.message);
      }
    }
    initialized = true;
    onChange(session);
  });

  // Modern supabase-js fires onAuthStateChange immediately on subscribe
  // (event "INITIAL_SESSION"), which made this getSession() call redundant —
  // both fired on every page load, doubling every refreshAll() (and every
  // TomTom/OpenWeatherMap/Google Calendar request with it). Kept only as a
  // fallback for older client versions that don't emit that initial event.
  supabase.auth.getSession().then(({ data }) => {
    if (!initialized) onChange(data.session);
  });
}
