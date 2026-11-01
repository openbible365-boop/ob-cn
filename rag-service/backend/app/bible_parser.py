import re

# 66 卷书的标准缩写与中英日韩别名映射表
BOOK_ALIASES = {
    "GEN": ["创世记", "创", "Genesis", "Gen", "Ge", "창세기", "창", "創世記", "創"],
    "EXO": ["出埃及记", "出", "Exodus", "Ex", "Exo", "출애굽기", "출", "出エジプト記", "出"],
    "LEV": ["利未记", "利", "Leviticus", "Lev", "Le", "레위기", "레", "レビ記", "レビ"],
    "NUM": ["民数记", "民", "Numbers", "Num", "Nu", "민수기", "민", "民数記", "民"],
    "DEU": ["申命记", "申", "Deuteronomy", "Deut", "Dt", "신명기", "신", "申命記", "申"],
    "JOSH": ["约书亚记", "书", "Joshua", "Josh", "Jos", "여호수아", "여", "ヨシュア記", "ヨシュ"],
    "JUDG": ["士师记", "士", "Judges", "Judg", "Jg", "사사기", "사", "士師記", "士"],
    "RUTH": ["路得记", "得", "Ruth", "Ru", "rut", "루기", "룻", "ルツ記", "ルツ"],
    "1SA": ["撒母耳记上", "撒上", "1 Samuel", "1 Sam", "1Sa", "1S", "사무엘상", "삼상", "サムエル記上", "サム上"],
    "2SA": ["撒母耳记下", "撒下", "2 Samuel", "2 Sam", "2Sa", "2S", "사무엘하", "삼하", "サムエル記下", "サム下"],
    "1KI": ["列王纪上", "王上", "1 Kings", "1 Ki", "1Kin", "열왕기상", "왕상", "列王記上", "列上"],
    "2KI": ["列王纪下", "王下", "2 Kings", "2 Ki", "2Kin", "열왕기하", "왕하", "列王記下", "列下"],
    "1CH": ["历代志上", "代上", "1 Chronicles", "1 Chr", "1Ch", "역대기상", "대상", "歴代誌上", "代上"],
    "2CH": ["历代志下", "代下", "2 Chronicles", "2 Chr", "2Ch", "역대기하", "대하", "歴代誌下", "代下"],
    "EZR": ["以斯拉记", "拉", "Ezra", "Ezr", "Ez", "에스라", "스", "エズラ記", "エズ"],
    "NEH": ["尼希米记", "尼", "Nehemiah", "Neh", "Ne", "느헤미야", "느", "ネヘミヤ記", "ネヘ"],
    "EST": ["以斯帖记", "帖", "Esther", "Est", "Es", "에스더", "에", "エステル記", "エス"],
    "JOB": ["约伯记", "伯", "Job", "요브기", "욥", "ヨブ記", "ヨブ"],
    "PSA": ["诗篇", "诗", "Psalms", "Psalm", "Psa", "Ps", "시편", "시", "诗", "詩篇", "诗", "詩"],
    "PRO": ["箴言", "箴", "Proverbs", "Prov", "Pr", "잠언", "잠", "箴言", "箴"],
    "ECC": ["传道书", "传", "Ecclesiastes", "Eccl", "Ec", "전도서", "전", "コヘレトの言葉", "コヘ", "伝道の書", "伝"],
    "SNG": ["雅歌", "歌", "Song of Solomon", "Song", "Sos", "아가", "아", "雅歌", "雅"],
    "ISA": ["以赛亚书", "赛", "Isaiah", "Isa", "Is", "이사야", "이사", "이", "イザヤ書", "イザ"],
    "JER": ["耶利米书", "耶", "Jeremiah", "Jer", "Je", "예레미야", "렘", "エレミヤ書", "エレ"],
    "LAM": ["耶利米哀歌", "哀", "Lamentations", "Lam", "La", "예레미야 애가", "애", "哀歌", "哀"],
    "EZK": ["以西结书", "结", "Ezekiel", "Ezek", "Ez", "에스겔", "겔", "エゼキエル書", "エゼ"],
    "DAN": ["提阿非罗", "但以理书", "但", "Daniel", "Dan", "Da", "다니엘", "단", "ダニエル書", "ダニ"],
    "HOS": ["何西阿书", "何", "Hosea", "Hos", "Ho", "호세아", "호", "ホセア書", "ホセ"],
    "JOL": ["约珥书", "珥", "Joel", "Jol", "Joe", "요엘", "요", "ヨエル書", "ヨエ"],
    "AMO": ["阿摩司书", "摩", "Amos", "Amo", "Am", "아모스", "암", "アモス書", "アモ"],
    "OBD": ["俄巴底亚书", "俄", "Obadiah", "Obad", "Ob", "오바디야", "옵", "オバデヤ書", "オバ"],
    "JON": ["约拿书", "拿", "Jonah", "Jon", "요나", "욘", "ヨナ書", "ヨナ"],
    "MIC": ["弥迦书", "弥", "Micah", "Mic", "Mi", "미가", "미", "ミカ書", "ミカ"],
    "NAM": ["那鸿书", "鸿", "Nahum", "Nah", "Na", "나훔", "나", "ナホム書", "ナホ"],
    "HAB": ["哈巴谷书", "哈", "Habakkuk", "Hab", "Ha", "하박국", "하", "ハバクク書", "ハバ"],
    "ZEP": ["西番雅书", "番", "Zephaniah", "Zeph", "Ze", "스바냐", "스", "ゼファニヤ書", "ゼフ"],
    "HAG": ["哈该书", "该", "Haggai", "Hag", "Hg", "학개", "학", "ハガイ書", "ハガ"],
    "ZEC": ["撒迦利亚书", "亚", "Zechariah", "Zech", "Zc", "스가랴", "스", "ゼカリヤ書", "ゼカ"],
    "MAL": ["玛拉基书", "玛", "Malachi", "Mal", "Ml", "말라기", "말", "マラキ書", "マラ"],
    "MAT": ["马太福音", "马太", "太", "Matthew", "Matt", "Mt", "마태복음", "마태", "마", "マタイによる福音書", "マタイ伝", "マタ"],
    "MRK": ["马可福音", "马可", "可", "Mark", "Mrk", "Mk", "마가복음", "마가", "막", "マルコによる福音書", "マルコ伝", "マル"],
    "LUK": ["路加福音", "路加", "路", "Luke", "Luk", "Lk", "누가복음", "누가", "누", "ルカによる福音書", "ルカ伝", "ルカ"],
    "JHN": ["约翰福音", "约翰", "约", "John", "Jhn", "Jn", "요한복음", "요한", "요", "ヨハネによる福音書", "ヨハネ伝", "ヨハ"],
    "ACT": ["使徒行传", "传", "使", "Acts", "Act", "Ac", "사도행전", "행", "使徒言行録", "使徒"],
    "ROM": ["罗马书", "罗马", "罗", "Romans", "Rom", "Ro", "로마서", "롬", "ローマ人への手紙", "ロマ"],
    "1CO": ["哥林多前书", "哥前", "1 Corinthians", "1 Cor", "1Co", "고集ど前书", "고전", "コリントの信徒への手紙一", "コリ前"],
    "2CO": ["哥林多后书", "哥后", "2 Corinthians", "2 Cor", "2Co", "고린도후서", "고후", "コリントの信徒への手紙二", "コリ后"],
    "GAL": ["加拉太书", "加", "Galatians", "Gal", "Ga", "갈라디아서", "갈", "ガラテヤの信徒への手紙", "ガラ"],
    "EPH": ["以弗所书", "弗", "Ephesians", "Eph", "Ep", "에베소서", "에", "エフェソの信徒への手紙", "エフェ"],
    "PHP": ["腓立比书", "腓", "Philippians", "Phil", "Php", "Ph", "빌립보서", "빌", "フィリピの信徒への手紙", "フィリ"],
    "COL": ["歌罗西书", "西", "Colossians", "Col", "Co", "골로새서", "골", "コロサイの信徒への手紙", "コロ"],
    "1TH": ["帖撒罗尼迦前书", "帖前", "1 Thessalonians", "1 Thess", "1Th", "데살로니가전서", "데전", "テサロニケの信徒への手紙一", "テサ前"],
    "2TH": ["帖撒罗尼迦后书", "帖后", "2 Thessalonians", "2 Thess", "2Th", "데살로니가후서", "데후", "テサロニケの信徒への手紙二", "テサ后"],
    "1TI": ["提摩太前书", "提前", "1 Timothy", "1 Tim", "1Ti", "디모데전서", "디전", "テモテへの手紙一", "テモ前"],
    "2TI": ["提摩太后书", "提后", "2 Timothy", "2 Tim", "2Ti", "디모데후서", "디후", "テモテへの手紙二", "テモ后"],
    "TIT": ["提多书", "多", "Titus", "Tit", "Ti", "디도서", "딛", "テトスへの手紙", "テト"],
    "PHM": ["腓利门书", "门", "Philemon", "Philem", "Phm", "Pm", "빌레몬서", "몬", "フィレモンへの手紙", "フィレ"],
    "HEB": ["希伯来书", "希", "Hebrews", "Heb", "He", "히브리서", "히", "ヘブライ人への手紙", "ヘブ"],
    "JAS": ["雅各书", "雅", "James", "Jas", "Ja", "야고보서", "야", "ヤコブの手紙", "ヤコ"],
    "1PE": ["彼得前书", "彼前", "1 Peter", "1 Pet", "1Pe", "1P", "베드로전서", "벧전", "ペトロの手紙一", "ペト前"],
    "2PE": ["彼得后书", "彼后", "2 Peter", "2 Pet", "2Pe", "2P", "베드로후서", "벧후", "ペトロの手紙二", "ペト后"],
    "1JN": ["约翰一书", "约一", "1 John", "1 Joh", "1Jn", "요한일서", "요일", "ヨハネの手紙一", "ヨハ一"],
    "2JN": ["约翰二书", "约二", "2 John", "2 Joh", "2Jn", "요한이서", "요이", "ヨハネの手紙二", "ヨハ二"],
    "3JN": ["约翰三书", "约三", "3 John", "3 Joh", "3Jn", "요한삼서", "요삼", "ヨハネの手紙三", "ヨハ三"],
    "JUD": ["犹大书", "犹", "Jude", "Jud", "유다서", "유", "ユダの手紙", "ユダ"],
    "REV": ["启示录", "启", "Revelation", "Rev", "Re", "요한계시록", "계시록", "계", "ヨハネの黙示録", "黙"],
}

