import { redirect } from "next/navigation";

// (site) 用户界面已下线：C 端由 mobile-app（App）与 /read（网页版）承载，
// 本服务的页面只保留后台管理。
export default function HomePage() {
  redirect("/admin");
}
