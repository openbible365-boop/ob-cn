import { db } from "@/lib/db";

const GENERIC_KNOWLEDGE_QUERY =
  /(?:群|社群|本群).{0,4}(?:资料|知识库)|(?:资料|知识库).{0,4}(?:回答|查找|搜索|里面|本群)/u;

function searchTokens(value: string) {
  const lower = value.toLocaleLowerCase();
  const tokens = new Set<string>();
  for (const match of lower.matchAll(/[a-z0-9][a-z0-9._-]{1,}|[\p{Script=Han}]{2,}/gu)) {
    const token = match[0];
    tokens.add(token);
    if (/^[\p{Script=Han}]+$/u.test(token)) {
      const chars = Array.from(token);
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.add(`${chars[index]}${chars[index + 1]}`);
      }
    }
  }
  return [...tokens].slice(0, 32);
}

function relevanceScore(
  resource: { title: string; description: string | null; contentText: string | null },
  tokens: string[],
) {
  const title = resource.title.toLocaleLowerCase();
  const description = (resource.description ?? "").toLocaleLowerCase();
  const content = (resource.contentText ?? "").toLocaleLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (description.includes(token)) score += 4;
    if (content.includes(token)) score += 1;
  }
  return score;
}

const TYPE_LABEL = {
  LINK: "链接",
  DOCUMENT: "文档",
  AUDIO: "音频",
  VIDEO: "视频",
  IMAGE: "图片",
  TEXT: "文本",
  OTHER: "文件",
} as const;

export async function communityKnowledgeContext(input: {
  communityId: string;
  query: string;
  includeAdminResources: boolean;
}) {
  const resources = await db.communityResource.findMany({
    where: {
      communityId: input.communityId,
      status: "ACTIVE",
      indexedAt: { not: null },
      ...(input.includeAdminResources
        ? {}
        : { visibility: "MEMBERS" as const }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      fileName: true,
      contentText: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  if (!resources.length) return "";

  const tokens = searchTokens(input.query);
  const genericQuery = GENERIC_KNOWLEDGE_QUERY.test(input.query);
  const ranked = resources
    .map((resource) => ({
      resource,
      score: relevanceScore(resource, tokens),
    }))
    .filter((item) => genericQuery || item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.resource.createdAt.getTime() -
          left.resource.createdAt.getTime(),
    )
    .slice(0, 5);
  if (!ranked.length) return "";

  let remaining = 7_000;
  const excerpts: string[] = [];
  for (const { resource } of ranked) {
    const header = `资料：${resource.title}\n类型：${TYPE_LABEL[resource.type]}${resource.fileName ? `（${resource.fileName}）` : ""}`;
    const body = [
      resource.description ? `说明：${resource.description}` : "",
      resource.contentText ? `内容：${resource.contentText}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const excerpt = `${header}${body ? `\n${body}` : ""}`.slice(
      0,
      Math.max(0, remaining),
    );
    if (!excerpt) break;
    excerpts.push(excerpt);
    remaining -= excerpt.length;
    if (remaining <= 0) break;
  }

  return `以下是仅属于当前社群的知识库检索结果。回答时优先依据这些资料，并用《资料标题》标明依据；资料没有明确说明的内容要如实说“不确定”，不要补造。

${excerpts.map((excerpt, index) => `[${index + 1}]\n${excerpt}`).join("\n\n")}`;
}
