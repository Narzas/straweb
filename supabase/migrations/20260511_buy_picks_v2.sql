-- ========================================================
-- buy_picks v2:
--   detection_meta JSONB 컬럼 추가 (차트 검증용)
--   swing points 좌표 + 체크리스트 결과 저장
-- ========================================================

alter table buy_picks
  add column if not exists detection_meta jsonb;

-- 인덱스 (검증용 조회 최적화)
create index if not exists idx_buy_picks_meta on buy_picks using gin (detection_meta);
