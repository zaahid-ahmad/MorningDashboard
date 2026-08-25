import { loadSettings, initSettingsModal, isCommuteConfigured, isWeatherConfigured } from "./settings.js";
import { signInWithGoogle, signOut, watchAuth } from "./auth.js";

import {
  fetchWeather,
  renderWeather,
  renderWeatherError,
  renderWeatherUnconfigured,
  renderWeatherSignedOut,
} from "./weather.js";

import {
  fetchCommute,
  renderCommute,
  renderCommuteError,
  renderCommuteUnconfigured,
  renderCommuteSignedOut,
} from "./traffic.js";

import {
  fetchTodaysEvents,
  renderSchedule,
  renderScheduleError,
  renderScheduleSignedOut,
} from "./schedule.js";

let currentSession = null;

function renderDateLine() {
  const el = document.getElementById("date-line");
  const now = new Date();
  el.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function renderClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateAuthButton() {
  const btn = document.getElementById("auth-btn");
  if (currentSession) {
    btn.textContent = "Sign out";
  } else {
    btn.textContent = "Sign in with Google";
  }
}

async function refreshWeather(settings) {
  if (!currentSession) return renderWeatherSignedOut();
  if (!isWeatherConfigured(settings)) return renderWeatherUnconfigured();
  try {
    renderWeather(await fetchWeather(settings));
  } catch (err) {
    console.error(err);
    renderWeatherError(err.message || "Could not load weather.");
  }
}

async function refreshCommute(settings) {
  if (!currentSession) return renderCommuteSignedOut();
  if (!isCommuteConfigured(settings)) return renderCommuteUnconfigured();
  try {
    renderCommute(settings, await fetchCommute(settings));
  } catch (err) {
    console.error(err);
    renderCommuteError(err.message || "Could not load traffic data.");
  }
}

async function refreshSchedule() {
  if (!currentSession) return renderScheduleSignedOut();
  try {
    renderSchedule(await fetchTodaysEvents());
  } catch (err) {
    console.error(err);
    renderScheduleError(err.message || "Could not load your calendar.");
  }
}

async function refreshAll() {
  const settings = loadSettings();
  await Promise.all([refreshWeather(settings), refreshCommute(settings), refreshSchedule()]);
}

function wireAuthButton() {
  document.getElementById("auth-btn").addEventListener("click", async () => {
    try {
      if (currentSession) {
        await signOut();
      } else {
        await signInWithGoogle(); // navigates away and back
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Sign-in failed.");
    }
  });
}

function init() {
  renderDateLine();
  renderClock();
  setInterval(renderClock, 30_000);

  wireAuthButton();

  initSettingsModal({
    onSave: () => refreshAll(),
  });

  document.getElementById("refresh-btn").addEventListener("click", refreshAll);

  try {
    watchAuth((session) => {
      currentSession = session;
      updateAuthButton();
      refreshAll();
    });
  } catch (err) {
    // Supabase not configured yet (js/config.js still has placeholder values).
    console.error(err);
    document.getElementById("auth-btn").disabled = true;
    document.getElementById("auth-btn").title = err.message;
  }

  // Passive auto-refresh every 10 minutes so the page stays current if left open.
  setInterval(refreshAll, 10 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", init);