# 构造别名反向查找字典，优化匹配速度
# key 为小写别名，value 为标准书卷 ID
ALIAS_TO_BOOK = {}
for book_id, aliases in BOOK_ALIASES.items():
    for alias in aliases:
        # 去掉空格，全部转小写
        clean_alias = alias.replace(" ", "").lower()
        ALIAS_TO_BOOK[clean_alias] = book_id

# 提取别名列表并按长度降序排列，保证前缀匹配
SORTED_ALIASES = sorted(list(ALIAS_TO_BOOK.keys()), key=len, reverse=True)


def parse_verse_reference(text: str) -> tuple[str, str] | None:
    """
    解析用户提问中的圣经引用，并返回规范化的 (verse_start, verse_end)。
    如：“约翰福音 3:16-18” -> (“JHN.3.16”, “JHN.3.18”)
       “요한복음 3:16” -> (“JHN.3.16”, “JHN.3.16”)
       “约 3 章 16 节” -> (“JHN.3.16”, “JHN.3.16”)
    """
    if not text:
        return None

    # 构建匹配书卷的正则表达式，将别名用 | 拼接
    alias_pattern = "|".join(re.escape(alias) for alias in SORTED_ALIASES)
    
    # 匹配三种主要模式：
    # 模式 1: 约3:16-18 或 约 3 : 16 - 18
    # 模式 2: 约3章16-18节 或 约 3 章 16 节
    # 模式 3: 约3:16
    pattern = re.compile(
        rf"\b({alias_pattern})\s*"                 # 组1: 书名别名
        r"(\d+)\s*"                               # 组2: 章号
        r"(?:章|:|：|\s)\s*"                       # 章与节的连接符
        r"(\d+)\s*"                               # 组3: 起始节号
        r"(?:(?:节|-|至|~|－|—)\s*(\d+)\s*节?)?",  # 组4: 结束节号（可选）
        re.IGNORECASE
    )

    match = pattern.search(text.replace(" ", ""))  # 压缩空格以方便匹配别名如 "1samuel"
    if not match:
        match = pattern.search(text)
        
    if match:
        alias = match.group(1).replace(" ", "").lower()
        book_id = ALIAS_TO_BOOK.get(alias)
        if not book_id:
            return None
            
        chapter = match.group(2)
        start_verse = match.group(3)
        end_verse = match.group(4)
        
        verse_start = f"{book_id}.{chapter}.{start_verse}"
        if end_verse:
            verse_end = f"{book_id}.{chapter}.{end_verse}"
        else:
            verse_end = verse_start
            
        return verse_start, verse_end
        
    # 如果没匹配到节，尝试只匹配到章：如“约翰福音3章”、“요한복음 3장”
    chapter_pattern = re.compile(
        rf"\b({alias_pattern})\s*"
        r"(\d+)\s*(?:章|장|chapter)?",
        re.IGNORECASE
    )
    match_chapter = chapter_pattern.search(text.replace(" ", ""))
    if not match_chapter:
        match_chapter = chapter_pattern.search(text)
        
    if match_chapter:
        alias = match_chapter.group(1).replace(" ", "").lower()
        book_id = ALIAS_TO_BOOK.get(alias)
        if book_id:
            chapter = match_chapter.group(2)
            return f"{book_id}.{chapter}.1", f"{book_id}.{chapter}.999"

    return None
