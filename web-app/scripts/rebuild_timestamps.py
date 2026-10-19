#!/usr/bin/env python3
"""
重建所有已缓存章节的时间戳 JSON 文件。

问题：旧时间戳使用 TTS API 的 addition.duration 估算值累加，
     存在系统性误差导致后半段跟读不同步。

解决：用 mutagen 逐节精确测量每节 MP3（需要整章音频拆分），
     但由于已拼接无法拆分，改为用整章音频总时长等比缩放重建时间戳。

策略：
  旧 start_i = sum(dur_0...dur_{i-1})   （基于 API 估算）
  新 start_i = 旧 start_i × (实际总时长 / 预期总时长)
  这样时间戳就与实际播放进度线性对齐。
"""
import json
import pathlib
from mutagen.mp3 import MP3

AUDIO_CACHE_DIR = pathlib.Path("data/audio/tts/doubao/cuv")

def rebuild_timestamps(mp3_path: pathlib.Path) -> bool:
    ts_path = mp3_path.with_suffix(".json")
    if not ts_path.exists():
        return False

    try:
        actual_duration = MP3(str(mp3_path)).info.length
    except Exception as e:
        print(f"  ⚠ 读取 MP3 失败 {mp3_path}: {e}")
        return False

    with open(ts_path, encoding="utf-8") as f:
        times = json.load(f)

    if not times:
        return False

    expected_total = times[-1]["end"]
    if expected_total <= 0:
        return False

    drift_factor = actual_duration / expected_total

    # 只有当漂移超过 0.3% 才重建（避免无意义写入）
    if abs(drift_factor - 1.0) < 0.003:
        return False

    new_times = []
    for t in times:
        new_times.append({
            "verse": t["verse"],
            "start": round(t["start"] * drift_factor, 4),
            "end": round(t["end"] * drift_factor, 4),
        })

    with open(ts_path, "w", encoding="utf-8") as f:
        json.dump(new_times, f, ensure_ascii=False)

    print(f"  ✓ {mp3_path.parent.name}/{mp3_path.stem}章  "
          f"预期:{expected_total:.2f}s → 实际:{actual_duration:.2f}s  "
          f"漂移:{(drift_factor-1)*100:+.2f}%  已重建")
    return True


def main():
    mp3_files = sorted(AUDIO_CACHE_DIR.rglob("*.mp3"))
    total = len(mp3_files)
    rebuilt = 0

    print(f"扫描 {total} 个已缓存章节...")
    for mp3 in mp3_files:
        if rebuild_timestamps(mp3):
            rebuilt += 1

    print(f"\n完成：共重建 {rebuilt}/{total} 个时间戳文件")


if __name__ == "__main__":
    main()
