"""
批量上传本地已存在的 TTS 音频文件到 AWS S3，并将记录写入数据库

扫描 data/audio/tts/doubao/cuv/ 目录下的所有 MP3 和 JSON 文件对，
逐一上传到 S3，然后将 S3 URL + timestamps 写入 chapter_audios 数据库。

使用方法：
    python scripts/batch_upload_s3.py [--dry-run] [--force] [--workers N] [--skip-db]

参数：
    --dry-run    : 仅打印会上传的文件，不实际上传，不写库
    --force      : 强制覆盖 S3 已有文件（数据库记录始终更新）
    --workers N  : 并发线程数（默认 8）
    --skip-db    : 上传 S3 后跳过写库步骤

前提条件：
    1. 已安装 boto3: pip install boto3
    2. .env 中已配置 AWS_* 变量
    3. S3 Bucket 已开启公共读取策略

上传路径规则：
    本地 MP3 : data/audio/tts/doubao/cuv/{book}/{chapter}.mp3
    本地 JSON : data/audio/tts/doubao/cuv/{book}/{chapter}.json
    S3 Key   : audio/tts/doubao/cuv/{book}/{chapter}.mp3 / .json
    DB       : chapter_audios(version='cuv', book, chapter, audio_url, timestamps)
"""

import sys
import os
import asyncio
import argparse
import json
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# 添加项目根目录到 Python 路径
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.core.config import settings

# ── 日志配置 ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── 本地音频根目录 ─────────────────────────────────────────
LOCAL_AUDIO_DIR = ROOT_DIR / "data" / "audio" / "tts" / "doubao" / "cuv"
S3_KEY_PREFIX = "audio/tts/doubao/cuv"

CONTENT_TYPE_MAP = {
    ".mp3": "audio/mpeg",
    ".json": "application/json",
}


def _get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _get_s3_public_url(key: str) -> str:
    bucket = settings.AWS_S3_BUCKET
    region = settings.AWS_S3_REGION
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _s3_object_exists(client, key: str) -> bool:
    try:
        client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        return True
    except Exception:
        return False


def _is_real_mp3(path: Path) -> bool:
    """判断文件是否为真实 MP3（而非 Git LFS 指针文件）"""
    if not path.exists() or path.stat().st_size < 10240:
        return False
    try:
        header = path.read_bytes()[:32]
        return not header.startswith(b'version https://git-lfs')
    except Exception:
        return False


def _upload_file(client, key: str, data: bytes, content_type: str) -> None:
    """上传到 S3，兼容 ACL 开关"""
    try:
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
            ACL="public-read",
        )
    except Exception:
        # HACK: Bucket 关闭对象 ACL 时回退
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )


def _collect_chapters() -> list[dict]:
    """
    扫描本地目录，收集所有 MP3+JSON 配对的章。

    Returns:
        [{book, chapter, mp3_path, json_path}, ...]
    """
    if not LOCAL_AUDIO_DIR.exists():
        logger.error(f"本地音频目录不存在: {LOCAL_AUDIO_DIR}")
        return []

    chapters = []
    for book_dir in sorted(LOCAL_AUDIO_DIR.iterdir()):
        if not book_dir.is_dir():
            continue
        book = book_dir.name

        # 找出所有真实 MP3 章节
        for mp3_path in sorted(book_dir.glob("*.mp3")):
            if not _is_real_mp3(mp3_path):
                logger.warning(f"跳过 LFS 指针: {book}/{mp3_path.name}")
                continue

            chapter_num = mp3_path.stem
            json_path = mp3_path.with_suffix(".json")

            if not json_path.exists():
                logger.warning(f"缺少 JSON 文件，跳过: {book}/{chapter_num}")
                continue

            chapters.append({
                "book": book,
                "chapter": int(chapter_num),
                "mp3_path": mp3_path,
                "json_path": json_path,
            })

    return chapters


