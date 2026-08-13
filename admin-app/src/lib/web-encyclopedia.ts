// 百科条目 → 网页版字段名的序列化（entries 列表与详情两条路由共用）。
// 原先放在 route 文件里 export，Next 生产构建禁止路由文件导出非路由字段，移到 lib。

/** 三语字段回落：某种语言缺内容时用中文顶上，避免前端出现空白卡片。 */
export function serializeEntry(
  entry: {
    id: string;
    entryType: string;
    category: string | null;
    indexLetter: string | null;
    coverStyle: string | null;
    author: string | null;
    titleZh: string | null;
    titleEn: string | null;
    titleKo: string | null;
    summaryZh: string | null;
    summaryEn: string | null;
    summaryKo: string | null;
    contentZh?: string | null;
    contentEn?: string | null;
    contentKo?: string | null;
  },
  withContent: boolean,
) {
  return {
    id: entry.id,
    entry_type: entry.entryType.toLowerCase(),
    category: entry.category,
    index_letter: entry.indexLetter,
    cover_style: entry.coverStyle,
    author: entry.author,
    title_zh: entry.titleZh,
    title_en: entry.titleEn,
    title_ko: entry.titleKo,
    summary_zh: entry.summaryZh,
    summary_en: entry.summaryEn,
    summary_ko: entry.summaryKo,
    ...(withContent
      ? {
          content_zh: entry.contentZh ?? null,
          content_en: entry.contentEn ?? null,
          content_ko: entry.contentKo ?? null,
        }
      : {}),
  };
}
