// Define the Bible books metadata for the catalog
const bibleMeta = {
    ot: [
        { id: "gen", name: "创世记", chapters: 50 },
        { id: "exo", name: "出埃及记", chapters: 40 },
        { id: "lev", name: "利未记", chapters: 27 },
        { id: "num", name: "民数记", chapters: 36 },
        { id: "deu", name: "申命记", chapters: 34 },
        { id: "jos", name: "约书亚记", chapters: 24 },
        { id: "jdg", name: "士师记", chapters: 21 },
        { id: "rut", name: "路得记", chapters: 4 },
        { id: "1sa", name: "撒母耳记上", chapters: 31 },
        { id: "2sa", name: "撒母耳记下", chapters: 24 },
        { id: "1ki", name: "列王纪上", chapters: 22 },
        { id: "2ki", name: "列王纪下", chapters: 25 },
        { id: "1ch", name: "历代志上", chapters: 29 },
        { id: "2ch", name: "历代志下", chapters: 36 },
        { id: "ezr", name: "以斯拉记", chapters: 10 },
        { id: "neh", name: "尼希米记", chapters: 13 },
        { id: "est", name: "以斯帖记", chapters: 10 },
        { id: "job", name: "约伯记", chapters: 42 },
        { id: "psa", name: "诗篇", chapters: 150 },
        { id: "pro", name: "箴言", chapters: 31 },
        { id: "ecc", name: "传道书", chapters: 12 },
        { id: "sng", name: "雅歌", chapters: 8 },
        { id: "isa", name: "以赛亚书", chapters: 66 },
        { id: "jer", name: "耶利米书", chapters: 52 },
        { id: "lam", name: "耶利米哀歌", chapters: 5 },
        { id: "ezk", name: "以西结书", chapters: 48 },
        { id: "dan", name: "但以理书", chapters: 12 },
        { id: "hos", name: "何西阿书", chapters: 14 },
        { id: "jol", name: "约珥书", chapters: 3 },
        { id: "amo", name: "阿摩司书", chapters: 9 },
        { id: "oba", name: "俄巴底亚书", chapters: 1 },
        { id: "jon", name: "约拿书", chapters: 4 },
        { id: "mic", name: "弥迦书", chapters: 7 },
        { id: "nah", name: "那鸿书", chapters: 3 },
        { id: "hab", name: "哈巴谷书", chapters: 3 },
        { id: "zep", name: "西番雅书", chapters: 3 },
        { id: "hag", name: "哈该书", chapters: 2 },
        { id: "zec", name: "撒迦利亚书", chapters: 14 },
        { id: "mal", name: "玛拉基书", chapters: 4 }
    ],
    nt: [
        { id: "mat", name: "马太福音", chapters: 28 },
        { id: "mrk", name: "马可福音", chapters: 16 },
        { id: "luk", name: "路加福音", chapters: 24 },
        { id: "jhn", name: "约翰福音", chapters: 21 },
        { id: "act", name: "使徒行传", chapters: 28 },
        { id: "rom", name: "罗马书", chapters: 16 },
        { id: "1co", name: "哥林多前书", chapters: 16 },
        { id: "2co", name: "哥林多后书", chapters: 13 },
        { id: "gal", name: "加拉太书", chapters: 6 },
        { id: "eph", name: "以弗所书", chapters: 6 },
        { id: "php", name: "腓立比书", chapters: 4 },
        { id: "col", name: "歌罗西书", chapters: 4 },
        { id: "1th", name: "帖撒罗尼迦前书", chapters: 5 },
        { id: "2th", name: "帖撒罗尼迦后书", chapters: 3 },
        { id: "1ti", name: "提摩太前书", chapters: 6 },
        { id: "2ti", name: "提摩太后书", chapters: 4 },
        { id: "tit", name: "提多书", chapters: 3 },
        { id: "phm", name: "腓利门书", chapters: 1 },
        { id: "heb", name: "希伯来书", chapters: 13 },
        { id: "jas", name: "雅各书", chapters: 5 },
        { id: "1pe", name: "彼得前书", chapters: 5 },
        { id: "2pe", name: "彼得后书", chapters: 3 },
        { id: "1jn", name: "约翰一书", chapters: 5 },
        { id: "2jn", name: "约翰二书", chapters: 1 },
        { id: "3jn", name: "约翰三书", chapters: 1 },
        { id: "jud", name: "犹大书", chapters: 1 },
        { id: "rev", name: "启示录", chapters: 22 }
    ]
};

