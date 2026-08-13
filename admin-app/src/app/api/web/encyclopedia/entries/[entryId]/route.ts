import { db } from "@/lib/db";
import { serializeEntry } from "@/lib/web-encyclopedia";
import { jsonError } from "@/lib/web-compat";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ entryId: string }> };

// 对应网页版原 GET /api/encyclopedia/entries/{id} —— 详情带正文。
export async function GET(_request: Request, { params }: RouteParams) {
  const { entryId } = await params;
  const entry = await db.encyclopediaEntry.findFirst({
    where: { id: entryId, isActive: true },
  });
  if (!entry) return jsonError("条目不存在", 404);
  return Response.json(serializeEntry(entry, true));
}
