const app = document.querySelector(".weather-app");
const searchForm = document.querySelector("#searchForm");
const cityInput = document.querySelector("#cityInput");
const locationButton = document.querySelector("#locationButton");
const statusMessage = document.querySelector("#statusMessage");
const unitButtons = document.querySelectorAll(".unit-option");

const elements = {
  cityName: document.querySelector("#cityName"),
  conditionText: document.querySelector("#conditionText"),
  localTime: document.querySelector("#localTime"),
  temperatureValue: document.querySelector("#temperatureValue"),
  temperatureUnit: document.querySelector("#temperatureUnit"),
  feelsLike: document.querySelector("#feelsLike"),
  humidity: document.querySelector("#humidity"),
  windSpeed: document.querySelector("#windSpeed"),
  windDirection: document.querySelector("#windDirection"),
  rainChance: document.querySelector("#rainChance"),
  sunriseTime: document.querySelector("#sunriseTime"),
  sunsetTime: document.querySelector("#sunsetTime"),
  updatedAt: document.querySelector("#updatedAt"),
  hourlyForecast: document.querySelector("#hourlyForecast"),
  dailyForecast: document.querySelector("#dailyForecast"),
  recentSearches: document.querySelector("#recentSearches")
};

const defaultPlace = {
  name: "Bucharest",
  country: "Romania",
  latitude: 44.4323,
  longitude: 26.1063,
  timezone: "Europe/Bucharest"
};

const storageKeys = {
  unit: "skycast-unit",
  lastPlace: "skycast-last-place",
  recent: "skycast-recent-places"
};

let activeUnit = getStoredValue(storageKeys.unit, "celsius");
let activePlace = getStoredValue(storageKeys.lastPlace, defaultPlace);
let recentPlaces = getStoredValue(storageKeys.recent, []);

const weatherMeta = {
  0: { label: "Clear sky", icon: "sun", theme: "clear" },
  1: { label: "Mainly clear", icon: "sun", theme: "clear" },
  2: { label: "Partly cloudy", icon: "cloud-sun", theme: "cloudy" },
  3: { label: "Overcast", icon: "cloud", theme: "cloudy" },
  45: { label: "Fog", icon: "cloud-fog", theme: "fog" },
  48: { label: "Depositing rime fog", icon: "cloud-fog", theme: "fog" },
  51: { label: "Light drizzle", icon: "cloud-drizzle", theme: "rain" },
  53: { label: "Drizzle", icon: "cloud-drizzle", theme: "rain" },
  55: { label: "Dense drizzle", icon: "cloud-drizzle", theme: "rain" },
  56: { label: "Freezing drizzle", icon: "cloud-drizzle", theme: "rain" },
  57: { label: "Dense freezing drizzle", icon: "cloud-drizzle", theme: "rain" },
  61: { label: "Slight rain", icon: "cloud-rain", theme: "rain" },
  63: { label: "Rain", icon: "cloud-rain", theme: "rain" },
  65: { label: "Heavy rain", icon: "cloud-rain", theme: "rain" },
  66: { label: "Freezing rain", icon: "cloud-rain", theme: "rain" },
  67: { label: "Heavy freezing rain", icon: "cloud-rain", theme: "rain" },
  71: { label: "Light snow", icon: "cloud-snow", theme: "snow" },
  73: { label: "Snow", icon: "cloud-snow", theme: "snow" },
  75: { label: "Heavy snow", icon: "cloud-snow", theme: "snow" },
  77: { label: "Snow grains", icon: "cloud-snow", theme: "snow" },
  80: { label: "Rain showers", icon: "cloud-rain", theme: "rain" },
  81: { label: "Moderate showers", icon: "cloud-rain", theme: "rain" },
  82: { label: "Violent showers", icon: "cloud-rain", theme: "storm" },
  85: { label: "Snow showers", icon: "cloud-snow", theme: "snow" },
  86: { label: "Heavy snow showers", icon: "cloud-snow", theme: "snow" },
  95: { label: "Thunderstorm", icon: "cloud-lightning", theme: "storm" },
  96: { label: "Thunderstorm with hail", icon: "cloud-lightning", theme: "storm" },
  99: { label: "Severe thunderstorm", icon: "cloud-lightning", theme: "storm" }
};

