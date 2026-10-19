#!/usr/bin/env python3
"""
Convert "拼音圣经全书 第二版.pdf" into HTML ruby JSON files in data/bible/pinyin2.
Uses the standard CUV (和合本) as the skeletal reference to ensure zero dropped text/verses,
aligns PDF-extracted Pinyin character streams with CUV using SequenceMatcher,
and falls back to existing pinyin data for unaligned characters.
"""

import os
import re
import sys
import json
import time
import difflib
from pathlib import Path
import fitz  # PyMuPDF

# Paths
WORKSPACE = Path("/Users/joseph/Desktop/PROJECT/ob-cn")
PDF_PATH = WORKSPACE / "拼音圣经全书 第二版.pdf"
CUV_DIR = WORKSPACE / "data/bible/cuv"
OLD_PINYIN_DIR = WORKSPACE / "data/bible/pinyin"
OUT_DIR = WORKSPACE / "data/bible/pinyin2"

# 66 books canon list (matches canonical order and filenames)
CANON = (
    "gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job "
    "psa pro ecc sng isa jer lam ezk dan hos joe amo oba jon mic nah hab zep "
    "hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti "
    "2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev"
).split()

# Book page mappings from PDF Table of Contents (TOC)
# Format: (book_code, start_page_number_1_indexed)
BOOK_PAGES = [
    ("gen", 13), ("exo", 130), ("lev", 223), ("num", 290), ("deu", 385),
    ("jos", 467), ("jdg", 526), ("rut", 582), ("1sa", 590), ("2sa", 664),
    ("1ki", 725), ("2ki", 795), ("1ch", 863), ("2ch", 929), ("ezr", 1007),
    ("neh", 1030), ("est", 1063), ("job", 1079), ("psa", 1136), ("pro", 1289),
    ("ecc", 1336), ("sng", 1353), ("isa", 1363), ("jer", 1481), ("lam", 1613),
    ("ezk", 1624), ("dan", 1737), ("hos", 1772), ("joe", 1790), ("amo", 1797),
    ("oba", 1811), ("jon", 1814), ("mic", 1819), ("nah", 1830), ("hab", 1835),
    ("zep", 1840), ("hag", 1846), ("zec", 1850), ("mal", 1870),
    ("mat", 1881), ("mrk", 1956), ("luk", 2003), ("jhn", 2084), ("act", 2146),
    ("rom", 2224), ("1co", 2257), ("2co", 2290), ("gal", 2312), ("eph", 2323),
    ("php", 2334), ("col", 2342), ("1th", 2350), ("2th", 2358), ("1ti", 2362),
    ("2ti", 2371), ("tit", 2378), ("phm", 2382), ("heb", 2384), ("jas", 2409),
    ("1pe", 2418), ("2pe", 2428), ("1jn", 2434), ("2jn", 2443), ("3jn", 2445),
    ("jud", 2447), ("rev", 2450)
]

# PDF text matching regex: pinyin contains tone marks and specific glyphs (e.g. ɑ, ɡ)
PINYIN_RE = re.compile(r"^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑɡńňǹ\u0261\u0304\u0301\u030c\u0300]+$")

# Parse helper
def is_pinyin(s):
    return bool(PINYIN_RE.match(s))

