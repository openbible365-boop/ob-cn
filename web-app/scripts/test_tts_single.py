import sys
import os
import asyncio

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.service.tts import synthesize_chapter, _get_cache_path
from backend.repository.json_verse import json_verse_repo

async def test_single(book='phm', chapter=1):
    print(f"🧪 开始单章测试合成: {book} 第 {chapter} 章...")
    
    # 1. 获取经文
    verses = json_verse_repo._get_book_verses('cuv', book)
    chapter_verses = [v for v in verses if v['chapter'] == chapter]
    
    if not chapter_verses:
        print(f"❌ 未找到经文数据: {book} {chapter}")
        return

    verses_data = [{"verse": v['verse_num'], "text": v['text']} for v in chapter_verses]
    print(f"📖 共有 {len(verses_data)} 节经文。")

    # 2. 强制清理旧缓存以便观察真实合成过程
    cache_path = _get_cache_path('cuv', book, chapter)
    ts_cache_path = cache_path.with_suffix('.json')
    if cache_path.exists():
        os.remove(cache_path)
    if ts_cache_path.exists():
        os.remove(ts_cache_path)
    
    # 3. 调用合成
    print("🎙️ 正在调用豆包 TTS API 并计算时间戳...")
    audio_url, timestamps = await synthesize_chapter('cuv', book, chapter, verses_data)
    
    if audio_url:
        print(f"✅ 合成成功！")
        print(f"🔗 音频路径: {cache_path}")
        print(f"📄 时间戳路径: {ts_cache_path}")
        print(f"⏱️ 提取到 {len(timestamps)} 组精确时间轴。")
        
        # 打印前几秒看看
        if timestamps:
            first = timestamps[0]
            print(f"🔍 样例 (第1节): {first['start']}s -> {first['end']}s")
    else:
        print("❌ 合成失败，请检查 .env 凭证或网络。")

if __name__ == "__main__":
    # 默认合成 腓利门书 (phm) 第 1 章（新约中最短的书卷之一，非常快）
    asyncio.run(test_single('phm', 1))
