// settings.js
// Home/work locations + commute departure times. Stored in localStorage —
// this is convenience state for one browser, not sensitive.
//
// Locations are picked from real places via the Settings map (search box,
// click-to-place, or drag-to-adjust — backed by OpenStreetMap's free
// Nominatim geocoder, see geocode.js) rather than typed as free text.
// That's what actually gets sent to the weather/commute Edge Functions, so
// there's no ambiguous address text for those to guess at on every
// refresh. One search box + a Home/Work tab switch (rather than two
// separate search boxes stacked on top of each other) keeps only one
// suggestions dropdown ever open at a time, over one field, over the map.

import { searchAddress, reverseGeocode, debounce } from "./geocode.js";

const STORAGE_KEY = "morning-dashboard-settings-v3";
const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_MAP_CENTER = [-26.2041, 28.0473]; // just a starting view before any location is picked
const TAB_COLOR = { home: "#2f6fed", work: "#d64545" };

const DEFAULTS = {
  homeLocation: null, // { label, lat, lon }
  workLocation: null,
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
  return Boolean(settings.homeLocation && settings.workLocation);
}

export function isWeatherConfigured(settings) {
  return Boolean(settings.homeLocation);
}

function pinIcon(color) {
  return L.divIcon({
    className: "location-pin",
    html: `<span style="background:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
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
    morningDeparture: document.getElementById("morning-departure"),
    eveningDeparture: document.getElementById("evening-departure"),
  };

  const searchInput = document.getElementById("location-search");
  const suggestionsEl = document.getElementById("location-suggestions");
  const selectedEl = document.getElementById("location-selected");
  const clearBtn = document.getElementById("location-clear");
  const tabs = {
    home: document.getElementById("tab-home"),
    work: document.getElementById("tab-work"),
  };

  let map = null;
  const markers = { home: null, work: null };
  let pending = { homeLocation: null, workLocation: null };
  let activeTab = "home";

  function locationKey(tab) {
    return tab === "home" ? "homeLocation" : "workLocation";
  }

  function placeMarker(tab, location) {
    if (markers[tab]) {
      markers[tab].setLatLng([location.lat, location.lon]);
      return;
    }
    markers[tab] = L.marker([location.lat, location.lon], {
      draggable: true,
      icon: pinIcon(TAB_COLOR[tab]),
    }).addTo(map);
    markers[tab].on("dragend", async () => {
      const { lat, lng } = markers[tab].getLatLng();
      const label = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setLocation(tab, { label, lat, lon: lng });
    });
  }

  function removeMarker(tab) {
    if (markers[tab]) {
      map.removeLayer(markers[tab]);
      markers[tab] = null;
    }
  }

  function fitToMarkers() {
    const present = [markers.home, markers.work].filter(Boolean);
    if (!present.length) return;
    if (present.length === 1) map.setView(present[0].getLatLng(), 13);
    else map.fitBounds(L.featureGroup(present).getBounds().pad(0.3), { maxZoom: 14 });
  }

  function refreshActiveDisplay() {
    const location = pending[locationKey(activeTab)];
    searchInput.value = location ? location.label : "";
    selectedEl.textContent = location
      ? `📍 ${location.label}`
      : `Search above, click the map, or drag a pin to set your ${activeTab} location.`;
  }

  function setLocation(tab, location) {
    pending[locationKey(tab)] = location;
    if (location) placeMarker(tab, location);
    else removeMarker(tab);
    if (tab === activeTab) refreshActiveDisplay();
    fitToMarkers();
  }

  function switchTab(tab) {
    activeTab = tab;
    tabs.home.classList.toggle("active", tab === "home");
    tabs.work.classList.toggle("active", tab === "work");
    suggestionsEl.hidden = true;
    refreshActiveDisplay();
  }

  function renderSuggestions(results) {
    suggestionsEl.innerHTML = "";
    for (const r of results) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "location-suggestion";
      item.textContent = r.label;
      // mousedown (not click) fires before the input's blur hides the list
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        suggestionsEl.hidden = true;
        setLocation(activeTab, r);
      });
      suggestionsEl.appendChild(item);
    }
    suggestionsEl.hidden = results.length === 0;
  }

  const runSearch = debounce(async () => {
    renderSuggestions(await searchAddress(searchInput.value));
  }, SEARCH_DEBOUNCE_MS);

  function ensureMap() {
    if (map) return;
    map = L.map("location-map").setView(DEFAULT_MAP_CENTER, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", async (e) => {
      const { lat, lng } = e.latlng;
      const label = (await reverseGeocode(lat, lng)) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setLocation(activeTab, { label, lat, lon: lng });
    });

    searchInput.addEventListener("input", runSearch);
    searchInput.addEventListener("blur", () => {
      setTimeout(() => { suggestionsEl.hidden = true; }, 100);
    });
    clearBtn.addEventListener("click", () => setLocation(activeTab, null));
    tabs.home.addEventListener("click", () => switchTab("home"));
    tabs.work.addEventListener("click", () => switchTab("work"));
  }

  function open() {
    // Show the modal no matter what — a failure below (e.g. Leaflet's CDN
    // script didn't load) should never make this button look like it's
    // doing nothing; it should visibly explain what's broken instead.
    modal.hidden = false;

    const settings = loadSettings();
    fields.morningDeparture.value = settings.morningDeparture;
    fields.eveningDeparture.value = settings.eveningDeparture;

    if (typeof L === "undefined") {
      document.getElementById("location-map").innerHTML =
        '<p class="empty-state">Map failed to load — check your internet connection and reload the page.</p>';
      return;
    }

    ensureMap();

    pending = { homeLocation: settings.homeLocation, workLocation: settings.workLocation };

    if (settings.homeLocation) placeMarker("home", settings.homeLocation);
    else removeMarker("home");
    if (settings.workLocation) placeMarker("work", settings.workLocation);
    else removeMarker("work");

    // Nudge straight to whichever one still needs setting.
    switchTab(settings.homeLocation && !settings.workLocation ? "work" : "home");

    // The map was sized while its container was display:none; Leaflet needs
    // a resize pass once it's actually visible before it'll render right.
    requestAnimationFrame(() => {
      map.invalidateSize();
      fitToMarkers();
    });
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
    const settings = {
      homeLocation: pending.homeLocation,
      workLocation: pending.workLocation,
      morningDeparture: fields.morningDeparture.value || DEFAULTS.morningDeparture,
      eveningDeparture: fields.eveningDeparture.value || DEFAULTS.eveningDeparture,
    };
    saveSettings(settings);
    close();
    onSave(settings);
  });

  if (!isCommuteConfigured(loadSettings())) {
    open();
  }
}