def extract_old_pinyin_pairs(old_json_path):
    """
    Parse existing pinyin json file to build a mapping dictionary of (ch_idx, v_idx, char_occurrence_index) -> pinyin.
    This serves as a high-fidelity fallback source if characters are omitted in the second-edition PDF.
    """
    if not old_json_path.exists():
        return {}
    
    with open(old_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    fallback_map = {} # (ch_idx, v_idx, char, occurrence_num) -> pinyin
    ruby_re = re.compile(r'<ruby>([\u4e00-\u9fff])<rt class="[^"]*">([^<]*)</rt></ruby>')
    
    for ch_idx, ch in enumerate(data.get("chapters", [])):
        for v_idx, v in enumerate(ch.get("verses", [])):
            text = v.get("text", "")
            matches = ruby_re.findall(text)
            
            # Count occurrences of each character in this verse
            char_counts = {}
            for char, pinyin in matches:
                char_counts[char] = char_counts.get(char, 0) + 1
                fallback_map[(ch_idx, v_idx, char, char_counts[char])] = pinyin
                
    return fallback_map

def extract_pdf_pinyin_pairs(doc, start_page, end_page):
    """
    Load pages from the PDF document and extract ordered pairs of (ChineseCharacter, Pinyin).
    It filters out running headers, page numbers, and InDesign artifacts.
    """
    pairs = []
    # Note: start_page and end_page are 1-indexed page numbers.
    # fitz uses 0-indexed page numbers.
    for page_idx in range(start_page - 1, end_page):
        if page_idx >= len(doc):
            break
        page = doc.load_page(page_idx)
        blocks = page.get_text("blocks")
        
        # Parse blocks in their read-order sequence
        for b in blocks:
            text = b[4]
            # Exclude InDesign markers and plain page numbers
            if ".indd" in text or re.match(r"^-\s*\d+\s*-$", text.strip()):
                continue
            
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            
            # Look for lines of Chinese characters and their corresponding Pinyin line below
            i = 0
            while i < len(lines):
                if i + 1 < len(lines) and is_pinyin(lines[i+1]):
                    char_str = lines[i]
                    pinyin_str = lines[i+1]
                    chars = [c for c in char_str if '\u4e00' <= c <= '\u9fff']
                    if chars:
                        # Grab the last Chinese character in the line (handles prepended punctuation)
                        pairs.append({
                            "char": chars[-1],
                            "pinyin": pinyin_str
                        })
                    i += 2
                else:
                    i += 1
    return pairs

def main():
    print("=================== Pinyin Bible PDF to JSON Converter ===================")
    
    # Verify paths
    if not PDF_PATH.exists():
        print(f"Error: PDF file not found at {PDF_PATH}")
        sys.exit(1)
        
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Open PyMuPDF Doc
    print(f"Opening PDF: {PDF_PATH.name}...")
    doc = fitz.open(str(PDF_PATH))
    print(f"Total PDF pages: {len(doc)}")
    
    total_aligned = 0
    total_cuv_chars = 0
    
    # Process book by book
    for idx, (book, start_page) in enumerate(BOOK_PAGES):
        # Determine the page range for this book
        if idx + 1 < len(BOOK_PAGES):
            end_page = BOOK_PAGES[idx+1][1] - 1
        else:
            end_page = 2486  # Revelation ends around page 2486 (2487/2488 are blank pages)
            
        print(f"\nProcessing [{idx+1:02d}/66] {book} | Pages: {start_page} - {end_page}...", end="", flush=True)
        
        # 1. Load CUV skeleton
        cuv_json_path = CUV_DIR / f"{book}.json"
        if not cuv_json_path.exists():
            print(f" ERROR: CUV file {cuv_json_path.name} not found!")
            continue
        with open(cuv_json_path, "r", encoding="utf-8") as f:
            cuv_data = json.load(f)
            
        # 2. Extract PDF Pairs
        pdf_pairs = extract_pdf_pinyin_pairs(doc, start_page, end_page)
        
        # 3. Load Old Pinyin Fallback Map
        old_pinyin_path = OLD_PINYIN_DIR / f"{book}.json"
        fallback_map = extract_old_pinyin_pairs(old_pinyin_path)
        
        # 4. Flatten CUV characters and track metadata
        cuv_chars = [] # list of dicts
        for ch_idx, ch in enumerate(cuv_data["chapters"]):
            for v_idx, v in enumerate(ch["verses"]):
                # Count character occurrence frequencies inside this verse for fallback lookups
                char_verse_counts = {}
                for char_idx, char in enumerate(v["text"]):
                    if '\u4e00' <= char <= '\u9fff':
                        char_verse_counts[char] = char_verse_counts.get(char, 0) + 1
                        cuv_chars.append({
                            "char": char,
                            "ch_idx": ch_idx,
                            "v_idx": v_idx,
                            "char_idx": char_idx,
                            "occurrence_num": char_verse_counts[char]
                        })
                        
        cuv_chars_str = "".join([x["char"] for x in cuv_chars])
        pdf_chars_str = "".join([x["char"] for x in pdf_pairs])
        
        # 5. Run difflib sequence alignment
        matcher = difflib.SequenceMatcher(None, cuv_chars_str, pdf_chars_str)
        matching_blocks = matcher.get_matching_blocks()
        
        # Assign pinyin to aligned characters
        for block in matching_blocks:
            c_start, p_start, size = block
            for i in range(size):
                c_idx = c_start + i
                p_idx = p_start + i
                cuv_chars[c_idx]["pinyin"] = pdf_pairs[p_idx]["pinyin"]
                cuv_chars[c_idx]["source"] = "pdf"
                
        # 6. Apply fallback for unaligned characters
        aligned_in_book = 0
        fallback_in_book = 0
        missed_in_book = 0
        
        for x in cuv_chars:
            if "pinyin" in x:
                aligned_in_book += 1
            else:
                # Fallback to old pinyin map
                fallback_key = (x["ch_idx"], x["v_idx"], x["char"], x["occurrence_num"])
                pinyin_val = fallback_map.get(fallback_key)
                if pinyin_val:
                    x["pinyin"] = pinyin_val
                    x["source"] = "fallback"
                    fallback_in_book += 1
                else:
                    missed_in_book += 1
                    
        # 7. Construct HTML ruby text back into CUV structure
        for ch_idx, ch in enumerate(cuv_data["chapters"]):
            for v_idx, v in enumerate(ch["verses"]):
                # Filter out chars belonging to this verse
                verse_chars = [x for x in cuv_chars if x["ch_idx"] == ch_idx and x["v_idx"] == v_idx]
                
                result_text = []
                char_ptr = 0
                for char in v["text"]:
                    if '\u4e00' <= char <= '\u9fff':
                        vc = verse_chars[char_ptr]
                        char_ptr += 1
                        
                        # Guard sanity check
                        assert vc["char"] == char, f"Character mismatch in reconstruction! CUV: {char}, Aligned: {vc['char']}"
                        
                        pinyin = vc.get("pinyin")
                        if pinyin:
                            result_text.append(f'<ruby>{char}<rt class="_idGenRuby-3">{pinyin}</rt></ruby>')
                        else:
                            result_text.append(char)
                    else:
                        # Non-chinese characters (punctuation, digits, brackets) keep as-is
                        result_text.append(char)
                v["text"] = "".join(result_text)
                
        # Write back pinyin2 book JSON
        out_json_path = OUT_DIR / f"{book}.json"
        with open(out_json_path, "w", encoding="utf-8") as f:
            json.dump(cuv_data, f, ensure_ascii=False, indent=4)
            
        book_chars = len(cuv_chars)
        total_cuv_chars += book_chars
        total_aligned += (aligned_in_book + fallback_in_book)
        
        # Book reporting
        cov_pct = (aligned_in_book / book_chars * 100) if book_chars > 0 else 100.0
        tot_cov_pct = ((aligned_in_book + fallback_in_book) / book_chars * 100) if book_chars > 0 else 100.0
        print(f" Aligned: {aligned_in_book}/{book_chars} ({cov_pct:.1f}%), Fallback: {fallback_in_book}, Missed: {missed_in_book}. Total Coverage: {tot_cov_pct:.2f}%")
        
    doc.close()
    
    # Print summary metrics
    print("\n=================== CONVERSION COMPLETE ===================")
    print(f"Total processed Chinese characters: {total_cuv_chars}")
    print(f"Total successfully annotated: {total_aligned} ({total_aligned / total_cuv_chars * 100:.3f}%)")
    print(f"Output files stored in: {OUT_DIR.relative_to(WORKSPACE)}")
    
    # Run sanity checks
    run_validation()

def run_validation():
    """
    Perform a series of strict verification assertions to ensure structural and content compliance.
    """
    print("\nRunning Validation Suite...")
    issues = []
    
    # Check 1: File count
    pinyin2_files = list(OUT_DIR.glob("*.json"))
    if len(pinyin2_files) != 66:
        issues.append(f"Expected 66 JSON files, found {len(pinyin2_files)}")
        
    for book in CANON:
        p2_path = OUT_DIR / f"{book}.json"
        cuv_path = CUV_DIR / f"{book}.json"
        
        if not p2_path.exists():
            issues.append(f"Missing output file: {book}.json")
            continue
            
        with open(p2_path, "r", encoding="utf-8") as f:
            p2_data = json.load(f)
        with open(cuv_path, "r", encoding="utf-8") as f:
            cuv_data = json.load(f)
            
        # Check 2: Structure
        for field in ["book", "bookEn", "abbr", "chapters"]:
            if field not in p2_data:
                issues.append(f"{book}.json is missing root field: '{field}'")
                
        # Check 3: Chapters & Verses matching count
        if len(p2_data.get("chapters", [])) != len(cuv_data.get("chapters", [])):
            issues.append(f"{book}.json chapter count mismatch: CUV has {len(cuv_data['chapters'])}, Output has {len(p2_data['chapters'])}")
            continue
            
        for ch_idx, (p2_ch, cuv_ch) in enumerate(zip(p2_data["chapters"], cuv_data["chapters"])):
            if len(p2_ch.get("verses", [])) != len(cuv_ch.get("verses", [])):
                issues.append(f"{book}.json Ch.{ch_idx+1} verse count mismatch: CUV has {len(cuv_ch['verses'])}, Output has {len(p2_ch['verses'])}")
                continue
                
            for v_idx, (p2_v, cuv_v) in enumerate(zip(p2_ch["verses"], cuv_ch["verses"])):
                # Check 4: Text content equivalence (by stripping HTML ruby tags)
                p2_raw_text = re.sub(r'<ruby>([\u4e00-\u9fff])<rt class="[^"]*">[^<]*</rt></ruby>', r'\1', p2_v["text"])
                if p2_raw_text != cuv_v["text"]:
                    issues.append(f"{book}.json Ch.{ch_idx+1} V.{v_idx+1} raw text mismatch. Original CUV has different wording/punctuation.")
                    
    if issues:
        print("❌ Validation FAILED! Found the following issues:")
        for issue in issues[:10]:
            print(f" - {issue}")
        if len(issues) > 10:
            print(f" ... and {len(issues) - 10} more issues.")
        sys.exit(1)
    else:
        print("✅ Validation PASSED! Structure, counts, and texts are 100% compliant with standard CUV.")

if __name__ == "__main__":
    main()
