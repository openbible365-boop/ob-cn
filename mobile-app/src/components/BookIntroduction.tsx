import { Icon } from "./Icon";
import { SkeletonScreen } from "./SkeletonScreen";
import type { Book, CommentarySection } from "../data/scripture";

// 精读本各卷绪论，数据来自注释包的 "0" 章键（PDF 原书提取）。
// 版面对应原书的三段式：档案框表（标题/作者/年代…）→ 论述专文 → 大纲。

// 档案栏目：原书绪论开头的框表，App 里合成一张档案卡
const FACT_LABELS = ["标题", "作者", "写作年代", "写作目的", "写作背景", "特点"];

// 大纲行的层级：第一部 → 一．→ 1．→ 1）
function outlineLevel(line: string): number {
  if (/^第[一二三四五六七八九十]+部/.test(line)) return 0;
  if (/^[一二三四五六七八九十]+[．.、]/.test(line)) return 1;
  if (/^\d+[．.]/.test(line)) return 2;
  if (/^\d+[）)]/.test(line)) return 3;
  return 2;
}

// 行尾的经文范围（…/1:1-2:25）拆出来弱化显示
function splitOutlineRef(line: string): [string, string] {
  const at = line.lastIndexOf("/");
  if (at > 0 && /^\d+:\d/.test(line.slice(at + 1))) {
    return [line.slice(0, at), line.slice(at + 1)];
  }
  return [line, ""];
}

function OutlineBlock({ body, fontSize }: { body: string; fontSize: number }) {
  return (
    <div className="intro-outline" style={{ fontSize: Math.max(13, fontSize - 3) }}>
      {body.split("\n").map((line, index) => {
        const [name, ref] = splitOutlineRef(line.trim());
        if (!name) return null;
        return (
          <div className={`intro-outline-row is-l${outlineLevel(name)}`} key={index}>
            <span>{name}</span>
            {ref && <small>{ref}</small>}
          </div>
        );
      })}
    </div>
  );
}

export function BookIntroduction({
  book,
  displayBook,
  sections,
  loadError,
  fontSize,
  translate = (text) => text,
  onStart,
}: {
  book: Book;
  displayBook: string;
  sections: CommentarySection[] | null;
  loadError: boolean;
  fontSize: number;
  translate?: (text: string) => string;
  onStart: () => void;
}) {
  const facts = (sections ?? []).filter((s) => FACT_LABELS.includes(s.title));
  const articles = (sections ?? []).filter((s) => !FACT_LABELS.includes(s.title));

  const jumpTo = (index: number) => {
    document.getElementById(`intro-article-${index}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="annotation-introduction">
      {/* 扉页式卷首：渐变纸面渐隐入正文，底纹用书名首字，与分享卡同一套品牌语言 */}
      <header className="annotation-intro-hero">
        <span className="intro-hero-watermark" aria-hidden="true">{Array.from(displayBook)[0]}</span>
        <div className="annotation-intro-eyebrow">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <path d="M12 2.5c.9 5.2 3.4 7.7 8.6 8.6-5.2.9-7.7 3.4-8.6 8.6-.9-5.2-3.4-7.7-8.6-8.6 5.2-.9 7.7-3.4 8.6-8.6Z" />
          </svg>
          {translate("精读本注释")} · {translate("绪论")}
        </div>
        <h1>{displayBook}</h1>
        <div className="annotation-intro-meta">
          <span>{translate(book.order <= 39 ? "旧约" : "新约")} · {translate("共")} {book.chapters} {translate("章")}</span>
          {/* 想直接读经的人不必滚到底 */}
          <button type="button" className="intro-start-inline" onClick={onStart}>
            {translate("进入第 1 章")} <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </header>

      {loadError && (
        <div className="annotation-status-card" role="alert">{translate("绪论加载失败，请检查网络后重试。")}</div>
      )}
      {sections === null && !loadError && <SkeletonScreen variant="verses" label={translate("正在加载绪论")} />}

      {facts.length > 0 && (
        <section className="intro-facts-card" aria-label={translate("书卷档案")}>
          {facts.map((fact) => {
            const [value, ...rest] = fact.body.split("\n");
            const detail = rest.join("\n").trim();
            // 只有这三项有真正的「值」（书名/人名/年代）；目的与特点是整段论述，
            // 首行只是折行产物，加粗会把句子劈断
            const VALUED = ["标题", "作者", "写作年代"];
            const hasValue = VALUED.includes(fact.title) && value.length <= 24 && detail;
            return (
              <div className="intro-fact-row" key={fact.title}>
                <small>{translate(fact.title)}</small>
                <div>
                  {hasValue ? (
                    <>
                      <b>{translate(value)}</b>
                      <p>{translate(detail)}</p>
                    </>
                  ) : (
                    <p>{translate(fact.body.replace(/\n/g, ""))}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {articles.length > 1 && (
        <nav className="intro-toc" aria-label={translate("绪论目录")}>
          {articles.map((section, index) => (
            <button type="button" key={`${section.title}-${index}`} onClick={() => jumpTo(index)}>
              {translate(section.title)}
            </button>
          ))}
        </nav>
      )}

      {articles.map((section, index) => (
        <section
          className="annotation-intro-section"
          id={`intro-article-${index}`}
          key={`${section.title}-${index}`}
        >
          <h2><span>{translate(section.title)}</span></h2>
          {section.title === "大纲" ? (
            <OutlineBlock body={translate(section.body)} fontSize={fontSize} />
          ) : (
            <p
              className="annotation-intro-body"
              style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}
            >
              {translate(section.body)}
            </p>
          )}
        </section>
      ))}

      {sections !== null && (
        <button className="annotation-intro-start" type="button" onClick={onStart}>
          <span><small>{translate("绪论读完")}</small>{translate("进入第 1 章")}</span>
          <Icon name="chevron-right" size={20} />
        </button>
      )}
    </div>
  );
}
