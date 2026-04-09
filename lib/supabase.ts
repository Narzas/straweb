import { createClient } from "@supabase/supabase-js";

/** 클라이언트 사이드 / 서버 사이드 공용 (anon key) */
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase env vars are not set.");
  return createClient(url, anon);
}

/** 서버 전용 (Route Handler — service role key) */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service env vars are not set.");
  return createClient(url, key);
}
