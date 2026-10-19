import { db } from "@/lib/db";

export const runtime = "nodejs";

// 对应网页版原 GET /api/spiritual/stages?category=general|verse_drawer
// 前端直接把返回值当数组用，每个阶段带 questions。
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("category") ?? "general";
  const stages = await db.spiritualStage.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      questions: {
        where: { isActive: true, category },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return Response.json(
    stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      description: stage.description,
      sort_order: stage.sortOrder,
      questions: stage.questions.map((question) => ({
        id: question.id,
        question_text: question.questionText,
        category: question.category,
        description: question.description,
        sort_order: question.sortOrder,
      })),
    })),
  );
}
