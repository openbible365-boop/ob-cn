import asyncio
import sys
import os
import argparse
import json

# 添加项目根目录到 PYTHONPATH 以便能够引入 backend 包
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.database import AsyncSessionLocal
from backend.repository import book as book_repo, ai as ai_repo
from backend.service import ai as ai_service

async def process_book(db, book_code: str, chapter_count: int, delay: int = 2):
    print(f"\n========== 开始处理书卷: {book_code} (共 {chapter_count} 章) ==========")
    for ch in range(1, chapter_count + 1):
        # 1. 检查是否存在
        existing = await ai_repo.get_chapter_summary(db, book_code, ch)
        if existing:
            print(f"[{book_code} {ch}章] 已存在，跳过。")
            continue
            
        print(f"[{book_code} {ch}章] 正在生成大模型总结与探索问题...")
        try:
            # 2. 生成
            generated_data = await ai_service.generate_chapter_summary(db, book_code, ch)
            overview_text = generated_data.get("overview", "")
            explore_chips = generated_data.get("explore_chips", [])
            
            # 3. 结果校验并入库
            if not overview_text or "摘要暂不可用" in overview_text:
                print(f"[{book_code} {ch}章] ⚠️ 生成失败，AI 未返回有效摘要或服务不可用。")
            else:
                await ai_repo.create_chapter_summary(
                    db, 
                    book_code, 
                    ch, 
                    overview_text, 
                    json.dumps(explore_chips, ensure_ascii=False) if explore_chips else None
                )
                print(f"[{book_code} {ch}章] ✅ 生成并入库成功! (获取到 {len(explore_chips)} 个探索问题)")
                
        except Exception as e:
            print(f"[{book_code} {ch}章] ❌ 发生异常: {e}")
            
        # 频率限制
        await asyncio.sleep(delay)

async def main():
    parser = argparse.ArgumentParser(description="批量生成圣经各章速览和启发探索并存入数据库")
    parser.add_argument("--book", type=str, help="指定单卷书的代码(例如: gen)。如果不指定，则按顺序处理所有书卷。")
    parser.add_argument("--delay", type=int, default=3, help="每次 API 调用间的延迟(秒)，防止被大模型限流。默认3秒。")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        if args.book:
            book_obj = await book_repo.get_book_by_code(db, args.book, "cuv")
            if not book_obj:
                print(f"错误: 找不到书卷代码 '{args.book}'，请检查名称是否正确(如: gen, exo)")
                return
            await process_book(db, book_obj.code, book_obj.chapter_count, args.delay)
        else:
            books = await book_repo.get_books(db, version="cuv")
            print(f"开始批量处理整本圣经，共计 {len(books)} 卷书...")
            for book_obj in books:
                await process_book(db, book_obj.code, book_obj.chapter_count, args.delay)

if __name__ == "__main__":
    asyncio.run(main())
