import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export default async function CommunityIndexPage() {
  const user = await requireUser();
  const firstMembership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
  });

  if (firstMembership) {
    redirect(`/community/${firstMembership.communityId}`);
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--body)", fontSize: 14 }}>
      你还没有加入任何社群。
    </div>
  );
}
