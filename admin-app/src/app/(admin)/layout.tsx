import { auth } from "@/auth";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="admin-shell">
      <AdminSidebar operatorName={session?.user?.name ?? "运营"} />
      <main className="admin-main">{children}</main>
    </div>
  );
}
