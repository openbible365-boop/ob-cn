import { auth } from "@/auth";

type Role = "SUPER_ADMIN" | "MODERATOR";

export async function requireRole(allowed: Role[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const role = session.user.role as Role | undefined;
  if (!role || !allowed.includes(role)) throw new Error("Forbidden");
  return session;
}
