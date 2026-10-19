import os
import json
from typing import List, Dict, Any, Optional

class JsonVerseRepository:
    """
    一个基于内存的经文读取服务，支持按卷懒加载以提升速度。
    """
    def __init__(self, data_root: Optional[str] = None):
        if data_root is None:
            # 动态计算绝对根目录下的 data 目录，确保在 Serverless 容器下定位无误
            repo_dir = os.path.dirname(os.path.abspath(__file__))
            backend_dir = os.path.dirname(repo_dir)
            project_root = os.path.dirname(backend_dir)
            self.data_root = os.path.join(project_root, "data")
        else:
            self.data_root = data_root
        self.cache: Dict[str, List[Dict[str, Any]]] = {}
        self._all_loaded = False

    def _find_version_path(self, version: str) -> Optional[str]:
        if not os.path.exists(self.data_root):
            return None
        for lang_dir in os.listdir(self.data_root):
            if lang_dir == "audio":  # 跳过音频缓存目录
                continue
            lang_path = os.path.join(self.data_root, lang_dir)
            if os.path.isdir(lang_path):
                version_path = os.path.join(lang_path, version)
                if os.path.isdir(version_path):
                    # 确保该目录下有 .json 文件才认为是正确的经文数据目录
                    if any(f.endswith('.json') for f in os.listdir(version_path)):
                        return version_path
        return None

    # NOTE: 历史数据中部分书卷 abbr 与前端标准 code 不一致，此处统一规范化
    # 旧格式 -> 前端标准 code（所有 key/value 均为小写）
    BOOK_CODE_NORMALIZE: Dict[str, str] = {
        "matt": "mat",   # 马太福音
        "mar":  "mrk",   # 马可福音
        "joh":  "jhn",   # 约翰福音
        "1jo":  "1jn",   # 约翰一书
        "2jo":  "2jn",   # 约翰二书
        "3jo":  "3jn",   # 约翰三书
        "eze":  "ezk",   # 以西结书
        "jam":  "jas",   # 雅各书
        "joe":  "jol",   # 约珥书
        "son":  "sng",   # 雅歌
    }

    def _normalize_book_code(self, code: str) -> str:
        """将旧格式书卷 code 统一转为前端标准 code"""
        return self.BOOK_CODE_NORMALIZE.get(code.lower(), code.lower())

    def _get_book_verses(self, version: str, book: str) -> List[Dict[str, Any]]:
        version = version.lower()
        book = book.lower()
        cache_key = f"{version}/{book}"
        
        if cache_key in self.cache:
            return self.cache[cache_key]
            
        version_path = self._find_version_path(version)
        if not version_path:
            self.cache[cache_key] = []
            return []
            
        # 尝试标准名和已知的旧格式别名
        possible_files = [f"{book}.json"]
        for old, standard in self.BOOK_CODE_NORMALIZE.items():
            if standard == book:
                possible_files.append(f"{old}.json")
                
        filepath = None
        for pf in possible_files:
            tmp = os.path.join(version_path, pf)
            if os.path.exists(tmp):
                filepath = tmp
                break
        
        temp_verses = []
        if filepath:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    book_data = json.load(f)
                    
                book_abbr = book_data.get("abbr", "").lower()
                if not book_abbr:
                    book_abbr = book
                
                # NOTE: 统一规范化书卷 code，防止旧格式（matt/mar/joh 等）混入
                book_abbr = self._normalize_book_code(book_abbr)
                    
                for chapter in book_data.get("chapters", []):
                    chapter_num = chapter.get("chapter")
                    for verse in chapter.get("verses", []):
                        verse_num = verse.get("verse")
                        text = verse.get("text", "").strip()
                        
                        if text:
                            temp_verses.append({
                                "version": version,
                                "book": book_abbr,
                                "chapter": chapter_num,
                                "verse_num": verse_num,
                                "text": text,
                                "heading": verse.get("heading") or None,  # 段落小标题(如「神的创造」)，无则 None
                            })
            except Exception as e:
                print(f"Failed to load {filepath}: {e}")
                
        self.cache[cache_key] = temp_verses
        return temp_verses


    def _ensure_all_loaded(self):
        """仅在无条件查询或全局搜索时触发所有加载"""
        if self._all_loaded:
            return
            
        if not os.path.exists(self.data_root):
            self._all_loaded = True
            return
            
        for lang_dir in os.listdir(self.data_root):
            lang_path = os.path.join(self.data_root, lang_dir)
            if not os.path.isdir(lang_path):
                continue
                
            for version_dir in os.listdir(lang_path):
                version_path = os.path.join(lang_path, version_dir)
                if not os.path.isdir(version_path):
                    continue
                    
                version_name = version_dir.lower()
                for filename in os.listdir(version_path):
                    if filename.endswith('.json'):
                        book = filename[:-5].lower()
                        self._get_book_verses(version_name, book)
                    
        self._all_loaded = True

    def _candidate_verses(
        self, version: Optional[str], book: Optional[str], search: Optional[str]
    ) -> List[Dict[str, Any]]:
        """按需加载相关文件，返回已按 version/book 粗筛的候选列表（不含 chapter/search/books 细筛）。"""
        if version and book and not search:
            # 明确指定版本和书卷且无搜索：只载入单个文件
            return self._get_book_verses(version, book)

        # 跨书/跨版本/搜索：按需预加载
        if search or (not version and not book):
            self._ensure_all_loaded()
        elif version and not book:
            version_path = self._find_version_path(version.lower())
            if version_path and os.path.isdir(version_path):
                for filename in os.listdir(version_path):
                    if filename.endswith('.json'):
                        self._get_book_verses(version.lower(), filename[:-5].lower())

        v_lower = version.lower() if version else None
        b_lower = book.lower() if book else None
        out: List[Dict[str, Any]] = []
        for verses in self.cache.values():
            for v in verses:
                if v_lower and v["version"] != v_lower:
                    continue
                if b_lower and v["book"] != b_lower:
                    continue
                out.append(v)
        return out

    def _matches(self, v: Dict[str, Any], chapter, books_lower, search_lower) -> bool:
        if chapter and v["chapter"] != chapter:
            return False
        if books_lower and self._normalize_book_code(v["book"]) not in books_lower:
            return False
        if search_lower and search_lower not in v["text"].lower():
            return False
        return True

    def get_verses(
        self,
        skip: int = 0,
        limit: int = 100,
        version: Optional[str] = None,
        book: Optional[str] = None,
        chapter: Optional[int] = None,
        search: Optional[str] = None,
        books: Optional[set] = None
    ) -> List[Dict[str, Any]]:
        candidates = self._candidate_verses(version, book, search)
        books_lower = {b.lower() for b in books} if books else None
        search_lower = search.lower() if search else None

        # 单趟扫描 + 命中即 skip/limit，命中够数即提前结束，避免「全量过滤再整段切片」
        result: List[Dict[str, Any]] = []
        skipped = 0
        for v in candidates:
            if not self._matches(v, chapter, books_lower, search_lower):
                continue
            if skipped < skip:
                skipped += 1
                continue
            result.append(v)
            if limit and len(result) >= limit:
                break
        return result

    def count_verses(
        self,
        version: Optional[str] = None,
        book: Optional[str] = None,
        chapter: Optional[int] = None,
        search: Optional[str] = None,
        books: Optional[set] = None
    ) -> int:
        # 仅计数：生成器累加，不再 get_verses(limit=9999999) 物化整段列表再取 len
        candidates = self._candidate_verses(version, book, search)
        books_lower = {b.lower() for b in books} if books else None
        search_lower = search.lower() if search else None
        return sum(1 for v in candidates if self._matches(v, chapter, books_lower, search_lower))

# 全局单例
json_verse_repo = JsonVerseRepository()
