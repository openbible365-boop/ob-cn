import { Icon } from "./Icon";
import type { Book } from "../data/scripture";

type IntroductionProfile = {
  category: string;
  subtitle: string;
  description: string;
  themes: string[];
};

function introductionProfile(book: Book, displayBook: string): IntroductionProfile {
  const profiles = [
    { end: 5, category: "摩西五经", subtitle: "创造、圣约与救赎的开端", description: "从神的创造与拣选出发，认识圣约、救赎以及神子民蒙召的根基。", themes: ["神的作为与启示", "圣约与救赎历史", "神子民的身份与使命"] },
    { end: 17, category: "历史书", subtitle: "在历史中看见神的信实", description: "透过以色列民族的兴衰，观察信靠、悖逆、管教与恢复交织的救赎历史。", themes: ["应许之地", "信靠与顺服", "管教与恢复"] },
    { end: 22, category: "诗歌智慧书", subtitle: "敬拜、苦难与智慧人生", description: "从祷告、诗歌和智慧教导中，学习在真实人生里敬畏神、认识自己。", themes: ["敬畏与智慧", "敬拜与祷告", "苦难中的信心"] },
    { end: 27, category: "大先知书", subtitle: "审判中的盼望与复兴", description: "聆听先知对罪恶的责备，也看见神对余民、救赎与复兴不改变的应许。", themes: ["圣洁与公义", "审判与悔改", "弥赛亚与复兴"] },
    { end: 39, category: "小先知书", subtitle: "归向神，重寻信实与公义", description: "在不同历史处境中聆听先知的呼召，重新理解悔改、公义与盟约之爱。", themes: ["悔改归向神", "社会公义", "盟约之爱"] },
    { end: 43, category: "福音书", subtitle: "认识耶稣基督与天国福音", description: "从耶稣的生平、教导、受死与复活，认识福音的核心以及门徒的道路。", themes: ["耶稣基督", "天国福音", "十字架与复活"] },
    { end: 44, category: "教会历史", subtitle: "福音从耶路撒冷传到地极", description: "跟随圣灵在初代教会中的工作，看见福音如何跨越地域与文化不断扩展。", themes: ["圣灵的工作", "教会的建立", "福音的扩展"] },
    { end: 57, category: "保罗书信", subtitle: "福音真理与教会生活", description: "从福音的教义根基出发，思想信徒生命、群体关系以及教会使命。", themes: ["因信得生", "在基督里的生命", "教会与使命"] },
    { end: 65, category: "普通书信", subtitle: "持守真道，活出真实信仰", description: "在试炼与挑战中坚守信仰，让所信的真理落实在品格、关系和盼望里。", themes: ["信心与行为", "苦难中的忍耐", "真理与相爱"] },
    { end: 66, category: "启示文学", subtitle: "在终末盼望中忠心到底", description: "在象征性的异象中看见基督最终的得胜，并以敬拜与忠心回应神。", themes: ["基督掌权", "审判与得胜", "新天新地的盼望"] },
  ];
  const profile = profiles.find((item) => book.order <= item.end) ?? profiles[profiles.length - 1];
  return { ...profile, description: `${displayBook}属于${profile.category}。${profile.description}` };
}

function readingStages(chapters: number) {
  if (chapters <= 3) return [{ label: "全书", range: `1–${chapters}章` }];
  const firstEnd = Math.ceil(chapters / 3);
  const secondEnd = Math.ceil((chapters * 2) / 3);
  return [
    { label: "开篇 · 主题展开", range: `1–${firstEnd}章` },
    { label: "中篇 · 信息推进", range: `${firstEnd + 1}–${secondEnd}章` },
    { label: "结篇 · 回应与盼望", range: `${secondEnd + 1}–${chapters}章` },
  ];
}

export function BookIntroduction({
  book,
  displayBook,
  fontSize,
  onStart,
}: {
  book: Book;
  displayBook: string;
  fontSize: number;
  onStart: () => void;
}) {
  const profile = introductionProfile(book, displayBook);
  return (
    <div className="annotation-introduction">
      <header className="annotation-intro-hero">
        <div className="annotation-intro-eyebrow">书卷阅读导览</div>
        <h1>{displayBook}</h1>
        <p>{profile.subtitle}</p>
        <div className="annotation-intro-meta">
          {book.order <= 39 ? "旧约" : "新约"} · {profile.category} · 共 {book.chapters} 章
        </div>
      </header>

      <section className="annotation-intro-section">
        <h2>本卷定位</h2>
        <p style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}>{profile.description}</p>
      </section>

      <section className="annotation-intro-section">
        <h2>导览说明</h2>
        <p style={{ fontSize, lineHeight: fontSize >= 19 ? 1.76 : 1.85 }}>
          本页提供书卷分类与阅读路线，帮助开始通读；它不是经过逐卷审订的正式绪论。详细背景与结构请结合每章「本章导读」和可靠注释阅读。
        </p>
      </section>

      <section className="annotation-intro-section">
        <h2>阅读重点</h2>
        <ul className="annotation-intro-themes">
          {profile.themes.map((theme) => <li key={theme}>{theme}</li>)}
        </ul>
      </section>

      <section className="annotation-intro-section">
        <h2>阅读路线</h2>
        <div className="annotation-intro-stages">
          {readingStages(book.chapters).map((stage) => (
            <div key={stage.label}>
              <strong>{stage.label}</strong>
              <small>{stage.range}</small>
            </div>
          ))}
        </div>
      </section>

      <button className="annotation-intro-start" type="button" onClick={onStart}>
        <span><small>开始阅读</small>{displayBook} 第 1 章</span>
        <Icon name="chevron-right" size={20} />
      </button>
    </div>
  );
}
