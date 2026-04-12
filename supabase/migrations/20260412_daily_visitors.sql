-- 일별 방문자 테이블
create table if not exists daily_visitors (
  date   date primary key default current_date,
  count  int4 not null default 0
);

alter table daily_visitors enable row level security;

create policy "public read daily_visitors"
  on daily_visitors for select using (true);

create policy "service role all daily_visitors"
  on daily_visitors for all using (auth.role() = 'service_role');

-- increment_visitors RPC: 누적 + 오늘 동시 증가
create or replace function increment_visitors()
returns int4
language plpgsql
security definer
as $$
declare
  new_total int4;
begin
  update site_stats set visitor_count = visitor_count + 1 where id = 1;
  select visitor_count into new_total from site_stats where id = 1;

  insert into daily_visitors (date, count)
  values (current_date, 1)
  on conflict (date)
  do update set count = daily_visitors.count + 1;

  return new_total;
end;
$$;
