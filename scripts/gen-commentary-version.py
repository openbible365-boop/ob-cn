#!/usr/bin/env python3
"""生成注释数据的版本指纹 data/commentary/jingdu/version.json。

每次更新注释内容后运行一次：
    python3 scripts/gen-commentary-version.py

App 端用它判断"精读本注释有更新"：已下载用户会在资源管理里看到更新提醒。
指纹 = 66 个 JSON 文件内容的 SHA-256 摘要前 12 位，内容不变则版本不变。
"""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "data" / "commentary" / "jingdu"
digest = hashlib.sha256()
for i in range(1, 67):
    digest.update((root / f"{i}.json").read_bytes())
version = digest.hexdigest()[:12]
out = root / "version.json"
out.write_text(json.dumps({"version": version}) + "\n", encoding="utf-8")
print(f"{out}: {version}")
