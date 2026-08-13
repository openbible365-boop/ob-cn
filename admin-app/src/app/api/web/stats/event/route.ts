export const runtime = "nodejs";

// 对应网页版原 POST /api/stats/event —— 阅读行为埋点。
//
// 网页版原本写入 user_action_logs 原始事件表，admin-app 目前没有对应的表：
// DailyMetric 是每日汇总快照（字段全为必填的统计结果），不能当事件流用。
// 这里先做成空实现让前端不报错，等补上事件表后再落库。
// 前端是 fire-and-forget，不读返回值，所以不影响任何功能。
export async function POST() {
  return Response.json({ ok: true });
}