init();

function init() {
  setActiveUnit(activeUnit, false);
  renderRecentSearches();
  renderIcons();
  loadWeather(activePlace).catch((error) => {
    showStatus(error.message, "error");
  });

  searchForm.addEventListener("submit", handleSearch);
  locationButton.addEventListener("click", handleLocationClick);
  unitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveUnit(button.dataset.unit, true);
    });
  });
}

async function handleSearch(event) {
  event.preventDefault();
  const query = cityInput.value.trim();

  if (query.length < 2) {
    showStatus("Type at least two letters for a city name.", "error");
    return;
  }

  try {
    setLoading(true, "Searching for that city...");
    const place = await searchPlace(query);
    cityInput.value = "";
    await loadWeather(place);
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function handleLocationClick() {
  if (!navigator.geolocation) {
    showStatus("Location is not available in this browser.", "error");
    return;
  }

  setLoading(true, "Getting your location...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const place = {
        name: "Your location",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto"
      };

      try {
        await loadWeather(place);
      } catch (error) {
        showStatus(error.message, "error");
      } finally {
        setLoading(false);
      }
    },
    () => {
      setLoading(false);
      showStatus("Location permission was blocked or unavailable.", "error");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
  );
}

async function searchPlace(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({
    name: query,
    count: "1",
    language: "en",
    format: "json"
  });

  const data = await fetchJson(url);
  const place = data.results?.[0];

  if (!place) {
    throw new Error("No city found. Try a nearby larger city.");
  }

  return {
    name: place.name,
    country: place.country || "",
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone || "auto"
  };
}

async function loadWeather(place) {
  activePlace = place;
  saveValue(storageKeys.lastPlace, place);
  showStatus(`Loading weather for ${formatPlaceName(place)}...`);

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m"
    ].join(","),
    hourly: ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset"
    ].join(","),
    temperature_unit: activeUnit,
    wind_speed_unit: activeUnit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: "mm",
    timezone: place.timezone || "auto",
    forecast_days: "7"
  });

  const data = await fetchJson(url);
  renderWeather(data, place);
  rememberPlace(place);
  hideStatus();
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather service is not responding right now.");
  }

  return response.json();
}

function renderWeather(data, place) {
  const current = data.current;
  const currentMeta = getWeatherMeta(current.weather_code, current.is_day);
  const tempUnit = activeUnit === "fahrenheit" ? "F" : "C";
  const tempSuffix = `&deg;${tempUnit}`;
  const windUnit = activeUnit === "fahrenheit" ? "mph" : "km/h";

  app.dataset.theme = currentMeta.theme;
  elements.cityName.textContent = formatPlaceName(place);
  elements.conditionText.textContent = currentMeta.label;
  elements.localTime.textContent = `Local time ${formatClock(current.time)}`;
  elements.temperatureValue.textContent = formatNumber(current.temperature_2m);
  elements.temperatureUnit.innerHTML = tempSuffix;
  elements.feelsLike.innerHTML = `${formatNumber(current.apparent_temperature)}${tempSuffix}`;
  elements.humidity.textContent = `${formatNumber(current.relative_humidity_2m)}%`;
  elements.windSpeed.textContent = `${formatNumber(current.wind_speed_10m)} ${windUnit}`;
  elements.windDirection.textContent = compassDirection(current.wind_direction_10m);
  elements.rainChance.textContent = `${formatNumber(getTodayRainChance(data))}%`;
  elements.sunriseTime.textContent = formatClock(data.daily.sunrise[0]);
  elements.sunsetTime.textContent = formatClock(data.daily.sunset[0]);
  elements.updatedAt.textContent = `Updated ${formatClock(current.time)}`;

  renderHourly(data.hourly, current.time, tempSuffix);
  renderDaily(data.daily, tempSuffix);
  renderIcons();
}

