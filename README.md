# Weather Week App

A lightweight weather web app that shows a 7-day forecast and suggests activities suited to the predicted weather.

## Features

- City search by name
- 7-day weather forecast
- Activity suggestions for each day
- Simple responsive design

## Setup

1. Create an OpenWeatherMap API key at https://openweathermap.org/api.
2. Open `script.js` and set the `API_KEY` constant.
3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm start
```

5. Open the app at `http://127.0.0.1:5500`.

## Notes

- The app uses the OpenWeatherMap Geocoding API and One Call API.
- If you want to use a different port, update the `start` script in `package.json`.
