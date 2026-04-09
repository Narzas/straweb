import type { Metadata } from "next";
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

export const metadata: Metadata = {
  title: "Posts",
  description: "All blog posts on StraWeb.",
  alternates: {
    canonical: "/posts",
  },
  openGraph: {
    title: "Posts",
    description: "All blog posts on StraWeb.",
    type: "website",
    url: "/posts",
  },
};

export default async function PostsPage() {
  const posts = getAllPosts();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Posts</h1>
        <p className="text-gray-500">{posts.length} posts total</p>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2">
        {posts.map((post, i) => (
          <li key={post.slug}>
            <PostCard post={post} priority={i < 2} />
          </li>
        ))}
      </ul>
    </div>
  );
}
