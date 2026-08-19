import os
import re
import json
import fitz  # PyMuPDF
import unicodedata

def normalize_nfc(text):
    return unicodedata.normalize('NFC', text)

def load_manifest(manifest_path):
    """
    加载 manifest.json 并构建圣经书籍映射字典。
    分别构建旧约和新约的书籍映射字典，以防止本文字词引起跨约误判。
    同时针对北韩拼写（无头音规则）及缩写形式（例如 역대상->력대상）进行映射兼容。
    """
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    
    books_list = manifest.get('books', [])
    ot_ko_to_book = {}
    nt_ko_to_book = {}
    
    for book in books_list:
        ko_clean = re.sub(r'\s+', '', book['ko'])
        # order <= 39 为旧约，否则为新约
        target_dict = ot_ko_to_book if book['order'] <= 39 else nt_ko_to_book
        
        # 标准名称映射
        target_dict[ko_clean] = book
        if ko_clean.endswith('서') and len(ko_clean) > 2:
            target_dict[ko_clean[:-1]] = book
        if ko_clean.endswith('기') and len(ko_clean) > 2:
            target_dict[ko_clean[:-1]] = book
            
        # 兼容 역대기상 / 역대기하 缩写及北韩拼写
        if ko_clean == "역대기상":
            target_dict["역대상"] = book
            target_dict["력대상"] = book
        elif ko_clean == "역대기하":
            target_dict["역대하"] = book
            target_dict["력대하"] = book
            
        # 兼容北韩拼写（两音规律/无头音规则），例如:
        # '열왕기상' -> '렬왕기상', '역대기상' -> '력대기상'
        ko_clean_nk = None
        if ko_clean.startswith('열왕기'):
            ko_clean_nk = '렬왕기' + ko_clean[3:]
        elif ko_clean.startswith('역대기'):
            ko_clean_nk = '력대기' + ko_clean[3:]
            
        if ko_clean_nk:
            target_dict[ko_clean_nk] = book
            if ko_clean_nk.endswith('서') and len(ko_clean_nk) > 2:
                target_dict[ko_clean_nk[:-1]] = book
            if ko_clean_nk.endswith('기') and len(ko_clean_nk) > 2:
                target_dict[ko_clean_nk[:-1]] = book

    return ot_ko_to_book, nt_ko_to_book, books_list

def clean_text_spacing(lines):
    """
    处理文本中的换行和空格，解决韩文单词断裂的问题。
    """
    if not lines:
        return ""
    
    result = []
    for i, line in enumerate(lines):
        line_str = line.strip()
        if not line_str:
            continue
        
        if not result:
            result.append(line_str)
            continue
        
        prev_str = result[-1]
        if not prev_str:
            result.append(line_str)
            continue
            
        last_char = prev_str[-1]
        first_char = line_str[0]
        
        def is_alphanumeric_or_hangul(char):
            code = ord(char)
            if (0xAC00 <= code <= 0xD7A3) or (0x1100 <= code <= 0x11FF) or (0x3130 <= code <= 0x318F):
                return True
            if char.isalnum():
                return True
            return False
            
        if is_alphanumeric_or_hangul(last_char) and is_alphanumeric_or_hangul(first_char):
            result[-1] = prev_str + line_str
        else:
            result[-1] = prev_str + " " + line_str
            
    return "".join(result)

