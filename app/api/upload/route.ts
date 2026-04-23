import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

const BUCKET = "blog-images";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXT  = ["jpg", "jpeg", "png", "webp", "gif"];

/** 실제 파일 내용의 매직 바이트로 타입 검증 (Content-Type 스푸핑 방어) */
function validateMagicBytes(buffer: ArrayBuffer, mime: string): boolean {
  const b = new Uint8Array(buffer.slice(0, 12));
  switch (mime) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/webp":
      return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
             b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
    case "image/gif":
      return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
    default:
      return false;
  }
}

// POST /api/upload  (multipart/form-data, field: "file")
export async function POST(req: NextRequest) {
  // ── 어드민 인증 ──────────────────────────────────────────
  const adminToken = process.env.ADMIN_TOKEN;
  const authHeader = req.headers.get("Authorization");
  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // ── MIME 타입 화이트리스트 ──────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다. (jpg/png/webp/gif)" }, { status: 400 });
  }

  // ── 확장자 검증 ────────────────────────────────────────
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: "지원하지 않는 확장자입니다." }, { status: 400 });
  }

  // ── 파일 크기 ──────────────────────────────────────────
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // ── 매직 바이트 검증 (실제 파일 내용 확인) ──────────────
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json({ error: "파일 내용이 선언된 형식과 일치하지 않습니다." }, { status: 400 });
  }

  const safeExt = ext === "jpg" ? "jpeg" : ext;
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filename);

  if (!urlData?.publicUrl) {
    return NextResponse.json({ error: "URL을 가져올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json({ url: urlData.publicUrl }, { status: 201 });
}
