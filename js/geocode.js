// geocode.js
// Free address search + reverse geocoding via OpenStreetMap's Nominatim.
// No API key needed — this is what makes the Settings map/search possible
// without exposing any TomTom/Google key in the browser. Keep usage light
// (one lookup per pause in typing, not per keystroke) per Nominatim's fair
// use policy: https://operations.osmfoundation.org/policies/nominatim/

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

// Biases (not restricts — countrycodes without bounded=1 just re-ranks)
// results toward South Africa, since that's where this deployment's
// addresses live. Change or remove if that's no longer true for you.
const COUNTRY_BIAS = "za";

export async function searchAddress(query) {
  if (!query.trim()) return [];
  const url =
    `${NOMINATIM_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}` +
    `&limit=8&countrycodes=${COUNTRY_BIAS}&addressdetails=1&dedupe=1`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const results = await res.json();
  if (results.length) {
    return results.map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
  }
  // Nothing in South Africa matched — fall back to an unrestricted search
  // rather than reporting "not found" for a real place elsewhere.
  const worldUrl = `${NOMINATIM_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=8&dedupe=1`;
  const worldRes = await fetch(worldUrl);
  if (!worldRes.ok) return [];
  const worldResults = await worldRes.json();
  return worldResults.map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
}

export async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.display_name || null;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