def parse_pdf(pdf_path, ko_to_book, is_new_testament=True):
    """
    解析圣经 PDF 页面并返回结构化数据。
    """
    print(f"开始解析 PDF: {pdf_path}")
    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"总页数: {total_pages}")
    
    current_book_meta = None
    current_chapter = 0
    
    bible_data = {}
    
    # 匹配书名及章/편，支持范围形式如 "욥기 25-26장", "시편 3-4편"
    header_pattern = re.compile(r'([가-힣]{2,10})\s*(\d+)(?:\s*-\s*(\d+))?(?:장|편)')
    chapter_num_pattern = re.compile(r'^\s*(\d+)\s*$')
    verse_pattern = re.compile(r'^\s*\t+\s*◦?\s*(\d+)\s*\t*(.*)$')
    
    for page_idx in range(total_pages):
        page = doc.load_page(page_idx)
        rect = page.rect
        w = rect.width
        h = rect.height
        mid_x = w / 2
        
        blocks = page.get_text("blocks")
        
        header_block_texts = []
        body_blocks = []
        
        for b in blocks:
            x0, y0, x1, y1, text, block_no, block_type = b
            text_clean = normalize_nfc(text).strip()
            
            # 页脚及纯数字页码过滤逻辑：放宽到 h - 15，防止切掉正文最底行
            if y1 > h - 15:
                continue
            if text_clean.isdigit():
                continue
                
            # 页眉块的判定条件
            is_header_block = False
            if y0 < 65:
                clean_for_match = re.sub(r'[^가-힣a-zA-Z0-9]', '', text_clean)
                if "남한" in text_clean or "북한" in text_clean:
                    is_header_block = True
                else:
                    for k in ko_to_book:
                        if k in clean_for_match or ko_to_book[k]['ko'] in clean_for_match:
                            is_header_block = True
                            break
            
            if is_header_block:
                header_block_texts.append(text_clean)
            else:
                x_mid = (x0 + x1) / 2
                if x_mid < mid_x:
                    body_blocks.append((y0, text))
        
        # 统一解析合并后的页眉文本
        page_header_book = None
        page_header_chapter = None
        page_header_chapters = []
        page_header_text = "\n".join(header_block_texts)
        combined_clean = re.sub(r'[^가-힣a-zA-Z0-9]', '', page_header_text)
        
        is_final_header_valid = False
        if "남한" in page_header_text or "북한" in page_header_text:
            is_final_header_valid = True
        else:
            for k in ko_to_book:
                if combined_clean == k or combined_clean == ko_to_book[k]['ko']:
                    is_final_header_valid = True
                    break
                    
        if is_final_header_valid:
            match = header_pattern.search(page_header_text)
            if match:
                book_name = re.sub(r'\s+', '', match.group(1))
                start_ch = int(match.group(2))
                end_ch = int(match.group(3)) if match.group(3) else start_ch
                
                if book_name in ko_to_book:
                    page_header_book = ko_to_book[book_name]
                    page_header_chapter = start_ch
                    page_header_chapters = list(range(start_ch, end_ch + 1))
            else:
                # 纯书名或无章号的标头页
                for k in ko_to_book:
                    if k == combined_clean or ko_to_book[k]['ko'] == combined_clean:
                        page_header_book = ko_to_book[k]
                        page_header_chapter = 1
                        page_header_chapters = [1]
                        break
        
        if page_header_book:
            if current_book_meta is None or current_book_meta['code'] != page_header_book['code']:
                current_book_meta = page_header_book
                current_chapter = page_header_chapter or 1
                print(f"Page {page_idx + 1}: 检测到书籍切换: {current_book_meta['ko']} ({current_book_meta['code']}), 从第 {current_chapter} 章开始, 触发页眉: {repr(page_header_text)}")
            elif page_header_chapter and page_header_chapter > current_chapter:
                print(f"Page {page_idx + 1}: 检测到页眉章号更新: {current_chapter} -> {page_header_chapter}, 触发页眉: {repr(page_header_text)}")
                current_chapter = page_header_chapter
                
            # 保证范围内所有的章都在 bible_data 中提前初始化
            book_code = current_book_meta['code']
            if book_code not in bible_data:
                bible_data[book_code] = {}
            for ch in page_header_chapters:
                if ch not in bible_data[book_code]:
                    bible_data[book_code][ch] = {}
        
        if not current_book_meta:
            continue
            
        book_code = current_book_meta['code']
        if book_code not in bible_data:
            bible_data[book_code] = {}
            
        body_blocks.sort(key=lambda x: x[0])
        
        for y0, block_text in body_blocks:
            raw_lines = block_text.split('\n')
            
            i = 0
            while i < len(raw_lines):
                line = normalize_nfc(raw_lines[i])
                line_strip = line.strip()
                
                if not line_strip:
                    i += 1
                    continue
                
                ch_match = chapter_num_pattern.match(line_strip)
                if ch_match:
                    ch_val = int(ch_match.group(1))
                    if ch_val == current_chapter + 1 or (current_chapter == 1 and ch_val == 1):
                        print(f"Page {page_idx + 1}: 检测到本文章号更新: {current_chapter} -> {ch_val}")
                        current_chapter = ch_val
                        if current_chapter not in bible_data[book_code]:
                            bible_data[book_code][current_chapter] = {}
                        i += 1
                        continue
                
                if current_chapter not in bible_data[book_code]:
                    bible_data[book_code][current_chapter] = {}
                
                v_match = verse_pattern.match(line)
                if v_match:
                    v_num = int(v_match.group(1))
                    v_text = v_match.group(2).strip()
                    
                    v_lines = [v_text]
                    j = i + 1
                    while j < len(raw_lines):
                        next_line = normalize_nfc(raw_lines[j])
                        next_line_strip = next_line.strip()
                        if not next_line_strip:
                            j += 1
                            continue
                        if verse_pattern.match(next_line) or chapter_num_pattern.match(next_line_strip):
                            break
                        v_lines.append(next_line_strip)
                        j += 1
                    
                    final_v_text = clean_text_spacing(v_lines)
                    bible_data[book_code][current_chapter][v_num] = final_v_text
                    i = j
                else:
                    if 1 not in bible_data[book_code][current_chapter]:
                        v_lines = [line_strip]
                        j = i + 1
                        while j < len(raw_lines):
                            next_line = normalize_nfc(raw_lines[j])
                            next_line_strip = next_line.strip()
                            if not next_line_strip:
                                j += 1
                                continue
                            if verse_pattern.match(next_line) or chapter_num_pattern.match(next_line_strip):
                                break
                            v_lines.append(next_line_strip)
                            j += 1
                        bible_data[book_code][current_chapter][1] = clean_text_spacing(v_lines)
                        i = j
                    else:
                        active_verses = list(bible_data[book_code][current_chapter].keys())
                        if active_verses:
                            last_v = max(active_verses)
                            prev_text = bible_data[book_code][current_chapter][last_v]
                            v_lines = [prev_text, line_strip]
                            j = i + 1
                            while j < len(raw_lines):
                                next_line = normalize_nfc(raw_lines[j])
                                next_line_strip = next_line.strip()
                                if not next_line_strip:
                                    j += 1
                                    continue
                                if verse_pattern.match(next_line) or chapter_num_pattern.match(next_line_strip):
                                    break
                                v_lines.append(next_line_strip)
                                j += 1
                            bible_data[book_code][current_chapter][last_v] = clean_text_spacing(v_lines)
                            i = j
                        else:
                            bible_data[book_code][current_chapter][1] = line_strip
                            i += 1

    return bible_data

