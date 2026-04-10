# Sidebar Clock & Weather Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이드바 상단에 날짜+시간 시계 카드와 한국 17개 광역 지자체 날씨 자동 슬라이드 카드를 추가한다.

**Architecture:** `ClockWidget`은 순수 클라이언트 컴포넌트로 서버 요청 없이 동작한다. `WeatherWidget`은 `/api/weather` 라우트에서 Open-Meteo API를 병렬 호출해 1시간 캐싱된 데이터를 받아 4초마다 도시를 자동 전환한다. `Sidebar.tsx`에 두 위젯을 기존 카드들 앞에 삽입한다.

**Tech Stack:** Next.js App Router, React hooks (useState/useEffect/useRef), Tailwind CSS, Open-Meteo API (무료, 키 불필요)

---

## File Map

| 파일 | 작업 |
|---|---|
| `components/ClockWidget.tsx` | 신규 생성 |
| `app/api/weather/route.ts` | 신규 생성 |
| `components/WeatherWidget.tsx` | 신규 생성 |
| `components/Sidebar.tsx` | 수정 — ClockWidget, WeatherWidget import 추가 |

---

## Task 1: ClockWidget 컴포넌트

**Files:**
- Create: `components/ClockWidget.tsx`

- [ ] **Step 1: 파일 생성**

`components/ClockWidget.tsx`를 아래 내용으로 생성한다:

```tsx
"use client";

import { useEffect, useState } from "react";

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

export default function ClockWidget() {
  const [parts, setParts] = useState(getTimeParts);
  const [colonVisible, setColonVisible] = useState(true);

  useEffect(() => {
    const tick = setInterval(() => {
      setParts(getTimeParts());
      setColonVisible((v) => !v);
    }, 500);
    return () => clearInterval(tick);
  }, []);

  const sep = (
    <span
      className="transition-opacity duration-100"
      style={{ opacity: colonVisible ? 1 : 0.15 }}
    >
      :
    </span>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* 날짜 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">
          {parts.date}
        </span>
        <span className="text-xs font-semibold text-indigo-400">
          {parts.day}
        </span>
      </div>

      {/* 시간 */}
      <p
        className="text-center text-3xl font-extrabold tracking-tight"
        style={{
          background: "linear-gradient(to right, #6366f1, #7c3aed)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {parts.hh}{sep}{parts.mm}{sep}{parts.ss}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/ClockWidget.tsx
git commit -m "feat: add ClockWidget with blinking colon"
```

---

## Task 2: `/api/weather` 라우트

**Files:**
- Create: `app/api/weather/route.ts`

- [ ] **Step 1: 파일 생성**

`app/api/weather/route.ts`를 아래 내용으로 생성한다:

```ts
import { NextResponse } from "next/server";

type CityWeather = {
  name: string;
  temp: number;
  humidity: number;
  weatherCode: number;
};

const CITIES = [
  { name: "서울",  lat: 37.5665, lon: 126.9780 },
  { name: "부산",  lat: 35.1796, lon: 129.0756 },
  { name: "대구",  lat: 35.8714, lon: 128.6014 },
  { name: "인천",  lat: 37.4563, lon: 126.7052 },
  { name: "광주",  lat: 35.1595, lon: 126.8526 },
  { name: "대전",  lat: 36.3504, lon: 127.3845 },
  { name: "울산",  lat: 35.5384, lon: 129.3114 },
  { name: "세종",  lat: 36.4800, lon: 127.2890 },
  { name: "경기",  lat: 37.4138, lon: 127.5183 },
  { name: "강원",  lat: 37.8228, lon: 128.1555 },
  { name: "충북",  lat: 36.6357, lon: 127.4917 },
  { name: "충남",  lat: 36.5184, lon: 126.8000 },
  { name: "전북",  lat: 35.7175, lon: 127.1530 },
  { name: "전남",  lat: 34.8679, lon: 126.9910 },
  { name: "경북",  lat: 36.4919, lon: 128.8889 },
  { name: "경남",  lat: 35.4606, lon: 128.2132 },
  { name: "제주",  lat: 33.4996, lon: 126.5312 },
];

export async function GET() {
  try {
    const results = await Promise.all(
      CITIES.map(async ({ name, lat, lon }) => {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,weathercode` +
          `&timezone=Asia%2FSeoul`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`fetch failed for ${name}`);
        const data = await res.json();
        const c = data.current;
        return {
          name,
          temp: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          weatherCode: c.weathercode,
        } satisfies CityWeather;
      })
    );

    return NextResponse.json(
      { cities: results },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 브라우저 또는 curl로 동작 확인**

개발 서버 실행 후:
```bash
curl http://localhost:3000/api/weather
```
예상 응답:
```json
{
  "cities": [
    { "name": "서울", "temp": 13, "humidity": 62, "weatherCode": 2 },
    ...
  ]
}
```
17개 도시가 모두 포함되면 정상.

- [ ] **Step 3: 커밋**

```bash
git add app/api/weather/route.ts
git commit -m "feat: add /api/weather route with Open-Meteo, 1h cache"
```

---

## Task 3: WeatherWidget 컴포넌트

**Files:**
- Create: `components/WeatherWidget.tsx`

- [ ] **Step 1: 파일 생성**

`components/WeatherWidget.tsx`를 아래 내용으로 생성한다:

```tsx
"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => setCities(d.cities ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (cities.length === 0) return;
    const timer = setInterval(() => {
      // fade out → 다음 도시 → fade in
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % cities.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(timer);
  }, [cities.length]);

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
      ) : !city || !weather ? (
        <p className="text-xs text-gray-400">날씨를 불러올 수 없습니다.</p>
      ) : (
        <>
          {/* 날씨 정보 */}
          <div
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
          <div className="mt-3 flex flex-wrap gap-1">
            {cities.map((_, i) => (
              <button
                key={i}
                onClick={() => { setVisible(false); setTimeout(() => { setIndex(i); setVisible(true); }, 300); }}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-indigo-500" : "bg-gray-200"
                }`}
                aria-label={cities[i].name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add components/WeatherWidget.tsx
git commit -m "feat: add WeatherWidget with 17-city auto-slide and dot indicator"
```

---

## Task 4: Sidebar에 위젯 연결

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: import 추가 및 위젯 삽입**

`components/Sidebar.tsx` 상단 import 블록에 추가:

```tsx
import ClockWidget from "./ClockWidget";
import WeatherWidget from "./WeatherWidget";
```

`return` 안의 `<div className="space-y-5 sticky top-24">` 바로 안쪽, 시세 카드 `{/* ── 시세 카드 ── */}` 앞에 삽입:

```tsx
<ClockWidget />
<WeatherWidget />
```

최종 구조:
```tsx
<div className="space-y-5 sticky top-24">
  <ClockWidget />
  <WeatherWidget />

  {/* ── 시세 카드 ── */}
  ...

  {/* ── 실시간 뉴스 카드 ── */}
  ...
</div>
```

- [ ] **Step 2: 브라우저에서 시각 확인**

개발 서버(`npm run dev`) 실행 후 `http://localhost:3000` 접속.
- 사이드바 최상단에 시계 카드가 보이는지 확인
- 콜론이 0.5초마다 깜빡이는지 확인
- 날씨 카드가 4초마다 도시를 전환하는지 확인
- 도트 인디케이터가 현재 도시에 맞게 indigo 색으로 표시되는지 확인

- [ ] **Step 3: 커밋**

```bash
git add components/Sidebar.tsx
git commit -m "feat: integrate ClockWidget and WeatherWidget into Sidebar"
```
