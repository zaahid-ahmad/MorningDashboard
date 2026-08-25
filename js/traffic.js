// traffic.js
// Calls the get-commute Supabase Edge Function, which holds the real
// TomTom key server-side and does the geocoding + routing.

import { invokeFunction } from "./supabaseClient.js";

export async function fetchCommute(settings) {
  // { toWork, toHome }
  return invokeFunction("get-commute", { body: { home: settings.homeAddress, work: settings.workAddress } });
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

function renderRow(label, leg) {
  const row = document.createElement("div");
  row.className = "commute-row";
  const delay = delayInfo(leg.delaySec);
  row.innerHTML = `
    <span class="commute-label">${escapeHtml(label)}</span>
    <span>
      <span class="commute-time">${formatDuration(leg.travelTimeSec)}</span>
      <span class="commute-delay ${delay.className}">${delay.label}</span>
    </span>
  `;
  return row;
}

export function renderCommute(settings, data) {
  const body = document.getElementById("commute-body");
  const status = document.getElementById("commute-status");
  status.textContent = "Live";
  status.className = "card-status status-ok";

  body.innerHTML = "";
  body.appendChild(renderRow(`Leave at ${settings.morningDeparture} → Work`, data.toWork));
  body.appendChild(renderRow(`Leave at ${settings.eveningDeparture} → Home`, data.toHome));
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
