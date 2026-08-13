"""
S3 音频路径迁移脚本
将现有 audio/tts/doubao/cuv/{book}/{ch}.mp3 复制到带声音标识的新路径：
  - 旧约 → cuv/male/{book}/{ch}.mp3    （开朗学长，旧约一贯如此）
  - 新约 → cuv/female/{book}/{ch}.mp3  （知性女声，当前新约录音）

原始文件不删除，纯复制。完成后确认无误再做后续步骤。

用法：
    backend/venv/bin/python scripts/migrate_voice_paths.py
    backend/venv/bin/python scripts/migrate_voice_paths.py --dry-run   # 只打印不操作
"""

import argparse
import os
import sys
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

# ── 配置 ──────────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET         = os.getenv("AWS_S3_BUCKET")
AWS_S3_REGION         = os.getenv("AWS_S3_REGION", "ap-southeast-1")

OLD_PREFIX = "audio/tts/doubao/cuv/"   # 现有路径前缀

# 新约书卷（与 tts.py 保持一致）
NEW_TESTAMENT_BOOKS = {
    "mat", "mrk", "luk", "jhn",
    "act",
    "rom", "1co", "2co", "gal", "eph",
    "php", "col", "1th", "2th", "1ti",
    "2ti", "tit", "phm",
    "heb",
    "jas", "1pe", "2pe",
    "1jn", "2jn", "3jn", "jud",
    "rev",
}


def get_voice(book: str) -> str:
    return "female" if book.lower() in NEW_TESTAMENT_BOOKS else "male"


def get_s3_client():
    return boto3.client(
        "s3",
        region_name=AWS_S3_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )


def list_existing_objects(client, prefix: str) -> list[dict]:
    """列出 S3 指定前缀下的所有对象"""
    objects = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=AWS_S3_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            objects.append(obj)
    return objects


def copy_object(client, src_key: str, dst_key: str, dry_run: bool) -> bool:
    """S3 内部 Copy（不产生流量费用）"""
    if dry_run:
        print(f"  [DRY] {src_key}\n       → {dst_key}")
        return True
    try:
        client.copy_object(
            Bucket=AWS_S3_BUCKET,
            CopySource={"Bucket": AWS_S3_BUCKET, "Key": src_key},
            Key=dst_key,
        )
        return True
    except ClientError as e:
        print(f"  ❌ 复制失败: {e}")
        return False


def run(dry_run: bool):
    if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET]):
        print("❗ 缺少 AWS 凭证，请检查 .env 文件")
        sys.exit(1)

    client = get_s3_client()

    print(f"\n🔍 扫描 S3 路径: s3://{AWS_S3_BUCKET}/{OLD_PREFIX}")
    objects = list_existing_objects(client, OLD_PREFIX)

    # 过滤出 mp3 和 json，排除已经迁移过的新路径（含 /male/ 或 /female/）
    targets = [
        o for o in objects
        if o["Key"].endswith(".mp3") or o["Key"].endswith(".json")
        if "/male/" not in o["Key"] and "/female/" not in o["Key"]
    ]

    print(f"   找到 {len(targets)} 个待迁移文件\n{'─'*60}")

    success = skip = fail = 0

    for obj in targets:
        src_key = obj["Key"]
        # 解析路径：audio/tts/doubao/cuv/{book}/{chapter}.ext
        rel = src_key[len(OLD_PREFIX):]          # e.g. mat/1.mp3
        parts = rel.split("/")
        if len(parts) != 2:
            print(f"  ⚠️  路径格式异常，跳过: {src_key}")
            skip += 1
            continue

        book, filename = parts[0], parts[1]
        voice = get_voice(book)

        # 新路径：audio/tts/doubao/cuv/{voice}/{book}/{chapter}.ext
        dst_key = f"audio/tts/doubao/cuv/{voice}/{book}/{filename}"

        # 检查目标是否已存在，避免重复复制
        try:
            client.head_object(Bucket=AWS_S3_BUCKET, Key=dst_key)
            print(f"  ⏭  已存在，跳过: {dst_key}")
            skip += 1
            continue
        except ClientError:
            pass  # 不存在，正常继续

        ok = copy_object(client, src_key, dst_key, dry_run)
        if ok:
            success += 1
            tag = "[DRY]" if dry_run else "✅"
            print(f"  {tag}  {book}/{filename} → {voice}/{book}/{filename}")
        else:
            fail += 1

    print(f"\n{'─'*60}")
    print(f"完成！✅ 复制 {success}个  ⏭ 跳过 {skip}个  ❌ 失败 {fail}个")
    if not dry_run:
        print("\n⚠️  原始文件未删除，确认新路径正常后可手动清理旧文件")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="迁移 S3 音频路径，加入 voice 子目录")
    parser.add_argument("--dry-run", action="store_true", help="只打印计划，不实际操作")
    args = parser.parse_args()

    run(dry_run=args.dry_run)
