"use client";

import '@/app/globals.css';
import type { AppProps } from 'next/app';
import type { NextComponentType } from 'next';

type AppPropsWithComponent = AppProps & {
  Component: NextComponentType;
};

function MyApp({ Component, pageProps }: AppPropsWithComponent) {
  return <Component {...pageProps} />;
}

import '@/app/globals.css';
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import debounce from "lodash.debounce";
import { useRouter } from "next/navigation";
import { useTheme } from 'next-themes';
import { CloudSun } from 'lucide-react';
import Link from "next/link";
import { types, onSnapshot, applySnapshot, Instance } from "mobx-state-tree";

// MST store definitions 
const WeatherEntryModel = types.model({ city: types.string, timestamp: types.Date, weather: types.frozen() });
const RootStore = types
  .model({ history: types.optional(types.array(WeatherEntryModel), []), favorites: types.optional(types.array(types.string), []) })
  .actions(self => ({ addHistory(entry: Instance<typeof WeatherEntryModel>) { self.history.unshift(entry); if (self.history.length > 20) self.history.pop(); }, toggleFavorite(city: string) { if (self.favorites.includes(city)) (self.favorites as any).remove(city); else self.favorites.push(city); }, load(snapshot: any) { applySnapshot(self, snapshot); } }))
  .views(self => ({ isFavorite: (city: string) => self.favorites.includes(city) }));
const store: Instance<typeof RootStore> = RootStore.create();
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("weatherAppStore");
  if (saved) store.load(JSON.parse(saved));
  onSnapshot(store, snap => localStorage.setItem("weatherAppStore", JSON.stringify(snap)));
}

interface City { name: string; country: string; timezone: string; highTemp?: number; lowTemp?: number; }
const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
const WEATHER_API_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

