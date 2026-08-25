// supabaseClient.js
// One shared Supabase client for the whole app, loaded from the CDN as an
// ES module (no build step / npm install required).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

let client = null;

export function getSupabase() {
  if (!client) {
    if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
      throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js first.");
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

/**
 * Wraps supabase.functions.invoke(). On a non-2xx response, the client's
 * own error.message is always the generic "Edge Function returned a
 * non-2xx status code" — the actual `{ error: "..." }` body the function
 * sent is unread on error.context (a Response). This reads it so callers
 * see the real reason instead.
 */
export async function invokeFunction(name, options) {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(name, options);
  if (error) {
    let message = error.message || "Request failed.";
    let rawBody = null;
    if (error.context && typeof error.context.clone === "function") {
      try {
        rawBody = await error.context.clone().json();
        message = rawBody?.error || rawBody?.message || rawBody?.msg || message;
      } catch {
        try {
          rawBody = await error.context.clone().text();
          if (rawBody) message = rawBody;
        } catch {
          // response body couldn't be read at all; stick with the generic message
        }
      }
    }
    console.error(`${name} failed (status ${error.context?.status}):`, rawBody ?? message);
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
