from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Optional

from backend.core.database import get_db
from backend.model.user import User
from backend.schema.book import BookCreate, BookUpdate, BookResponse
from backend.repository import book as book_repo
from backend.api.deps import get_current_admin

router = APIRouter(prefix="/api/books", tags=["Books"])

@router.get("/")
async def read_books(
    version: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all books (Publicly accessible for filters) - Hardcoded for JSON source
    """
    # 圣经66卷书的固定数据，这与前台 JS 中的常量匹配
    ot = [
        ('gen', '创世记', 50), ('exo', '出埃及记', 40), ('lev', '利未记', 27), ('num', '民数记', 36), ('deu', '申命记', 34),
        ('jos', '约书亚记', 24), ('jdg', '士师记', 21), ('rut', '路得记', 4), ('1sa', '撒母耳记上', 31), ('2sa', '撒母耳记下', 24),
        ('1ki', '列王纪上', 22), ('2ki', '列王纪下', 25), ('1ch', '历代志上', 29), ('2ch', '历代志下', 36), ('ezr', '以斯拉记', 10),
        ('neh', '尼希米记', 13), ('est', '以斯帖记', 10), ('job', '约伯记', 42), ('psa', '诗篇', 150), ('pro', '箴言', 31),
        ('ecc', '传道书', 12), ('sng', '雅歌', 8), ('isa', '以赛亚书', 66), ('jer', '耶利米书', 52), ('lam', '耶利米哀歌', 5),
        ('ezk', '以西结书', 48), ('dan', '但以理书', 12), ('hos', '何西阿书', 14), ('jol', '约珥书', 3), ('amo', '阿摩司书', 9),
        ('oba', '俄巴底亚书', 1), ('jon', '约拿书', 4), ('mic', '弥迦书', 7), ('nam', '那鸿书', 3), ('hab', '哈巴谷书', 3),
        ('zep', '西番雅书', 3), ('hag', '哈该书', 2), ('zec', '撒迦利亚书', 14), ('mal', '玛拉基书', 4)
    ]
    nt = [
        ('mat', '马太福音', 28), ('mrk', '马可福音', 16), ('luk', '路加福音', 24), ('jhn', '约翰福音', 21), ('act', '使徒行传', 28),
        ('rom', '罗马书', 16), ('1co', '哥林多前书', 16), ('2co', '哥林多后书', 13), ('gal', '加拉太书', 6), ('eph', '以弗所书', 6),
        ('php', '腓立比书', 4), ('col', '歌罗西书', 4), ('1th', '帖撒罗尼迦前书', 5), ('2th', '帖撒罗尼迦后书', 3),
        ('1ti', '提摩太前书', 6), ('2ti', '提摩太后书', 4), ('tit', '提多书', 3), ('phm', '腓利门书', 1),
        ('heb', '希伯来书', 13), ('jas', '雅各书', 5), ('1pe', '彼得前书', 5), ('2pe', '彼得后书', 3),
        ('1jn', '约翰壹书', 5), ('2jn', '约翰贰书', 1), ('3jn', '约翰叁书', 1), ('jud', '犹大书', 1), ('rev', '启示录', 22)
    ]
    all_books = []
    
    for i, (code, name, chap_count) in enumerate(ot):
        all_books.append({
            "id": i + 1, "code": code, "name": name, "full_name": name,
            "testament": "OT", "order_num": i + 1, "chapter_count": chap_count
        })
    for i, (code, name, chap_count) in enumerate(nt):
        all_books.append({
            "id": 39 + i + 1, "code": code, "name": name, "full_name": name,
            "testament": "NT", "order_num": 39 + i + 1, "chapter_count": chap_count
        })
        
    return all_books


@router.get("/all-audiobooks")
async def list_all_audiobooks():
    """
    返回全本圣经所有章节的听书条目，供牧声 App 听书频道使用。
    """
    from backend.core.config import settings

    S3_BUCKET = settings.AWS_S3_BUCKET or "cdsaws"
    S3_REGION = settings.AWS_S3_REGION or "us-east-1"
    VOICE = "male"
    VERSION = "cuv"

    ot_books = [
        ('gen', '创世记', 50), ('exo', '出埃及记', 40), ('lev', '利未记', 27),
        ('num', '民数记', 36), ('deu', '申命记', 34), ('jos', '约书亚记', 24),
        ('jdg', '士师记', 21), ('rut', '路得记', 4), ('1sa', '撒母耳记上', 31),
        ('2sa', '撒母耳记下', 24), ('1ki', '列王纪上', 22), ('2ki', '列王纪下', 25),
        ('1ch', '历代志上', 29), ('2ch', '历代志下', 36), ('ezr', '以斯拉记', 10),
        ('neh', '尼希米记', 13), ('est', '以斯帖记', 10), ('job', '约伯记', 42),
        ('psa', '诗篇', 150), ('pro', '箴言', 31), ('ecc', '传道书', 12),
        ('sng', '雅歌', 8), ('isa', '以赛亚书', 66), ('jer', '耶利米书', 52),
        ('lam', '耶利米哀歌', 5), ('ezk', '以西结书', 48), ('dan', '但以理书', 12),
        ('hos', '何西阿书', 14), ('jol', '约珥书', 3), ('amo', '阿摩司书', 9),
        ('oba', '俄巴底亚书', 1), ('jon', '约拿书', 4), ('mic', '弥迦书', 7),
        ('nam', '那鸿书', 3), ('hab', '哈巴谷书', 3), ('zep', '西番雅书', 3),
        ('hag', '哈该书', 2), ('zec', '撒迦利亚书', 14), ('mal', '玛拉基书', 4),
    ]
    
    nt_books = [
        ('mat', '马太福音', 28), ('mrk', '马可福音', 16), ('luk', '路加福音', 24), ('jhn', '约翰福音', 21), ('act', '使徒行传', 28),
        ('rom', '罗马书', 16), ('1co', '哥林多前书', 16), ('2co', '哥林多后书', 13), ('gal', '加拉太书', 6), ('eph', '以弗所书', 6),
        ('php', '腓立比书', 4), ('col', '歌罗西书', 4), ('1th', '帖撒罗尼迦前书', 5), ('2th', '帖撒罗尼迦后书', 3),
        ('1ti', '提摩太前书', 6), ('2ti', '提摩太后书', 4), ('tit', '提多书', 3), ('phm', '腓利门书', 1),
        ('heb', '希伯来书', 13), ('jas', '雅各书', 5), ('1pe', '彼得前书', 5), ('2pe', '彼得后书', 3),
        ('1jn', '约翰壹书', 5), ('2jn', '约翰贰书', 1), ('3jn', '约翰叁书', 1), ('jud', '犹大书', 1), ('rev', '启示录', 22)
    ]

    items = []
    
    def build_items(books_list, album_name):
        for book_code, book_name, chapter_count in books_list:
            for chapter in range(1, chapter_count + 1):
                if S3_REGION == "us-east-1":
                    audio_url = f"https://{S3_BUCKET}.s3.amazonaws.com/audio/tts/doubao/{VERSION}/{VOICE}/{book_code}/{chapter}.mp3"
                else:
                    audio_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/audio/tts/doubao/{VERSION}/{VOICE}/{book_code}/{chapter}.mp3"

                cover_url = f"https://picsum.photos/seed/bible-{book_code}/400/400"

                items.append({
                    "id": f"bible-{VERSION}-{book_code}-{chapter}",
                    "title": f"{book_name} 第{chapter}章",
                    "artist": "圣经和合本朗读",
                    "album": album_name,
                    "book": book_code,
                    "book_name": book_name,
                    "chapter": chapter,
                    "version": VERSION,
                    "cover_url": cover_url,
                    "audio_url": audio_url,
                    "is_audiobook": True,
                })
                
    build_items(ot_books, "旧约全书")
    build_items(nt_books, "新约全书")

    return items

@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
async def create_new_book(
    book_in: BookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Create a new book entry (Admin only)
    """
    existing = await book_repo.get_book_by_code(db, code=book_in.code, version=book_in.version)
    if existing:
        raise HTTPException(status_code=400, detail="Book code already exists for this version")
    return await book_repo.create_book(db, obj_in=book_in)

@router.put("/{book_id}", response_model=BookResponse)
async def update_existing_book(
    book_id: int,
    book_in: BookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Update a book entry (Admin only)
    """
    db_obj = await book_repo.get_book_by_id(db, book_id=book_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Book not found")
    return await book_repo.update_book(db, db_obj=db_obj, obj_in=book_in)

@router.delete("/{book_id}", response_model=BookResponse)
async def delete_existing_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Delete a book entry (Admin only)
    """
    db_obj = await book_repo.get_book_by_id(db, book_id=book_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Book not found")
    return await book_repo.delete_book(db, db_obj=db_obj)
