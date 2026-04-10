"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CityWeather = {
  name: string;
  temp: number;
  humidity: number;
  weatherCode: number;
};

function getWeatherInfo(code: number): { icon: string; label: string } {
  if (code === 0)                        return { icon: "☀️",  label: "맑음" };
  if (code === 1)                        return { icon: "🌤️", label: "구름 조금" };
  if (code === 2)                        return { icon: "⛅",  label: "구름 많음" };
  if (code === 3)                        return { icon: "☁️",  label: "흐림" };
  if (code >= 45 && code <= 48)          return { icon: "🌫️", label: "안개" };
  if (code >= 51 && code <= 67)          return { icon: "🌧️", label: "비" };
  if (code >= 71 && code <= 77)          return { icon: "❄️",  label: "눈" };
  if (code >= 80 && code <= 82)          return { icon: "🌦️", label: "소나기" };
  if (code >= 95 && code <= 99)          return { icon: "⛈️",  label: "천둥번개" };
  return { icon: "🌡️", label: "알 수 없음" };
}

export default function WeatherWidget() {
  const [cities, setCities] = useState<CityWeather[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/weather", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setCities(d.cities ?? []))
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const goToCity = useCallback((i: number) => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    setVisible(false);
    fadeTimer.current = setTimeout(() => {
      setIndex(i);
      setVisible(true);
    }, 300);
  }, []);

  useEffect(() => {
    if (cities.length === 0) return;
    // cities.length dep (not cities) avoids restarting on same-length re-fetches
    const timer = setInterval(() => {
      goToCity((index + 1) % cities.length);
    }, 4000);
    return () => {
      clearInterval(timer);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [cities.length, index, goToCity]);

  const city = cities[index];
  const weather = city ? getWeatherInfo(city.weatherCode) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        오늘의 날씨
      </p>

      {loading ? (
        <div className="space-y-2">
          <div className="animate-pulse rounded bg-gray-100 h-8 w-3/5" />
          <div className="animate-pulse rounded bg-gray-100 h-4 w-2/5" />
        </div>
      ) : error || !city || !weather ? (
        <p className="text-xs text-gray-400">날씨를 불러올 수 없습니다.</p>
      ) : (
        <>
          {/* 날씨 정보 */}
          <div
            aria-live="polite"
            aria-atomic="true"
            className="transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{weather.icon}</span>
              <span className="text-base font-bold text-gray-800">{city.name}</span>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 leading-none">
              {city.temp}°C
            </p>
            <p className="mt-1 text-xs text-gray-500">{weather.label}</p>
            <p className="text-xs text-gray-400">💧 습도 {city.humidity}%</p>
          </div>

          {/* 도트 인디케이터 */}
          <div
            role="group"
            aria-label="도시 선택"
            className="mt-3 flex flex-wrap gap-1"
          >
            {cities.map((c, i) => (
              <button
                key={c.name}
                onClick={() => goToCity(i)}
                className="relative flex h-4 w-4 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                aria-label={c.name}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === index ? "bg-indigo-500" : "bg-gray-200"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
