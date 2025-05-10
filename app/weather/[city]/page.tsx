import classNames from 'classnames';

interface CityPageProps {
  params: { city: string };
  searchParams: { unit?: 'imperial' | 'metric' };
}

interface WeatherData {
  current: any;
  forecast: any;
}

// Fetch current & 5-day forecast
async function getWeather(
  city: string,
  units: 'metric' | 'imperial'
): Promise<WeatherData> {
  const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=${units}`,
      { cache: 'no-store' }
    ),
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=${units}`,
      { cache: 'no-store' }
    ),
  ]);
  if (!currentRes.ok) throw new Error('Failed to fetch current weather');
  if (!forecastRes.ok) throw new Error('Failed to fetch forecast');
  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

// Map OpenWeather 'id' to our bg-key
function getBgKey(id: number): string {
  const group = Math.floor(id / 100);

  switch (group) {
    case 2:
      return 'thunderstorm';    // 2xx
    case 3:
    case 5:
      return 'rainy';           // 3xx & 5xx
    case 6:
      return 'snowy';           // 6xx
    case 7:
      // Specific “haze” code
      if (id === 721) return 'mist';
      // Fog, mist, smoke, etc.
      return 'mist';
    case 8:
      // 800 is perfectly clear
      if (id === 800) return 'sunny';
      // 801, 802, 803, 804 → clouds
      return 'cloudy';
    default:
      // Anything else (just in case)
      return 'default';
  }
}


export default async function CityWeatherPage({
  params,
  searchParams,
}: CityPageProps) {
  const cityName = decodeURIComponent(params.city);
  const unit = searchParams.unit === 'imperial' ? 'imperial' : 'metric';

  if (!cityName.trim()) {
    return <main className="p-6">Invalid city name.</main>;
  }

  let weatherData: WeatherData;
  try {
    weatherData = await getWeather(cityName, unit);
  } catch (err: any) {
    return <main className="p-6 text-red-600">Error: {err.message}</main>;
  }

  const { current, forecast } = weatherData;
  const tempUnit = unit === 'imperial' ? '°F' : '°C';
  const windUnit = unit === 'imperial' ? 'mph' : 'm/s';

  // Determine background by weather code
  const code = current.weather?.[0]?.id ?? 800;
  const bgKey = getBgKey(code);

  // Map embed
  const { lat, lon } = current.coord;
  const mapSrc =
    `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.05}%2C${lat - 0.05}%2C${
      lon + 0.05
    }%2C${lat + 0.05}&layer=mapnik&marker=${lat}%2C${lon}`;

  // Links
  const basePath = `/weather/${encodeURIComponent(cityName)}`;
  const metricLink = `${basePath}?unit=metric`;
  const imperialLink = `${basePath}?unit=imperial`;

  return (
    <main
      className={classNames(
        'min-h-screen p-6 bg-cover bg-center text-white relative',
        `bg-${bgKey}`
      )}
      style={{ backgroundImage: `url('/images/weather/${bgKey}.jpg')` }}
    >
      {/* Unit Toggle */}
      <div className="flex justify-end mb-4 space-x-2">
        <a
          href={metricLink}
          className={classNames(
            'px-3 py-1 rounded-lg border transition',
            unit === 'metric'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-100'
          )}
        >
          °C
        </a>
        <a
          href={imperialLink}
          className={classNames(
            'px-3 py-1 rounded-lg border transition',
            unit === 'imperial'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-100'
          )}
        >
          °F
        </a>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800 bg-white bg-opacity-70  px-4 py-2 rounded-lg">
        Weather in {current.name}
      </h1>

      {/* Map */}
      <div className="w-full h-64 mb-6 border rounded-lg overflow-hidden">
        <iframe
          title="location-map"
          src={mapSrc}
          style={{ border: 0, width: '100%', height: '100%' }}
          loading="lazy"
        />
      </div>

      {/* Current Weather */}
      <section className="max-w-md mx-auto bg-white bg-opacity-80 text-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Weather</h2>
        <p>
          <strong>Temperature:</strong> {current.main.temp.toFixed(1)}{tempUnit}
        </p>
        <p>
          <strong>Feels Like:</strong> {current.main.feels_like.toFixed(1)}{tempUnit}
        </p>
        <p>
          <strong>Humidity:</strong> {current.main.humidity}%
        </p>
        <p>
          <strong>Condition:</strong> {current.weather[0].description}
        </p>
        <p>
          <strong>Wind Speed:</strong> {current.wind.speed.toFixed(1)} {windUnit}
        </p>
        <p>
          <strong>Pressure:</strong> {current.main.pressure} hPa
        </p>
      </section>

      {/* 5-Day Forecast */}
      {forecast.list?.length > 0 && (
        <section className="max-w-md mx-auto bg-white bg-opacity-80 text-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">5-Day Forecast</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {forecast.list.filter((_: any, i: number) => i % 8 === 0).map((item: any) => (
              <div
                key={item.dt}
                className="p-4 border rounded-lg bg-white bg-opacity-70"
              >
                <p className="font-semibold">
                  {new Date(item.dt * 1000).toLocaleDateString()}
                </p>
                <p>High: {item.main.temp_max.toFixed(1)}{tempUnit}</p>
                <p>Low: {item.main.temp_min.toFixed(1)}{tempUnit}</p>
                <p>{item.weather[0].description}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

