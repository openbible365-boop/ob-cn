import os
import json
import re

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("BeautifulSoup4 is not installed. Please run: pip install beautifulsoup4")
    exit(1)

JINGDU_DIR = "commentary/Jingdu"
OUTPUT_DIR = "data/commentary/jingdu"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def clean_html(tag):
    """移除 HTML 标签中的所有属性（如 class, id 等），使其更干净"""
    for t in tag.find_all(True):
        t.attrs = {}
    tag.attrs = {}
    return str(tag)

def process_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html_content = f.read()

    soup = BeautifulSoup(html_content, 'html.parser')
    
    commentaries = []
    
    # Extract overviews (灰框)
    overview_tags = soup.find_all('p', class_=re.compile(r'注释-正文-灰框'))
    for tag in overview_tags:
        title_span = tag.find('span', class_='注释-正文标题')
        if title_span:
            verses = title_span.get_text(strip=True).replace(' ', '')
            # Remove the title span to get the rest of the text
            title_span.extract()
            # Remove english title variations if any
            eng_span = tag.find('span', class_='注释-正文标题-英文')
            if eng_span:
                eng_span.extract()
            text = tag.get_text(strip=True)
            commentaries.append({
                "type": "overview",
                "verses": verses,
                "text": text,
                "html": clean_html(tag) # we keep the raw html minus the verse ranges for formatting
            })
            
    # Extract specific verse commentaries
    verse_tags = soup.find_all('p', class_='注释-正文')
    for tag in verse_tags:
        title_span = tag.find('span', class_='注释-正文标题')
        if title_span:
            verses_text = title_span.get_text(strip=True)
            # Sometimes it has '1:1 空虚混沌:'
            verses_match = re.match(r'^([\d:,-]+)(.*)', verses_text)
            if verses_match:
                verses_ref = verses_match.group(1).strip()
                title_text = verses_match.group(2).strip()
                # we can put title_text back to string if it's not empty, but simpler is just extract span
                title_span.extract()
                text = tag.get_text(strip=True)
                if title_text:
                     text = f"{title_text}{text}"
                
                commentaries.append({
                    "type": "commentary",
                    "verses": verses_ref,
                    "text": text,
                    "html": clean_html(tag)
                })

    return commentaries

def main():
    if not os.path.exists(JINGDU_DIR):
        print(f"Directory {JINGDU_DIR} not found.")
        return

    file_pattern = re.compile(r'^(\d+)-(\d+)\.html$')
    
    all_books_data = {}

    for filename in os.listdir(JINGDU_DIR):
        match = file_pattern.match(filename)
        if match:
            book_id = match.group(1)
            chapter_id = match.group(2)
            filepath = os.path.join(JINGDU_DIR, filename)
            
            # Read and process
            print(f"Processing {filename}...")
            comm_data = process_html_file(filepath)
            
            if book_id not in all_books_data:
                all_books_data[book_id] = {}
            
            all_books_data[book_id][chapter_id] = comm_data

    # Save to JSON
    for book_id, chapters in all_books_data.items():
        # Sort chapters numerically
        sorted_chapters = dict(sorted(chapters.items(), key=lambda item: int(item[0])))
        
        output_file = os.path.join(OUTPUT_DIR, f"{book_id}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sorted_chapters, f, ensure_ascii=False, indent=2)
            
    print("Conversion completed successfully.")

if __name__ == "__main__":
    main()