export default function Home() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof City | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const seenCitiesRef = useRef<Set<string>>(new Set());

  // Geolocation
  const handleLocationClick = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      pos => router.push(`/weather/coords?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
      err => alert("Failed to get location: " + err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  


  // fetch weather helper
  const fetchWeatherData = async (city: string) => {
    try {
      const res = await fetch(
        `${WEATHER_API_BASE_URL}?q=${encodeURIComponent(city)}&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}&units=metric`
      );
      const data = await res.json();
      if (data?.main) return { high: data.main.temp_max, low: data.main.temp_min,raw: data,  };
    } catch {}
    return null;
  };

  // main city fetch (with pagination via &start=)
  const fetchCities = useCallback(async (query: string, pageNum: number) => {
    setLoading(true);
    const rows = query.trim() ? 20 : 50;
    const start = (pageNum - 1) * rows;
    const sortParam = query.trim() ? "" : "&sort=population";
    const url =
      `https://public.opendatasoft.com/api/records/1.0/search/` +
      `?dataset=geonames-all-cities-with-a-population-1000` +
      `&q=${encodeURIComponent(query)}` +
      `&rows=${rows}&start=${start}` +
      sortParam;

    const res = await fetch(url);
    const json = await res.json();

    // hydrate with weather
    const batch: City[] = await Promise.all(
      json.records.map(async (rec: any) => {
        const base = {
          name: rec.fields.name,
          country: rec.fields.cou_name_en,
          timezone: rec.fields.timezone,
        };
        const w = await fetchWeatherData(rec.fields.name);
        return { ...base, highTemp: w?.high, lowTemp: w?.low };
      })
    );

    // dedupe
    const newCities: City[] = [];
    batch.forEach((c) => {
      const key = `${c.name.toLowerCase()}|${c.country.toLowerCase()}|${c.timezone}`;
      if (!seenCitiesRef.current.has(key)) {
        seenCitiesRef.current.add(key);
        newCities.push(c);
      }
    });

    if (pageNum === 1) setCities(newCities);
    else setCities((prev) => [...prev, ...newCities]);

    setHasMore(json.nhits > start + rows);
    setLoading(false);
  }, []);

  const debouncedFetch = useMemo(() => debounce(fetchCities, 400), [fetchCities]);

  // fetch top-5 text suggestions
  const fetchSuggestions = useMemo(() =>
    debounce(async (term: string) => {
      if (!term.trim()) return setSuggestions([]);
      const url =
        `https://public.opendatasoft.com/api/records/1.0/search/` +
        `?dataset=geonames-all-cities-with-a-population-1000` +
        `&q=${encodeURIComponent(term)}` +
        `&rows=5`;
      try {
        const res = await fetch(url);
        const json = await res.json();
        const names: string[] = Array.from(
          new Set(json.records.map((r: any) => r.fields.name).filter((name: unknown): name is string => typeof name === 'string'))
        );
        setSuggestions(names);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300), []
  );

  useEffect(() => {
    // reset on new search term
    setPage(1);
    setHasMore(true);
    setCities([]);
    seenCitiesRef.current.clear();
    debouncedFetch(search, 1);
    fetchSuggestions(search);
  }, [search, debouncedFetch, fetchSuggestions]);

  useEffect(() => {
    if (page > 1) fetchCities(search, page);
  }, [page, search, fetchCities]);

  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100 &&
        !loading && hasMore
      ) setPage((p) => p + 1);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasMore]);

  // Inline suggestion logic
  const inlineSuggestion = useMemo(() => {
    if (!search) return "";
    const first = suggestions[0];
    if (first && first.toLowerCase().startsWith(search.toLowerCase())) return search + first.slice(search.length);
    return "";
  }, [search, suggestions]);

  // filtered + sorted logic unchanged
  const filtered = useMemo(() => cities.filter(c =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()) &&
    c.name.toLowerCase().includes(cityFilter.trim().toLowerCase()) &&
    c.country.toLowerCase().includes(countryFilter.trim().toLowerCase()) &&
    c.timezone.toLowerCase().includes(timezoneFilter.trim().toLowerCase())
  ), [cities, search, cityFilter, countryFilter, timezoneFilter]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    return [...filtered].sort((a, b) => {
      const A = a[sortColumn], B = b[sortColumn];
      if (typeof A === 'string') return sortOrder === 'asc' ? A.localeCompare(B as string) : (B as string).localeCompare(A);
      if (typeof A === 'number') return sortOrder === 'asc' ? (A as number) - (B as number) : (B as number) - (A as number);
      return 0;
    });
  }, [filtered, sortColumn, sortOrder]);

  // sort handler
  const handleSort = (col: keyof City) => {
    if (sortColumn === col) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortOrder('asc'); }
  };

  return (
    <main className={`min-h-screen p-6 relative font-sans transition-colors duration-300 bg-fixed bg-cover bg-center bg-no-repeat ${theme === 'light' ? "bg-gray-100" : "bg-gray-900"}`} style={{ backgroundImage: theme === 'light' ? "url('/images/weather/city.jpg')" : "url('/images/weather/night.jpg')" }}>
      {/* Top controls: location + theme toggle */}
      <div className="absolute top-4 right-4 flex space-x-2">
        <button onClick={handleLocationClick} className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600">Your Location</button>
      </div>
      {/* Title with icon */}
      <div className="flex items-center justify-center mb-6 text-center space-x-2">
        <CloudSun size={32} className="text-yellow-500 dark:text-yellow-300" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">City Weather Explorer</h1>
      </div>

      {/* Favorites */}
      <div className="flex flex-wrap justify-center mb-6 space-x-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">⭐ Your Favorites:</h2>
        {store.favorites.length === 0 ? (
          <span className="text-gray-500 dark:text-gray-400">None yet</span>
        ) : store.favorites.map(city => (
          <button key={city} onClick={() => router.push(`/weather/${encodeURIComponent(city)}`)} className="bg-gradient-to-r from-yellow-300 to-yellow-200 dark:from-yellow-600 dark:to-yellow-500 text-yellow-900 dark:text-yellow-50 px-4 py-2 hover:from-yellow-400 hover:to-yellow-300 dark:hover:from-yellow-700 dark:hover:to-yellow-600 transform hover:scale-105 transition duration-200 rounded">
            {city}
          </button>
        ))}
      </div>


      {/* Search with inline suggestion */}
      <div className="flex justify-center mb-4">
        <div className="relative w-full max-w-md">
          {inlineSuggestion && (
            <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-800 border rounded-md px-3 py-1 shadow-sm text-gray-600 dark:text-gray-300 text-center select-none">
              {inlineSuggestion}
            </div>
          )}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === 'Tab') && inlineSuggestion) { e.preventDefault(); setSearch(inlineSuggestion); } }}
            placeholder="Type to search..."
            className="w-full p-2 border rounded-md outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-70 rounded shadow">
          <thead>
            <tr>
              <th onClick={() => handleSort("name")} className="cursor-pointer px-4 py-2 border text-left">
                <div className="flex flex-col">
                  <span className="dark:text-gray-100">City {sortColumn === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}</span>
                  <input
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    placeholder="Filter city"
                    className="mt-1 p-1 border rounded"
                  />
                </div>
              </th>
              <th onClick={() => handleSort("country")} className="cursor-pointer px-4 py-2 border text-left">
                <div className="flex flex-col">
                  <span className="dark:text-gray-100">Country {sortColumn === "country" ? (sortOrder === "asc" ? "▲" : "▼") : ""}</span>
                  <input
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    placeholder="Filter country"
                    className="mt-1 p-1 border rounded"
                  />
                </div>
              </th>
              <th onClick={() => handleSort("timezone")} className="cursor-pointer px-4 py-2 border text-left">
                <div className="flex flex-col">
                  <span className="dark:text-gray-100">Timezone {sortColumn === "timezone" ? (sortOrder === "asc" ? "▲" : "▼") : ""}</span>
                  <input
                    value={timezoneFilter}
                    onChange={(e) => setTimezoneFilter(e.target.value)}
                    placeholder="Filter timezone"
                    className="mt-1 p-1 border rounded"
                  />
                </div>
              </th>
              <th className="px-4 py-2 border text-left dark:text-gray-100">High Temp</th>
              <th className="px-4 py-2 border text-left dark:text-gray-100">Low Temp</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={i} className="hover:bg-yellow-500 dark:text-black ">
                <td className="px-4 py-2 border  dark:text-gray-100">
                  <button onClick={() => store.toggleFavorite(c.name)}>
                    {store.isFavorite(c.name) ? '★' : '☆'}
                  </button>
                  <span>  </span>
                  <a
                    href={`/weather/${encodeURIComponent(c.name)}`} 
                    onClick={async () => {
                    // record history
                    const w = await fetchWeatherData(c.name);
                    if (w) store.addHistory({ city: c.name, timestamp: new Date(), weather: w.raw });
                    router.push(`/weather/${encodeURIComponent(c.name)}`);
                    }}
                    className="text-blue-600 underline cursor-pointer"
                  >
                    {c.name}
                  </a>
                </td>
                <td className="px-4 py-2 border  dark:text-gray-100">{c.country}</td>
                <td className="px-4 py-2 border  dark:text-gray-100">{c.timezone}</td>
                <td className="px-4 py-2 border  dark:text-gray-100">{c.highTemp != null ? `${c.highTemp}°C` : 'N/A'}</td>
                <td className="px-4 py-2 border  dark:text-gray-100">{c.lowTemp != null ? `${c.lowTemp}°C` : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {loading && <p className="text-center text-gray-500 my-4">Loading...</p>}
      {!loading && search.trim() && !hasMore && (
        <p className="text-center text-gray-500 my-4">End of list.</p>
      )}
    </main>
  );
}

