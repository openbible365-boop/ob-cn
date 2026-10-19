import { GET as listEntries } from "../entries/route";

export const runtime = "nodejs";

// 对应网页版原 GET /api/encyclopedia/dict —— 词典分页，
// 与 /entries?entry_type=dictionary 同一套逻辑，固定返回 {total, items}。
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("entry_type", "dictionary");
  return listEntries(new Request(url, request));
}
