import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthed())) redirect("/");
  return <>{children}</>;
}
