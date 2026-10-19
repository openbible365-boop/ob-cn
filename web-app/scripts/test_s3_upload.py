"""
S3 上传功能测试脚本（单章节）

选取 mar/1（马可福音第1章）作为测试样本，完整跑通：
  1. 上传 MP3 到 S3
  2. 上传 timestamps JSON 到 S3
  3. 验证 S3 公开 URL 可访问
  4. 写入 chapter_audios 数据库
  5. 从数据库回读验证

运行方式：
    python3 scripts/test_s3_upload.py
"""

import sys
import asyncio
import json
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── 测试目标：腓利门书（phm）第 1 章 ─────────────────────────
TEST_BOOK    = "phm"
TEST_CHAPTER = 1
VERSION      = "cuv"

LOCAL_MP3  = ROOT_DIR / "data" / "audio" / "tts" / "doubao" / VERSION / TEST_BOOK / f"{TEST_CHAPTER}.mp3"
LOCAL_JSON = LOCAL_MP3.with_suffix(".json")
S3_MP3_KEY = f"audio/tts/doubao/{VERSION}/{TEST_BOOK}/{TEST_CHAPTER}.mp3"
S3_TS_KEY  = f"audio/tts/doubao/{VERSION}/{TEST_BOOK}/{TEST_CHAPTER}.json"


def _get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _get_public_url(key: str) -> str:
    bucket = settings.AWS_S3_BUCKET
    region = settings.AWS_S3_REGION
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def step_check_local():
    """Step 1：确认本地文件存在"""
    print("\n" + "─" * 50)
    print("📁 Step 1：检查本地文件")

    assert LOCAL_MP3.exists(),  f"MP3 不存在：{LOCAL_MP3}"
    assert LOCAL_JSON.exists(), f"JSON 不存在：{LOCAL_JSON}"

    mp3_kb  = LOCAL_MP3.stat().st_size  // 1024
    json_kb = LOCAL_JSON.stat().st_size // 1024
    print(f"  ✅ MP3  : {LOCAL_MP3.name}  ({mp3_kb} KB)")
    print(f"  ✅ JSON : {LOCAL_JSON.name} ({json_kb} KB)")

    # 读取 timestamps 预览
    ts = json.loads(LOCAL_JSON.read_text(encoding="utf-8"))
    print(f"  📌 timestamps 共 {len(ts)} 节，首节: {ts[0]}")
    return ts


def step_upload_s3(timestamps: list):
    """Step 2：上传 MP3 + JSON 到 S3"""
    print("\n" + "─" * 50)
    print("☁️  Step 2：上传到 S3")

    client = _get_s3_client()
    bucket = settings.AWS_S3_BUCKET

    def upload(key, data, content_type):
        try:
            client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type, ACL="public-read")
        except Exception:
            # Bucket 关闭 ACL 时回退
            client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        print(f"  ✅ 已上传: s3://{bucket}/{key}")

    upload(S3_MP3_KEY, LOCAL_MP3.read_bytes(), "audio/mpeg")
    upload(S3_TS_KEY,  LOCAL_JSON.read_bytes(), "application/json")

    mp3_url = _get_public_url(S3_MP3_KEY)
    print(f"\n  🌐 公开 URL:\n     {mp3_url}")
    return mp3_url


def step_verify_s3(mp3_url: str):
    """Step 3：用 HTTP HEAD 验证 S3 URL 可访问"""
    print("\n" + "─" * 50)
    print("🔍 Step 3：验证 S3 公开 URL 可访问性")

    import urllib.request
    try:
        req = urllib.request.Request(mp3_url, method="HEAD")
        with urllib.request.urlopen(req, timeout=10) as resp:
            content_length = resp.headers.get("Content-Length", "未知")
            content_type   = resp.headers.get("Content-Type", "未知")
            print(f"  ✅ HTTP {resp.status}")
            print(f"     Content-Type  : {content_type}")
            print(f"     Content-Length: {content_length} bytes")
    except Exception as e:
        print(f"  ❌ URL 无法访问: {e}")
        print("     请检查 S3 Bucket Policy 是否已开启公共读取！")
        print("     所需 Policy 参考 .env.example 中的注释")


async def step_write_db(mp3_url: str, timestamps: list):
    """Step 4：写入 chapter_audios 数据库"""
    print("\n" + "─" * 50)
    print("💾 Step 4：写入数据库")

    from backend.core.database import AsyncSessionLocal
    from backend.repository import chapter_audio as audio_repo
    from backend.schema.chapter_audio import ChapterAudioCreate, ChapterAudioUpdate

    ts_json = json.dumps(timestamps, ensure_ascii=False)

    async with AsyncSessionLocal() as db:
        existing = await audio_repo.get_audio(db, version=VERSION, book=TEST_BOOK, chapter=TEST_CHAPTER)
        if existing:
            await audio_repo.update_audio(
                db, db_obj=existing,
                obj_in=ChapterAudioUpdate(audio_url=mp3_url, timestamps=ts_json)
            )
            print(f"  🔄 已更新 DB 记录 (id={existing.id})")
        else:
            rec = await audio_repo.create_audio(
                db,
                obj_in=ChapterAudioCreate(
                    version=VERSION, book=TEST_BOOK, chapter=TEST_CHAPTER,
                    audio_url=mp3_url, timestamps=ts_json
                )
            )
            print(f"  🆕 已新建 DB 记录 (id={rec.id})")


async def step_read_db():
    """Step 5：从数据库回读验证"""
    print("\n" + "─" * 50)
    print("📖 Step 5：从数据库回读验证")

    from backend.core.database import AsyncSessionLocal
    from backend.repository import chapter_audio as audio_repo

    async with AsyncSessionLocal() as db:
        rec = await audio_repo.get_audio(db, version=VERSION, book=TEST_BOOK, chapter=TEST_CHAPTER)

    if not rec:
        print("  ❌ 数据库中未找到记录！")
        return

    ts = json.loads(rec.timestamps) if rec.timestamps else []
    print(f"  ✅ DB id       : {rec.id}")
    print(f"     version    : {rec.version}")
    print(f"     book       : {rec.book}")
    print(f"     chapter    : {rec.chapter}")
    print(f"     audio_url  : {rec.audio_url}")
    print(f"     timestamps : {len(ts)} 节（前3节: {ts[:3]}）")


async def main():
    print("=" * 50)
    print(f"🧪 S3 上传功能测试  ({VERSION}/{TEST_BOOK}/{TEST_CHAPTER})")
    print(f"   Bucket : {settings.AWS_S3_BUCKET}")
    print(f"   Region : {settings.AWS_S3_REGION}")
    print("=" * 50)

    # ── 校验凭证 ──
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY or not settings.AWS_S3_BUCKET:
        print("❌ AWS S3 凭证未配置，请先在 .env 中填写 AWS_* 变量")
        sys.exit(1)

    timestamps = step_check_local()
    mp3_url    = step_upload_s3(timestamps)
    step_verify_s3(mp3_url)
    await step_write_db(mp3_url, timestamps)
    await step_read_db()

    print("\n" + "=" * 50)
    print("🎉 测试完成！如果所有步骤显示 ✅，可以执行正式批量上传：")
    print("   python3 scripts/batch_upload_s3.py")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
