import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { CreateEventControl } from "@/components/site/CreateEventControl";
import { toggleSignup } from "@/lib/actions/site/events";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function monthGrid(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { day: number; muted: boolean; key: string }[] = [];
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const day = daysInPrevMonth - i;
    cells.push({ day, muted: true, key: dateKey(month === 0 ? year - 1 : year, (month + 11) % 12, day) });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, muted: false, key: dateKey(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({ day, muted: true, key: dateKey(month === 11 ? year + 1 : year, (month + 1) % 12, day) });
  }
  return cells;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default async function CommunityEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<{ month?: string; event?: string }>;
}) {
  const { communityId } = await params;
  const { month: monthParam, event: eventParam } = await searchParams;
  const user = await requireUser();

  const community = await db.community.findUnique({ where: { id: communityId } });
  if (!community) notFound();

  const now = new Date();
  const [year, month] = monthParam
    ? monthParam.split("-").map((n) => Number(n))
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const monthIndex = month - 1;

  const rangeStart = new Date(Date.UTC(year, monthIndex - 1, 25));
  const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 6));

  const [membership, events] = await Promise.all([
    db.membership.findUnique({ where: { userId_communityId: { userId: user.id, communityId } } }),
    db.event.findMany({
      where: { communityId, startAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const eventsByDay = new Map<string, typeof events>();
  for (const e of events) {
    const key = e.startAt.toISOString().slice(0, 10);
    const list = eventsByDay.get(key) ?? [];
    list.push(e);
    eventsByDay.set(key, list);
  }

  const cells = monthGrid(year, monthIndex);
  const canManage = membership?.role === "OWNER" || membership?.role === "ADMIN";

  const prevMonthDate = new Date(Date.UTC(year, monthIndex - 1, 1));
  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const prevMonthParam = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextMonthParam = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const selectedEvent = eventParam ? events.find((e) => e.id === eventParam) : undefined;
  const selectedSignup = selectedEvent
    ? await db.eventSignup.findUnique({ where: { eventId_userId: { eventId: selectedEvent.id, userId: user.id } } })
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 28px 24px", minHeight: 0, overflow: "auto" }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{community.name} · 活动</div>
        <Link href={`/community/${communityId}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--body)" }}>← 返回社群</Link>
        <div style={{ flex: 1 }} />
        {canManage && <CreateEventControl communityId={communityId} />}
      </div>

      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{year} 年 {month} 月</div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href={`?month=${prevMonthParam}`} className="icon-btn" style={{ width: 28, height: 28, textDecoration: "none" }}>‹</Link>
          <Link href={`?month=${nextMonthParam}`} className="icon-btn" style={{ width: 28, height: 28, textDecoration: "none" }}>›</Link>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--body)" }}>本月 {events.filter((e) => e.startAt.getUTCFullYear() === year && e.startAt.getUTCMonth() === monthIndex).length} 场活动</div>
      </div>

      <div className="card" style={{ borderRadius: "16px 16px 0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--surface-2)" }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ padding: 10, textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--body)" }}>{w}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((cell) => {
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === now.toISOString().slice(0, 10);
            return (
              <div key={cell.key} style={{ borderRight: "1px solid var(--surface-2)", borderBottom: "1px solid var(--surface-2)", padding: 8, minHeight: 74, fontSize: 12, fontWeight: 600, color: cell.muted ? "var(--line)" : "var(--ink)" }}>
                {isToday ? (
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, background: "var(--ink)", color: "var(--yellow)", borderRadius: 100, fontSize: 12, fontWeight: 800 }}>{cell.day}</div>
                ) : (
                  cell.day
                )}
                {dayEvents.map((e) => (
                  <Link
                    key={e.id}
                    href={`?month=${year}-${String(month).padStart(2, "0")}&event=${e.id}`}
                    style={{
                      display: "block", marginTop: 4, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "3px 6px",
                      background: "rgba(191,120,246,.16)", color: "var(--purple)", textDecoration: "none",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                  >
                    {e.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <div className="card" style={{ marginTop: 12, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{selectedEvent.title}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)", marginBottom: 2 }}>
                开始：{selectedEvent.startAt.toISOString().slice(0, 16).replace("T", " ")}
              </div>
              {selectedEvent.endAt && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)" }}>
                  结束：{selectedEvent.endAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
              )}
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--body)", marginTop: 6 }}>已报名 {selectedEvent.signupCount} 人</div>
            </div>
            <form action={toggleSignup}>
              <input type="hidden" name="eventId" value={selectedEvent.id} />
              <input type="hidden" name="communityId" value={communityId} />
              <button
                type="submit"
                style={{
                  height: 40, padding: "0 18px", borderRadius: 100, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                  background: selectedSignup ? "var(--white)" : "var(--purple)",
                  color: selectedSignup ? "var(--ink)" : "#fff",
                  boxShadow: "var(--shadow-card)",
                  ...(selectedSignup ? { border: "1px solid var(--line)" } : {}),
                }}
              >
                {selectedSignup ? "取消报名" : "一键报名"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
