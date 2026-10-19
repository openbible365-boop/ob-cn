// 今日金句：31 条精选经文按「一年中的第几天」轮换，全端同一天看到同一句。
// 文本为和合本（公版），与 data/bible/cuv 的经文一致。
export type DailyVerse = {
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
};

const VERSES: DailyVerse[] = [
  { book: "psa", chapter: 119, verse: 105, reference: "诗篇 119:105", text: "你的话是我脚前的灯，是我路上的光。" },
  { book: "psa", chapter: 23, verse: 1, reference: "诗篇 23:1", text: "耶和华是我的牧者，我必不至缺乏。" },
  { book: "jhn", chapter: 3, verse: 16, reference: "约翰福音 3:16", text: "神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。" },
  { book: "pro", chapter: 3, verse: 5, reference: "箴言 3:5", text: "你要专心仰赖耶和华，不可倚靠自己的聪明。" },
  { book: "isa", chapter: 41, verse: 10, reference: "以赛亚书 41:10", text: "你不要害怕，因为我与你同在；不要惊惶，因为我是你的　神。" },
  { book: "mat", chapter: 11, verse: 28, reference: "马太福音 11:28", text: "凡劳苦担重担的人，可以到我这里来，我就使你们得安息。" },
  { book: "rom", chapter: 8, verse: 28, reference: "罗马书 8:28", text: "我们晓得万事都互相效力，叫爱　神的人得益处。" },
  { book: "psa", chapter: 46, verse: 1, reference: "诗篇 46:1", text: "神是我们的避难所，是我们的力量，是我们在患难中随时的帮助。" },
  { book: "jhn", chapter: 14, verse: 27, reference: "约翰福音 14:27", text: "我留下平安给你们，我将我的平安赐给你们。" },
  { book: "2co", chapter: 5, verse: 17, reference: "哥林多后书 5:17", text: "若有人在基督里，他就是新造的人，旧事已过，都变成新的了。" },
  { book: "psa", chapter: 37, verse: 5, reference: "诗篇 37:5", text: "当将你的事交托耶和华，并倚靠他，他就必成全。" },
  { book: "isa", chapter: 40, verse: 31, reference: "以赛亚书 40:31", text: "但那等候耶和华的必从新得力。他们必如鹰展翅上腾。" },
  { book: "mat", chapter: 6, verse: 33, reference: "马太福音 6:33", text: "你们要先求他的国和他的义，这些东西都要加给你们了。" },
  { book: "1jn", chapter: 4, verse: 19, reference: "约翰一书 4:19", text: "我们爱，因为　神先爱我们。" },
  { book: "heb", chapter: 13, verse: 8, reference: "希伯来书 13:8", text: "耶稣基督昨日、今日、一直到永远，是一样的。" },
  { book: "psa", chapter: 121, verse: 1, reference: "诗篇 121:1", text: "我要向山举目，我的帮助从何而来？" },
  { book: "1pe", chapter: 5, verse: 7, reference: "彼得前书 5:7", text: "你们要将一切的忧虑卸给　神，因为他顾念你们。" },
  { book: "jos", chapter: 1, verse: 9, reference: "约书亚记 1:9", text: "你当刚强壮胆！不要惧怕，也不要惊惶，因为你无论往哪里去，耶和华你的　神必与你同在。" },
  { book: "lam", chapter: 3, verse: 22, reference: "耶利米哀歌 3:22", text: "我们不至消灭，是出于耶和华诸般的慈爱，是因他的怜悯不至断绝。" },
  { book: "eph", chapter: 2, verse: 8, reference: "以弗所书 2:8", text: "你们得救是本乎恩，也因着信；这并不是出于自己，乃是　神所赐的。" },
  { book: "2ti", chapter: 1, verse: 7, reference: "提摩太后书 1:7", text: "因为　神赐给我们不是胆怯的心，乃是刚强、仁爱、谨守的心。" },
  { book: "psa", chapter: 27, verse: 1, reference: "诗篇 27:1", text: "耶和华是我的亮光，是我的拯救，我还怕谁呢？" },
  { book: "jhn", chapter: 8, verse: 12, reference: "约翰福音 8:12", text: "我是世界的光。跟从我的，就不在黑暗里走，必要得着生命的光。" },
  { book: "mat", chapter: 5, verse: 16, reference: "马太福音 5:16", text: "你们的光也当这样照在人前，叫他们看见你们的好行为，便将荣耀归给你们在天上的父。" },
  { book: "col", chapter: 3, verse: 23, reference: "歌罗西书 3:23", text: "无论做什么，都要从心里做，像是给主做的，不是给人做的。" },
  { book: "psa", chapter: 103, verse: 2, reference: "诗篇 103:2", text: "我的心哪，你要称颂耶和华，不可忘记他的一切恩惠。" },
  { book: "zep", chapter: 3, verse: 17, reference: "西番雅书 3:17", text: "耶和华你的　神是施行拯救、大有能力的主，他在你中间必因你欢欣喜乐。" },
  { book: "php", chapter: 4, verse: 6, reference: "腓立比书 4:6", text: "应当一无挂虑，只要凡事藉着祷告、祈求和感谢，将你们所要的告诉　神。" },
  { book: "gal", chapter: 2, verse: 20, reference: "加拉太书 2:20", text: "我已经与基督同钉十字架，现在活着的不再是我，乃是基督在我里面活着。" },
  { book: "jer", chapter: 29, verse: 11, reference: "耶利米书 29:11", text: "我知道我向你们所怀的意念是赐平安的意念，不是降灾祸的意念，要叫你们末后有指望。" },
  { book: "psa", chapter: 118, verse: 24, reference: "诗篇 118:24", text: "这是耶和华所定的日子，我们在其中要高兴欢喜。" },
];

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function getDailyVerse(date = new Date()): DailyVerse {
  return VERSES[dayOfYear(date) % VERSES.length];
}
