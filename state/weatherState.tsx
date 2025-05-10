// state/weatherState.tsx
"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";

interface WeatherData {
  current: any;
  forecast: any;
}

interface WeatherState {
  lastViewed: string[];
  setLastViewed: Dispatch<SetStateAction<string[]>>;
  weatherCache: Record<string, WeatherData>;
  setWeatherCache: Dispatch<SetStateAction<Record<string, WeatherData>>>;
  favoriteCities: string[];
  setFavoriteCities: Dispatch<SetStateAction<string[]>>;
  addFavorite: (city: string) => void;
  removeFavorite: (city: string) => void;
  isFavorite: (city: string) => boolean;
}

const WeatherContext = createContext<WeatherState | undefined>(undefined);

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error("useWeather must be used within a WeatherProvider");
  }
  return context;
};

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lastViewed, setLastViewed] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("lastViewed");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading last viewed cities from localStorage:", error);
      return [];
    }
  });
  const [weatherCache, setWeatherCache] = useState<Record<string, WeatherData>>({});
  const [favoriteCities, setFavoriteCities] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("favorites");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading favorite cities from localStorage:", error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("lastViewed", JSON.stringify(lastViewed));
  }, [lastViewed]);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favoriteCities));
  }, [favoriteCities]);

  const addFavorite = (city: string) => {
    if (!favoriteCities.includes(city)) {
      setFavoriteCities((prev) => [...prev, city]);
    }
  };

  const removeFavorite = (city: string) => {
    setFavoriteCities((prev) => prev.filter((fav) => fav !== city));
  };

  const isFavorite = (city: string) => {
    return favoriteCities.includes(city);
  };

  const value: WeatherState = {
    lastViewed,
    setLastViewed,
    weatherCache,
    setWeatherCache,
    favoriteCities,
    setFavoriteCities,
    addFavorite,
    removeFavorite,
    isFavorite,
  };

  return (
    <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
  );
};