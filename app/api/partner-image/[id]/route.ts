import { NextResponse } from "next/server";

const IMAGES: Record<string, string> = {
  rg40xxv:
    "https://image7.coupangcdn.com/image/affiliate/banner/8435a0f6659b4bd159c610105ceb6b0a@2x.jpg",
  rg34xxsp:
    "https://image1.coupangcdn.com/image/affiliate/banner/8cc51b6d5c32c2a7099502bf0e9f5dd8@2x.jpg",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = IMAGES[id];
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });

  const res = await fetch(url, {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok)
    return NextResponse.json({ error: "upstream error" }, { status: 502 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
