import { db } from "@/lib/db";

export const runtime = "nodejs";

// 对应网页版原 GET /api/media，返回蛇形字段的数组（前端按 m.media_type 过滤）。
export async function GET(request: Request) {
  const mediaType = new URL(request.url).searchParams.get("media_type")?.toUpperCase();
  const items = await db.mediaItem.findMany({
    where: {
      isActive: true,
      ...(mediaType === "VIDEO" || mediaType === "AUDIO" ? { mediaType } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return Response.json(
    items.map((item) => ({
      id: item.id,
      media_type: item.mediaType.toLowerCase(),
      title: item.title,
      series: item.series,
      category: item.category,
      duration: item.duration,
      teacher: item.teacher,
      description: item.description,
      cover_style: item.coverStyle,
      url: item.url,
    })),
  );
}
