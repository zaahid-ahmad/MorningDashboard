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