def _upload_chapter(client, item: dict, force: bool) -> tuple[str, str, list]:
    """
    上传一个章的 MP3 + JSON 到 S3。

    Returns:
        (status, s3_mp3_url, timestamps_list)
        status: "uploaded" | "skipped" | "error"
    """
    book = item["book"]
    chapter = item["chapter"]
    mp3_path: Path = item["mp3_path"]
    json_path: Path = item["json_path"]

    mp3_key = f"{S3_KEY_PREFIX}/{book}/{chapter}.mp3"
    ts_key = f"{S3_KEY_PREFIX}/{book}/{chapter}.json"
    s3_url = _get_s3_public_url(mp3_key)

    try:
        mp3_exists = _s3_object_exists(client, mp3_key)
        ts_exists = _s3_object_exists(client, ts_key)

        if not force and mp3_exists and ts_exists:
            # 读取本地 JSON 返回（跳过上传，但仍需写库）
            timestamps = json.loads(json_path.read_text(encoding="utf-8"))
            return "skipped", s3_url, timestamps

        # 上传 MP3
        _upload_file(client, mp3_key, mp3_path.read_bytes(), "audio/mpeg")
        # 上传 JSON
        _upload_file(client, ts_key, json_path.read_bytes(), "application/json")

        timestamps = json.loads(json_path.read_text(encoding="utf-8"))
        return "uploaded", s3_url, timestamps

    except Exception as e:
        logger.error(f"上传失败 {book}/{chapter}: {e}")
        return "error", s3_url, []