// Mock Data for the OpenBible Application

const bibleData = {
    "cuv": {
        "gen": {
            "name": "创世记",
            "1": [
                { verse: 1, text: "起初，神创造天地。" },
                { verse: 2, text: "地是空虚混沌，渊面黑暗；神的灵运行在水面上。" },
                { verse: 3, text: "神说：“要有光”，就有了光。" },
                { verse: 4, text: "神看光是好的，就把光暗分开了。" },
                { verse: 5, text: "神称光为“昼”，称暗为“夜”。有晚上，有早晨，这是头一日。" },
                { verse: 6, text: "神说：“诸水之间要有空气，将水分为上下。”" },
                { verse: 7, text: "神就造出空气，将空气以下的水、空气以上的水分开了。事就这样成了。" },
                { verse: 8, text: "神称空气为“天”。有晚上，有早晨，是第二日。" },
                { verse: 9, text: "神说：“天下的水要聚在一处，使旱地露出来。”事就这样成了。" },
                { verse: 10, text: "神称旱地为“地”，称水的聚处为“海”。神看着是好的。" }
            ],
            "2": [
                { verse: 1, text: "天地万物都造齐了。" },
                { verse: 2, text: "到第七日，　神造物的工已经完毕，就在第七日歇了他一切的工，安息了。" },
                { verse: 3, text: "神赐福给第七日，定为圣日，因为在这日　神歇了他一切创造的工，就安息了。" },
                { verse: 4, text: "创造天地的来历，在耶和华　神造天地的日子，乃是这样：" },
                { verse: 5, text: "野地还没有草木，田间的菜蔬还没有长起来，因为耶和华　神还没有降雨在地上，也没有人耕地，" },
                { verse: 6, text: "但有雾气从地上腾，滋润遍地。" },
                { verse: 7, text: "耶和华　神用地上的尘土造人，将生气吹在他鼻孔里，他就成了有灵的活人，名叫亚当。" }
            ],
            "3": [
                { verse: 1, text: "耶和华　神所造的，惟有蛇比田野一切的活物更狡猾。蛇对女人说：“　神岂是真说不许你们吃园中所有树上的果子吗？”" },
                { verse: 2, text: "女人对蛇说：“园中树上的果子，我们可以吃；" },
                { verse: 3, text: "惟有园当中的那棵树上的果子，　神曾说：‘你们不可吃，也不可摸，免得你们死。’”" },
                { verse: 4, text: "蛇对女人说：“你们不一定死，“" },
                { verse: 5, text: "因为　神知道，你们吃的日子眼睛就明亮了，你们便如　神能知道善恶。”" }
            ]
        },
        "jhn": {
            "name": "约翰福音",
            "1": [
                { verse: 1, text: "太初有道，道与神同在，道就是神。" },
                { verse: 2, text: "这道太初与神同在。" },
                { verse: 3, text: "万物是藉着他造的；凡被造的，没有一样不是藉着他造的。" },
                { verse: 4, text: "生命在他里头，这生命就是人的光。" },
                { verse: 5, text: "光照在黑暗里，黑暗却不接受光。" }
            ],
            "2": [
                { verse: 1, text: "第三日，在加利利的迦拿有娶亲的筵席，耶稣的母亲在那里。" },
                { verse: 2, text: "耶稣和他的门徒也被请去赴席。" },
                { verse: 3, text: "酒用尽了，耶稣的母亲对他说：“他们没有酒了。”" },
                { verse: 4, text: "耶稣说：“母亲（原文作“妇人”），我与你有什么相干？我的时候还没有到。”" },
                { verse: 5, text: "他母亲对用人说：“他告诉你们什么，你们就作什么。”" }
            ],
            "3": [
                { verse: 1, text: "有一个法利赛人，名叫尼哥底母，是犹太人的官。" },
                { verse: 2, text: "这人夜里来见耶稣，说：“拉比，我们知道你是由　神那里来作师傅的；因为你所行的神迹，若没有　神同在，无人能行。”" },
                { verse: 3, text: "耶稣回答说：“我实实在在地告诉你：人若不重生，就不能见　神的国。”" },
                { verse: 4, text: "尼哥底母说：“人已经老了，如何能重生呢？岂能再进母腹生出来吗？”" },
                { verse: 5, text: "耶稣说：“我实实在在地告诉你：人若不是从水和圣灵生的，就不能进　神的国。" }
            ]
        }
    },
    "kjv": {
        "gen": {
            "name": "Genesis",
            "1": [
                { verse: 1, text: "In the beginning God created the heaven and the earth." },
                { verse: 2, text: "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters." },
                { verse: 3, text: "And God said, Let there be light: and there was light." },
                { verse: 4, text: "And God saw the light, that it was good: and God divided the light from the darkness." },
                { verse: 5, text: "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day." },
                { verse: 6, text: "And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters." },
                { verse: 7, text: "And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament: and it was so." },
                { verse: 8, text: "And God called the firmament Heaven. And the evening and the morning were the second day." },
                { verse: 9, text: "And God said, Let the waters under the heaven be gathered together unto one place, and let the dry land appear: and it was so." },
                { verse: 10, text: "And God called the dry land Earth; and the gathering together of the waters called he Seas: and God saw that it was good." }
            ],
            "2": [
                { verse: 1, text: "Thus the heavens and the earth were finished, and all the host of them." },
                { verse: 2, text: "And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made." },
                { verse: 3, text: "And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God created and made." },
                { verse: 4, text: "These are the generations of the heavens and of the earth when they were created, in the day that the LORD God made the earth and the heavens," },
                { verse: 5, text: "And every plant of the field before it was in the earth, and every herb of the field before it grew: for the LORD God had not caused it to rain upon the earth, and there was not a man to till the ground." },
                { verse: 6, text: "But there went up a mist from the earth, and watered the whole face of the ground." },
                { verse: 7, text: "And the LORD God formed man of the dust of the ground, and breathed into his nostrils the breath of life; and man became a living soul." }
            ],
            "3": [
                { verse: 1, text: "Now the serpent was more subtil than any beast of the field which the LORD God had made. And he said unto the woman, Yea, hath God said, Ye shall not eat of every tree of the garden?" },
                { verse: 2, text: "And the woman said unto the serpent, We may eat of the fruit of the trees of the garden:" },
                { verse: 3, text: "But of the fruit of the tree which is in the midst of the garden, God hath said, Ye shall not eat of it, neither shall ye touch it, lest ye die." },
                { verse: 4, text: "And the serpent said unto the woman, Ye shall not surely die:" },
                { verse: 5, text: "For God doth know that in the day ye eat thereof, then your eyes shall be opened, and ye shall be as gods, knowing good and evil." }
            ]
        },
        "jhn": {
            "name": "John",
            "1": [
                { verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
                { verse: 2, text: "The same was in the beginning with God." },
                { verse: 3, text: "All things were made by him; and without him was not any thing made that was made." },
                { verse: 4, text: "In him was life; and the life was the light of men." },
                { verse: 5, text: "And the light shineth in darkness; and the darkness comprehended it not." }
            ],
            "2": [
                { verse: 1, text: "And the third day there was a marriage in Cana of Galilee; and the mother of Jesus was there:" },
                { verse: 2, text: "And both Jesus was called, and his disciples, to the marriage." },
                { verse: 3, text: "And when they wanted wine, the mother of Jesus saith unto him, They have no wine." },
                { verse: 4, text: "Jesus saith unto her, Woman, what have I to do with thee? mine hour is not yet come." },
                { verse: 5, text: "His mother saith unto the servants, Whatsoever he saith unto you, do it." }
            ],
            "3": [
                { verse: 1, text: "There was a man of the Pharisees, named Nicodemus, a ruler of the Jews:" },
                { verse: 2, text: "The same came to Jesus by night, and said unto him, Rabbi, we know that thou art a teacher come from God: for no man can do these miracles that thou doest, except God be with him." },
                { verse: 3, text: "Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God." },
                { verse: 4, text: "Nicodemus saith unto him, How can a man be born when he is old? can he enter the second time into his mother's womb, and be born?" },
                { verse: 5, text: "Jesus answered, Verily, verily, I say unto thee, Except a man be born of water and of the Spirit, he cannot enter into the kingdom of God." }
            ]
        }
    },
    "niv": {
        "gen": {
            "name": "Genesis",
            "1": [
                { verse: 1, text: "In the beginning God created the heavens and the earth." },
                { verse: 2, text: "Now the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters." },
                { verse: 3, text: "And God said, \"Let there be light,\" and there was light." },
                { verse: 4, text: "God saw that the light was good, and he separated the light from the darkness." },
                { verse: 5, text: "God called the light \"day,\" and the darkness he called \"night.\" And there was evening, and there was morning—the first day." }
            ]
        },
        "jhn": {
            "name": "John",
            "1": [
                { verse: 1, text: "In the beginning was the Word, and the Word was with God, and the Word was God." },
                { verse: 2, text: "He was with God in the beginning." },
                { verse: 3, text: "Through him all things were made; without him nothing was made that has been made." },
                { verse: 4, text: "In him was life, and that life was the light of all mankind." },
                { verse: 5, text: "The light shines in the darkness, and the darkness has not overcome it." }
            ]
        }
    }
};

const mockCommentaries = {
    "gen-1-1": [
        { author: "精读本注释", text: "「起初，神创造天地。」<br><br>【起初】希伯来文 bereshith：指时间无始以来的起点，表明时间本身也是受造的。神超然地存在于时间之外。<br><br>【创造】希伯来文 bara：这个词在旧约中专门用作神的创造行动，意思是“从无中生有”(creatio ex nihilo)。这宣告了宇宙并非神明彼此争战产生，也非偶然，而是至高神主权旨意下的杰作。<br><br>【神创造】原文 Elohim bara：Elohim（神）是复数形式，但所搭配的动词 bara（创造）是单数。这初步暗示了三位一体上帝的奥秘：圣父、圣子、圣灵同尊同荣，共同参与了创造。" },
        { author: "Matthew Henry", text: "这里宣示了最大的真理：神存在，神创造了宇宙。与当时多神教神话形成强烈对比。" }
    ],
    "gen-1-2": [
        { author: "精读本注释", text: "「地是空虚混沌，渊面黑暗；神的灵运行在水面上。」<br><br>【空虚混沌】tohu wabhohu：指没有形状、缺乏内容的荒凉状态。但这并非最后结局，而是神预备施展大能的舞台。<br><br>【运行】原文意为“如母鸟搧展双翅覆育其雏”（申32:11）。圣灵如同一位保惠师，正以温柔且满有能力的方式，在看似荒废的水面上孕育生命，准备将秩序与美丽带来。" },
        { author: "John Calvin", text: "不可见的上帝在创造可见世界时表现了自己。宇宙是他荣耀的剧场。" }
    ],
    "gen-1-3": [
        { author: "精读本注释", text: "「神说：“要有光”，就有了光。」<br><br>【要有光】这是整本圣经中神所发出的第一句话。光代表了真理、生命、圣洁。自然界的光在创造中被造，正如属灵的光（基督）进入罪的混沌中驱散黑暗。<br><br>【神说...就有了】（也见诗33:9「因为祂说有，就有；命立，就立。」）创造的大能借着神的话语（Logos）彰显。这清楚表明神的话语具有绝对的创造力与权柄。" }
    ],
    "jhn-1-1": [
        { author: "精读本注释", text: "「太初有道，道与神同在，道就是神。」<br><br>这节经文与创世记1:1遥相呼应，将我们带回创世以前的那永恒深处。<br><br>【太初】希腊文 Arche：指超越时间的永恒开端。<br><br>【道】希腊文 Logos：希腊哲学中“宇宙理性”和希伯来信仰中“神大能的话语”的结合。在这里特指耶稣基督。<br><br>【道与神同在】说明了圣子与圣父在位格上的区分，且有着极其亲密、面对面的相交。「同在」原文带有动态指向对对方的倾向。<br><br>【道就是神】清楚、斩钉截铁地宣告了基督的神性本源。基督不是受造物，祂本质上就是神自己。" },
        { author: "A.W. Pink", text: "「太初有道」，证明了基督的先存性，以及祂神性的绝对性。" }
    ],
    "jhn-1-3": [
        { author: "精读本注释", text: "「万物是藉着他造的；凡被造的，没有一样不是藉着他造的。」<br><br>这再次反驳了任何认为物质邪恶、或由次等神祇创造的异端思想。基督（道）不仅是救赎主，祂也是创造的唯一中介。这经文确立了整本圣经宇宙观的基础。" }
    ],
    "jhn-1-4": [
        { author: "精读本注释", text: "「生命在他里头，这生命就是人的光。」<br><br>【生命】希腊文 Zoe：指灵性、永恒的生命。耶稣不仅仅有生命，祂本身就是生命（约14:6）。<br><br>【人的光】唯独在基督里，人类才能找到真正的方向、道德的指引和认识神启示的荣光。脱离这光，人只能在灵性死亡的黑暗中摸索。" }
    ]
};

// Initial state for notes and QA
let mockNotes = [
    { id: 1, verseRef: "gen-1-1", verseText: "创世记 1:1", text: "这是整本圣经的根基。记住创造主的伟大。", date: "2026-03-01" }
];

let mockQA = [
    { id: 1, chapterRef: "gen-1", question: "第一天神创造了光，但日月星辰是第四天造的，那么第一天的光是什么？", answer: "早期教父奥古斯丁认为第一天的光代表属灵的光明或天使的受造。也有现代神学家认为它指宇宙早期的能量辐射，直到第四天大气层清澈才显出具体星体。" },
    { id: 2, verseRef: "gen-1-26", question: "神说‘我们要照着我们的形像造人’中的‘我们’是指谁？", answer: "传统基督教神学普遍认为这暗示了三位一体的神（圣父、圣子、圣灵）。早期解经家也有认为这是神与天使天庭的议会说法。" }
];

// Mock Data for New Features: Plan, Video, Audio

const mockReadingPlan = {
    title: "麦琴读经计划",
    description: "一年内读完旧约一次，新约和诗篇两次。感受宏大救赎历史与个人灵修的平衡。",
    progress: 12, // User's day progress
    days: [
        {
            day: 12, date: "3月1日", tasks: [
                { id: "gen-12", title: "创世记 12章", completed: true },
                { id: "mat-11", title: "马太福音 11章", completed: false },
                { id: "ezr-2", title: "以斯拉记 2章", completed: false },
                { id: "act-12", title: "使徒行传 12章", completed: false }
            ]
        },
        {
            day: 13, date: "3月2日", tasks: [
                { id: "gen-13", title: "创世记 13章", completed: false },
                { id: "mat-12", title: "马太福音 12章", completed: false },
                { id: "ezr-3", title: "以斯拉记 3章", completed: false },
                { id: "act-13", title: "使徒行传 13章", completed: false }
            ]
        }
    ]
};

const mockVideos = [
    { id: "v1", title: "创世记 1-11章 概览 (BibleProject)", duration: "08:14", imageUrl: "https://images.unsplash.com/photo-1519791404176-0fef47095fbd?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", series: "BibleProject 圣经导读" },
    { id: "v2", title: "什么是恩典？(福音辞典)", duration: "05:42", imageUrl: "https://images.unsplash.com/photo-1544413165-2766adf1024e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", series: "核心神学主题" },
    { id: "v3", title: "如何阅读圣经中的诗篇", duration: "06:33", imageUrl: "https://images.unsplash.com/photo-1623861214309-fa9860b29ce1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", series: "如何读圣经系列" },
    { id: "v4", title: "约翰福音 1-12章 概览", duration: "09:05", imageUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80", series: "BibleProject 圣经导读" }
];

const mockAudio = [
    { id: "a1", title: "太初有道: 约翰福音引言解析", speaker: "唐崇荣牧师", duration: "45:20", date: "2025.10.12" },
    { id: "a2", title: "创世记中的福音预表", speaker: "提摩太·凯勒 (Timothy Keller)", duration: "38:15", date: "2024.05.08" },
    { id: "a3", title: "罗马书系列: 因信称义", speaker: "钟马田 (D. Martyn Lloyd-Jones)", duration: "50:00", date: "2023.11.20" },
    { id: "a4", title: "在苦难中看见神的荣耀 (约伯记摘要)", speaker: "约翰·派博 (John Piper)", duration: "42:10", date: "2025.01.15" }
];

// ── Multi-language book names ──
const bookNames = {
    zh: {
        gen: '创世记', exo: '出埃及记', lev: '利未记', num: '民数记', deu: '申命记',
        jos: '约书亚记', jdg: '士师记', rut: '路得记', '1sa': '撒母耳记上', '2sa': '撒母耳记下',
        '1ki': '列王纪上', '2ki': '列王纪下', '1ch': '历代志上', '2ch': '历代志下',
        ezr: '以斯拉记', neh: '尼希米记', est: '以斯帖记', job: '约伯记', psa: '诗篇',
        pro: '箴言', ecc: '传道书', sng: '雅歌', isa: '以赛亚书', jer: '耶利米书',
        lam: '耶利米哀歌', ezk: '以西结书', dan: '但以理书', hos: '何西阿书', jol: '约珥书',
        amo: '阿摩司书', oba: '俄巴底亚书', jon: '约拿书', mic: '弥迦书', nah: '那鸿书',
        hab: '哈巴谷书', zep: '西番雅书', hag: '哈该书', zec: '撒迦利亚书', mal: '玛拉基书',
        mat: '马太福音', mrk: '马可福音', luk: '路加福音', jhn: '约翰福音', act: '使徒行传',
        rom: '罗马书', '1co': '哥林多前书', '2co': '哥林多后书', gal: '加拉太书', eph: '以弗所书',
        php: '腓立比书', col: '歌罗西书', '1th': '帖撒罗尼迦前书', '2th': '帖撒罗尼迦后书',
        '1ti': '提摩太前书', '2ti': '提摩太后书', tit: '提多书', phm: '腓利门书',
        heb: '希伯来书', jas: '雅各书', '1pe': '彼得前书', '2pe': '彼得后书',
        '1jn': '约翰一书', '2jn': '约翰二书', '3jn': '约翰三书', jud: '犹大书', rev: '启示录'
    },
    en: {
        gen: 'Genesis', exo: 'Exodus', lev: 'Leviticus', num: 'Numbers', deu: 'Deuteronomy',
        jos: 'Joshua', jdg: 'Judges', rut: 'Ruth', '1sa': '1 Samuel', '2sa': '2 Samuel',
        '1ki': '1 Kings', '2ki': '2 Kings', '1ch': '1 Chronicles', '2ch': '2 Chronicles',
        ezr: 'Ezra', neh: 'Nehemiah', est: 'Esther', job: 'Job', psa: 'Psalms',
        pro: 'Proverbs', ecc: 'Ecclesiastes', sng: 'Song of Solomon', isa: 'Isaiah', jer: 'Jeremiah',
        lam: 'Lamentations', ezk: 'Ezekiel', dan: 'Daniel', hos: 'Hosea', jol: 'Joel',
        amo: 'Amos', oba: 'Obadiah', jon: 'Jonah', mic: 'Micah', nah: 'Nahum',
        hab: 'Habakkuk', zep: 'Zephaniah', hag: 'Haggai', zec: 'Zechariah', mal: 'Malachi',
        mat: 'Matthew', mrk: 'Mark', luk: 'Luke', jhn: 'John', act: 'Acts',
        rom: 'Romans', '1co': '1 Corinthians', '2co': '2 Corinthians', gal: 'Galatians', eph: 'Ephesians',
        php: 'Philippians', col: 'Colossians', '1th': '1 Thessalonians', '2th': '2 Thessalonians',
        '1ti': '1 Timothy', '2ti': '2 Timothy', tit: 'Titus', phm: 'Philemon',
        heb: 'Hebrews', jas: 'James', '1pe': '1 Peter', '2pe': '2 Peter',
        '1jn': '1 John', '2jn': '2 John', '3jn': '3 John', jud: 'Jude', rev: 'Revelation'
    },
    ko: {
        gen: '창세기', exo: '출애굽기', lev: '레위기', num: '민수기', deu: '신명기',
        jos: '여호수아', jdg: '사사기', rut: '룻기', '1sa': '사무엘상', '2sa': '사무엘하',
        '1ki': '열왕기상', '2ki': '열왕기하', '1ch': '역대상', '2ch': '역대하',
        ezr: '에스라', neh: '느헤미야', est: '에스더', job: '욥기', psa: '시편',
        pro: '잠언', ecc: '전도서', sng: '아가', isa: '이사야', jer: '예레미야',
        lam: '예레미야애가', ezk: '에스겔', dan: '다니엘', hos: '호세아', jol: '요엘',
        amo: '아모스', oba: '오바댜', jon: '요나', mic: '미가', nah: '나훔',
        hab: '하박국', zep: '스바냐', hag: '학개', zec: '스가랴', mal: '말라기',
        mat: '마태복음', mrk: '마가복음', luk: '누가복음', jhn: '요한복음', act: '사도행전',
        rom: '로마서', '1co': '고린도전서', '2co': '고린도후서', gal: '갈라디아서', eph: '에베소서',
        php: '빌립보서', col: '골로새서', '1th': '데살로니가전서', '2th': '데살로니가후서',
        '1ti': '디모데전서', '2ti': '디모데후서', tit: '디도서', phm: '빌레몬서',
        heb: '히브리서', jas: '야고보서', '1pe': '베드로전서', '2pe': '베드로후서',
        '1jn': '요한일서', '2jn': '요한이서', '3jn': '요한삼서', jud: '유다서', rev: '요한계시록'
    }
};

// ── Korean Bible (개역개정 Korean Revised Version) ──
bibleData['krv'] = {
    gen: {
        name: '창세기',
        '1': [
            { verse: 1, text: '태초에 하나님이 천지를 창조하시니라.' },
            { verse: 2, text: '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라.' },
            { verse: 3, text: '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고' },
            { verse: 4, text: '빛이 하나님이 보시기에 좋았더라. 하나님이 빛과 어둠을 나누사' },
            { verse: 5, text: '하나님이 빛을 낮이라 부르시고 어둠을 밤이라 부르시니라. 저녁이 되고 아침이 되니 이는 첫째 날이니라.' },
            { verse: 6, text: '하나님이 이르시되 물 가운데에 궁창이 있어 물과 물로 나뉘라 하시고' },
            { verse: 7, text: '하나님이 궁창을 만드사 궁창 아래의 물과 궁창 위의 물로 나뉘게 하시니 그대로 되니라.' },
            { verse: 8, text: '하나님이 궁창을 하늘이라 부르시니라. 저녁이 되고 아침이 되니 이는 둘째 날이니라.' },
            { verse: 9, text: '하나님이 이르시되 천하의 물이 한 곳으로 모이고 뭍이 드러나라 하시니 그대로 되니라.' },
            { verse: 10, text: '하나님이 뭍을 땅이라 부르시고 모인 물을 바다라 부르시니 하나님이 보시기에 좋았더라.' },
            { verse: 11, text: '하나님이 이르시되 땅은 풀과 씨 맺는 채소와 각기 종류대로 씨 가진 열매 맺는 나무를 내라 하시니 그대로 되어' },
            { verse: 12, text: '땅이 풀과 각기 종류대로 씨 맺는 채소와 각기 종류대로 씨 가진 열매 맺는 나무를 내니 하나님이 보시기에 좋았더라.' }
        ],
        '2': [
            { verse: 1, text: '천지와 만물이 다 이루어지니라.' },
            { verse: 2, text: '하나님이 그가 하시던 일을 일곱째 날에 마치시니 그가 하시던 모든 일을 쉬시니라.' },
            { verse: 3, text: '하나님이 그 일곱째 날을 복되게 하사 거룩하게 하셨으니 이는 하나님이 그 창조하시며 만드시던 모든 일을 마치고 그 날에 안식하셨음이니라.' },
            { verse: 4, text: '이것이 천지가 창조될 때에 하늘과 땅의 내력이니라.' },
            { verse: 5, text: '여호와 하나님이 땅에 비를 내리지 아니하셨고 땅을 갈 사람도 없었으므로 들에는 초목이 아직 없었고 밭에는 채소가 나지 아니하였으며' },
            { verse: 7, text: '여호와 하나님이 땅의 흙으로 사람을 지으시고 생기를 그 코에 불어넣으시니 사람이 생령이 되니라.' }
        ],
        '3': [
            { verse: 1, text: '그런데 뱀은 여호와 하나님이 지으신 들짐승 중에 가장 간교하니라. 뱀이 여자에게 물어 이르되 하나님이 참으로 너희에게 동산 모든 나무의 열매를 먹지 말라 하시더냐.' },
            { verse: 2, text: '여자가 뱀에게 말하되 동산 나무의 열매를 우리가 먹을 수 있으나' },
            { verse: 3, text: '동산 중앙에 있는 나무의 열매는 하나님의 말씀에 너희는 먹지도 말고 만지지도 말라, 너희가 죽을까 하노라 하셨느니라.' }
        ]
    },
    jhn: {
        name: '요한복음',
        '1': [
            { verse: 1, text: '태초에 말씀이 계시니라. 이 말씀이 하나님과 함께 계셨으니 이 말씀은 곧 하나님이시니라.' },
            { verse: 2, text: '그가 태초에 하나님과 함께 계셨고' },
            { verse: 3, text: '만물이 그로 말미암아 지은 바 되었으니 지은 것이 하나도 그가 없이는 된 것이 없느니라.' },
            { verse: 4, text: '그 안에 생명이 있었으니 이 생명은 사람들의 빛이라.' },
            { verse: 5, text: '빛이 어둠에 비치되 어둠이 깨닫지 못하더라.' },
            { verse: 6, text: '하나님께로부터 보내심을 받은 사람이 있으니 그의 이름은 요한이라.' },
            { verse: 7, text: '그가 증언하러 왔으니 곧 빛에 대하여 증언하고 모든 사람이 자기로 말미암아 믿게 하려 함이라.' },
            { verse: 8, text: '그는 이 빛이 아니요 이 빛에 대하여 증언하러 온 자라.' },
            { verse: 9, text: '참 빛 곧 세상에 와서 각 사람에게 비추는 빛이 있었나니' },
            { verse: 10, text: '그가 세상에 계셨으며 세상은 그로 말미암아 지은 바 되었으되 세상이 그를 알지 못하였고' },
            { verse: 11, text: '자기 땅에 오매 자기 백성이 영접하지 아니하였으나' },
            { verse: 12, text: '영접하는 자 곧 그 이름을 믿는 자들에게는 하나님의 자녀가 되는 권세를 주셨으니' },
            { verse: 13, text: '이는 혈통으로나 육정으로나 사람의 뜻으로 나지 아니하고 오직 하나님께로부터 난 자들이니라.' },
            { verse: 14, text: '말씀이 육신이 되어 우리 가운데 거하시매 우리가 그의 영광을 보니 아버지의 독생자의 영광이요 은혜와 진리가 충만하더라.' }
        ],
        '3': [
            { verse: 1, text: '그런데 바리새인 중에 니고데모라 하는 사람이 있으니 유대인의 지도자라.' },
            { verse: 2, text: '그가 밤에 예수께 와서 이르되 랍비여 우리가 당신은 하나님께로부터 오신 선생인 줄 아나이다. 하나님이 함께 하시지 아니하시면 당신이 행하시는 이 표적을 아무도 할 수 없음이니이다.' },
            { verse: 3, text: '예수께서 대답하여 이르시되 진실로 진실로 네게 이르노니 사람이 거듭나지 아니하면 하나님의 나라를 볼 수 없느니라.' },
            { verse: 16, text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라.' },
            { verse: 17, text: '하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요 그로 말미암아 세상이 구원을 받게 하려 하심이라.' }
        ]
    },
    psa: {
        name: '시편',
        '23': [
            { verse: 1, text: '여호와는 나의 목자시니 내게 부족함이 없으리로다.' },
            { verse: 2, text: '그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가로 인도하시는도다.' },
            { verse: 3, text: '내 영혼을 소생시키시고 자기 이름을 위하여 의의 길로 인도하시는도다.' },
            { verse: 4, text: '내가 사망의 음침한 골짜기로 다닐지라도 해를 두려워하지 않을 것은 주께서 나와 함께 하심이라. 주의 지팡이와 막대기가 나를 안위하시나이다.' },
            { verse: 5, text: '주께서 내 원수의 목전에서 내게 상을 차려 주시고 기름을 내 머리에 부으셨으니 내 잔이 넘치나이다.' },
            { verse: 6, text: '내 평생에 선하심과 인자하심이 반드시 나를 따르리니 내가 여호와의 집에 영원히 살리로다.' }
        ]
    }
};

// Export to window for broad access across scripts
window.bibleMeta = bibleMeta;
window.bibleData = bibleData;
window.mockCommentaries = mockCommentaries;
window.mockVideos = mockVideos;
window.mockAudio = mockAudio;
window.bookNames = bookNames;

