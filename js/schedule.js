// schedule.js
// Calls the get-schedule Supabase Edge Function, which uses your stored
// Google refresh token (captured once at sign-in, see auth.js) to pull
// today's events server-side.

import { getSupabase } from "./supabaseClient.js";

export async function fetchTodaysEvents() {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("get-schedule");
  if (error) throw new Error(error.message || "Could not load your calendar.");
  if (data?.error === "not_connected") {
    throw new Error("Google Calendar isn't connected yet — try signing out and back in.");
  }
  if (data?.error) throw new Error(data.error);
  return data.events || [];
}

function formatTime(iso, allDay) {
  if (allDay) return "All day";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function renderSchedule(events) {
  const body = document.getElementById("schedule-body");
  const status = document.getElementById("schedule-status");
  status.textContent = "Live";
  status.className = "card-status status-ok";

  if (!events.length) {
    body.innerHTML = `<p class="empty-state">Nothing on your calendar today.</p>`;
    return;
  }

  body.innerHTML = "";
  for (const ev of events) {
    const row = document.createElement("div");
    row.className = "event-item";
    row.innerHTML = `
      <div class="event-time">${escapeHtml(formatTime(ev.start, ev.allDay))}</div>
      <div>
        <div class="event-title">${escapeHtml(ev.title)}</div>
        ${ev.location ? `<div class="event-location">${escapeHtml(ev.location)}</div>` : ""}
      </div>
    `;
    body.appendChild(row);
  }
}

export function renderScheduleError(message) {
  const body = document.getElementById("schedule-body");
  const status = document.getElementById("schedule-status");
  status.textContent = "Error";
  status.className = "card-status status-error";
  body.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

export function renderScheduleSignedOut() {
  const body = document.getElementById("schedule-body");
  const status = document.getElementById("schedule-status");
  status.textContent = "Signed out";
  status.className = "card-status";
  body.innerHTML = `<p class="empty-state">Sign in with Google (top right) to see today's events.</p>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
