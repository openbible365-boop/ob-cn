// Generated from data/manifest.json — bible versions & the 66-book canon.
// Regenerate by re-running the data copy script if the corpus changes.

export type VersionCode = "cuv" | "cnvs" | "pinyin" | "krv" | "keb" | "snr" | "kjv";

export const VERSIONS: { code: VersionCode; label: string; lang: "zh" | "ko" | "en" }[] = [
  { code: "cuv", label: "和合本", lang: "zh" },
  { code: "cnvs", label: "新译本", lang: "zh" },
  { code: "pinyin", label: "拼音和合本", lang: "zh" },
  { code: "krv", label: "개역한글", lang: "ko" },
  { code: "keb", label: "쉬운성경", lang: "ko" },
  { code: "snr", label: "새번역", lang: "ko" },
  { code: "kjv", label: "KJV", lang: "en" },
];

export type Book = { order: number; code: string; zh: string; ko: string; en: string; chapters: number };

export const BOOKS: Book[] = [
  { order: 1, code: "gen", zh: "创世记", ko: "창세기", en: "Genesis", chapters: 50 },
  { order: 2, code: "exo", zh: "出埃及记", ko: "출애굽기", en: "Exodus", chapters: 40 },
  { order: 3, code: "lev", zh: "利未记", ko: "레위기", en: "Leviticus", chapters: 27 },
  { order: 4, code: "num", zh: "民数记", ko: "민수기", en: "Numbers", chapters: 36 },
  { order: 5, code: "deu", zh: "申命记", ko: "신명기", en: "Deuteronomy", chapters: 34 },
  { order: 6, code: "jos", zh: "约书亚记", ko: "여호수아기", en: "Joshua", chapters: 24 },
  { order: 7, code: "jdg", zh: "士师记", ko: "사사기", en: "Judges", chapters: 21 },
  { order: 8, code: "rut", zh: "路得记", ko: "룻기", en: "Ruth", chapters: 4 },
  { order: 9, code: "1sa", zh: "撒母耳记上", ko: "사무엘상", en: "1Samuel", chapters: 31 },
  { order: 10, code: "2sa", zh: "撒母耳记下", ko: "사무엘하", en: "2Samuel", chapters: 24 },
  { order: 11, code: "1ki", zh: "列王纪上", ko: "열왕기상", en: "1Kings", chapters: 22 },
  { order: 12, code: "2ki", zh: "列王纪下", ko: "열왕기하", en: "2Kings", chapters: 25 },
  { order: 13, code: "1ch", zh: "历代志上", ko: "역대기상", en: "1Chronicles", chapters: 29 },
  { order: 14, code: "2ch", zh: "历代志下", ko: "역대기하", en: "2Chronicles", chapters: 36 },
  { order: 15, code: "ezr", zh: "以斯拉记", ko: "에스라", en: "Ezra", chapters: 10 },
  { order: 16, code: "neh", zh: "尼希米记", ko: "느헤미야", en: "Nehemiah", chapters: 13 },
  { order: 17, code: "est", zh: "以斯帖记", ko: "에스더기", en: "Esther", chapters: 10 },
  { order: 18, code: "job", zh: "约伯记", ko: "욥기", en: "Job", chapters: 42 },
  { order: 19, code: "psa", zh: "诗篇", ko: "시편", en: "Psalms", chapters: 150 },
  { order: 20, code: "pro", zh: "箴言", ko: "잠언", en: "Proverbs", chapters: 31 },
  { order: 21, code: "ecc", zh: "传道书", ko: "전도서", en: "Ecclesiastes", chapters: 12 },
  { order: 22, code: "sng", zh: "雅歌", ko: "아가", en: "SongOfSongs", chapters: 8 },
  { order: 23, code: "isa", zh: "以赛亚书", ko: "이사야서", en: "Isaiah", chapters: 66 },
  { order: 24, code: "jer", zh: "耶利米书", ko: "예레미야서", en: "Jeremiah", chapters: 52 },
  { order: 25, code: "lam", zh: "耶利米哀歌", ko: "예레미야애가", en: "Lamentations", chapters: 5 },
  { order: 26, code: "ezk", zh: "以西结书", ko: "에스겔", en: "Ezekiel", chapters: 48 },
  { order: 27, code: "dan", zh: "但以理书", ko: "다니엘서", en: "Daniel", chapters: 12 },
  { order: 28, code: "hos", zh: "何西阿书", ko: "호세아서", en: "Hosea", chapters: 14 },
  { order: 29, code: "joe", zh: "约珥书", ko: "요엘서", en: "Joel", chapters: 3 },
  { order: 30, code: "amo", zh: "阿摩司书", ko: "아모스서", en: "Amos", chapters: 9 },
  { order: 31, code: "oba", zh: "俄巴底亚书", ko: "오바댜", en: "Obadiah", chapters: 1 },
  { order: 32, code: "jon", zh: "约拿书", ko: "요나서", en: "Jonah", chapters: 4 },
  { order: 33, code: "mic", zh: "弥迦书", ko: "미가", en: "Micah", chapters: 7 },
  { order: 34, code: "nah", zh: "那鸿书", ko: "나훔", en: "Nahum", chapters: 3 },
  { order: 35, code: "hab", zh: "哈巴谷书", ko: "하박국", en: "Habakkuk", chapters: 3 },
  { order: 36, code: "zep", zh: "西番雅书", ko: "스바냐", en: "Zephaniah", chapters: 3 },
  { order: 37, code: "hag", zh: "哈该书", ko: "학개", en: "Haggai", chapters: 2 },
  { order: 38, code: "zec", zh: "撒迦利亚书", ko: "스가랴", en: "Zechariah", chapters: 14 },
  { order: 39, code: "mal", zh: "玛拉基书", ko: "말라기", en: "Malachi", chapters: 4 },
  { order: 40, code: "mat", zh: "马太福音", ko: "마태복음", en: "Matthew", chapters: 28 },
  { order: 41, code: "mrk", zh: "马可福音", ko: "마가복음", en: "Mark", chapters: 16 },
  { order: 42, code: "luk", zh: "路加福音", ko: "누가복음", en: "Luke", chapters: 24 },
  { order: 43, code: "jhn", zh: "约翰福音", ko: "요한복음", en: "John", chapters: 21 },
  { order: 44, code: "act", zh: "使徒行传", ko: "사도행전", en: "Acts", chapters: 28 },
  { order: 45, code: "rom", zh: "罗马书", ko: "로마서", en: "Romans", chapters: 16 },
  { order: 46, code: "1co", zh: "哥林多前书", ko: "고린도전서", en: "1Corinthians", chapters: 16 },
  { order: 47, code: "2co", zh: "哥林多后书", ko: "고린도후서", en: "2Corinthians", chapters: 13 },
  { order: 48, code: "gal", zh: "加拉太书", ko: "갈라디아서", en: "Galatians", chapters: 6 },
  { order: 49, code: "eph", zh: "以弗所书", ko: "에베소서", en: "Ephesians", chapters: 6 },
  { order: 50, code: "php", zh: "腓立比书", ko: "빌립보서", en: "Philippians", chapters: 4 },
  { order: 51, code: "col", zh: "歌罗西书", ko: "골로새서", en: "Colossians", chapters: 4 },
  { order: 52, code: "1th", zh: "帖撒罗尼迦前书", ko: "데살로니가전서", en: "1Thessalonians", chapters: 5 },
  { order: 53, code: "2th", zh: "帖撒罗尼迦后书", ko: "데살로니가후서", en: "2Thessalonians", chapters: 3 },
  { order: 54, code: "1ti", zh: "提摩太前书", ko: "디모데전서", en: "1Timothy", chapters: 6 },
  { order: 55, code: "2ti", zh: "提摩太后书", ko: "디모데후서", en: "2Timothy", chapters: 4 },
  { order: 56, code: "tit", zh: "提多书", ko: "디도서", en: "Titus", chapters: 3 },
  { order: 57, code: "phm", zh: "腓利门书", ko: "빌레몬서", en: "Philemon", chapters: 1 },
  { order: 58, code: "heb", zh: "希伯来书", ko: "히브리서", en: "Hebrews", chapters: 13 },
  { order: 59, code: "jas", zh: "雅各书", ko: "야고보서", en: "James", chapters: 5 },
  { order: 60, code: "1pe", zh: "彼得前书", ko: "베드로전서", en: "1Peter", chapters: 5 },
  { order: 61, code: "2pe", zh: "彼得后书", ko: "베드로후서", en: "2Peter", chapters: 3 },
  { order: 62, code: "1jn", zh: "约翰一书", ko: "요한일서", en: "1John", chapters: 5 },
  { order: 63, code: "2jn", zh: "约翰二书", ko: "요한이서", en: "2John", chapters: 1 },
  { order: 64, code: "3jn", zh: "约翰三书", ko: "요한삼서", en: "3John", chapters: 1 },
  { order: 65, code: "jud", zh: "犹大书", ko: "유다서", en: "Jude", chapters: 1 },
  { order: 66, code: "rev", zh: "启示录", ko: "요한계시록", en: "Revelation", chapters: 22 },
];

export const DEFAULT_VERSION: VersionCode = "cuv";
export const DEFAULT_BOOK_ORDER = 43; // 约翰福音

export function getBook(order: number): Book {
  return BOOKS[Math.min(Math.max(order, 1), 66) - 1];
}

export function getVersion(code: string | undefined) {
  return VERSIONS.find((v) => v.code === code) ?? VERSIONS[0];
}

// Old Testament 1-39, New Testament 40-66 (for the book picker).
export const OT_BOOKS = BOOKS.slice(0, 39);
export const NT_BOOKS = BOOKS.slice(39);
