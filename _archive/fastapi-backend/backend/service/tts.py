"""
豆包 TTS（火山引擎语音合成）service 层

调用策略：
1. 仅支持 CUV（和合本）版本；其他版本直接返回 None
2. 按书卷自动选择音色：
   - 旧约 → 「开朗学长」 en_male_jason_conversation_wvae_bigtts
   - 新约 → 「知性女声」 zh_female_zhixingnvsheng_mars_bigtts
3. 缓存优先级（S3 + 数据库模式）：
   a. 数据库已存在该章记录 → 直接返回 DB 中的 S3 URL + timestamps
   b. S3 已存在对应 Key（手动上传等场景）→ 从 S3 读取 timestamps 并写入 DB
   c. 调用豆包 TTS 合成 → 上传 S3 → 写入数据库 → 返回 S3 URL
   d. S3 未配置凭证 → 模拟模式（返回占位音频）
"""

import asyncio
import base64
import json
import logging
import pathlib
from typing import Optional

import httpx

from backend.core.config import settings

logger = logging.getLogger(__name__)

# 音频缓存根目录（供 _get_cache_path 向后兼容，批量上传脚本仍需引用）
ROOT_DIR = pathlib.Path(__file__).parent.parent.parent
AUDIO_CACHE_DIR = ROOT_DIR / "data" / "audio"

# 模拟模式下的占位音频（可播放的 public domain MP3）
MOCK_AUDIO_FALLBACK_URL = (
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
)

# 火山引擎 TTS API 端点（V1 HTTP 接口）
DOUBAO_TTS_URL = "https://openspeech.bytedance.com/api/v1/tts"

# NOTE: 新约书卷代码集合（小写），旧约为其余所有书卷
NEW_TESTAMENT_BOOKS = {
    "mat", "mrk", "luk", "jhn",           # 四福音
    "act",                                  # 使徒行传
    "rom", "1co", "2co", "gal", "eph",    # 保罗书信
    "php", "col", "1th", "2th", "1ti",
    "2ti", "tit", "phm",
    "heb",                                  # 希伯来书
    "jas", "1pe", "2pe",                   # 大公书信
    "1jn", "2jn", "3jn", "jud",
    "rev",                                  # 启示录
}

OLD_TESTAMENT_BOOKS = {
    "gen", "exo", "lev", "num", "deu",                          # 律法书
    "jos", "jdg", "rut", "1sa", "2sa", "1ki", "2ki",            # 历史书
    "1ch", "2ch", "ezr", "neh", "est",
    "job", "psa", "pro", "ecc", "sng",                          # 诗歌智慧书
    "isa", "jer", "lam", "ezk", "dan",                          # 大先知书
    "hos", "jol", "amo", "oba", "jon", "mic",                   # 小先知书
    "nah", "hab", "zep", "hag", "zec", "mal",
}

# 声音 ID 映射
VOICE_OLD_TESTAMENT = "en_male_jason_conversation_wvae_bigtts"   # 开朗学长
VOICE_NEW_TESTAMENT = "zh_female_zhixingnvsheng_mars_bigtts"     # 知性女声


def _is_new_testament(book: str) -> bool:
    """判断书卷是否属于新约"""
    return book.lower() in NEW_TESTAMENT_BOOKS


def _get_voice_for_book(book: str) -> str:
    """根据书卷返回对应的声音 ID"""
    if _is_new_testament(book):
        logger.debug(f"书卷 {book} 属于新约，使用知性女声")
        return VOICE_NEW_TESTAMENT
    else:
        logger.debug(f"书卷 {book} 属于旧约，使用开朗学长")
        return VOICE_OLD_TESTAMENT


def _get_cache_path(version: str, book: str, chapter: int) -> pathlib.Path:
    """返回本地音频缓存文件路径（供批量上传脚本读取已存在文件）"""
    return AUDIO_CACHE_DIR / "tts" / "doubao" / version.lower() / book.lower() / f"{chapter}.mp3"


# ─────────────────────────────────────────────
# S3 工具函数
# ─────────────────────────────────────────────

def _s3_is_configured() -> bool:
    """检查 S3 凭证是否已配置"""
    return bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_S3_BUCKET
    )


def _get_s3_key(version: str, book: str, chapter: int, voice: str = 'female') -> str:
    """返回 S3 Object Key（MP3 文件）"""
    return f"audio/tts/doubao/{version.lower()}/{voice}/{book.lower()}/{chapter}.mp3"