function renderHourly(hourly, currentTime, tempSuffix) {
  const startIndex = Math.max(
    0,
    hourly.time.findIndex((time) => time >= currentTime)
  );
  const slots = hourly.time.slice(startIndex, startIndex + 10);

  elements.hourlyForecast.innerHTML = slots.map((time, index) => {
    const sourceIndex = startIndex + index;
    const meta = getWeatherMeta(hourly.weather_code[sourceIndex], 1);
    const rain = hourly.precipitation_probability[sourceIndex] ?? 0;

    return `
      <article class="forecast-card">
        <span>${index === 0 ? "Now" : formatClock(time)}</span>
        <i data-lucide="${meta.icon}" aria-hidden="true"></i>
        <strong>${formatNumber(hourly.temperature_2m[sourceIndex])}${tempSuffix}</strong>
        <p>${rain}% rain</p>
      </article>
    `;
  }).join("");
}

function renderDaily(daily, tempSuffix) {
  elements.dailyForecast.innerHTML = daily.time.map((date, index) => {
    const meta = getWeatherMeta(daily.weather_code[index], 1);
    const max = formatNumber(daily.temperature_2m_max[index]);
    const min = formatNumber(daily.temperature_2m_min[index]);
    const rain = daily.precipitation_probability_max[index] ?? 0;

    return `
      <article class="daily-card">
        <span>${index === 0 ? "Today" : formatDay(date)}</span>
        <i data-lucide="${meta.icon}" aria-hidden="true"></i>
        <div class="daily-temp">
          <span>${max}${tempSuffix}</span>
          <span>${min}${tempSuffix}</span>
        </div>
        <p>${rain}% rain</p>
      </article>
    `;
  }).join("");
}

function renderRecentSearches() {
  const visiblePlaces = recentPlaces.filter((place) => place.name !== "Your location").slice(0, 5);

  if (!visiblePlaces.length) {
    elements.recentSearches.innerHTML = `<p class="empty-state">No recent cities yet.</p>`;
    return;
  }

  elements.recentSearches.innerHTML = "";
  visiblePlaces.forEach((place) => {
    const button = document.createElement("button");
    button.className = "recent-button";
    button.type = "button";
    button.textContent = formatPlaceName(place);
    button.addEventListener("click", () => loadWeather(place));
    elements.recentSearches.append(button);
  });
}

function rememberPlace(place) {
  if (place.name === "Your location") {
    return;
  }

  recentPlaces = [
    place,
    ...recentPlaces.filter((item) => {
      return `${item.name}-${item.country}` !== `${place.name}-${place.country}`;
    })
  ].slice(0, 5);

  saveValue(storageKeys.recent, recentPlaces);
  renderRecentSearches();
}

function setActiveUnit(unit, shouldReload) {
  activeUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";
  saveValue(storageKeys.unit, activeUnit);

  unitButtons.forEach((button) => {
    const isActive = button.dataset.unit === activeUnit;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (shouldReload && activePlace) {
    loadWeather(activePlace).catch((error) => {
      showStatus(error.message, "error");
    });
  }
}

function setLoading(isLoading, message) {
  searchForm.querySelectorAll("button, input").forEach((item) => {
    item.disabled = isLoading;
  });
  locationButton.disabled = isLoading;

  if (message) {
    showStatus(message);
  }
}

function showStatus(message, state = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.state = state;
  statusMessage.hidden = false;
}

function hideStatus() {
  statusMessage.hidden = true;
}

function getWeatherMeta(code, isDay) {
  const meta = weatherMeta[code] || { label: "Mixed conditions", icon: "cloud-sun", theme: "cloudy" };

  if (!isDay && meta.theme === "clear") {
    return { ...meta, icon: "moon-star" };
  }

  if (!isDay && meta.icon === "cloud-sun") {
    return { ...meta, icon: "cloud-moon" };
  }

  return meta;
}

function getTodayRainChance(data) {
  return data.daily.precipitation_probability_max?.[0]
    ?? data.hourly.precipitation_probability?.[0]
    ?? 0;
}

function formatPlaceName(place) {
  return place.country ? `${place.name}, ${place.country}` : place.name;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return Math.round(Number(value));
}

function formatClock(value) {
  if (!value || typeof value !== "string") {
    return "--";
  }

  const time = value.split("T")[1];
  return time ? time.slice(0, 5) : "--";
}

function formatDay(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function compassDirection(degrees) {
  if (degrees === null || degrees === undefined || Number.isNaN(Number(degrees))) {
    return "--";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(Number(degrees) / 45) % directions.length;
  return directions[index];
}

function getStoredValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private browsing modes.
  }
}

function renderIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
