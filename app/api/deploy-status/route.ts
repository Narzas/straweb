import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    return NextResponse.json({ building: false });
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=5`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!res.ok) return NextResponse.json({ building: false });

    const data = await res.json();
    const activeStates = ["BUILDING", "QUEUED", "INITIALIZING"];
    const building =
      data.deployments?.some((d: { state: string }) =>
        activeStates.includes(d.state)
      ) ?? false;

    return NextResponse.json({ building });
  } catch {
    return NextResponse.json({ building: false });
  }
}
