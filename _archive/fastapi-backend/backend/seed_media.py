import os
import sys
import asyncio

# Add project root to sys.path so we can import backend packages
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession
from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.media import MediaItem

async def seed_media():
    # 确保表被创建（一般项目会在启动或者alembic中创建，但在seed中跑一次安全）
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        # 删表现有数据
        from sqlalchemy import delete
        await db.execute(delete(MediaItem))
        
        # Hardcoded VIDEO_DATA from frontend js/app.js
        VIDEO_DATA = [
            { "id": "v1", "title": "创世记的神学意义", "series": "旧约导论", "category": "旧约", "dur": "45:32", "teacher": "王明道牧师", "desc": "深入探讨创世记的神学主题，包括创造、堕落与救赎的叙事脉络。", "gradient": "linear-gradient(135deg, #667eea, #764ba2)" },
            { "id": "v2", "title": "出埃及记：救赎的预表", "series": "旧约导论", "category": "旧约", "dur": "52:18", "teacher": "王明道牧师", "desc": "从出埃及记看基督救赎的预表与影子。", "gradient": "linear-gradient(135deg, #f093fb, #f5576c)" },
            { "id": "v3", "title": "约翰福音1章深度解析", "series": "四福音研读", "category": "新约", "dur": "38:14", "teacher": "李常受弟兄", "desc": "解析\"太初有道\"的深层含义，探索道成肉身的奥秘。", "gradient": "linear-gradient(135deg, #4facfe, #00f2fe)" },
            { "id": "v4", "title": "马太福音：天国的福音", "series": "四福音研读", "category": "新约", "dur": "41:30", "teacher": "李常受弟兄", "desc": "天国八福与登山宝训的信息精要。", "gradient": "linear-gradient(135deg, #43e97b, #38f9d7)" },
            { "id": "v5", "title": "诗篇的诗歌文学", "series": "智慧书研读", "category": "专题", "dur": "52:07", "teacher": "张学恩博士", "desc": "诗篇的文学体裁、希伯来诗歌的平行结构与修辞手法。", "gradient": "linear-gradient(135deg, #fa709a, #fee140)" },
            { "id": "v6", "title": "使徒行传：早期教会", "series": "新约历史", "category": "新约", "dur": "41:55", "teacher": "陈终道牧师", "desc": "初代教会的建立、圣灵降临与福音的传播。", "gradient": "linear-gradient(135deg, #a18cd1, #fbc2eb)" },
            { "id": "v7", "title": "罗马书：因信称义", "series": "保罗书信", "category": "新约", "dur": "63:20", "teacher": "陈终道牧师", "desc": "保罗论述因信称义的核心教义，人类的罪与神的救恩。", "gradient": "linear-gradient(135deg, #fccb90, #d57eeb)" },
            { "id": "v8", "title": "启示录：末世的盼望", "series": "末世论", "category": "专题", "dur": "58:40", "teacher": "张学恩博士", "desc": "启示录中的异象、七教会书信与最终审判的信息。", "gradient": "linear-gradient(135deg, #ff9a9e, #fecfef)" },
            { "id": "v9", "title": "圣经考古学导论", "series": "圣经背景", "category": "专题", "dur": "35:42", "teacher": "刘志雄长老", "desc": "从考古学发现印证圣经记载的历史真实性。", "gradient": "linear-gradient(135deg, #96fbc4, #f9f586)" },
        ]

        AUDIO_DATA = [
            { "id": "a1", "title": "每日灵修：创世记1章", "category": "灵修", "dur": "20:15", "speaker": "王怡牧师", "desc": "从创世记第一章默想神创造的大能与美善。", "icon": "fa-sun" },
            { "id": "a2", "title": "创世记3章：堕落与应许", "category": "灵修", "dur": "18:30", "speaker": "王怡牧师", "desc": "人类堕落的经过以及神所赐下的第一个救赎应许。", "icon": "fa-sun" },
            { "id": "a3", "title": "早祷：马太福音5章", "category": "灵修", "dur": "14:22", "speaker": "刘彤牧师", "desc": "登山宝训中八福的教导与生命应用。", "icon": "fa-sun" },
            { "id": "a4", "title": "圣经朗读：约翰福音全卷", "category": "诵读", "dur": "1:58:32", "speaker": "朗读团队", "desc": "约翰福音全书的清晰朗读，配合轻音乐背景。", "icon": "fa-book-open" },
            { "id": "a5", "title": "圣经朗读：诗篇1-50篇", "category": "诵读", "dur": "2:15:10", "speaker": "朗读团队", "desc": "诗篇前五十篇的完整朗读。", "icon": "fa-book-open" },
            { "id": "a6", "title": "诗篇颂唱：第23篇", "category": "敬拜", "dur": "5:40", "speaker": "赞美之泉", "desc": "耶和华是我的牧者——诗篇23篇的优美颂唱。", "icon": "fa-music" },
            { "id": "a7", "title": "奇异恩典", "category": "敬拜", "dur": "4:55", "speaker": "赞美之泉", "desc": "经典圣诗的现代编曲版本。", "icon": "fa-music" },
            { "id": "a8", "title": "使徒信经讲解", "category": "教导", "dur": "29:55", "speaker": "唐崇荣牧师", "desc": "逐条解析使徒信经的核心信仰告白。", "icon": "fa-graduation-cap" },
            { "id": "a9", "title": "基督论概要", "category": "教导", "dur": "35:20", "speaker": "唐崇荣牧师", "desc": "系统阐述基督之神人二性与救赎工作。", "icon": "fa-graduation-cap" },
            { "id": "a10", "title": "罗马书讲座：称义之道", "category": "教导", "dur": "42:10", "speaker": "林献羔牧师", "desc": "保罗书信中因信称义教义的系统讲解。", "icon": "fa-graduation-cap" },
        ]

        # 公开测试媒体源（稳定的示例资源，用于真实播放测试）
        TEST_VIDEO_URLS = [
            "https://www.w3schools.com/html/mov_bbb.mp4",
            "https://media.w3.org/2010/05/sintel/trailer.mp4",
            "https://www.w3schools.com/tags/movie.mp4",
        ]
        TEST_AUDIO_URLS = [
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        ]

        for i, v in enumerate(VIDEO_DATA):
            item = MediaItem(
                id=v["id"],
                media_type="video",
                title=v["title"],
                series=v.get("series"),
                category=v["category"],
                duration=v.get("dur"),
                teacher=v.get("teacher"),
                description=v.get("desc"),
                cover_style=v.get("gradient"),
                url=TEST_VIDEO_URLS[i % len(TEST_VIDEO_URLS)]
            )
            db.add(item)

        for i, a in enumerate(AUDIO_DATA):
            item = MediaItem(
                id=a["id"],
                media_type="audio",
                title=a["title"],
                series=None,
                category=a["category"],
                duration=a.get("dur"),
                teacher=a.get("speaker"),
                description=a.get("desc"),
                cover_style=a.get("icon"),
                url=TEST_AUDIO_URLS[i % len(TEST_AUDIO_URLS)]
            )
            db.add(item)

        await db.commit()
        print(f"Successfully seeded {len(VIDEO_DATA)} videos and {len(AUDIO_DATA)} audios.")

if __name__ == "__main__":
    asyncio.run(seed_media())
