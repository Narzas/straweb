import { getAllTags } from "@/lib/posts";
import { NextResponse } from "next/server";

export const revalidate = 3600;

export function GET() {
  return NextResponse.json(getAllTags());
}
