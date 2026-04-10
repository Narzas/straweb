# Sidebar Clock & Weather Widget Design

**Date:** 2026-04-10  
**Status:** Approved

## Overview

사이드바에 두 가지 위젯을 추가한다:
1. **시계 카드** — 실시간 날짜+시간 표시, 실시간 시세 위에 위치
2. **날씨 카드** — 한국 17개 광역 지자체 날씨 자동 슬라이드, 시계 바로 아래 위치

최종 사이드바 순서: 시계 → 날씨 → 실시간 시세 → 실시간 뉴스

---

## 1. ClockWidget (`components/ClockWidget.tsx`)

### 기능
- 클라이언트 컴포넌트 (`"use client"`)
- `setInterval(1000)`으로 매 초 업데이트
- 표시 형식: 윗줄 `2026.04.10  목요일`, 아랫줄 `14 : 32 : 07`
- 콜론(`:`)은 500ms 단위로 opacity 토글 (깜빡임 효과)

### 스타일
- 기존 카드 스타일 통일: `rounded-xl border border-gray-200 bg-white p-5 shadow-sm`
- 날짜: `text-xs text-gray-400`
- 시간: `text-3xl font-extrabold` + `bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent`

---

## 2. WeatherWidget (`components/WeatherWidget.tsx`)

### 기능
- 클라이언트 컴포넌트 (`"use client"`)
- 마운트 시 `/api/weather` fetch
- 17개 도시를 4초마다 자동 전환 (fade 애니메이션)
- 도트 인디케이터로 현재 도시 위치 표시
- 도시 순서: 특별시/광역시/특별자치시 8개 → 도/특별자치도 9개

### 표시 항목
- 도시명, 날씨 아이콘(이모지), 날씨 설명(한글), 기온(°C), 습도(%)

### 날씨 코드 → 한글/이모지 매핑
Open-Meteo `weathercode` 기준으로 주요 코드 매핑:
- 0: ☀️ 맑음
- 1~3: 🌤️ 구름 조금 / ⛅ 구름 많음 / ☁️ 흐림
- 51~67: 🌧️ 비
- 71~77: ❄️ 눈
- 80~82: 🌦️ 소나기
- 95~99: ⛈️ 천둥번개

---

## 3. `/api/weather` Route (`app/api/weather/route.ts`)

### 동작
- GET 요청 수신
- 17개 도시 좌표 목록을 Open-Meteo API에 병렬 fetch
- `next: { revalidate: 3600 }` (1시간 캐시)
- 응답: `{ cities: CityWeather[] }`

### 도시 목록 (이름 + 위도/경도)
```
서울 37.5665, 126.9780
부산 35.1796, 129.0756
대구 35.8714, 128.6014
인천 37.4563, 126.7052
광주 35.1595, 126.8526
대전 36.3504, 127.3845
울산 35.5384, 129.3114
세종 36.4800, 127.2890
경기 37.4138, 127.5183
강원 37.8228, 128.1555
충북 36.6357, 127.4917
충남 36.5184, 126.8000
전북 35.7175, 127.1530
전남 34.8679, 126.9910
경북 36.4919, 128.8889
경남 35.4606, 128.2132
제주 33.4996, 126.5312
```

### Open-Meteo 요청 파라미터
```
https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,relative_humidity_2m,weathercode
  &timezone=Asia/Seoul
```

### 응답 타입
```ts
type CityWeather = {
  name: string;
  temp: number;
  humidity: number;
  weatherCode: number;
};
```

---

## 4. Sidebar 수정 (`components/Sidebar.tsx`)

`ClockWidget`과 `WeatherWidget`을 import하여 `space-y-5` 맨 앞에 추가:

```
<ClockWidget />
<WeatherWidget />
{/* 기존 시세 카드 */}
{/* 기존 뉴스 카드 */}
```

---

## 스타일 원칙
- 기존 카드 디자인 언어 유지 (`rounded-xl border-gray-200 bg-white shadow-sm`)
- 컬러 액센트: indigo-500 ~ violet-500 (기존 사이트 톤과 통일)
- 로딩 중 Skeleton 컴포넌트 재사용
