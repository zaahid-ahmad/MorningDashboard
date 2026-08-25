// traffic.js
// Calls the get-commute Supabase Edge Function, which holds the real
// TomTom key server-side and does the routing. Home/work coordinates are
// already resolved (picked from the Settings map), so no geocoding
// happens here or server-side.

import { invokeFunction } from "./supabaseClient.js";

const ROUTE_CHOICE_KEY = "morning-dashboard-route-choice-v1";
const ROUTE_COLOR = "#2f6fed";
const ROUTE_COLOR_MUTED = "#9a9ea5";

export async function fetchCommute(settings) {
  const { homeLocation, workLocation } = settings;
  // { toWork: Route[], toHome: Route[] }, fastest first
  return invokeFunction("get-commute", {
    body: {
      homeLat: homeLocation.lat,
      homeLon: homeLocation.lon,
      workLat: workLocation.lat,
      workLon: workLocation.lon,
    },
  });
}

function loadRouteChoice() {
  try {
    return JSON.parse(localStorage.getItem(ROUTE_CHOICE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRouteChoice(direction, via) {
  const choice = loadRouteChoice();
  choice[direction] = via;
  localStorage.setItem(ROUTE_CHOICE_KEY, JSON.stringify(choice));
}

// Falls back to the fastest route (routes[0]) if there's no saved
// preference, or the saved one no longer appears in this fetch's results.
function pickRoute(routes, preferredVia) {
  return routes.find((r) => r.via === preferredVia) || routes[0];
}

function formatDuration(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function delayInfo(delaySec) {
  const mins = Math.round(delaySec / 60);
  if (mins < 3) return { className: "delay-none", label: "Normal traffic" };
  if (mins < 12) return { className: "delay-some", label: `+${mins} min delay` };
  return { className: "delay-heavy", label: `+${mins} min delay` };
}

// Draws every route as a line on a small map — the selected one in accent
// blue and on top, the rest muted grey underneath — and lets clicking any
// line pick that route, the same way Google Maps' route alternatives work.
function renderRouteMap(containerId, routes, selectedVia, onSelect) {
  const withPaths = routes.filter((r) => r.path?.length);
  if (!withPaths.length) return null;

  if (typeof L === "undefined") {
    // Leaflet's CDN script didn't load (offline, blocked, etc.) — leave the
    // route list below as the fallback rather than throwing here.
    return null;
  }

  const map = L.map(containerId, { zoomControl: false, scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const lines = [];
  for (const route of withPaths) {
    const isSelected = route.via === selectedVia;
    const line = L.polyline(route.path, {
      color: isSelected ? ROUTE_COLOR : ROUTE_COLOR_MUTED,
      weight: isSelected ? 5 : 3,
      opacity: isSelected ? 0.95 : 0.55,
    }).addTo(map);
    line.on("click", () => onSelect(route));
    if (isSelected) line.bringToFront();
    lines.push(line);
  }

  map.fitBounds(L.featureGroup(lines).getBounds().pad(0.15), { maxZoom: 15 });
  return map;
}

function renderDirection(label, direction, routes, onPick, registerMap) {
  const selected = pickRoute(routes, loadRouteChoice()[direction]);
  const delay = delayInfo(selected.delaySec);

  const wrap = document.createElement("div");
  wrap.className = "commute-direction";

  const header = document.createElement("div");
  header.className = "commute-row";
  header.innerHTML = `
    <span class="commute-label">${escapeHtml(label)}</span>
    <span>
      <span class="commute-time">${formatDuration(selected.travelTimeSec)}</span>
      <span class="commute-delay ${delay.className}">${delay.label}</span>
    </span>
  `;
  wrap.appendChild(header);

  if (routes.some((r) => r.path?.length)) {
    const mapId = `route-map-${direction}-${Math.random().toString(36).slice(2, 8)}`;
    const mapDiv = document.createElement("div");
    mapDiv.className = "route-map";
    mapDiv.id = mapId;
    wrap.appendChild(mapDiv);
    // Deferred one frame so mapDiv has real layout size (it needs to be in
    // the live DOM first) before Leaflet measures its container.
    requestAnimationFrame(() => {
      const map = renderRouteMap(mapId, routes, selected.via, (route) => {
        saveRouteChoice(direction, route.via);
        onPick();
      });
      if (map) registerMap(map);
    });
  }

  if (routes.length > 1) {
    const options = document.createElement("div");
    options.className = "route-options";
    for (const route of routes) {
      const isSelected = route.via === selected.via;
      const optDelay = delayInfo(route.delaySec);

      const opt = document.createElement("label");
      opt.className = "route-option" + (isSelected ? " route-option-selected" : "");
      opt.innerHTML = `
        <input type="radio" name="route-${direction}" ${isSelected ? "checked" : ""} />
        <span class="route-option-via">${escapeHtml(route.via)}</span>
        <span class="route-option-time">${formatDuration(route.travelTimeSec)}</span>
        <span class="commute-delay ${optDelay.className}">${optDelay.label}</span>
      `;
      opt.querySelector("input").addEventListener("change", () => {
        saveRouteChoice(direction, route.via);
        onPick();
      });
      options.appendChild(opt);
    }
    wrap.appendChild(options);
  }

  return wrap;
}

export function renderCommute(settings, data) {
  const body = document.getElementById("commute-body");
  const status = document.getElementById("commute-status");
  status.textContent = "Live";
  status.className = "card-status status-ok";

  let activeMaps = [];

  function draw() {
    for (const map of activeMaps) map.remove();
    activeMaps = [];

    body.innerHTML = "";
    const registerMap = (map) => activeMaps.push(map);
    body.appendChild(renderDirection(`Leave at ${settings.morningDeparture} → Work`, "toWork", data.toWork, draw, registerMap));
    body.appendChild(renderDirection(`Leave at ${settings.eveningDeparture} → Home`, "toHome", data.toHome, draw, registerMap));
  }

  draw();
}

export function renderCommuteError(message) {
  const body = document.getElementById("commute-body");
  const status = document.getElementById("commute-status");
  status.textContent = "Error";
  status.className = "card-status status-error";
  body.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

export function renderCommuteUnconfigured() {
  const body = document.getElementById("commute-body");
  const status = document.getElementById("commute-status");
  status.textContent = "Not configured";
  status.className = "card-status";
  body.innerHTML = `<p class="empty-state">Add your home and work addresses in Settings to see live traffic times.</p>`;
}

export function renderCommuteSignedOut() {
  const body = document.getElementById("commute-body");
  const status = document.getElementById("commute-status");
  status.textContent = "Signed out";
  status.className = "card-status";
  body.innerHTML = `<p class="empty-state">Sign in with Google (top right) to see live traffic times.</p>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
