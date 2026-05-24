// ─────────────────────────────────────────────────────────────────────────────
// JARVIS Weather — fixed to use the free OpenWeatherMap /forecast endpoint.
//
// WHY THE OLD VERSION BROKE:
//   The previous code called /data/2.5/onecall, which OpenWeatherMap moved
//   behind a paid subscription in 2022. Free-tier API keys now get HTTP 401
//   on that endpoint.
//
// WHAT THIS VERSION DOES:
//   • /geo/1.0/direct    — same as before (geocode city → lat/lon)
//   • /data/2.5/weather  — current conditions (free tier ✓)
//   • /data/2.5/forecast — 5-day / 3-hour forecast (free tier ✓)
//     Entries are grouped by calendar day and collapsed into one card each,
//     preserving the original 7-day-style UI as closely as possible.
//     (The free endpoint only covers ~5 days, so you'll see 5–6 day cards.)
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = "b593774f7e85714a6ec84db78e15c594";

// ── DOM refs ──────────────────────────────────────────────────────────────────
const searchButton      = document.getElementById("search-button");
const cityInput         = document.getElementById("city-input");
const errorMessage      = document.getElementById("error-message");
const weatherContainer  = document.getElementById("weather-container");
const locationName      = document.getElementById("location-name");
const currentSummary    = document.getElementById("current-summary");
const currentTemp       = document.getElementById("current-temp");
const forecastGrid      = document.getElementById("forecast-grid");

// ── Activity map ──────────────────────────────────────────────────────────────
const activityMap = [
	{
		keywords: ["Thunderstorm"],
		suggestion:
			"Stay indoors and enjoy a cozy movie, board games, or a warm drink.",
	},
	{
		keywords: ["Drizzle", "Rain"],
		suggestion:
			"Bring an umbrella, visit a café, or enjoy indoor hobbies like reading or cooking.",
	},
	{
		keywords: ["Snow"],
		suggestion:
			"Bundle up for snow activities, build a snowman, or stay cozy with a hot beverage.",
	},
	{
		keywords: ["Clear"],
		suggestion:
			"Plan a picnic, bike ride, or outdoor workout when the sun is shining.",
	},
	{
		keywords: ["Clouds"],
		suggestion:
			"A stroll in the park, museum visit, or brunch is a great fit for cloudy weather.",
	},
	{
		keywords: ["Mist", "Smoke", "Haze", "Fog"],
		suggestion:
			"Choose a gentle indoor workout, watch a documentary, or take a calm afternoon at home.",
	},
	{
		keywords: ["Sand", "Dust"],
		suggestion:
			"Avoid dusty outdoor plans; try indoor crafts, yoga, or streaming a new series.",
	},
];

// ── Event listeners ───────────────────────────────────────────────────────────
searchButton.addEventListener("click", handleSearch);
cityInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter") handleSearch();
});

// ── Search handler ────────────────────────────────────────────────────────────
async function handleSearch() {
	const city = cityInput.value.trim();
	clearMessage();

	if (!city) {
		showError("Please enter a city name.");
		return;
	}

	if (!API_KEY) {
		showError("Set your OpenWeatherMap API key in script.js before searching.");
		return;
	}

	// Disable button while loading
	searchButton.disabled = true;
	searchButton.textContent = "Loading…";

	try {
		const coords   = await getCoordinates(city);
		const current  = await getCurrentWeather(coords.lat, coords.lon);
		const forecast = await getForecast(coords.lat, coords.lon);
		renderWeather(coords.displayName || city, current, forecast);
	} catch (err) {
		showError(err.message || "Unable to load weather data.");
	} finally {
		searchButton.disabled = false;
		searchButton.textContent = "Search";
	}
}

// ── API calls ─────────────────────────────────────────────────────────────────

async function getCoordinates(city) {
	const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
	const res  = await fetch(url);

	if (!res.ok) {
		const detail = await parseApiError(res);
		throw new Error(`Unable to retrieve location. ${detail}`);
	}

	const data = await res.json();
	if (!data || data.length === 0) {
		throw new Error("City not found. Please try another location.");
	}

	return {
		lat: data[0].lat,
		lon: data[0].lon,
		// Use the official name + country returned by the geocoder
		displayName: data[0].state
			? `${data[0].name}, ${data[0].state}, ${data[0].country}`
			: `${data[0].name}, ${data[0].country}`,
	};
}

/** Current conditions — free tier, no subscription needed. */
async function getCurrentWeather(lat, lon) {
	const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
	const res  = await fetch(url);

	if (!res.ok) {
		const detail = await parseApiError(res);
		throw new Error(`Unable to load current weather. ${detail}`);
	}

	return res.json();
}

/** 5-day / 3-hour forecast — free tier, no subscription needed. */
async function getForecast(lat, lon) {
	const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
	const res  = await fetch(url);

	if (!res.ok) {
		const detail = await parseApiError(res);
		throw new Error(`Unable to load forecast. ${detail}`);
	}

	return res.json();
}

async function parseApiError(res) {
	let detail = `HTTP ${res.status}`;
	try {
		const body = await res.json();
		if (body.message) detail = `${detail}: ${body.message}`;
	} catch (_) { /* ignore */ }
	return detail;
}

// ── Data transformation ───────────────────────────────────────────────────────

