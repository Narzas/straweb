-- ========================================================
-- 매수타점 시스템 (/admin/picks)
--
-- 한국 주식 차트 패턴 기반 매수타점 자동 탐지
-- 데이터 소스: pykrx (Python 스크립트, 일 1회 cron)
-- 패턴: Double Bottom, Inverse H&S, Cup with Handle, Elliott Wave,
--       High Wave, Doji (보조)
--
-- 필터 정책:
--  - 시가총액 1000억 이상
--  - 엔터/게임/정치테마/세력주 제외
--  - 년·월·일봉 우상향
--  - 240일선 위
--  - 시세 준 종목은 ABC 조정 완료 검증
-- ========================================================

-- 1) 종목 메타 (분기 단위 갱신)
create table if not exists stocks (
  ticker          text primary key,            -- "005930"
  name            text not null,               -- "삼성전자"
  market          text not null,               -- "KOSPI" | "KOSDAQ"
  sector          text,                        -- KRX 업종
  listed_at       date,                        -- 상장일 (10년 검증용)
  is_excluded     boolean not null default false,
  exclude_reason  text,                        -- "ENTERTAINMENT" | "GAME" | "POLITICAL" | "MANIPULATION" | "DELISTED" | "WATCHLIST"
  updated_at      timestamptz not null default now()
);

create index if not exists idx_stocks_market on stocks(market);
create index if not exists idx_stocks_excluded on stocks(is_excluded);

-- 2) 일봉 데이터 (10년치 누적, ~600만 row 예상)
create table if not exists daily_ohlcv (
  ticker      text not null,
  date        date not null,
  open        numeric(14, 2) not null,
  high        numeric(14, 2) not null,
  low         numeric(14, 2) not null,
  close       numeric(14, 2) not null,
  volume      bigint not null,
  market_cap  numeric(20, 0),                  -- 매일 갱신 (원 단위)
  primary key (ticker, date)
);

create index if not exists idx_daily_ohlcv_date on daily_ohlcv(date desc);
create index if not exists idx_daily_ohlcv_ticker_date on daily_ohlcv(ticker, date desc);

-- 3) 명시적 제외 리스트
--    엔터/게임/정치테마는 수동 입력 + 일부 자동 감지
create table if not exists excluded_tickers (
  ticker      text primary key,
  category    text not null,                   -- "ENTERTAINMENT" | "GAME" | "POLITICAL" | "MANIPULATION"
  reason      text,
  added_at    timestamptz not null default now()
);

create index if not exists idx_excluded_category on excluded_tickers(category);

-- 4) 탐지 결과 (매일 신규 row 추가)
create table if not exists buy_picks (
  id              bigserial primary key,
  date            date not null,               -- 탐지 기준일 (장마감 후 일자)
  ticker          text not null,
  pattern         text not null,               -- "DOUBLE_BOTTOM" | "INVERSE_HS" | "CUP_HANDLE" | "ELLIOTT_W2" | "ELLIOTT_W4"
  score           integer not null,            -- 0-100 (70+만 UI 노출)
  entry_price     numeric(14, 2) not null,
  current_price   numeric(14, 2),
  target_price    numeric(14, 2),
  stop_loss       numeric(14, 2),
  candle_confirm  text,                        -- "DRAGONFLY_DOJI" | "HIGH_WAVE" | "LONG_LEGGED_DOJI" | null
  note            text,                        -- 자동 생성 코멘트 (한글)

  -- 검증 정보 (디버깅 + 카드 표시용)
  trend_yearly    text,                        -- "UP" | "FLAT" | "DOWN"
  trend_monthly   text,
  ma240_position  text,                        -- "ABOVE" | "BELOW"
  rrr             numeric(5, 2),               -- Risk-Reward Ratio
  pattern_height  numeric(14, 2),              -- 패턴 높이 (measured move 계산용)

  generated_at    timestamptz not null default now(),

  -- 같은 날 같은 종목+패턴 중복 방지
  unique (date, ticker, pattern)
);

create index if not exists idx_buy_picks_date on buy_picks(date desc);
create index if not exists idx_buy_picks_date_score on buy_picks(date desc, score desc);
create index if not exists idx_buy_picks_ticker on buy_picks(ticker);

-- 5) 일일 실행 로그 (cron 모니터링용)
create table if not exists buy_picks_runs (
  id              bigserial primary key,
  run_date        date not null,
  stage           text not null,               -- "FETCH" | "FILTER" | "DETECT"
  status          text not null,               -- "OK" | "PARTIAL" | "ERROR"
  duration_sec    integer,
  fetched_count   integer,                     -- FETCH 단계: 수집한 종목 수
  filtered_count  integer,                     -- FILTER 단계: 통과한 종목 수
  picks_count     integer,                     -- DETECT 단계: 생성된 picks 수
  message         text,                        -- 에러/경고 메시지
  created_at      timestamptz not null default now()
);

create index if not exists idx_buy_picks_runs_date on buy_picks_runs(run_date desc);

-- ========================================================
-- 초기 제외 리스트 시드 (대표 엔터/게임/정치테마)
-- 추후 운영하며 추가
-- ========================================================
insert into excluded_tickers (ticker, category, reason) values
  -- 엔터테인먼트
  ('352820', 'ENTERTAINMENT', '하이브'),
  ('041510', 'ENTERTAINMENT', 'SM'),
  ('035900', 'ENTERTAINMENT', 'JYP Ent.'),
  ('122870', 'ENTERTAINMENT', 'YG PLUS'),
  ('253450', 'ENTERTAINMENT', '스튜디오드래곤'),
  ('182360', 'ENTERTAINMENT', '큐브엔터'),
  ('173940', 'ENTERTAINMENT', 'FNC엔터'),

  -- 게임
  ('036570', 'GAME', '엔씨소프트'),
  ('251270', 'GAME', '넷마블'),
  ('259960', 'GAME', '크래프톤'),
  ('263750', 'GAME', '펄어비스'),
  ('293490', 'GAME', '카카오게임즈'),
  ('095660', 'GAME', '네오위즈'),
  ('112040', 'GAME', '위메이드'),
  ('194480', 'GAME', '데브시스터즈'),
  ('035600', 'GAME', 'KG모빌리언스'),  -- 일부 게임 관련
  ('192080', 'GAME', '더블유게임즈')

on conflict (ticker) do nothing;
