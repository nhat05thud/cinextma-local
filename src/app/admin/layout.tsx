import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Quản trị", template: "%s | Quản trị" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