def save_bible_json(bible_data, books_list, output_dir):
    """
    保存为结构化的 JSON 文件
    """
    os.makedirs(output_dir, exist_ok=True)
    meta_by_code = {b['code']: b for b in books_list}
    
    for book_code, chapters in bible_data.items():
        if book_code not in meta_by_code:
            print(f"警告: 未在书籍元数据中找到代码 {book_code}")
            continue
            
        meta = meta_by_code[book_code]
        
        book_json = {
            "book": meta['ko'],
            "bookEn": meta['en'],
            "abbr": meta['en'],
            "chapters": []
        }
        
        abbr_map = {
            "gen": "Gen", "exo": "Exo", "lev": "Lev", "num": "Num", "deu": "Deu",
            "jos": "Jos", "jdg": "Jdg", "rut": "Rut", "1sa": "1Sa", "2sa": "2Sa",
            "1ki": "1Ki", "2ki": "2Ki", "1ch": "1Ch", "2ch": "2Ch", "ezr": "Ezr",
            "neh": "Neh", "est": "Est", "job": "Job", "psa": "Psa", "pro": "Pro",
            "ecc": "Ecc", "sng": "Sng", "isa": "Isa", "jer": "Jer", "lam": "Lam",
            "ezk": "Ezk", "dan": "Dan", "hos": "Hos", "joe": "Joe", "amo": "Amo",
            "oba": "Oba", "jon": "Jon", "mic": "Mic", "nah": "Nah", "hab": "Hab",
            "zep": "Zep", "hag": "Hag", "zec": "Zec", "mal": "Mal",
            "mat": "Mat", "mrk": "Mrk", "luk": "Luk", "jhn": "Jhn", "act": "Act",
            "rom": "Rom", "1co": "1Co", "2co": "2Co", "gal": "Gal", "eph": "Eph",
            "php": "Php", "col": "Col", "1th": "1Th", "2th": "2Th", "1ti": "1Ti",
            "2ti": "2Ti", "tit": "Tit", "phm": "Phm", "heb": "Heb", "jas": "Jas",
            "1pe": "1Pe", "2pe": "2Pe", "1jn": "1Jn", "2jn": "2Jn", "3jn": "3Jn",
            "jud": "Jud", "rev": "Rev"
        }
        
        book_json["abbr"] = abbr_map.get(book_code, meta['en'])
        
        sorted_chapter_nums = sorted(list(chapters.keys()))
        for ch_num in sorted_chapter_nums:
            verses_dict = chapters[ch_num]
            ch_data = {
                "chapter": ch_num,
                "verses": []
            }
            sorted_verse_nums = sorted(list(verses_dict.keys()))
            for v_num in sorted_verse_nums:
                ch_data["verses"].append({
                    "verse": v_num,
                    "text": verses_dict[v_num]
                })
            book_json["chapters"].append(ch_data)
            
        output_file = os.path.join(output_dir, f"{book_code}.json")
        with open(output_file, 'w', encoding='utf-8') as out_f:
            json.dump(book_json, out_f, ensure_ascii=False, indent=4)
        print(f"成功保存: {output_file} ({len(book_json['chapters'])} 章)")

