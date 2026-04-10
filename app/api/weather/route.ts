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
  const settled = await Promise.allSettled(
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

  const results: CityWeather[] = settled
    .filter((r): r is PromiseFulfilledResult<CityWeather> => r.status === "fulfilled")
    .map((r) => r.value);

  if (results.length === 0) {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  return NextResponse.json(
    { cities: results },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
  );
}
