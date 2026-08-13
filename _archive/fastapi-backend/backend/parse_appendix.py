"""
解析「附录.pdf」(主题式圣经词典)为结构化词条。

基于 PDF 文本坐标的解析（而非纯文本行）：
  该 PDF 为三栏排版，每栏内有清晰的缩进层级——
    词头(headword)  顶格(栏最左 x)
    编号小点 1./① 略缩进
    经文/释义细目    更缩进
  因此「词头永远顶格、正文一律缩进」是可靠信号，可干净区分词头与折行续写，
  避免旧版把折行正文/整句经文误判成独立词条(残片)的问题。

词条结构：
  词名 (English) 【人/地】 含义      <- 专名词条头
  词名 (English) 含义                <- 专名词条头(无类型标记)
  词名                               <- 主题词条头
  <若干行释义正文，内含经文引用如 可14:36 或 头胎……创10:15>

输出 dict 列表：{term, english, kind, gloss, body}
"""
import re
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pypdf import PdfReader

PDF_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '附录.pdf')

# 专名词头：词 (English) 【人/地】 含义
HEAD_TYPED = re.compile(
    r'^(?P<term>[一-鿿·]+)\s*[\(（](?P<en>[A-Za-z0-9 \-\.\'’]+)[\)）]\s*【(?P<kind>[^】]+)】\s*(?P<gloss>.*)$'
)
# 专名词头(缺【类型】标记)：词 (English) 含义
HEAD_NOKIND = re.compile(
    r'^(?P<term>[一-鿿·]+)\s*[\(（](?P<en>[A-Za-z0-9 \-\.\'’]+)[\)）]\s*(?P<gloss>.*)$'
)
# 纯主题词头：仅由中文(含间隔号)组成的首段
TOPIC_TERM = re.compile(r'^[一-鿿·]+')
# 紧凑专名词条的「含义」行：整行纯中文短语(≤16字，可含常见标点)，无英文/数字/经文。
# 用于把被误判成词头的含义归回上一专名词条。
BARE_MEANING = re.compile(r'^[一-鿿·，,。、：:；;！!？?]{1,16}$')
# 折行到下一行的「【类型】 含义」(词头行止于英文括号，类型与含义换行)
KIND_GLOSS = re.compile(r'^【(?P<kind>[^】]+)】\s*(?P<gloss>.*)$')
# 行首是这些字符的，一定不是词头（编号/圈码/交叉引用/省略号/标点）
NONHEAD_START = re.compile(r'^[0-9０-９①-⑳⓪→·．\.\-—…，,。;；:：、（()“"]')
# 经文引用行：书名(1-3中文字)+章:节，如 创24:67 / 林后7:6。这类行虽顶格也不是词头。
SCRIPTURE_LINE = re.compile(r'^[一-鿿]{1,3}\d{1,3}[:：]\d')
HEADER = '主题式圣经词典'
SECTION = re.compile(r'^-+\s*[A-Za-z]\s*-+$')

# ── 正文折行合并：判断某行是否“新逻辑行”(保留换行)，否则视作上一行的折行续写并拼接 ──
# 新逻辑行：编号(1. ①)、交叉引用(→)、经文整句引用(书名章:节)、关键词细目(含……)
_BODY_NEWLINE = re.compile(r'^(?:[0-9０-９]+[.\．、]|[①-⑳⓪]|→|[一-鿿]{1,3}\d{1,3}[:：]\d)')

X_HEAD_TOL = 3.0      # 行首 x 距栏基准 <= 该值 视为顶格(词头)
Y_TOL = 2.8           # 同一物理行的 y 容差
COL_GAP = 40.0        # 栏间 x 间隔阈值


def _page_lines(page):
    """提取一页 -> 按栏、按行重建的 [(col_idx, xmin, base, y, text)]，已按阅读顺序(栏→上到下)排序。"""
    frags = []
    def v(text, cm, tm, font, size):
        t = text.strip()
        if not t:
            return
        if t.startswith(HEADER) or t.isdigit() or SECTION.match(t):
            return
        frags.append([tm[4], tm[5], t])
    page.extract_text(visitor_text=v)
    if not frags:
        return []

    # 1) 用 x 间隔聚类出栏边界
    xs = sorted(f[0] for f in frags)
    bounds = []
    for i in range(1, len(xs)):
        if xs[i] - xs[i-1] > COL_GAP:
            bounds.append((xs[i-1] + xs[i]) / 2)

    def col_of(x):
        c = 0
        for b in bounds:
            if x > b:
                c += 1
        return c

    cols = [[] for _ in range(len(bounds) + 1)]
    for x, y, t in frags:
        cols[col_of(x)].append((x, y, t))

    out = []
    for ci, bucket in enumerate(cols):
        if not bucket:
            continue
        bucket.sort(key=lambda f: (-f[1], f[0]))   # 栏内 y 降序、x 升序
        lines = []
        for x, y, t in bucket:
            if lines and abs(lines[-1]['y'] - y) <= Y_TOL:   # 同 y 合并为一物理行
                lines[-1]['parts'].append((x, t))
            else:
                lines.append({'y': y, 'parts': [(x, t)]})
        base = min(min(p[0] for p in ln['parts']) for ln in lines)
        raw = []
        for ln in lines:
            ln['parts'].sort(key=lambda p: p[0])
            raw.append([ln['parts'][0][0], ' '.join(p[1] for p in ln['parts'])])
        # 折行专名合并：顶格行若括号未闭合(英文名换行)，吸收下一行
        i = 0
        while i < len(raw):
            xmin, text = raw[i]
            while xmin <= base + X_HEAD_TOL and _unclosed_paren(text) and i + 1 < len(raw):
                nxt = raw[i + 1][1]
                tail = text.rstrip()
                joiner = '' if tail[-1:] in ('-', '(', '（') else ' '
                text = tail + joiner + nxt.lstrip()
                i += 1
            out.append((ci, xmin, base, text))
            i += 1
    return out


