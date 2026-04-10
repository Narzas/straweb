-- 방명록 테이블
create table if not exists guestbook (
  id          uuid        default gen_random_uuid() primary key,
  author      text        not null check (char_length(author) between 1 and 20),
  message     text        not null check (char_length(message) between 1 and 200),
  created_at  timestamptz default now() not null
);

-- RLS
alter table guestbook enable row level security;

create policy "public read guestbook"
  on guestbook for select using (true);

create policy "public insert guestbook"
  on guestbook for insert with check (true);
