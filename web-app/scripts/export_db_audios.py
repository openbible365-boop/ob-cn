import asyncio
import os
import sys
import json

# 将项目根目录添加到系统路径以支持相对导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.future import select
from backend.core.database import AsyncSessionLocal
from backend.model.chapter_audio import ChapterAudio
from backend.repository.json_verse import json_verse_repo

async def export_audio_data():
    from datetime import datetime
    # NOTE: 备份文件统一存放到 backups/ 目录，避免污染项目根目录
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(backup_dir, f"exported_audio_verses_{timestamp}.json")
    print("🚀 开始导出音频与经文字段数据...")

    
    export_data = []
    
    async with AsyncSessionLocal() as db:
        # 查询数据库中所有的录音记录
        result = await db.execute(select(ChapterAudio))
        audios = result.scalars().all()
        
        print(f"📦 找到 {len(audios)} 条章节录音数据")
        
        for audio in audios:
            # 拿到对应的经文内容
            verses = json_verse_repo._get_book_verses(audio.version, audio.book)
            if not verses:
                continue
            
            # 过滤出该章节的经文
            chapter_verses = [v for v in verses if v['chapter'] == audio.chapter]
            
            # 解析时间戳(持续时间)
            timestamps = []
            if audio.timestamps:
                timestamps = json.loads(audio.timestamps)
                
            # 组装本章经文详情
            verses_detail = []
            for i, v in enumerate(chapter_verses):
                duration = timestamps[i] if i < len(timestamps) else None
                verses_detail.append({
                    "verse": v['verse_num'],
                    "text": v['text'],
                    "duration": duration
                })
            
            chapter_data = {
                "version": audio.version,
                "book": audio.book,
                "chapter": audio.chapter,
                "audio_url": audio.audio_url,
                "verses": verses_detail
            }
            
            export_data.append(chapter_data)
    
    # 写入文件
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ 导出完成！共导出 {len(export_data)} 章数据，已保存至 {file_path}")

if __name__ == "__main__":
    asyncio.run(export_audio_data())
