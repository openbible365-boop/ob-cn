#!/usr/bin/env python3
"""Copy bible + jingdu data from openbible/data into ob-cn/data, normalized
to canonical 66 book codes, and generate data/manifest.json."""
import json
import shutil
from pathlib import Path

SRC = Path("/Users/joseph/Desktop/PROJECT/openbible/data")
DST = Path("/Users/joseph/Desktop/PROJECT/ob-cn/data")

# Protestant canon, canonical order (matches jingdu file numbering 1-66).
CANON = (
    "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job "
    "psa pro ecc sng isa jer lam ezk dan hos joe amo oba jon mic nah hab zep "
    "hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti "
    "2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev"
).split()
assert len(CANON) == 66

ALIASES = {
    "jhn": ["joh"], "ezk": ["eze"], "jas": ["jam"], "mat": ["matt"],
    "mrk": ["mar"], "sng": ["son"], "joe": ["jol"], "nah": ["nam"],
    "1jn": ["1jo"], "2jn": ["2jo"], "3jn": ["3jo"],
}

VERSIONS = [
    # code, source dir, display label, language
    ("cuv", "zh/cuv", "和合本", "zh"),
    ("cnvs", "zh/cnvs", "新译本", "zh"),
    ("pinyin", "zh/pinyin", "拼音和合本", "zh"),
    ("krv", "ko/krv", "개역한글", "ko"),
    ("keb", "ko/keb", "쉬운성경", "ko"),
    ("snr", "ko/snr", "새번역", "ko"),
    ("kjv", "en/kjv", "KJV", "en"),
]


def resolve(src_dir: Path, code: str) -> Path:
    for cand in [code, *ALIASES.get(code, [])]:
        p = src_dir / f"{cand}.json"
        if p.exists():
            return p
    raise FileNotFoundError(f"{src_dir} has no file for {code}")


def main():
    names = {}  # code -> {zh, ko, en}
    chapters = {}  # code -> chapter count (from cuv)

    for vcode, subdir, label, lang in VERSIONS:
        src_dir = SRC / subdir
        out = DST / "bible" / vcode
        out.mkdir(parents=True, exist_ok=True)
        for code in CANON:
            src = resolve(src_dir, code)
            shutil.copyfile(src, out / f"{code}.json")
        print(f"{vcode}: 66 books copied")

    # Book display names: zh from cuv, ko from krv, en from kjv (cnvs's
    # `book` field is unreliable — it repeats the file code).
    for code in CANON:
        zh = json.loads((DST / "bible/cuv" / f"{code}.json").read_text())
        ko = json.loads((DST / "bible/krv" / f"{code}.json").read_text())
        en = json.loads((DST / "bible/kjv" / f"{code}.json").read_text())
        names[code] = {"zh": zh["book"], "ko": ko["book"], "en": en["book"]}
        chapters[code] = len(zh["chapters"])

    jd_out = DST / "commentary" / "jingdu"
    jd_out.mkdir(parents=True, exist_ok=True)
    for i in range(1, 67):
        shutil.copyfile(SRC / "commentary/jingdu" / f"{i}.json", jd_out / f"{i}.json")
    print("jingdu: 66 books copied")

    manifest = {
        "versions": [
            {"code": v[0], "label": v[2], "lang": v[3]} for v in VERSIONS
        ],
        "books": [
            {
                "order": i + 1,
                "code": code,
                "zh": names[code]["zh"],
                "ko": names[code]["ko"],
                "en": names[code]["en"],
                "chapters": chapters[code],
            }
            for i, code in enumerate(CANON)
        ],
    }
    (DST / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    )
    print("manifest.json written")

    # Sanity: jingdu numbering should match canon order (43 = John).
    j43 = json.loads((jd_out / "43.json").read_text())
    assert "3" in j43, "jingdu 43 (John) should have chapter 3"
    print("sanity OK — books:", names["jhn"], "| john chapters:", chapters["jhn"])


main()
