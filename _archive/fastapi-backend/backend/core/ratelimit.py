"""进程内滑动窗口限流（按键计数），作为 AI 接口滥用的兜底。

注意：状态保存在单进程内存中，多 worker / Serverless 多实例之间不共享。
作为「防刷兜底」已足够；若将来横向扩展，应改用 Redis 等共享存储。
"""
import time
from collections import deque, defaultdict
from threading import Lock

_BUCKETS: "defaultdict[str, deque]" = defaultdict(deque)
_LOCK = Lock()
_MAX_KEYS = 50000  # 防止不同键（IP）无限增长占内存


def hit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """记录一次命中。返回 (是否允许, 建议的 Retry-After 秒数)。

    在 window_seconds 时间窗内，同一 key 最多允许 limit 次。
    """
    now = time.time()
    cutoff = now - window_seconds
    with _LOCK:
        dq = _BUCKETS[key]
        while dq and dq[0] <= cutoff:
            dq.popleft()
        if len(dq) >= limit:
            retry = int(dq[0] + window_seconds - now) + 1
            return False, max(retry, 1)
        dq.append(now)
        if len(_BUCKETS) > _MAX_KEYS:
            _gc()
        return True, 0


def _gc() -> None:
    """清掉已空的桶，回收内存。"""
    for k in [k for k, d in _BUCKETS.items() if not d]:
        _BUCKETS.pop(k, None)
