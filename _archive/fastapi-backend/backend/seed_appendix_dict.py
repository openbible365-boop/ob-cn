"""
把「附录.pdf」(主题式圣经词典)解析出的词条灌入 encyclopedia 表(entry_type=dictionary)。
试点：默认前 6 页。再次运行会先清掉本脚本导入过的词条(id 前缀 appx-)，避免重复。
首字母由 service/pinyin_index 自动计算。
"""
import os
import sys
import asyncio

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete
from backend.core.database import AsyncSessionLocal, engine, Base
from backend.model.encyclopedia import EncyclopediaEntry
from backend.service.pinyin_index import first_letter
from backend.parse_appendix import parse


def build_content(e: dict) -> str:
    """组合释义正文：含义 + 正文。英文/类型放进标题区由前端单独展示。"""
    parts = []
    if e.get('gloss'):
        parts.append(e['gloss'])
    if e.get('body'):
        parts.append(e['body'])
    return '\n'.join(parts).strip()


async def seed(max_pages=6):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    items = parse(max_pages)

    async with AsyncSessionLocal() as db:
        # 清掉上次本脚本导入的(id 前缀 appx-)
        await db.execute(delete(EncyclopediaEntry).where(EncyclopediaEntry.id.like('appx-%')))
        await db.commit()

        count = 0
        for idx, e in enumerate(items):
            term = e['term'].strip()
            if not term:
                continue
            content = build_content(e)
            if not content:
                continue
            # 类型/英文拼到分类，便于前端展示与区分
            kind = e.get('kind') or ''
            category = '圣经词典' + (f'·{kind}' if kind else '')
            entry = EncyclopediaEntry(
                id=f'appx-{idx+1}',
                entry_type='dictionary',
                category=category,
                index_letter=first_letter(term),
                sort_order=idx + 1,
                is_active=True,
                title_zh=term,
                title_en=e.get('english') or None,
                content_zh=content,
            )
            db.add(entry)
            count += 1
        await db.commit()
        print(f'导入词典词条 {count} 条(解析前 {max_pages} 页)。')


if __name__ == '__main__':
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    asyncio.run(seed(max_pages))
