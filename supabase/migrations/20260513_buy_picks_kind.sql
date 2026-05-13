-- ========================================================
-- buy_picks v4:
--   kind 컬럼 추가 — 매수타점 vs 워치리스트 카테고리 분리
--   'match'          : 기존 매수타점 (점수≥70 + R/R≥1.5)
--   'gap_extended'   : GAP_UP_SUPPORT 패턴 매치 + R/R<1.5 (갭자리 후보)
--   'trend_extended' : 시세줌 + ABC 미완 + 패턴 매치 없음 (추세 진행 워치)
-- ========================================================

alter table buy_picks
  add column if not exists kind text not null default 'match';

create index if not exists idx_buy_picks_kind on buy_picks(kind);

-- 매수타점이 아닌 카테고리는 점수/RR/패턴 제약이 다르므로
-- 기존 unique key (date, ticker, pattern, timeframe) 그대로 사용 가능.
-- trend_extended는 pattern='TREND_EXTENDED' / timeframe='DAILY' 로 고정 저장 → 충돌 없음.
