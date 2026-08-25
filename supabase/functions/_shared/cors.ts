// Shared CORS headers for every Edge Function. '*' keeps setup simple for
// a personal project; tighten to your GitHub Pages origin if you want to
// lock this down further (see README.md).
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};
