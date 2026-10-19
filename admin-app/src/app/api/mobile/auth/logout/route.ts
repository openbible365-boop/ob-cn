import { NextResponse } from "next/server";
import { destroySession } from "@/lib/current-user";

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
