"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CityWeather = {
  name: string;
  temp: number;
  humidity: number;
  weatherCode: number;
};

const DAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function getTimeParts() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const day = DAYS[now.getDay()];
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return { date: `${y}.${m}.${d}`, day, hh, mm, ss };
}

function getWeatherInfo(code: number): { icon: string; label: string } {
  if (code === 0)                    return { icon: "☀️",  label: "맑음" };
  if (code === 1)                    return { icon: "🌤️", label: "구름 조금" };
  if (code === 2)                    return { icon: "⛅",  label: "구름 많음" };
  if (code === 3)                    return { icon: "☁️",  label: "흐림" };
  if (code >= 45 && code <= 48)      return { icon: "🌫️", label: "안개" };
  if (code >= 51 && code <= 67)      return { icon: "🌧️", label: "비" };
  if (code >= 71 && code <= 77)      return { icon: "❄️",  label: "눈" };
  if (code === 85 || code === 86)    return { icon: "🌨️", label: "눈 소나기" };
  if (code >= 80 && code <= 82)      return { icon: "🌦️", label: "소나기" };
  if (code >= 95 && code <= 99)      return { icon: "⛈️",  label: "천둥번개" };
  return { icon: "🌡️", label: "알 수 없음" };
}

function Colon({ visible }: { visible: boolean }) {
  return (
    <span
      className="transition-opacity duration-100"
      style={{ opacity: visible ? 1 : 0.15 }}
    >
      :
    </span>
  );
}

export default function ClockWeatherWidget() {
  // ── 시계 ──
  const [parts, setParts] = useState<ReturnType<typeof getTimeParts> | null>(null);
  const [colonVisible, setColonVisible] = useState(true);

  // ── 날씨 ──
  const [cities, setCities] = useState<CityWeather[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 시계 tick
  useEffect(() => {
    setParts(getTimeParts());
    const tick = setInterval(() => {
      setParts(getTimeParts());
      setColonVisible((v) => !v);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  // 날씨 fetch
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/weather", { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("weather api error"); return r.json(); })
      .then((d) => setCities(d.cities ?? []))
      .catch((err) => { if (err.name !== "AbortError") {} })
      .finally(() => setWeatherLoading(false));
    return () => controller.abort();
  }, []);

  // 도시 슬라이드
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
    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
      {/* ── 시계 ── */}
      <div className="flex items-center justify-between">
        {parts ? (
          <>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {parts.date} <span className="font-semibold text-indigo-400">{parts.day}</span>
            </span>
            <p
              className="text-xl font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(to right, #6366f1, #7c3aed)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {parts.hh}<Colon visible={colonVisible} />{parts.mm}<Colon visible={colonVisible} />{parts.ss}
            </p>
          </>
        ) : (
          <div className="h-5 w-full" />
        )}
      </div>

      {/* ── 구분선 ── */}
      <div className="my-2.5 border-t border-gray-100 dark:border-slate-700" />

      {/* ── 날씨 ── */}
      {weatherLoading ? (
        <div className="flex items-center gap-2">
          <div className="animate-pulse rounded bg-gray-100 dark:bg-slate-700 h-5 w-5" />
          <div className="animate-pulse rounded bg-gray-100 dark:bg-slate-700 h-4 w-24" />
        </div>
      ) : !city || !weather ? (
        <p className="text-xs text-gray-400">날씨 정보 없음</p>
      ) : (
        <>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-between transition-opacity duration-300"
            style={{ opacity: visible ? 1 : 0 }}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-lg leading-none">{weather.icon}</span>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{city.name}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{weather.label}</span>
            </div>
            <div className="text-right">
              <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">{city.temp}°C</span>
              <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">💧{city.humidity}%</span>
            </div>
          </div>

          {/* 도트 인디케이터 */}
          <div role="group" aria-label="도시 선택" className="mt-2 flex flex-wrap gap-1">
            {cities.map((c, i) => (
              <button
                key={c.name}
                onClick={() => goToCity(i)}
                className="relative flex h-4 w-4 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                aria-label={c.name}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition-colors ${i === index ? "bg-indigo-500" : "bg-gray-200 dark:bg-slate-600"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
