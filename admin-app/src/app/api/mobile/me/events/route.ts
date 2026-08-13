import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/current-user";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "未登录" },
      { status: 401 },
    );
  }

  const signups = await db.eventSignup.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          startAt: true,
          endAt: true,
          community: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              avatarColor: true,
            },
          },
        },
      },
    },
    orderBy: { event: { startAt: "asc" } },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    activities: signups.map(({ id, createdAt, event }) => ({
      signupId: id,
      signedUpAt: createdAt,
      ...event,
    })),
  });
}
