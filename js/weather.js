// weather.js
// Calls the get-weather Supabase Edge Function, which holds the real
// OpenWeatherMap key server-side. The home location's coordinates are
// already resolved (picked from the Settings map), so no geocoding
// happens here or server-side — just a direct lookup by lat/lon.

import { invokeFunction } from "./supabaseClient.js";

export async function fetchWeather(settings) {
  const { lat, lon } = settings.homeLocation;
  return invokeFunction("get-weather", { body: { lat, lon } });
}

function iconEmoji(code) {
  const map = {
    "01": "☀️", "02": "🌤️", "03": "☁️", "04": "☁️",
    "09": "🌧️", "10": "🌦️", "11": "⛈️", "13": "❄️", "50": "🌫️",
  };
  return map[code?.slice(0, 2)] || "🌡️";
}

export function renderWeather(data) {
  const body = document.getElementById("weather-body");
  const status = document.getElementById("weather-status");
  status.textContent = "Live";
  status.className = "card-status status-ok";

  body.innerHTML = "";

  const main = document.createElement("div");
  main.className = "weather-main";
  main.innerHTML = `
    <div style="font-size:36px;line-height:1;">${iconEmoji(data.icon)}</div>
    <div>
      <div class="weather-temp">${data.tempC}&deg;C</div>
      <div class="weather-desc">${escapeHtml(data.description)}</div>
    </div>
  `;
  body.appendChild(main);

  const meta = document.createElement("div");
  meta.className = "weather-meta";
  meta.innerHTML = `
    <div>Feels like<span>${data.feelsLikeC}&deg;C</span></div>
    <div>Humidity<span>${data.humidity != null ? data.humidity + "%" : "–"}</span></div>
    <div>Wind<span>${data.windKph != null ? data.windKph + " km/h" : "–"}</span></div>
  `;
  body.appendChild(meta);

  if (data.rainChance != null && data.rainChance >= 30) {
    const note = document.createElement("p");
    note.className = "weather-note";
    note.textContent = `${data.rainChance}% chance of rain later today — grab an umbrella.`;
    body.appendChild(note);
  }
}

export function renderWeatherError(message) {
  const body = document.getElementById("weather-body");
  const status = document.getElementById("weather-status");
  status.textContent = "Error";
  status.className = "card-status status-error";
  body.innerHTML = `<p class="empty-state">${escapeHtml(message)}</p>`;
}

export function renderWeatherUnconfigured() {
  const body = document.getElementById("weather-body");
  const status = document.getElementById("weather-status");
  status.textContent = "Not configured";
  status.className = "card-status";
  body.innerHTML = `<p class="empty-state">Add your home address in Settings to see today's forecast.</p>`;
}

export function renderWeatherSignedOut() {
  const body = document.getElementById("weather-body");
  const status = document.getElementById("weather-status");
  status.textContent = "Signed out";
  status.className = "card-status";
  body.innerHTML = `<p class="empty-state">Sign in with Google (top right) to see today's forecast.</p>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