def _get_s3_ts_key(version: str, book: str, chapter: int, voice: str = 'female') -> str:
    """返回 S3 Object Key（timestamps JSON 文件）"""
    return f"audio/tts/doubao/{version.lower()}/{voice}/{book.lower()}/{chapter}.json"


def _get_s3_public_url(version: str, book: str, chapter: int, voice: str = 'female') -> str:
    """返回 S3 公开读取 URL"""
    key = _get_s3_key(version, book, chapter, voice)
    bucket = settings.AWS_S3_BUCKET
    region = settings.AWS_S3_REGION
    # us-east-1 使用无区域子域名，其他区域使用 s3.{region}.amazonaws.com
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def _get_s3_client():
    """创建 boto3 S3 客户端（同步，用于上传操作）"""
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _s3_object_exists(key: str) -> bool:
    """检测 S3 指定 Key 是否已存在（HEAD Object 请求）"""
    try:
        client = _get_s3_client()
        client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        return True
    except Exception:
        return False


def _upload_to_s3_public(key: str, data: bytes, content_type: str) -> None:
    """
    上传字节到 S3，兼容 ACL 开关：
    优先设置 public-read，若 Bucket 关闭了对象 ACL 则回退为 Bucket Policy 公开模式。
    """
    client = _get_s3_client()
    try:
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
            ACL="public-read",
        )
    except Exception as acl_err:
        # HACK: 若 Bucket 关闭了对象 ACL（推荐做法），回退不带 ACL 参数，依赖 Bucket Policy 公开读
        logger.warning(f"S3 ACL 设置失败（{acl_err}），回退为 Bucket Policy 公开模式")
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )


def _fetch_s3_json(key: str) -> Optional[list]:
    """从 S3 读取 timestamps JSON 文件内容，失败时返回 None"""
    try:
        client = _get_s3_client()
        resp = client.get_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        return json.loads(resp["Body"].read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"从 S3 读取 timestamps 失败: {e}")
        return None


# ─────────────────────────────────────────────
# 数据库写入辅助
# ─────────────────────────────────────────────

async def _save_to_db(
    db,
    version: str,
    book: str,
    chapter: int,
    audio_url: str,
    timestamps: list,
) -> None:
    """
    向后兼容版本：根据书卷自动推断 voice 后调用 _save_to_db_voice。
    """
    voice = "female" if _is_new_testament(book) else "male"
    await _save_to_db_voice(db, version, book, chapter, voice, audio_url, timestamps)


async def _save_to_db_voice(
    db,
    version: str,
    book: str,
    chapter: int,
    voice: str,
    audio_url: str,
    timestamps: list,
) -> None:
    """
    将合成结果（S3 URL + timestamps JSON）写入 chapter_audios 表，包含 voice 字段。
    若已存在记录则更新，否则新建。
    """
    try:
        from backend.repository import chapter_audio as audio_repo
        from backend.schema.chapter_audio import ChapterAudioCreate, ChapterAudioUpdate

        ts_json = json.dumps(timestamps, ensure_ascii=False)
        existing = await audio_repo.get_audio(
            db, version=version, book=book, chapter=chapter, voice=voice
        )

        if existing:
            await audio_repo.update_audio(
                db,
                db_obj=existing,
                obj_in=ChapterAudioUpdate(audio_url=audio_url, timestamps=ts_json),
            )
            logger.info(f"DB 已更新: {version}/{book}/{chapter} [{voice}] → {audio_url}")
        else:
            await audio_repo.create_audio(
                db,
                obj_in=ChapterAudioCreate(
                    version=version,
                    book=book,
                    chapter=chapter,
                    voice=voice,
                    audio_url=audio_url,
                    timestamps=ts_json,
                ),
            )
            logger.info(f"DB 已新建: {version}/{book}/{chapter} [{voice}] → {audio_url}")
    except Exception as e:
        logger.error(f"DB 写入失败 ({version}/{book}/{chapter} [{voice}]): {e}")



# ─────────────────────────────────────────────
# TTS 合成核心逻辑
# ─────────────────────────────────────────────

# 修改并发数量为 3 以防触发频率限制
tts_semaphore = asyncio.Semaphore(3)