/**
 * Groups the 3-hourly forecast list by local calendar date and returns one
 * summary object per day — mirroring the shape the old `daily[]` array had.
 *
 * Returned shape per day:
 *   { dateLabel, icon, description, weatherMain, tempMin, tempMax, tempDay }
 */
function buildDailyCards(forecastList) {
	// Build a map: "YYYY-MM-DD" → array of 3-hour slots
	const byDay = {};

	for (const slot of forecastList) {
		// dt_txt is "YYYY-MM-DD HH:MM:SS" in UTC; use it as the stable day key
		const dayKey = slot.dt_txt.slice(0, 10);
		if (!byDay[dayKey]) byDay[dayKey] = [];
		byDay[dayKey].push(slot);
	}

	// Collapse each day's slots into a single summary
	return Object.entries(byDay).map(([dayKey, slots]) => {
		const temps = slots.map((s) => s.main.temp);
		const tempMin = Math.min(...temps);
		const tempMax = Math.max(...temps);

		// Representative slot: prefer midday (12:00), otherwise the first slot
		const midday = slots.find((s) => s.dt_txt.includes("12:00:00")) || slots[0];

		// Pick the most severe / interesting weather condition of the day
		const dominant = pickDominantWeather(slots);

		return {
			dateLabel:    dayKey,
			icon:         dominant.icon,
			description:  dominant.description,
			weatherMain:  dominant.main,
			tempMin:      Math.round(tempMin),
			tempMax:      Math.round(tempMax),
			// "daytime feel" — average of midday slots (09:00–15:00)
			tempDay:      Math.round(
				slots
					.filter((s) => {
						const h = parseInt(s.dt_txt.slice(11, 13), 10);
						return h >= 9 && h <= 15;
					})
					.reduce((sum, s, _, arr) => sum + s.main.temp / arr.length, 0)
				|| midday.main.temp
			),
		};
	});
}

/**
 * Among all 3-hour slots in a day, pick the weather condition that best
 * represents the day. Priority order: Thunderstorm > Snow > Rain > Drizzle >
 * everything else (by occurrence count).
 */
function pickDominantWeather(slots) {
	const priority = ["Thunderstorm", "Snow", "Rain", "Drizzle"];

	for (const p of priority) {
		const match = slots.find((s) => s.weather[0].main === p);
		if (match) return match.weather[0];
	}

	// Fall back to the most-frequent main condition
	const counts = {};
	for (const s of slots) {
		const m = s.weather[0].main;
		counts[m] = (counts[m] || 0) + 1;
	}
	const topMain = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
	return slots.find((s) => s.weather[0].main === topMain).weather[0];
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderWeather(displayName, current, forecastData) {
	weatherContainer.classList.remove("hidden");

	locationName.textContent  = displayName;
	currentSummary.textContent =
		`${capitalize(current.weather[0].description)} • Humidity ${current.main.humidity}%`;
	currentTemp.textContent   = `${Math.round(current.main.temp)}°C`;

	// Skip today (index 0) if the API already returned today's data — show
	// upcoming days. Keeping today gives users a sanity check, so we keep all.
	const dailyCards = buildDailyCards(forecastData.list);

	forecastGrid.innerHTML = dailyCards
		.slice(0, 7)                        // cap at 7 cards (free API gives ~5)
		.map((day) => createForecastCard(day))
		.join("");
}

function createForecastCard(day) {
	const iconUrl    = `https://openweathermap.org/img/wn/${day.icon}@2x.png`;
	const title      = formatDay(day.dateLabel);
	const description = capitalize(day.description);
	const suggestion = getActivitySuggestion(day.weatherMain, day.tempDay);

	return `
    <article class="card">
      <h3>${title}</h3>
      <div class="temp-row">
        <div>
          <img class="weather-icon" src="${iconUrl}" alt="${description}" />
        </div>
        <div>
          <div>${description}</div>
          <div><strong>${day.tempMax}°C</strong> / ${day.tempMin}°C</div>
        </div>
      </div>
      <div class="activity">${suggestion}</div>
    </article>
  `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Accepts either a "YYYY-MM-DD" string (new path) or a Unix timestamp (legacy).
 */
function formatDay(value) {
	const date =
		typeof value === "number"
			? new Date(value * 1000)
			: new Date(value + "T12:00:00"); // force local noon to avoid DST edge-cases

	return date.toLocaleDateString(undefined, {
		weekday: "long",
		month:   "short",
		day:     "numeric",
	});
}

function capitalize(text) {
	if (!text) return "";
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function getActivitySuggestion(weatherMain, tempDay) {
	const entry = activityMap.find((e) => e.keywords.includes(weatherMain));

	const tempMessage =
		tempDay <= 5
			? "Dress warmly if you go outside."
			: tempDay >= 28
			? "Stay hydrated and choose a shaded activity."
			: "Enjoy the comfortable conditions.";

	if (entry) return `${entry.suggestion} ${tempMessage}`;

	return `A variable day ahead. ${tempMessage}`;
}

function showError(message) {
	errorMessage.textContent = message;
	errorMessage.classList.remove("hidden");
	weatherContainer.classList.add("hidden");
}

function clearMessage() {
	errorMessage.textContent = "";
	errorMessage.classList.add("hidden");
}