async def _write_db_records(records: list[dict]) -> tuple[int, int]:
    """
    批量写入 chapter_audios 数据库记录。
    NOTE: 每 20 条提交一次，避免单个大事务长时间持有 SQLite 锁导致卡死

    Args:
        records: [{book, chapter, audio_url, timestamps}, ...]
    Returns:
        (created_count, updated_count)
    """
    from backend.core.database import AsyncSessionLocal
    from backend.model.chapter_audio import ChapterAudio
    from sqlalchemy import select

    BATCH_SIZE = 20
    created = updated = 0

    async with AsyncSessionLocal() as db:
        for idx, rec in enumerate(records, 1):
            try:
                ts_json = json.dumps(rec["timestamps"], ensure_ascii=False)

                result = await db.execute(
                    select(ChapterAudio).where(
                        ChapterAudio.version == "cuv",
                        ChapterAudio.book == rec["book"],
                        ChapterAudio.chapter == rec["chapter"],
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    existing.audio_url = rec["audio_url"]
                    existing.timestamps = ts_json
                    updated += 1
                else:
                    db.add(ChapterAudio(
                        version="cuv",
                        book=rec["book"],
                        chapter=rec["chapter"],
                        audio_url=rec["audio_url"],
                        timestamps=ts_json,
                    ))
                    created += 1

                # 每 BATCH_SIZE 条提交一次
                if idx % BATCH_SIZE == 0:
                    await db.commit()
                    logger.info(f"  💾 已写入 {idx}/{len(records)} 条...")

            except Exception as e:
                logger.error(f"DB 写入失败 {rec['book']}/{rec['chapter']}: {e}")
                await db.rollback()

        # 最后一批
        try:
            await db.commit()
            logger.info(f"  💾 写入完成，共 {len(records)} 条")
        except Exception as e:
            logger.error(f"最终提交失败: {e}")

    return created, updated


def main():
    parser = argparse.ArgumentParser(description="批量上传本地 TTS 音频到 AWS S3 并写入数据库")
    parser.add_argument("--dry-run", action="store_true", help="只打印待上传文件，不实际上传，不写库")
    parser.add_argument("--force", action="store_true", help="强制覆盖 S3 已有文件")
    parser.add_argument("--workers", type=int, default=8, help="并发线程数（默认 8）")
    parser.add_argument("--skip-db", action="store_true", help="跳过数据库写入步骤")
    parser.add_argument(
        "--books", type=str, default="",
        help="只处理指定书卷，逗号分隔，例如: --books mrk,mat,jhn,jas,1jn,2jn,3jn"
    )
    args = parser.parse_args()

    # ── 校验配置 ──────────────────────────────────────────
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY or not settings.AWS_S3_BUCKET:
        logger.error(
            "AWS S3 凭证未配置！请在 .env 中填写：\n"
            "  AWS_ACCESS_KEY_ID=...\n"
            "  AWS_SECRET_ACCESS_KEY=...\n"
            "  AWS_S3_BUCKET=...\n"
            "  AWS_S3_REGION=...（可选，默认 us-east-1）"
        )
        sys.exit(1)

    logger.info(f"🪣 目标 Bucket : {settings.AWS_S3_BUCKET} ({settings.AWS_S3_REGION})")
    logger.info(f"📂 本地源目录 : {LOCAL_AUDIO_DIR}")

    # ── 收集章节 ──────────────────────────────────────────
    chapters = _collect_chapters()
    if not chapters:
        logger.warning("未找到任何可上传的章节（需要 MP3 + JSON 配对），退出。")
        return

    # NOTE: --books 参数过滤，只处理指定书卷
    if args.books:
        filter_books = {b.strip().lower() for b in args.books.split(",") if b.strip()}
        chapters = [c for c in chapters if c["book"] in filter_books]
        logger.info(f"🔍 --books 过滤: 只处理 {sorted(filter_books)}，剩余 {len(chapters)} 个章节")

    logger.info(f"📦 共发现 {len(chapters)} 个章节（MP3+JSON 配对）")


    if args.dry_run:
        logger.info("🏜️  [dry-run 模式] 以下章节将被上传和写库：")
        for item in chapters:
            mp3_key = f"{S3_KEY_PREFIX}/{item['book']}/{item['chapter']}.mp3"
            url = _get_s3_public_url(mp3_key)
            size_kb = item["mp3_path"].stat().st_size // 1024
            print(f"  cuv/{item['book']:6s}/{item['chapter']:3d}  ({size_kb:6d} KB)  → {url}")
        return

    # ── 并发上传 S3 ───────────────────────────────────────
    logger.info(f"🚀 开始上传（并发线程: {args.workers}，force={args.force}）...")

    client = _get_s3_client()
    uploaded = skipped = errors = 0
    db_records: list[dict] = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        future_map = {
            executor.submit(_upload_chapter, client, item, args.force): item
            for item in chapters
        }

        for i, future in enumerate(as_completed(future_map), 1):
            item = future_map[future]
            book, chapter = item["book"], item["chapter"]
            try:
                status, s3_url, timestamps = future.result()
                if status in ("uploaded", "skipped"):
                    if status == "uploaded":
                        uploaded += 1
                        logger.info(f"[{i:4d}/{len(chapters)}] ✅ {book}/{chapter} → {s3_url}")
                    else:
                        skipped += 1
                        logger.debug(f"[{i:4d}/{len(chapters)}] ⏭️  跳过: {book}/{chapter}")

                    # 无论上传还是跳过，都收集 DB 记录
                    if not args.skip_db:
                        db_records.append({
                            "book": book,
                            "chapter": chapter,
                            "audio_url": s3_url,
                            "timestamps": timestamps,
                        })
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                logger.error(f"[{i:4d}/{len(chapters)}] ✖️  异常: {book}/{chapter} → {e}")

    # ── 写入数据库 ────────────────────────────────────────
    db_created = db_updated = 0
    if db_records and not args.skip_db:
        logger.info(f"💾 开始写入数据库（{len(db_records)} 条记录）...")
        db_created, db_updated = asyncio.run(_write_db_records(db_records))

    # ── 汇总报告 ──────────────────────────────────────────
    logger.info(
        f"\n{'─' * 60}\n"
        f"🎉 全部完成！\n"
        f"  S3 上传   ✅ {uploaded} 个 / ⏭️ {skipped} 个跳过 / ✖️ {errors} 个失败\n"
        f"  数据库    🆕 新建: {db_created} / 🔄 更新: {db_updated}\n"
        f"  Bucket    https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/\n"
        f"{'─' * 60}"
    )

    if errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
