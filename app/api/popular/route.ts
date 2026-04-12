import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getAllPosts } from "@/lib/posts";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("post_views")
      .select("slug, view_count")
      .order("view_count", { ascending: false })
      .limit(5);

    if (error) throw error;

    const allPosts = getAllPosts();
    const postMap = new Map(allPosts.map((p) => [p.slug, p]));

    const popular = (data ?? [])
      .map((row) => {
        const post = postMap.get(row.slug);
        if (!post) return null;
        return {
          slug: row.slug,
          title: post.title,
          category: post.category,
          views: row.view_count as number,
        };
      })
      .filter(Boolean);

    return NextResponse.json(popular, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
