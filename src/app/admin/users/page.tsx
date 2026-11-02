import UsersManager from "@/components/admin/manage/UsersManager";
import { listUsers } from "@/server/queries/admin";
import { requireAdminPage } from "@/server/session";

export const metadata = { title: "Người dùng" };

export default async function UsersPage() {
  const [session, users] = await Promise.all([requireAdminPage(), listUsers()]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Người dùng</h1>
      <UsersManager users={users} currentUserId={session.user.id} />
    </div>
  );
}
