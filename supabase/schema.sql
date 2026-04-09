-- ========================================================
-- comments 테이블
-- Supabase 대시보드 > SQL Editor에서 실행하세요
-- ========================================================

create table if not exists comments (
  id            uuid primary key default gen_random_uuid(),
  post_slug     text not null,
  author        text not null,
  content       text not null,
  is_secret     boolean not null default false,
  password_hash text,                     -- 비밀글 전용 (bcrypt hash)
  created_at    timestamptz default now() not null
);

-- 슬러그별 조회 인덱스
create index if not exists idx_comments_post_slug on comments(post_slug);

-- RLS 활성화
alter table comments enable row level security;

-- 모든 사람이 일반 댓글 조회 가능
create policy "public read non-secret"
  on comments for select
  using (is_secret = false);

-- 인증 없이도 댓글 작성 가능 (anon key 허용)
create policy "public insert"
  on comments for insert
  with check (true);

-- 삭제는 service role만 (관리자)
create policy "service role delete"
  on comments for delete
  using (auth.role() = 'service_role');


-- ========================================================
-- Storage bucket (이미지 업로드)
-- ========================================================

-- Supabase 대시보드 > Storage > New bucket
-- 이름: blog-images
-- Public: true

-- 또는 SQL:
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict do nothing;

create policy "public read blog-images"
  on storage.objects for select
  using (bucket_id = 'blog-images');

create policy "public upload blog-images"
  on storage.objects for insert
  with check (bucket_id = 'blog-images');

create policy "service role delete blog-images"
  on storage.objects for delete
  using (bucket_id = 'blog-images' and auth.role() = 'service_role');
