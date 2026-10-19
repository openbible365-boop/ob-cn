import { useLocation, useNavigate } from "react-router-dom";

// 统一的「返回」策略：有站内历史就真的后退（不再往历史里堆新条目），
// 深链直达、没有历史可退时才去兜底路由。
// location.key === "default" 表示这是本次会话的第一条历史记录。
export function useAppBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== "default") navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
