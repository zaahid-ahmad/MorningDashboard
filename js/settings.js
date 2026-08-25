// settings.js
// Personal commute preferences only. Stored in localStorage — this is
// just convenience state for one browser, not sensitive.

const STORAGE_KEY = "morning-dashboard-settings-v2";

const DEFAULTS = {
  homeAddress: "",
  workAddress: "",
  morningDeparture: "07:00",
  eveningDeparture: "17:00",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Could not read saved settings, using defaults.", err);
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isCommuteConfigured(settings) {
  return Boolean(settings.homeAddress && settings.workAddress);
}

export function isWeatherConfigured(settings) {
  return Boolean(settings.homeAddress);
}

/** Wires the settings modal (open/close/save) and returns nothing.
 *  onSave is called with the freshly saved settings object.
 */
export function initSettingsModal({ onSave }) {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("close-settings-btn");
  const form = document.getElementById("settings-form");

  const fields = {
    homeAddress: document.getElementById("home-address"),
    workAddress: document.getElementById("work-address"),
    morningDeparture: document.getElementById("morning-departure"),
    eveningDeparture: document.getElementById("evening-departure"),
  };

  function populateForm(settings) {
    fields.homeAddress.value = settings.homeAddress;
    fields.workAddress.value = settings.workAddress;
    fields.morningDeparture.value = settings.morningDeparture;
    fields.eveningDeparture.value = settings.eveningDeparture;
  }

  function readForm() {
    return {
      homeAddress: fields.homeAddress.value.trim(),
      workAddress: fields.workAddress.value.trim(),
      morningDeparture: fields.morningDeparture.value || DEFAULTS.morningDeparture,
      eveningDeparture: fields.eveningDeparture.value || DEFAULTS.eveningDeparture,
    };
  }

  function open() {
    populateForm(loadSettings());
    modal.hidden = false;
  }

  function close() {
    modal.hidden = true;
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const settings = readForm();
    saveSettings(settings);
    close();
    onSave(settings);
  });

  const current = loadSettings();
  if (!isCommuteConfigured(current)) {
    open();
  }
}