def _unclosed_paren(text):
    return (text.count('(') + text.count('（')) > (text.count(')') + text.count('）'))


def _normalize_body(body_lines):
    """合并经文/释义的折行：非“新逻辑行”的行拼到上一行，避免一句经文被拆成多段。"""
    merged = []
    for ln in body_lines:
        ln = ln.strip()
        if not ln:
            continue
        if merged and not _BODY_NEWLINE.match(ln):
            merged[-1] += ln
        else:
            merged.append(ln)
    return '\n'.join(merged).strip()


def parse(max_pages=6, page_range=None):
    reader = PdfReader(PDF_PATH)
    pages = page_range if page_range is not None else range(min(max_pages, len(reader.pages)))
    entries = []
    cur = None

    def flush():
        nonlocal cur
        # 合法词头必以中文起首；三栏交错偶尔残留「【地】…」「shalal-…)」等碎片，丢弃以免污染词典。
        if cur and cur['term'] and re.match(r'^[一-鿿]', cur['term']):
            cur['body'] = _normalize_body(cur['body_lines'])
            del cur['body_lines']
            entries.append(cur)
        cur = None

    for pno in pages:
        for ci, xmin, base, text in _page_lines(reader.pages[pno]):
            # 含「……」的是关键词细目/经文行(正文)，即便顶格也不是词头
            is_head = (xmin <= base + X_HEAD_TOL) and not NONHEAD_START.match(text) \
                and not SCRIPTURE_LINE.match(text) and '…' not in text
            if not is_head:
                if cur is not None:
                    cur['body_lines'].append(text)
                continue
            # 紧凑专名词条：【类型】/含义折到下一行、缩排≈顶格(在 X_HEAD_TOL 内)，会被误判成新词头并夺走正文。
            # 若上一词条是专名(有 english)且含义为空、尚无正文，则紧随的顶格行其实属于它，归回不另起词头：
            #   ① 「【类型】 含义」折行  ② 纯中文/短标点的含义短语
            if cur is not None and cur.get('english') and not cur['gloss']:
                km = KIND_GLOSS.match(text)
                if km:   # 「【类型】 含义」折行：本词典正文几乎不含【】，可不限是否已有正文
                    if not cur['kind']:
                        cur['kind'] = km.group('kind').strip()
                    if km.group('gloss').strip():
                        cur['gloss'] = km.group('gloss').strip()
                    continue
                if not cur['body_lines'] and not HEAD_TYPED.match(text) \
                        and not HEAD_NOKIND.match(text) and BARE_MEANING.match(text):
                    cur['gloss'] = text.strip()
                    continue
            flush()
            m = HEAD_TYPED.match(text)
            m2 = HEAD_NOKIND.match(text) if not m else None
            if m:
                cur = {'term': m.group('term').strip(), 'english': m.group('en').strip(),
                       'kind': m.group('kind').strip(), 'gloss': m.group('gloss').strip(),
                       'body_lines': []}
            elif m2:
                cur = {'term': m2.group('term').strip(), 'english': m2.group('en').strip(),
                       'kind': '', 'gloss': m2.group('gloss').strip(), 'body_lines': []}
            else:
                # 纯主题词头：取首个中文段为词名，其后(若有空格+正文)切回正文，修复同行串入的 body
                tm = TOPIC_TERM.match(text)
                term = tm.group(0) if tm else text.strip()
                rest = text[len(term):].strip()
                cur = {'term': term.strip(), 'english': '', 'kind': '', 'gloss': '',
                       'body_lines': [rest] if rest else []}
        # 翻页不 flush，词条可能跨页续写
    flush()
    return entries


if __name__ == '__main__':
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    items = parse(max_pages)
    print(f'解析页数={max_pages}，词条数={len(items)}\n')
    for e in items[:20]:
        tag = f" ({e['english']})" if e['english'] else ''
        kind = f" 【{e['kind']}】" if e['kind'] else ''
        gl = f"  含义={e['gloss']}" if e['gloss'] else ''
        print(f"■ {e['term']}{tag}{kind}{gl}")
        if e['body']:
            print(f"   {e['body'][:120]}")
