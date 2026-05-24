# Weather Week App

A lightweight weather web app that shows current conditions, a multi-day forecast, and activity suggestions tailored to the weather.

## Features

- Search by city name
- Current weather summary
- Forecast cards for the next several days
- Activity suggestions based on weather conditions
- Responsive mobile-friendly design

## Setup

1. Create an OpenWeatherMap API key at https://openweathermap.org/api.
2. Open `script.js` and set the `API_KEY` constant at the top of the file.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm start
```

5. Open the app in your browser at `http://127.0.0.1:5500`.

## Notes

- The app uses OpenWeatherMap's Geocoding API, Current Weather API, and 5-day / 3-hour Forecast API.
- The free forecast endpoint provides about 5–6 days of forecast data, not a full 7-day forecast.
- If you want to change the port, update the `start` script in `package.json`.
- Keep your API key private and do not commit it to public repositories.