async def _synthesize_single_verse(
    client: httpx.AsyncClient,
    payload: dict,
    headers: dict,
    verse_num: int,
    text: str
) -> Optional[tuple[int, bytes, float]]:
    """合成单节经文，返回 (节号, 音频字节, 持续时间)"""
    if not text.strip():
        return None

    verse_payload = payload.copy()
    verse_payload["request"] = payload["request"].copy()
    verse_payload["request"]["reqid"] = f"{payload['request']['reqid']}-{verse_num}"
    verse_payload["request"]["text"] = text.strip() + "。"

    async with tts_semaphore:
        try:
            resp = await client.post(DOUBAO_TTS_URL, json=verse_payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            audio_b64 = data.get("data")
            if not audio_b64:
                logger.error(f"TTS API 返回无音频数据 (节 {verse_num}): {data}")
                return None

            audio_bytes = base64.b64decode(audio_b64)

            # NOTE: 用 mutagen 精确测量实际 MP3 帧时长，替代 API 估算值 addition.duration。
            # 原因：API 返回的估算时长存在系统性误差（约1-2%），逐节累加后后半段严重不同步。
            duration_sec = 0.0
            try:
                from mutagen.mp3 import MP3
                from io import BytesIO
                audio_info = MP3(BytesIO(audio_bytes))
                duration_sec = audio_info.info.length
            except Exception:
                # 降级：使用 API 估算值
                duration_ms = int(data.get("addition", {}).get("duration", 0))
                duration_sec = duration_ms / 1000.0

            return (verse_num, audio_bytes, duration_sec)
        except Exception as e:
            logger.error(f"TTS 合成第 {verse_num} 节异常: {e}")
            return None


async def synthesize_chapter(
    version: str,
    book: str,
    chapter: int,
    verses_data: list[dict],
    db=None,              # 可选：AsyncSession，传入时自动写入数据库
    force: bool = False,  # 是否强制重新合成，跳过 DB 和 S3 缓存
    voice: Optional[str] = None,  # 'female' | 'male'，None 时按书卷自动推断
) -> Optional[tuple[str, list]]:
    """
    合成整章音频，返回可访问的音频 URL 及对应的时间戳数组。

    voice 参数：
      - 'female' → 知性女声（新约默认）
      - 'male'   → 开朗学长（旧约默认）
      - None     → 根据书卷自动推断（向后兼容）

    缓存优先级：
    1. 数据库已存在记录 → 直接返回 DB 中的 S3 URL + timestamps（最快路径）
    2. S3 已存在 MP3+JSON → 读取 timestamps 写入 DB → 返回 S3 URL
    3. 调用豆包 TTS 合成 → 上传 S3 → 写入 DB → 返回 S3 URL
    4. S3 未配置 → 模拟模式
    """
    # 仅支持 CUV 版本
    if version.lower() != "cuv":
        logger.info(f"TTS 仅支持 CUV 版本，版本 '{version}' 跳过合成")
        return None, []

    # NOTE: 决定最终使用的 voice：显式传入优先，否则按书卷自动推断
    effective_voice = voice if voice in ("female", "male") else (
        "female" if _is_new_testament(book) else "male"
    )
    voice_label = "知性女声" if effective_voice == "female" else "开朗学长"
    voice_type_id = VOICE_NEW_TESTAMENT if effective_voice == "female" else VOICE_OLD_TESTAMENT

    # ── 1. 优先查数据库缓存 ────────────────────────────────────────
    if db is not None and not force:
        try:
            from backend.repository import chapter_audio as audio_repo
            db_record = await audio_repo.get_audio(
                db, version=version, book=book, chapter=chapter, voice=effective_voice
            )
            if db_record and db_record.audio_url:
                logger.info(f"DB 缓存命中: {version}/{book}/{chapter} [{effective_voice}]")
                timestamps = []
                if db_record.timestamps:
                    try:
                        timestamps = json.loads(db_record.timestamps)
                    except Exception:
                        pass
                return db_record.audio_url, timestamps
        except Exception as e:
            logger.warning(f"查询 DB 缓存失败，继续走 S3 流程: {e}")

    # ── 2. 检查 S3 是否已配置 ──────────────────────────────────────
    if not _s3_is_configured():
        logger.warning(
            f"S3 凭证未配置，使用模拟音频（{voice_label}）。"
            "填写 AWS S3 凭证后系统将自动上传真实音频。"
        )
        return MOCK_AUDIO_FALLBACK_URL, []

    mp3_key = _get_s3_key(version, book, chapter, effective_voice)
    ts_key  = _get_s3_ts_key(version, book, chapter, effective_voice)

    # ── 3. S3 缓存命中检测（适用于手动上传等场景）────────────────
    loop = asyncio.get_running_loop()

    if not force:
        mp3_exists = await loop.run_in_executor(None, _s3_object_exists, mp3_key)
        ts_exists  = await loop.run_in_executor(None, _s3_object_exists, ts_key)

        if mp3_exists and ts_exists:
            logger.info(f"S3 缓存命中: {mp3_key}，同步写入 DB")
            timestamps = await loop.run_in_executor(None, _fetch_s3_json, ts_key) or []
            s3_url = _get_s3_public_url(version, book, chapter, effective_voice)
            if db is not None:
                await _save_to_db_voice(db, version, book, chapter, effective_voice, s3_url, timestamps)
            return s3_url, timestamps

    # ── 4. 无豆包凭证 → 模拟模式 ───────────────────────────────────
    if not settings.DOUBAO_APP_ID or not settings.DOUBAO_ACCESS_TOKEN:
        logger.warning(f"DOUBAO 凭证未配置，使用模拟音频（{voice_label}）。")
        return MOCK_AUDIO_FALLBACK_URL, []

    # ── 5. 调用豆包 TTS 逐节合成 ───────────────────────────────────
    if not verses_data:
        logger.error(f"TTS: {book} {chapter} 章无文本内容")
        return None, []

    base_payload = {
        "app": {
            "appid": settings.DOUBAO_APP_ID,
            "token": settings.DOUBAO_ACCESS_TOKEN,
            "cluster": settings.DOUBAO_CLUSTER,
        },
        "user": {"uid": "openbible_tts"},
        "audio": {
            "voice_type": voice_type_id,
            "encoding": "mp3",
            "speed_ratio": 1.0,
            "volume_ratio": 1.0,
            "pitch_ratio": 1.0,
        },
        "request": {
            "reqid": f"cuv-{book}-{chapter}-{effective_voice}",
            "text": "",
            "text_type": "plain",
            "operation": "query",
            "with_frontend": 1,
            "frontend_type": "unitTson",
        },
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer;{settings.DOUBAO_ACCESS_TOKEN}",
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as http_client:
            tasks = []
            for item in verses_data:
                v_num  = item["verse"]
                v_text = item["text"]
                if len(v_text) > 900:
                    v_text = v_text[:900]
                tasks.append(_synthesize_single_verse(http_client, base_payload, headers, v_num, v_text))

            results = await asyncio.gather(*tasks, return_exceptions=True)

        full_audio_bytes = bytearray()
        timestamps = []
        current_time = 0.0

        for res in results:
            if isinstance(res, Exception) or res is None:
                continue
            verse_num, a_bytes, dur_sec = res
            if not a_bytes or dur_sec <= 0:
                continue
            full_audio_bytes.extend(a_bytes)
            timestamps.append({
                "verse": verse_num,
                "start": current_time,
                "end": current_time + dur_sec
            })
            current_time += dur_sec

        if not full_audio_bytes:
            logger.error("TTS 返回空音频集合，无法上传 S3")
            return None, []

        # ── 6. 上传 MP3 和 timestamps JSON 到 S3 ──────────────────
        ts_json_bytes = json.dumps(timestamps, ensure_ascii=False).encode("utf-8")

        await loop.run_in_executor(
            None,
            lambda: _upload_to_s3_public(mp3_key, bytes(full_audio_bytes), "audio/mpeg")
        )
        await loop.run_in_executor(
            None,
            lambda: _upload_to_s3_public(ts_key, ts_json_bytes, "application/json")
        )

        s3_url = _get_s3_public_url(version, book, chapter, effective_voice)
        logger.info(
            f"TTS 逐节合成完成（{voice_label}），共合并 {len(timestamps)} 节。"
            f"已上传 S3: {s3_url}"
        )

        # ── 7. 写入数据库 ──────────────────────────────────────────
        if db is not None:
            await _save_to_db_voice(db, version, book, chapter, effective_voice, s3_url, timestamps)

        return s3_url, timestamps

    except Exception as e:
        logger.error(f"TTS 合成主流程异常: {e}")
        return None, []