if __name__ == "__main__":
    workspace_dir = "/Users/joseph/Desktop/PROJECT/huidu-ob"
    manifest_path = os.path.join(workspace_dir, "data/manifest.json")
    output_dir = os.path.join(workspace_dir, "data/bible/nkv")
    
    pdf_ot = None
    pdf_nt = None
    
    files = os.listdir(workspace_dir)
    for f in files:
        f_norm = normalize_nfc(f)
        if f_norm.endswith(".pdf"):
            if "구약" in f_norm:
                pdf_ot = os.path.join(workspace_dir, f)
            elif "신약" in f_norm:
                pdf_nt = os.path.join(workspace_dir, f)
                
    print(f"找到旧约 PDF: {pdf_ot}")
    print(f"找到新约 PDF: {pdf_nt}")
    
    if not pdf_ot or not pdf_nt:
        print("错误: 未找到旧约或新约 PDF 文件！")
        exit(1)
        
    ot_ko_to_book, nt_ko_to_book, books_list = load_manifest(manifest_path)
    
    # 1. 解析新约
    print("\n--- 开始解析新约 ---")
    nt_data = parse_pdf(pdf_nt, nt_ko_to_book, is_new_testament=True)
    save_bible_json(nt_data, books_list, output_dir)
    
    # 2. 解析旧约
    print("\n--- 开始解析旧约 ---")
    ot_data = parse_pdf(pdf_ot, ot_ko_to_book, is_new_testament=False)
    save_bible_json(ot_data, books_list, output_dir)
    
    print("\n北韩圣经 PDF 数据解析并转换 JSON 完成！")
