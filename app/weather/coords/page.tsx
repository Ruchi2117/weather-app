"use client";

import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

interface WeatherData {
  current: any;
  forecast: any;
}

async function getWeatherByCoords(lat: number, lon: number): Promise<WeatherData> {
  const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;

  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
      { cache: "no-store" }
    ),
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
      { cache: "no-store" }
    ),
  ]);

  if (!currentRes.ok) {
    const txt = await currentRes.text();
    throw new Error(`Weather API error (${currentRes.status}): ${txt}`);
  }
  if (!forecastRes.ok) {
    const txt = await forecastRes.text();
    throw new Error(`Forecast API error (${forecastRes.status}): ${txt}`);
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "nextjs-weather-app" }, cache: "no-store" }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    const addr = data.address || {};
    if (addr.city || addr.town || addr.village) {
      return addr.city || addr.town || addr.village;
    }
  } catch {
    // ignore and fallback
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function getBgKey(id: number): string {
  const group = Math.floor(id / 100);

  switch (group) {
    case 2:
      return 'thunderstorm';
    case 3:
    case 5:
      return 'rainy';
    case 6:
      return 'snowy';
    case 7:
      return id === 721 ? 'haze' : 'misty';
    case 8:
      return id === 800 ? 'sunny' : 'cloudy';
    default:
      return 'default';
  }
}

export default function CoordWeatherPage() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [placeName, setPlaceName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lon: longitude });
      },
      () => setError('Unable to retrieve location.')
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    (async () => {
      try {
        const data = await getWeatherByCoords(coords.lat, coords.lon);
        setWeather(data);
        const name = await reverseGeocode(coords.lat, coords.lon);
        setPlaceName(name);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [coords]);

  if (error) {
    return (
      <main className="p-6 text-center text-red-500">
        {error}
      </main>
    );
  }

  if (!weather) {
    return (
      <main className="p-6 text-center">
        Loading weather...
      </main>
    );
  }

  const code = weather.current.weather?.[0]?.id ?? 800;
  const bgKey = getBgKey(code);
  const bgImage = `/images/weather/${bgKey}.jpg`;
  const baseClasses = 'min-h-screen p-6 bg-cover bg-center text-white relative';

  return (
    <main
      className={classNames(baseClasses)}
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <h1 className="text-3xl font-bold text-center mb-6 bg-white bg-opacity-70 text-gray-800 inline-block px-4 py-2 rounded-lg">
        Weather in {placeName}
      </h1>

      <section className="max-w-md mx-auto bg-white bg-opacity-80 text-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Weather</h2>
        <p>
          <strong>Temperature:</strong> {weather.current.main.temp.toFixed(1)}°C
        </p>
        <p>
          <strong>Feels Like:</strong> {weather.current.main.feels_like.toFixed(1)}°C
        </p>
        <p>
          <strong>Humidity:</strong> {weather.current.main.humidity}%
        </p>
        <p>
          <strong>Condition:</strong> {weather.current.weather[0].description}
        </p>
        <p>
          <strong>Wind Speed:</strong> {weather.current.wind.speed.toFixed(1)} m/s
        </p>
        <p>
          <strong>Pressure:</strong> {weather.current.main.pressure} hPa
        </p>
      </section>

      {weather.forecast?.list?.length > 0 && (
        <section className="max-w-md mx-auto bg-white bg-opacity-80 text-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">5-Day Forecast</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {weather.forecast.list
              .filter((_: any, i: number) => i % 8 === 0)
              .map((item: any) => (
                <div
                  key={item.dt}
                  className="p-4 border rounded-lg bg-white bg-opacity-70"
                >
                  <p className="font-semibold">
                    {new Date(item.dt * 1000).toLocaleDateString()}
                  </p>
                  <p>High: {item.main.temp_max.toFixed(1)}°C</p>
                  <p>Low: {item.main.temp_min.toFixed(1)}°C</p>
                  <p>{item.weather[0].description}</p>
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
