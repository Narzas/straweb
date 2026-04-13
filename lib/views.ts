import { createServiceClient } from "@/lib/supabase";

/** 서버 사이드에서 여러 slug의 조회수를 한 번에 가져옴 */
export async function getViewCounts(
  slugs: string[]
): Promise<Record<string, number>> {
  if (!slugs.length) return {};
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("post_views")
      .select("slug, view_count")
      .in("slug", slugs);
    const result: Record<string, number> = {};
    for (const row of data ?? []) {
      result[row.slug] = row.view_count ?? 0;
    }
    return result;
  } catch {
    return {};
  }
}
