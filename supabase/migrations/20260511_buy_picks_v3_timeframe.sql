-- ========================================================
-- buy_picks v3:
--   timeframe 컬럼 추가 (일·주·월·년봉 지원)
--   같은 종목이 여러 시간프레임에서 동시 매칭 가능
-- ========================================================

alter table buy_picks
  add column if not exists timeframe text not null default 'DAILY';

-- 기존 unique (date, ticker, pattern) → (date, ticker, pattern, timeframe)
alter table buy_picks drop constraint if exists buy_picks_date_ticker_pattern_key;

create unique index if not exists buy_picks_unique_key
  on buy_picks (date, ticker, pattern, timeframe);

create index if not exists idx_buy_picks_timeframe on buy_picks(timeframe);
