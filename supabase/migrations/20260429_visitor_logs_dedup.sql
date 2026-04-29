-- ========================================================
-- visitor_logs: 시간당 dedup UNIQUE 인덱스
-- 같은 IP가 같은 페이지를 1시간 내에 여러번 찍어도 1건만 기록
-- Vercel serverless 인메모리 rate-limit이 인스턴스별로 분산되는 문제를
-- DB-level UNIQUE 제약으로 atomic하게 해결
--
-- IMMUTABLE 표현식 트릭:
--   - date_trunc(text, timestamptz)는 STABLE (session timezone 의존)
--   - extract(epoch from timestamptz)도 STABLE
--   - 하지만 (ts at time zone 'UTC')는 IMMUTABLE (literal zone) → timestamp 반환
--   - date_trunc(text, timestamp)는 IMMUTABLE
--   → date_trunc('hour', ts at time zone 'UTC')는 IMMUTABLE 합성
-- ========================================================

-- 기존 중복 row 정리 (같은 시간버킷·ip·slug·path 중 가장 빠른 1건만 남김)
delete from visitor_logs v
using (
  select min(ts) as first_ts,
         ip_hash,
         coalesce(slug, '') as s,
         coalesce(path, '') as p,
         date_trunc('hour', ts at time zone 'UTC') as bucket
  from visitor_logs
  group by ip_hash,
           coalesce(slug, ''),
           coalesce(path, ''),
           date_trunc('hour', ts at time zone 'UTC')
  having count(*) > 1
) d
where v.ip_hash = d.ip_hash
  and coalesce(v.slug, '') = d.s
  and coalesce(v.path, '') = d.p
  and date_trunc('hour', v.ts at time zone 'UTC') = d.bucket
  and v.ts <> d.first_ts;

-- 시간당 1회 UNIQUE 인덱스 (UTC 시간버킷)
create unique index if not exists visitor_logs_hourly_dedup_idx
on visitor_logs (
  ip_hash,
  (coalesce(slug, '')),
  (coalesce(path, '')),
  (date_trunc('hour', ts at time zone 'UTC'))
);
