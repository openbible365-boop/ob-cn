'use strict';
(function () {
    // 社群功能总开关（与 App 端 mobile-app/src/data/features.ts 的 SHOW_COMMUNITY 同步）：
    // false 时隐藏右栏「社群」标签与个人页「我的社群」入口；面板代码与接口全部保留，翻回 true 即恢复。
    const SHOW_COMMUNITY = false;

    // 本地时区日期（YYYY-MM-DD / YYYY-MM）：禁止 toISOString().slice——那是 UTC 日，
    // 太平洋时区傍晚、北京时间凌晨都会差出一天
    function localDateKey(d = new Date()) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    // 笔记日期显示：云端笔记带完整时间戳，按本地时区取日期；本地笔记是已格式化的字符串，原样显示
    function noteDateLabel(value) {
        if (!value) return '';
        if (!/T\d{2}:\d{2}/.test(value)) return value;
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? value : localDateKey(d);
    }

    // ── State ──
    const S = {
        book: 'gen', chapter: '1', version: 'cuv', lang: 'zh', theme: 'light',
        selection: new Set(), lastRef: null, highlights: {},
        notes: JSON.parse(localStorage.getItem('ob_notes') || '[]'),
        bookmarks: JSON.parse(localStorage.getItem('ob_bookmarks') || '[]'),
        view: 'reading', panelTab: 'ai', fontSize: parseInt(localStorage.getItem('ob_fontsize')) || 20, panelOpen: true, navOpen: false,
        spiritualStages: [], // Cache for general category stages
        spiritualVerseQuestions: [], // Cache for verse_drawer category stages
        // NOTE: 新约默认声音——启动时从后端拉取，前端不提供用户切换入口
        ntVoice: 'female',
        // 接口由 admin-app 提供，网页版始终同源访问（线上 nginx 转发 /api/）。
        // 本地开发用 scripts/web-dev-server.mjs：静态托管 + /api 转发到 :3000。
        // 注意不要写成 http://localhost:3000——跨端口会被 CORS 拦截，且登录 Cookie 也带不上。
        apiBase: '/api/web'
    };

    let isVerifyingPayment = false;

    // 启动时从后端加载新约声音设置
    fetch(`${S.apiBase}/config/voice`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && d.nt_voice) S.ntVoice = d.nt_voice; })
        .catch(() => {}); // 静默失败，保持默认 female


    // ── Book metadata ──
    const OT_BOOKS = [
        ['gen', '创世记'], ['exo', '出埃及记'], ['lev', '利未记'], ['num', '民数记'], ['deu', '申命记'],
        ['jos', '约书亚记'], ['jdg', '士师记'], ['rut', '路得记'], ['1sa', '撒母耳记上'], ['2sa', '撒母耳记下'],
        ['1ki', '列王纪上'], ['2ki', '列王纪下'], ['1ch', '历代志上'], ['2ch', '历代志下'], ['ezr', '以斯拉记'],
        ['neh', '尼希米记'], ['est', '以斯帖记'], ['job', '约伯记'], ['psa', '诗篇'], ['pro', '箴言'],
        ['ecc', '传道书'], ['sng', '雅歌'], ['isa', '以赛亚书'], ['jer', '耶利米书'], ['lam', '耶利米哀歌'],
        ['ezk', '以西结书'], ['dan', '但以理书'], ['hos', '何西阿书'], ['jol', '约珥书'], ['amo', '阿摩司书'],
        ['oba', '俄巴底亚书'], ['jon', '约拿书'], ['mic', '弥迦书'], ['nah', '那鸿书'], ['hab', '哈巴谷书'],
        ['zep', '西番雅书'], ['hag', '哈该书'], ['zec', '撒迦利亚书'], ['mal', '玛拉基书']
    ];
    const NT_BOOKS = [
        ['mat', '马太福音'], ['mrk', '马可福音'], ['luk', '路加福音'], ['jhn', '约翰福音'], ['act', '使徒行传'],
        ['rom', '罗马书'], ['1co', '哥林多前书'], ['2co', '哥林多后书'], ['gal', '加拉太书'], ['eph', '以弗所书'],
        ['php', '腓立比书'], ['col', '歌罗西书'], ['1th', '帖撒罗尼迦前书'], ['2th', '帖撒罗尼迦后书'],
        ['1ti', '提摩太前书'], ['2ti', '提摩太后书'], ['tit', '提多书'], ['phm', '腓利门书'],
        ['heb', '希伯来书'], ['jas', '雅各书'], ['1pe', '彼得前书'], ['2pe', '彼得后书'],
        ['1jn', '约翰壹书'], ['2jn', '约翰贰书'], ['3jn', '约翰叁书'], ['jud', '犹大书'], ['rev', '启示录']
    ];
    const ALL_BOOKS = [...OT_BOOKS, ...NT_BOOKS];
    const BOOK_NAME = Object.fromEntries(ALL_BOOKS.map(([k, v]) => [k, v]));
    const BOOK_CHAPTERS = {
        gen: 50, exo: 40, lev: 27, num: 36, deu: 34, jos: 24, jdg: 21, rut: 4, '1sa': 31, '2sa': 24,
        '1ki': 22, '2ki': 25, '1ch': 29, '2ch': 36, ezr: 10, neh: 13, est: 10, job: 42, psa: 150, pro: 31,
        ecc: 12, sng: 8, isa: 66, jer: 52, lam: 5, ezk: 48, dan: 12, hos: 14, jol: 3, amo: 9, oba: 1,
        jon: 4, mic: 7, nah: 3, hab: 3, zep: 3, hag: 2, zec: 14, mal: 4, mat: 28, mrk: 16, luk: 24,
        jhn: 21, act: 28, rom: 16, '1co': 16, '2co': 13, gal: 6, eph: 6, php: 4, col: 4, '1th': 5,
        '2th': 3, '1ti': 6, '2ti': 4, tit: 3, phm: 1, heb: 13, jas: 5, '1pe': 5, '2pe': 3,
        '1jn': 5, '2jn': 1, '3jn': 1, jud: 1, rev: 22
    };


    // ── Book themes for contextual AI prompts ──
    const BOOK_THEMES = {
        gen: ['创造','堕落与罪','信心与拣选','约与应许','神的主权'],
        exo: ['救赎','逾越节','十诫与律法','会幕','神的同在'],
        lev: ['圣洁','献祭','赎罪','洁净','敬拜'],
        num: ['旷野漂流','信心试炼','顺服与悖逆','神的信实'],
        deu: ['律法重申','盟约更新','应许之地','敬畏神'],
        jos: ['得胜','信心行动','应许成就','分地'],
        jdg: ['背道循环','士师兴起','人心偏行','神的怜悯'],
        rut: ['忠诚','救赎','神的眷顾','外邦人归主'],
        '1sa': ['君王兴起','顺服vs悖逆','大卫与扫罗','信靠神'],
        '2sa': ['大卫王朝','罪的后果','神的恩典','悔改'],
        '1ki': ['所罗门智慧','圣殿建造','国度分裂','先知'],
        '2ki': ['先知事工','国度兴衰','悔改与审判','被掳'],
        '1ch': ['大卫家谱','敬拜','圣殿预备','感恩'],
        '2ch': ['圣殿','敬拜复兴','列王评价','悔改与复兴'],
        ezr: ['归回','圣殿重建','律法教导','分别为圣'],
        neh: ['城墙重建','领袖祷告','信心与行动','复兴'],
        est: ['神的护理','勇气','拯救','隐藏的神'],
        job: ['苦难','信心试炼','神的主权','敬畏神'],
        psa: ['敬拜赞美','哀求祷告','信靠','感恩'],
        pro: ['智慧','敬畏耶和华','生活指引','品格塑造'],
        ecc: ['虚空','人生意义','敬畏神','智慧人生'],
        sng: ['爱情','忠贞','基督与教会','美好关系'],
        isa: ['弥赛亚预言','审判与安慰','圣洁','救恩'],
        jer: ['审判警告','新约应许','悔改呼召','神的心意'],
        lam: ['哀哭','神的信实','盼望','悔改'],
        ezk: ['神的荣耀','审判与恢复','枯骨复活','新圣殿'],
        dan: ['信心坚守','末世预言','神的国度','主权'],
        hos: ['神的爱','背约与归回','怜悯','婚姻隐喻'],
        jol: ['耶和华的日子','悔改','圣灵浇灌','复兴'],
        amo: ['社会公义','审判','余民','神的怜悯'],
        oba: ['以东审判','骄傲的结局','神的公义'],
        jon: ['神的怜悯','悔改','宣教使命','顺服'],
        mic: ['公义','怜悯','弥赛亚预言','谦卑行走'],
        nah: ['神的审判','公义','安慰','尼尼微倾覆'],
        hab: ['信心等候','义人因信得生','神的主权'],
        zep: ['审判之日','余民','喜乐','复兴应许'],
        hag: ['圣殿重建','优先次序','神的同在'],
        zec: ['弥赛亚异象','末世预言','复兴与盼望'],
        mal: ['忠心与背道','十一奉献','公义的日头'],
        mat: ['天国','登山宝训','弥赛亚','门徒训练'],
        mrk: ['仆人耶稣','神迹','十字架','服侍'],
        luk: ['人子耶稣','怜悯','祷告','圣灵'],
        jhn: ['道成肉身','生命','光','信','神迹记号'],
        act: ['圣灵降临','教会建立','宣教','见证'],
        rom: ['因信称义','恩典','罪与救赎','圣灵的生活'],
        '1co': ['教会合一','属灵恩赐','爱的真谛','复活'],
        '2co': ['安慰','事奉','软弱中的刚强','奉献'],
        gal: ['因信称义','自由','圣灵果子','律法与恩典'],
        eph: ['在基督里','教会','属灵军装','合一'],
        php: ['喜乐','基督的心','知足','追求卓越'],
        col: ['基督的超越','在基督里丰盛','新人生活'],
        '1th': ['基督再来','圣洁生活','盼望','信心'],
        '2th': ['主的日子','坚忍','真理','勤勉'],
        '1ti': ['教会治理','敬虔','教导','忠心'],
        '2ti': ['忠心传道','末世','坚忍','圣经权威'],
        tit: ['纯正教导','好行为','救恩的恩典'],
        phm: ['饶恕','在基督里的平等','爱心'],
        heb: ['基督的超越','信心英雄','新约','坚忍'],
        jas: ['信心与行为','试炼','智慧','舌头'],
        '1pe': ['苦难中的盼望','圣洁','顺服','恩典'],
        '2pe': ['真知识','假教师','主再来','成长'],
        '1jn': ['爱','光明','认识神','胜过世界'],
        '2jn': ['真理','爱心','警惕假教师'],
        '3jn': ['效法善','好客','忠心'],
        jud: ['护卫真道','假教师','坚守信仰'],
        rev: ['末世启示','羔羊得胜','新天新地','敬拜']
    };

    // ── AI Summaries ──
    const AI_SUMMARIES = {
        'gen-1-1': '这节经文宣告了整本圣经最核心的真理：神是创造者，宇宙有开始，时间与物质皆为受造。希伯来文"bara"专用于神的创造行动，意味着从无中生有。这不仅反驳了多神教宇宙观，更奠定了圣经整体神学的基础——神超然存在于时间之外，主权地创造了一切。',
        'gen-1-2': '「空虚混沌」（tohu wabhohu）形容无秩序的荒凉状态，但这是神施展大能的舞台。圣灵如母鸟展翅运行在水面，孕育即将展开的创造之工。混沌与黑暗不是终点，而是美善秩序的起点，也预表神在我们生命中的更新。',
        'gen-1-3': '神的第一句话便是"要有光"，光象征真理、生命与神的同在。早于太阳的创造，这光可能指宇宙初始的基本能量，或在属灵层面预表基督。神的话语本身就具有创造大能，祂说有就有，命立就立。',
        'gen-1-4': '神看光是好的——"好"（tov）不仅是美学评价，更是道德与功能上的完满。神将光暗分开，这是宇宙第一次的分别，也预表神在历史中的行动：将圣洁与罪恶分开，将蒙恩与沦亡分开。',
        'gen-1-5': '神称光为昼、称暗为夜。命名在古代文化中代表权柄与主权。"有晚上，有早晨，这是头一日"——希伯来人以晚上为一天之始，这个顺序沿用至犹太传统的安息日计算中。',
        'gen-2-7': '神亲手用地上的尘土造人，吹入生气，人才成为有灵的活人。这描述了人独特的双重本质：物质的身体与神所赐的灵命。这是人与其他受造物最根本的区别——人是按神的形象受造，具有理性、道德和与神相交的能力。',
        'jhn-1-1': '"太初有道"呼应创世记开篇。"道"（希腊文Logos）兼具宇宙理性与神大能话语的含义，在此特指耶稣基督。这节经文从三个角度宣告基督：祂存在于太初、祂与圣父同在（位格区分）、祂本质即神（神性宣告）。',
        'jhn-1-2': '"这道太初与神同在"进一步强调圣子与圣父之间永恒的团契关系。"同在"原文含有面对面、亲密倚靠的意味，描绘三位一体内部的爱与相交——这是无始无终的内在爱，是基督降世之恩的源头。',
        'jhn-1-3': '"万物是藉着他造的"排除了任何将物质视为邪恶的异端可能。基督不仅是救赎主，更是创造的唯一中介，将创世记与约翰福音在神学上完美连接。',
        'jhn-1-4': '"生命在他里头"——基督不只拥有生命，祂本身就是生命的源头（约14:6）。这生命成为人的光，引导人认识神、回归神。脱离这光，人只能在属灵死亡的黑暗中摸索。',
        'jhn-1-5': '"光照在黑暗里"——这句话同时包含两重含义：黑暗无法理解光，也无法熄灭光。即使面对十字架与死亡，光终将得胜。这是对信徒最深的安慰：神的光不会被任何黑暗所征服。',
        'jhn-3-16': '这是整本圣经中最经典的一节。"神爱世人"——原文Kosmos（世界）指堕落、对立于神的全人类，而非仅指美好的创造。神的爱的伟大不在于对象的可爱，而在于神自己主动、无条件的给予。独生子的降世是神全部爱的集中彰显。',
        'psa-23-1': '"耶和华是我的牧者"——这是一句深具亲密性的信仰宣告。用一位东方牧羊人的形象，描绘神与信徒的关系：全然供应、亲自带领、靠近保护。"我必不至缺乏"不是骄傲的宣称，而是基于对神信实的确认，是信心之歌，也是平安之源。'
    };

    const CROSS_REFS = {
        'gen-1-1': ['约翰福音 1:1', '希伯来书 11:3', '诗篇 33:6', '以赛亚书 45:18'],
        'gen-1-2': ['申命记 32:11', '诗篇 104:30', '以赛亚书 40:13'],
        'gen-1-3': ['约翰福音 1:4', '以赛亚书 9:2', '哥林多后书 4:6'],
        'gen-2-7': ['哥林多前书 15:45', '以赛亚书 64:8', '传道书 12:7'],
        'jhn-1-1': ['创世记 1:1', '约翰壹书 1:1', '启示录 19:13'],
        'jhn-1-2': ['箴言 8:22-30', '歌罗西书 1:17'],
        'jhn-1-3': ['歌罗西书 1:16', '希伯来书 1:2'],
        'jhn-1-4': ['约翰福音 14:6', '约翰福音 11:25'],
        'jhn-1-5': ['约翰福音 3:19', '以弗所书 5:8'],
        'jhn-3-16': ['罗马书 5:8', '约翰壹书 4:9', '以弗所书 2:4-5'],
        'psa-23-1': ['诗篇 80:1', '约翰福音 10:11', '以赛亚书 40:11']
    };


    // ── DOM helpers ──
    const $ = id => document.getElementById(id);
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
    function showToast(msg, dur = 2500) {
        const t = $('toast'); $('toast-msg').textContent = msg; t.classList.remove('hidden');
        setTimeout(() => t.classList.add('hidden'), dur);
    }

    // ── Get user avatar HTML for chat bubbles ──
    function getUserAvatarHtml() {
        const profile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
        const user = Auth?.getUser?.() || null;
        const avatar = profile.avatar;
        // If user has a custom avatar image (data URI or URL)
        if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
            return `<img src="${avatar}" alt="Me">`;
        }
        // Fallback to username initial
        const name = user?.username || user?.email || profile.name || '';
        if (name) {
            return `<span class="avatar-letter">${name[0].toUpperCase()}</span>`;
        }
        // Default icon
        return '<i class="fa-solid fa-user"></i>';
    }
    // ── Brand Logo ──
    // 品牌标识改为「矢量图标 + i18n 文字」后，语言与主题都由 CSS/i18n 自动接管，
    // 这里不再需要按语言换图；保留空函数以兼容既有调用点。
    function updateBrandLogo() {}

    // ── Theme ──
    function applyTheme(theme) {
        S.theme = theme; document.body.setAttribute('data-theme', theme);
        const btn = $('theme-btn');
        if (btn) btn.innerHTML = theme === 'dark'
            ? `<i class="fa-solid fa-sun"></i><span data-i18n="nav.light">${t('nav.light')}</span>`
            : `<i class="fa-solid fa-moon"></i><span data-i18n="nav.dark">${t('nav.dark')}</span>`;
        
        localStorage.setItem('ob_theme', theme);
        updateBrandLogo();
    }


    // ── Content language: derived from Bible version (for book names, chapter labels) ──
    const VERSION_LANG_MAP = { cuv: 'zh', cnvs: 'zh', pinyin: 'zh' };
    function getContentLang() {
        return VERSION_LANG_MAP[S.version] || (typeof getLang === 'function' ? getLang() : 'zh');
    }

    // ── Book name helper (uses content language) ──
    function bookDisplayName(book, langOverride) {
        const lang = langOverride || getContentLang();
        if (typeof bookNames !== 'undefined' && bookNames[lang]) {
            return bookNames[lang][book] || bookNames['zh'][book] || book;
        }
        return BOOK_NAME[book] || book;
    }

    function getChLabel(chapter, langOverride) {
        const lang = langOverride || getContentLang();
        if (lang === 'ko') return `제${chapter}장`;
        if (lang === 'en') return `Ch. ${chapter}`;
        return `第${chapter}章`;
    }
    function getVerseWord() {
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        if (lang === 'ko') return '절';
        if (lang === 'en') return 'verses';
        return '节';
    }

    function refLabel(refs) {
        if (!refs || refs.size === 0) return '';
        const arr = [...refs].sort((a, b) => {
            const [, ca, va] = a.split('-'); const [, cb, vb] = b.split('-');
            return ca !== cb ? +ca - +cb : +va - +vb;
        });
        const [b, ch, v0] = arr[0].split('-');
        const bookName = bookDisplayName(b);
        if (arr.length === 1) return `${bookName} ${ch}:${v0}`;
        // Group by chapter
        const byChap = {};
        arr.forEach(r => { const [, c, v] = r.split('-'); (byChap[c] = byChap[c] || []).push(+v); });
        const parts = Object.entries(byChap).map(([c, vs]) => {
            vs.sort((a, b) => a - b);
            // Merge consecutive into ranges
            const ranges = []; let start = vs[0], end = vs[0];
            for (let i = 1; i < vs.length; i++) {
                if (vs[i] === end + 1) end = vs[i];
                else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = vs[i]; }
            }
            ranges.push(start === end ? `${start}` : `${start}-${end}`);
            return `${c}:${ranges.join(',')}`;
        });
        return `${bookName} ${parts.join('; ')}`;
    }


    // ── Verse Selection (Core) ──
    // Every plain click TOGGLES the verse (cumulative by default)
    // Shift+click fills a range between lastRef and current verse
    function handleVerseClick(ref, e) {
        e.preventDefault();
        if (e.shiftKey && S.lastRef && S.lastRef !== ref) {
            // Shift+click: add range
            fillRange(S.lastRef, ref);
        } else {
            // Plain click: toggle this verse in/out of selection
            if (S.selection.has(ref)) {
                S.selection.delete(ref);
            } else {
                S.selection.add(ref);
            }
        }
        S.lastRef = ref;
        renderVerseStates();
        updateSelectionBar();
        updateStudyPanelRef(); // only update ref pill + verse text, NOT AI
    }

    function fillRange(fromRef, toRef) {
        const verses = [...document.querySelectorAll('.verse[data-ref]')];
        const refs = verses.map(v => v.dataset.ref);
        const si = refs.indexOf(fromRef), ei = refs.indexOf(toRef);
        if (si < 0 || ei < 0) return;
        const [s, e] = si < ei ? [si, ei] : [ei, si];
        for (let i = s; i <= e; i++) S.selection.add(refs[i]);
    }

    function renderVerseStates() {
        document.querySelectorAll('.verse[data-ref]').forEach(v => {
            const ref = v.dataset.ref;
            v.classList.toggle('selected', S.selection.has(ref));
            const hl = S.highlights[ref];
            if (hl) v.setAttribute('data-highlight', hl);
            else v.removeAttribute('data-highlight');
        });
    }

    function updateSelectionBar() {
        const bar = $('selection-bar');
        const cnt = S.selection.size;
        if (!bar) return;
        if (cnt === 0) { 
            bar.classList.add('hidden');
            // 恢复首页通用问题
            if (typeof window.updateVerseDrawerPresets === 'function') {
                window.updateVerseDrawerPresets(false);
            }
            // NOTE: 取消选节时，将慧读面板平滑回滚到顶部，重新看到速览内容
            const scrollContainer = $('ai-panel-scroll');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else { 
            bar.classList.remove('hidden'); 
            $('sel-count').textContent = cnt; 
        }
        // Update mobile bottom nav badge
        const badge = $('bottom-sel-badge');
        if (badge) badge.textContent = cnt > 0 ? cnt : '';
        const studyBtn = $('bottom-study-btn');
        if (studyBtn) studyBtn.classList.toggle('active', cnt > 0);
    }

    // ── 高亮：本地持久化 + 跨端同步 ──
    // 与 App 共用 /api/mobile/highlights：带增量即推送，空数组即拉取，
    // 服务端返回全量后本地以云端为准。登出后回退到本地副本。
    function loadLocalHighlights() {
        try { S.highlights = JSON.parse(localStorage.getItem('ob_highlights')) || {}; }
        catch (e) { S.highlights = {}; }
    }
    function saveLocalHighlights() {
        try { localStorage.setItem('ob_highlights', JSON.stringify(S.highlights)); } catch (e) {}
    }
    // 旧版 Tailwind 高亮色 → 现行 App 色值。
    // 服务端只接受现行色值，而存量本地数据仍是旧色值（CSS 两套都渲染）。
    // 不映射的话，老用户一登录，整批高亮会被服务端以 400 整体拒绝——
    // 失败的不只是那几条旧的，而是全部。
    const LEGACY_HIGHLIGHT_MAP = {
        '#FEF08A': '#FBE59A',   // 黄
        '#BBF7D0': '#BFE6CF',   // 绿
        '#BAE6FD': '#C7DCF4',   // 蓝
        '#FBCFE8': '#F3CAD8',   // 粉
        '#DDD6FE': '#DDCCF1',   // 紫
    };
    function normalizeHighlightColor(c) {
        if (typeof c !== 'string') return c;
        return LEGACY_HIGHLIGHT_MAP[c.toUpperCase()] || c;
    }

    function refToParts(ref) {
        const parts = String(ref).split('-');
        if (parts.length < 3) return null;
        const verse = parseInt(parts.pop(), 10);
        const chapter = parseInt(parts.pop(), 10);
        const book = parts.join('-');
        if (!book || !chapter || !verse) return null;
        return { book, chapter, verse };
    }
    async function syncHighlights(pushRefs, color) {
        if (typeof Auth === 'undefined' || !Auth.getUser()) return;
        const highlights = [];
        const deletions = [];
        if (pushRefs) {
            pushRefs.forEach(ref => {
                const p = refToParts(ref);
                if (!p) return;
                if (color) highlights.push({ ...p, color: normalizeHighlightColor(color) });
                else deletions.push(p);
            });
        } else {
            // 登录后的全量合并：本地高亮推上云，云端结果落回本地
            Object.entries(S.highlights).forEach(([ref, c]) => {
                const p = refToParts(ref);
                if (p) highlights.push({ ...p, color: normalizeHighlightColor(c) });
            });
        }
        try {
            const res = await fetch('/api/mobile/highlights', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ highlights, deletions })
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.ok && Array.isArray(data.highlights)) {
                S.highlights = {};
                data.highlights.forEach(h => { S.highlights[`${h.book}-${h.chapter}-${h.verse}`] = h.color; });
                saveLocalHighlights();
                renderVerseStates();
            }
        } catch (e) { /* 离线时静默，下次操作或登录时再同步 */ }
    }

    // ── Apply color highlight ──
    function applyColor(color) {
        // 统一大写存储：与 App 端 HIGHLIGHT_COLORS 及云端校验一致
        if (color) color = color.toUpperCase();
        const refs = [...S.selection];
        refs.forEach(ref => {
            if (color) S.highlights[ref] = color;
            else delete S.highlights[ref];
        });
        renderVerseStates();
        saveLocalHighlights();
        syncHighlights(refs, color || null);
        showToast(color ? '已应用颜色标注' : '已清除标注');
    }

    // ── Copy selection ──
    // 经文纯文本：剥掉源数据里的行内标记（人名 <mark class="pn">、拼音 <rt> 等）。
    // 凡是把经文送出应用的出口（复制/AI/属性）都必须过这一层。
    function plainVerseText(t) {
        return (t || '').replace(/<rt[^>]*>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '');
    }

    function copySelection() {
        if (S.selection.size === 0) return;
        const lines = [];
        const data = window.bibleData[S.version]?.[S.book]?.[S.chapter];
        if (!data) return;
        [...S.selection].sort((a, b) => {
            return +a.split('-')[2] - +b.split('-')[2];
        }).forEach(ref => {
            const vn = ref.split('-')[2];
            const v = data.find(v => String(v.verse) === vn);
            if (v) lines.push(`${vn} ${plainVerseText(v.text)}`);
        });
        const refStr = refLabel(S.selection);
        navigator.clipboard.writeText(`${refStr}\n${lines.join('\n')}`).then(() => showToast(t('toast.copied')));
    }


    /**
     * NOTE: 切换章节时强制停止当前正在播放的圈圣经音频。
     * 当用户点选不同章节，旧章节的音频应当立即停止而不是继续与新章舨2运行。
     */
    function stopBibleAudio() {
        const audioEl = $('main-audio-player');
        if (audioEl && !audioEl.paused) {
            audioEl.pause();
        }
        if (audioEl) {
            audioEl.src = '';
            audioEl.currentTime = 0;
        }
        // 隐藏音频播放条
        const bar = $('audio-player-bar');
        if (bar) bar.classList.add('hidden');
        // 清空时间戳和跨读高亮状态
        _explicitTimestamps = null;
        _followActiveRef = null;
        document.querySelectorAll('.verse.audio-hl').forEach(el => el.classList.remove('audio-hl'));
    }

    let _lastRenderedKey = null;
    // NOTE: 用于取消上一个未完成的 fetch，防止快速切换书卷时竞态条件
    let _fetchController = null;

    // ── Render Bible Text ──
    async function renderBibleText(force = false) {
        const container = $('bible-text');
        if (!container) return;
        // 拼音版：注音 ruby 需要更大的行距与更小的注音字号
        container.classList.toggle('is-pinyin', S.version === 'pinyin');

        const currentKey = `${S.version}-${S.book}-${S.chapter}`;
        if (!force && _lastRenderedKey === currentKey && container.children.length > 0) {
            renderVerseStates();
            return;
        }

        // 取消上一个未完成的请求，避免旧请求覆盖新内容
        if (_fetchController) {
            _fetchController.abort();
        }
        _fetchController = new AbortController();
        const signal = _fetchController.signal;

        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const loadingText = lang === 'en' ? 'Loading...' : lang === 'ko' ? '로딩 중...' : '加载中...';
        container.innerHTML = `<div class="loading-state" style="text-align:center;padding:40px;color:var(--text-tertiary);"><i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}</div>`;

        let data = [];
        let fetchFailed = false;
        try {
            const url = `${S.apiBase}/verses/public?version=${S.version}&book=${S.book}&chapter=${S.chapter}`;
            const res = await fetch(url, { signal });
            if (res.ok) {
                const json = await res.json();
                data = json.verses || [];
            } else {
                fetchFailed = true;
            }
        } catch (e) {
            // 用户主动取消（切换了新书卷），静默退出即可
            if (e.name === 'AbortError') return;
            console.error("Failed to load verses:", e);
            fetchFailed = true;
        }

        // 二次校验：请求完成后确认状态未被新操作覆盖
        if (`${S.version}-${S.book}-${S.chapter}` !== currentKey) return;

        // 服务故障态与真空态分开：失败给重试，空数据只是说明
        if (fetchFailed && (!data || data.length === 0)) {
            const errLang = typeof getLang === 'function' ? getLang() : 'zh';
            const errMsg = errLang === 'ko' ? '말씀을 불러오지 못했습니다' : errLang === 'en' ? 'Failed to load scripture' : '经文加载失败，请检查网络';
            const retryLabel = errLang === 'ko' ? '다시 시도' : errLang === 'en' ? 'Retry' : '重试';
            container.innerHTML = `<div class="no-data-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${errMsg}</p><button class="primary-btn" style="margin-top:12px;padding:8px 24px;" onclick="window._retryBibleText()">${retryLabel}</button></div>`;
            return;
        }

        if (!data || data.length === 0) {
            const ndLang = typeof getLang === 'function' ? getLang() : 'zh';
            const ndMsg = ndLang === 'ko' ? '해당 버전 데이터가 없습니다' : ndLang === 'en' ? 'No data available for this version' : '暂无该版本数据';
            container.innerHTML = `<div class="no-data-state"><i class="fa-solid fa-book"></i><p>${ndMsg}</p></div>`;
            return;
        }

        // Sort verses to ensure numerical order
        data.sort((a, b) => a.verse - b.verse);

        const bookName = bookDisplayName(S.book);
        const chLabel = getChLabel(S.chapter);

        // Compare mode: fetch parallel versions first
        let compareData = {};
        if (_compareMode && _cmpEnabled.filter(v => v !== S.version).length > 0) {
            compareData = await fetchCompareData();
        }

        let html = '';
        // Compare bar (sticky version selector)
        if (_compareMode) {
            html += renderCompareBar();
        }

        html += `<div class="ch-heading">${bookName} ${chLabel}</div>`;
        html += '<div class="verse-wrap">';
        const notedRefs = getNotedRefs();
        data.forEach(v => {
            const ref = `${S.book}-${S.chapter}-${v.verse}`;
            const isSelected = S.selection.has(ref);
            const hl = S.highlights[ref] ? ` data-highlight="${S.highlights[ref]}"` : '';
            const noteIcon = notedRefs.has(ref) ? `<span class="verse-note-icon" data-note-ref="${ref}" title="${t('notes.view') || '查看笔记'}"><i class="fa-solid fa-note-sticky"></i></span>` : '';

            // 段落小标题（如「神的创造」）：显示在该节经文之前
            if (v.heading) {
                html += `<div class="verse-heading">${escapeNoteHTML(v.heading)}</div>`;
            }

            // Main verse
            const plainText = plainVerseText(v.text);
            html += `<span class="verse${isSelected ? ' selected' : ''}" data-ref="${ref}" data-verse="${v.verse}" data-text="${plainText.replace(/"/g, '&quot;')}"${hl}><span class="verse-num">${v.verse}</span><span class="verse-content">${v.text}${noteIcon}</span> </span>`;

            // Inline compare blocks (rendered below each verse)
            if (_compareMode) {
                html += buildCompareVerseHtml(v.verse, compareData);
            }
        });
        html += '</div>';
        container.innerHTML = html;

        // Attach compare bar interactions
        if (_compareMode) {
            attachCompareBarEvents();
        }

        // Use event delegation instead of per-verse listeners
        container.onclick = e => {
            // Handle note icon click — open notes panel
            const noteEl = e.target.closest('.verse-note-icon');
            if (noteEl) {
                e.stopPropagation();
                const noteRef = noteEl.dataset.noteRef;
                if (noteRef) {
                    S.selection.clear();
                    S.selection.add(noteRef);
                    S.lastRef = noteRef;
                    renderVerseStates();
                    updateSelectionBar();
                }
                // 笔记已移入左侧「笔记」视图；旧代码跳的右栏 notes 标签已不存在，
                // 点了图标便毫无反应。现在：切视图 → 滚到那条笔记 → 闪烁提示
                switchView('notes');
                setTimeout(() => {
                    const idx = S.notes.findIndex(n => Array.isArray(n.refs) && n.refs.includes(noteRef));
                    if (idx < 0) return;
                    const card = document.querySelector(`.note-card[data-note-idx="${idx}"]`);
                    if (!card) return;
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.classList.add('note-card-flash');
                    setTimeout(() => card.classList.remove('note-card-flash'), 1800);
                }, 350);
                return;
            }
            const vEl = e.target.closest('.verse[data-ref]');
            if (vEl) handleVerseClick(vEl.dataset.ref, e);
        };
        container.oncontextmenu = e => {
            const vEl = e.target.closest('.verse[data-ref]');
            if (vEl) showCtxMenu(vEl.dataset.ref, e);
        };
        updateChapterNav();

        // Expose data globally so other tools like copy/AI/bookmarks can access it simply
        if (typeof window.bibleData === 'undefined') window.bibleData = {};
        if (!window.bibleData[S.version]) window.bibleData[S.version] = {};
        if (!window.bibleData[S.version][S.book]) window.bibleData[S.version][S.book] = {};
        window.bibleData[S.version][S.book][S.chapter] = data;

        _lastRenderedKey = currentKey;
    }

    function syncStateToUrl() {
        // e.g., #cuv/gen/1
        if (S.version && S.book && S.chapter) {
            history.replaceState(null, '', `#${S.version}/${S.book}/${S.chapter}`);
            localStorage.setItem('ob_last_pos', `${S.version}/${S.book}/${S.chapter}`);
        }
    }

    function updateChapterNav() {
        const chLabel = getChLabel(S.chapter);
        const label = `${bookDisplayName(S.book)} ${S.chapter}`;
        const chNav = $('ch-nav-label'); if (chNav) chNav.textContent = label;
        const bc = $('breadcrumb-book'); if (bc) bc.textContent = bookDisplayName(S.book);
        const bcc = $('breadcrumb-ch'); if (bcc) bcc.textContent = chLabel;
        const maxCh = BOOK_CHAPTERS[S.book] || 1;
        [$('prev-ch')].forEach(b => { if (b) b.disabled = S.chapter === '1'; });
        [$('next-ch')].forEach(b => { if (b) b.disabled = +S.chapter >= maxCh; });
        // Update active book/chapter in left nav
        document.querySelectorAll('.book-btn').forEach(b => b.classList.toggle('active', b.dataset.book === S.book));
        document.querySelectorAll('.ch-chip').forEach(c => c.classList.toggle('active', c.dataset.ch === S.chapter));
        syncStateToUrl();
    }

    // ── Chapter Overview for AI Panel default state ──
    const CH_EXPLORE_TEMPLATES = [
        { emoji: '❓', tpl: (bk, ch, theme) => `${bk} 第${ch}章中"${theme}"这个主题有什么深层含义？` },
        { emoji: '💡', tpl: (bk, ch, theme) => `${bk} 第${ch}章关于"${theme}"的教导如何应用在今天的生活中？` },
        { emoji: '📖', tpl: (bk, ch) => `请对比和总结${bk} 第${ch}章与其历史文化背景的关联` },
        { emoji: '🔗', tpl: (bk, ch) => `${bk} 第${ch}章与新约有哪些重要的呼应和关联？` },
        { emoji: '🙏', tpl: (bk, ch) => `根据${bk} 第${ch}章的内容，帮我写一段灵修祷告` },
        { emoji: '🎯', tpl: (bk, ch) => `总结${bk} 第${ch}章的核心要点与三个关键教导` },
    ];

    function renderChapterOverview() {
        const refEl = $('ch-overview-ref');
        const bodyEl = $('ch-overview-body');
        const themesEl = $('ch-overview-themes');
        const chipsEl = $('ch-explore-chips');
        if (!refEl || !bodyEl || !themesEl || !chipsEl) return;

        const targetLang = getContentLang();
        
        // Localize static UI elements based on current Bible version
        if (typeof LANGS !== 'undefined') {
            const dict = LANGS[targetLang] || LANGS['zh'];
            const lblOverview = document.querySelector('[data-i18n="ch.overview"]');
            if (lblOverview) lblOverview.textContent = dict['ch.overview'] || '本章速览';

            const lblExplore = document.querySelector('[data-i18n="ch.explore"]');
            if (lblExplore) lblExplore.textContent = dict['ch.explore'] || '启发探索';

            const lblSelectHint = document.querySelector('[data-i18n="ch.select-hint"]');
            if (lblSelectHint) lblSelectHint.textContent = dict['ch.select-hint'] || '点击左侧经文可获取逐节深度解析';
        }

        const bookName = bookDisplayName(S.book);
        const chNum = S.chapter;
        const refLabel = targetLang === 'en' ? `${bookName} ${chNum}` : 
                         targetLang === 'ko' ? `${bookName} 제${chNum}장` :
                         `${bookName} 第${chNum}章`;
        refEl.textContent = refLabel;

        // Fallback text translated
        const fbStr = {
            zh: `本章记录了《${bookName}》第${chNum}章的重要内容。选择经文或点击下方问题开始深入探索。`,
            en: `This chapter records the important content of ${bookName} ${chNum}. Select verses or click questions below to explore deeply.`,
            ko: `이 장은 ${bookName} 제${chNum}장의 중요한 내용을 기록하고 있습니다. 구절을 선택하거나 아래의 질문을 클릭하여 깊이 있는 탐구를 시작하세요.`
        };
        const emptyFallbackHtml = `<div class="overview-text">${fbStr[targetLang] || fbStr['zh']}</div>`;

        // Show skeleton first
        bodyEl.innerHTML = `<div class="ch-overview-skeleton">
            <div class="skeleton-line" style="width:100%"></div>
            <div class="skeleton-line" style="width:92%"></div>
            <div class="skeleton-line" style="width:80%"></div>
        </div>`;

        // NOTE: 加载期间清空标签区，不显示通用默认标签；API 返回章节专属 theme_tags 后再渲染
        themesEl.innerHTML = '';

        // 启发探索区域同步显示骨架屏，与本章速览保持一致
        chipsEl.innerHTML = `
            <div class="ch-overview-skeleton" style="display:flex;flex-direction:column;gap:8px;">
                <div class="skeleton-line" style="width:88%;height:36px;border-radius:999px;"></div>
                <div class="skeleton-line" style="width:76%;height:36px;border-radius:999px;"></div>
                <div class="skeleton-line" style="width:82%;height:36px;border-radius:999px;"></div>
            </div>`;

        // Generate overview via API call
        fetch(`${S.apiBase}/ai/chapter-summary/${S.book}/${chNum}?version=${S.version}`)
        .then(r => r.json())
        .then(data => {
            if (data.answer) {
                bodyEl.innerHTML = `<div class="overview-text">${data.answer}</div>`;
            } else {
                // NOTE: AI 未返回速览时展示简洁提示，不引用默认书卷标签
                bodyEl.innerHTML = emptyFallbackHtml;
            }

            // NOTE: AI 返回章节专属主题标签时，替换掉占位的书卷标签
            if (data.theme_tags && data.theme_tags.length > 0) {
                themesEl.innerHTML = data.theme_tags.map(th => {
                    const escapedTh = th.replace(/'/g, "\\'");
                    const safeBook = bookName.replace(/'/g, "\\'");
                    return `<span class="ch-theme-tag" onclick="window.explainThemeTag('${safeBook}', ${chNum}, '${escapedTh}')" style="cursor:pointer;" title="点击让 AI 深度解读此标签"><i class="fa-solid fa-tag" style="font-size:0.6rem;"></i> ${th}</span>`;
                }).join('');
            }
            
            // Render explore chips
            // NOTE: 图标统一为 App 紫的线性图标，不用彩色 emoji（与右栏其它图标一致）
            const CHIP_ICONS = { '📜': 'fa-landmark', '💡': 'fa-lightbulb', '🙏': 'fa-hands-praying', '📖': 'fa-book-open', '❓': 'fa-circle-question', '✝️': 'fa-cross', '🕊️': 'fa-dove', '🔗': 'fa-link', '🎯': 'fa-bullseye', '🔍': 'fa-magnifying-glass' };
            if (data.explore_chips && data.explore_chips.length > 0) {
                chipsEl.innerHTML = data.explore_chips.map(chip =>
                    `<button class="ch-explore-chip" data-question="${chip.question.replace(/"/g, '&quot;')}">
                        <span class="ch-chip-emoji"><i class="fa-solid ${CHIP_ICONS[chip.emoji] || 'fa-lightbulb'}" aria-hidden="true"></i></span>
                        <span class="ch-chip-text">${chip.question}</span>
                    </button>`
                ).join('');
                
                // Bind chip clicks to AI input
                chipsEl.querySelectorAll('.ch-explore-chip').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const q = btn.dataset.question;
                        const input = $('ai-search-input');
                        if (input) {
                            input.value = q;
                            if (typeof window._syncAISendBtn === 'function') window._syncAISendBtn();
                            input.focus();
                            sendAIQuestion();
                        }
                    });
                });
            } else {
                chipsEl.innerHTML = '';
            }
        })
        .catch(() => {
            const bookThemes = BOOK_THEMES[S.book] || [];
            const fallbackThemes = bookThemes.length > 0 ? `核心主题：${bookThemes.slice(0, 3).join('、')}。` : '';
            // NOTE: Fallback in localized form might omit fallbackThemes for non-zh to keep it clean, or we can just show emptyFallbackHtml since bookThemes are Chinese
            bodyEl.innerHTML = targetLang === 'zh' ? 
                `<div class="overview-text">本章记录了《${bookName}》第${chNum}章的重要内容。${fallbackThemes}选择经文或点击下方问题开始深入探索。</div>` :
                emptyFallbackHtml;
            chipsEl.innerHTML = '';
        });
    }


    function goChapter(delta) {
        const newCh = +S.chapter + delta;
        const maxCh = BOOK_CHAPTERS[S.book] || 1;
        if (newCh < 1 || newCh > maxCh) return;
        S.chapter = String(newCh);
        S.selection.clear();
        S.lastRef = null;
        stopBibleAudio();  // NOTE: 切章时停止旧音频
        clearAIChat();     // 清空 AI 对话
        renderBibleText();
        updateSelectionBar();
        updateStudyPanel();
        renderChapterOverview();
        // NOTE: 若当前停在注释 Tab，切章后立即刷新为新章全章注释
        if (S.panelTab === 'study') renderStudyTabContent();
        $('content-area').querySelector('.active-view')?.scrollTo(0, 0);
    }

    function navigateTo(book, chapter) {
        S.book = book; S.chapter = String(chapter || 1);
        S.selection.clear(); S.lastRef = null;
        stopBibleAudio();  // NOTE: 切换书卷时停止旧音频
        clearAIChat();     // 清空 AI 对话
        // 选书/选章就是「我要读这段」的意图：不在阅读视图时自动切回。
        // 否则顶栏芯片变了、页面还停在设置/笔记，用户以为没生效。
        // 放在状态更新之后：switchView 内部的渲染直接出新章节，
        // 后面那次 renderBibleText 会被 _lastRenderedKey 守卫跳过。
        if (S.view !== 'reading') switchView('reading');
        renderBibleText(); updateSelectionBar(); updateStudyPanel();
        renderBookList();
        $('chapter-overlay').classList.add('hidden');
        $('content-area').querySelector('.active-view')?.scrollTo(0, 0);
        // Refresh contextual AI prompts for new chapter
        if (typeof updateAIPresets === 'function') updateAIPresets();
        renderChapterOverview();
        // NOTE: 若当前停在注释 Tab，切章后立即刷新为新章全章注释
        if (S.panelTab === 'study') renderStudyTabContent();
    }


    // ── Study Panel Update (delegates to ref update) ──
    function updateStudyPanel() { updateStudyPanelRef(); }

    // ── Lightweight ref update (fires on every verse click) ──
    function updateStudyPanelRef() {
        const hasSelection = S.selection.size > 0;
        // NOTE: 不再隐藏速览（ai-default-state），只控制选节区的显隐
        const selDisp = $('study-selection-display');
        const aiSection = $('study-ai-section');
        const commSection = $('study-tab-comm-section');
        const crossSection = $('study-tab-cross-section');

        if (!hasSelection) {
            selDisp?.classList.add('hidden');
            if (aiSection) aiSection.style.display = 'none';
            // 显示注释区块，因为它需要渲染本章全部注释
            if (commSection) commSection.style.display = 'block';
            if (crossSection) crossSection.style.display = 'none';
            
            // 同步 Tabs 状态并重新渲染（此时会执行 renderStudyTabContent，进而加载本章注释）
            syncTabRefPills(null);
            return;
        }

        // NOTE: 选节后显示追加在速览下方的选节区，不隐藏速览
        selDisp?.classList.remove('hidden');

        // Update ref pill
        const refPill = $('study-ref-pill');
        if (refPill) {
            $('study-ref-text').textContent = refLabel(S.selection);
            refPill.style.animation = 'none'; void refPill.offsetWidth; refPill.style.animation = '';
        }

        // 刷新个性化属灵提问芯片（选中经文时切换为 verse_drawer 类别）
        if (typeof window.updateVerseDrawerPresets === 'function') {
            window.updateVerseDrawerPresets(true);
        }

        // NOTE: study-verse-block 不显示（用户无需在慧读面板中看到已选经文文字块）

        // Notes context
        const noteCtx = $('note-context-label');
        if (noteCtx) noteCtx.textContent = (t('notes.context') || '当前选节') + `：${refLabel(S.selection)}`;

        // Hide AI/cross sections until button clicked
        if (aiSection) aiSection.style.display = 'none';
        if (crossSection) crossSection.style.display = 'none';

        // Immediately show and fetch commentary
        if (commSection) {
            commSection.style.display = 'block';
            const sortedRefs = [...S.selection].sort((a, b) => +a.split('-')[2] - +b.split('-')[2]);
            if (sortedRefs.length > 0) {
                showCommentary(sortedRefs);
            }
        }

        // NOTE: 在注释/资源/笔记 Tab 内点选经文时，保留在当前 Tab 并刷新内容；
        // 其他情况（如首次选节）才自动切换到慧读(ai)。
        const STAY_TABS = ['study', 'community', 'bookmarks'];
        if (!STAY_TABS.includes(S.panelTab)) {
            switchPanelTab('ai');
        }

        // NOTE: 平滑滚动到选节区
        // 慧读(ai) Tab 使用 ai-panel-scroll 容器；其他 Tab 直接滚动到 selDisp
        if (selDisp) {
            requestAnimationFrame(() => {
                if (S.panelTab === 'ai') {
                    const scrollContainer = $('ai-panel-scroll');
                    if (scrollContainer) {
                        selDisp.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } else {
                    selDisp.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        }

        // Sync ref pills across study / notes / bookmarks tabs
        syncTabRefPills(hasSelection ? refLabel(S.selection) : null);
    }


    // ── Sync verse ref pills and tab states across all tabs ──
    function syncTabRefPills(label) {
        // Sync study tab
        if (S.panelTab === 'study') renderStudyTabContent();
        // 百科 tab 不依赖选节，无需随选节刷新
        // Sync notes tab
        if (S.panelTab === 'notes') syncNotesTabSelection();
    }

    // ── Run AI Analysis (only triggered by button click) ──
    function runAIAnalysis() {
        if (S.selection.size === 0) { showToast(((typeof getLang === 'function' ? getLang() : 'zh') === 'ko' ? '먼저 구절을 선택하세요' : (typeof getLang === 'function' ? getLang() : 'zh') === 'en' ? 'Please select verses first' : '请先点击左侧经文选节')); return; }

        const text = [];
        const data = window.bibleData[S.version]?.[S.book]?.[S.chapter];
        [...S.selection].sort((a, b) => +a.split('-')[2] - +b.split('-')[2]).forEach(ref => {
            const vn = ref.split('-')[2];
            const v = data?.find(v => String(v.verse) === vn);
            if (v) text.push(`${vn} ${plainVerseText(v.text)}`);
        });
        const refStr = refLabel(S.selection);
        const verseText = text.join('\n');

        // Switch to AI tab, show AI section, hide button
        switchPanelTab('ai');
        const aiSection = $('study-ai-section');
        if (aiSection) aiSection.style.display = 'block';
        const runBtn = $('run-ai-btn');
        if (runBtn) runBtn.style.display = 'none';

        fetchAIAnalysis(refStr, verseText);
    }

    async function fetchAIAnalysis(ref, verseText) {
        const aiSection = $('study-ai-section');
        if (!aiSection) return;

        const loading = $('study-ai-loading');
        const text = $('study-ai-text');

        loading.classList.remove('hidden');
        text.innerHTML = '';

        try {
            await fetch(`${S.apiBase}/stats/event`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "read_commentary", version: S.version })
            });
        } catch (e) { }

        try {
            const url = new URL(`${S.apiBase}/ai/summary/${ref}`, window.location.origin);
            if (verseText) url.searchParams.append('text', verseText);

            const res = await fetch(url.toString());
            const data = await res.json();

            loading.classList.add('hidden');
            if (res.ok) {
                const sourceLabel = data.source === 'db' ? '库缓存' : data.source === 'template' ? '内置解读' : '慧读生成';
                text.innerHTML = `<p>${data.content}</p><div style="text-align:right;font-size:0.75rem;color:var(--text-tertiary);margin-top:8px;">[来源: ${sourceLabel}]</div>`;
            } else {
                text.innerHTML = `<p style="color:var(--text-tertiary);font-size:0.88rem;">${t('err.analyze_fail')}: ${data.detail || t('err.unknown')}</p>`;
            }
        } catch (err) {
            loading.classList.add('hidden');
            text.innerHTML = `<p style="color:var(--text-tertiary);font-size:0.88rem;">${t('err.request')}: ${err.message}</p>`;
        }
    }

    let jingduCache = {};
    let jingduBookFetched = new Set();

    function deobfuscate(text) {
        const raw = atob(text.trim());
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i) ^ 0x2A;
        }
        return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    }

    function isVerseInRef(chapter, verse, refStr) {
        // extract e.g. "1:1-2:3" or "32:3-23" from strings like "1:6-8空气:"
        let cleanRef = refStr.replace(/[^0-9:,-]/g, '').replace(/-+$/, '');
        if (!cleanRef) return false;
        
        const parts = cleanRef.split('-');
        if (parts.length === 1) {
            const [c1, v1] = parts[0].split(':').map(Number);
            return chapter === c1 && verse === v1;
        } else {
            let start = parts[0];
            let end = parts[1];
            
            let c1, v1, c2, v2;
            if (start.includes(':')) {
                [c1, v1] = start.split(':').map(Number);
            } else {
                return false;
            }
            
            if (end.includes(':')) {
                [c2, v2] = end.split(':').map(Number);
            } else {
                c2 = c1;
                v2 = Number(end);
            }
            
            if (chapter > c1 && chapter < c2) return true;
            if (chapter === c1 && chapter === c2) return verse >= v1 && verse <= v2;
            if (chapter === c1 && chapter < c2) return verse >= v1;
            if (chapter === c2 && chapter > c1) return verse <= v2;
            return false;
        }
    }

    async function showCommentary(refs) {
        const cont = $('study-tab-commentary-content');
        if (!cont) return;
        
        cont.innerHTML = `<div class="skeleton-commentary">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line" style="width:100%"></div>
            <div class="skeleton-line" style="width:92%"></div>
            <div class="skeleton-line" style="width:85%"></div>
            <div class="skeleton-line short" style="width:60%"></div>
            <div class="skeleton-spacer"></div>
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line" style="width:95%"></div>
            <div class="skeleton-line" style="width:88%"></div>
            <div class="skeleton-line short" style="width:45%"></div>
        </div>`;
        
        let allMatchedComms = [];
        let fetchedBooksInLoop = new Set();
        
        for (const ref of refs) {
            const [b, c, v] = ref.split('-');
            const cacheKey = `${b}-${c}`;
            
            if (!jingduBookFetched.has(b) && !fetchedBooksInLoop.has(b)) {
                fetchedBooksInLoop.add(b);
                try {
                    // Determine bookId dynamically, e.g. 'gen' -> '1'
                    const bookIndex = Object.keys(BOOK_CHAPTERS).indexOf(b) + 1;
                    const url = `data/commentary/jingdu/${bookIndex}.json`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const text = await res.text();
                        const data = deobfuscate(text);
                        for (const chapterKey in data) {
                            jingduCache[`${b}-${chapterKey}`] = data[chapterKey] || [];
                        }
                        jingduBookFetched.add(b);
                    }
                } catch (e) {
                    console.error("Failed to load jingdu commentary:", e);
                }
            }
            
            const allComm = jingduCache[cacheKey] || [];
            const num_c = parseInt(c);
            const num_v = parseInt(v);
            
            const matchedCommsForVerse = allComm.filter(comm => isVerseInRef(num_c, num_v, comm.verses));
            
            // Deduplicate across verses in the same selection
            for (const comm of matchedCommsForVerse) {
                if (!allMatchedComms.some(c => c.verses === comm.verses && (c.text === comm.text || c.html === comm.html))) {
                    allMatchedComms.push(comm);
                }
            }
        }
        
        // Sort by verses string length/number to make it slightly ordinal
        allMatchedComms.sort((a, b) => {
            let numA = parseInt(a.verses.match(/\d+/)?.[0] || '0');
            let numB = parseInt(b.verses.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });
        
        if (allMatchedComms.length) {
            cont.innerHTML = allMatchedComms.map(commentaryItemHtml).join('');
            setupCommentaryCollapse(cont);
            // 绑定防复制事件
            cont.addEventListener('copy', e => e.preventDefault());
            cont.addEventListener('contextmenu', e => e.preventDefault());
            cont.addEventListener('selectstart', e => e.preventDefault());
        } else {
            cont.innerHTML = '<p style="color:var(--text-tertiary);font-size:0.88rem;padding:8px 0;">' + ((typeof getLang === 'function' ? getLang() : 'zh') === 'ko' ? '해설이 없습니다.' : (typeof getLang === 'function' ? getLang() : 'zh') === 'en' ? 'No commentary available.' : '暂无该节注释数据') + '</p>';
        }
    }

    // 注释条目渲染：节段做金色徽章（多节段实底以示覆盖范围广），
    // 超长条目默认折叠，展开由用户决定——避免一条 1:1-2:3 的长文把面板变成文字墙。
    // 中文标点归正：注释源数据里逗号/分号等是半角，夹在汉字中间不合排版规范。
    // 只在前后都是 CJK 时替换，不碰 (The Source) 这类西文片段内部的标点。
    function zhTypeset(html) {
        if (!html) return html;
        const CJK = '[\u4e00-\u9fff\u3000-\u303f？！；：、」』）]';
        return html
            .replace(new RegExp(`(${CJK}),(?=${CJK.replace(']', '「『（]')})`, 'g'), '$1，')
            .replace(new RegExp(`(${CJK});(?=${CJK})`, 'g'), '$1；')
            .replace(new RegExp(`(${CJK}):(?=${CJK})`, 'g'), '$1：')
            .replace(new RegExp(`(${CJK})[?](?=${CJK})`, 'g'), '$1？')
            .replace(new RegExp(`(${CJK})!(?=${CJK})`, 'g'), '$1！');
    }

    function commentaryItemHtml(c) {
        const multi = /[-,–]/.test(c.verses);
        return `<div class="commentary-item">
            <div class="commentary-head">
                <span class="commentary-range${multi ? ' is-multi' : ''}">${c.verses}</span>
                <span class="commentary-source">精读本注释</span>
            </div>
            <div class="commentary-text">${zhTypeset(c.html || c.text)}</div>
            <button class="commentary-expand hidden">展开全文 <i class="fa-solid fa-angle-down"></i></button>
        </div>`;
    }

    // 折叠检测：渲染后量高度，超过阈值的条目收起并给「展开全文」
    function setupCommentaryCollapse(cont) {
        cont.querySelectorAll('.commentary-item').forEach(item => {
            const text = item.querySelector('.commentary-text');
            const btn = item.querySelector('.commentary-expand');
            if (!text || !btn) return;
            if (text.scrollHeight > 380) {
                item.classList.add('is-collapsed');
                btn.classList.remove('hidden');
                btn.addEventListener('click', () => {
                    const collapsed = item.classList.toggle('is-collapsed');
                    btn.innerHTML = collapsed
                        ? '展开全文 <i class="fa-solid fa-angle-down"></i>'
                        : '收起 <i class="fa-solid fa-angle-up"></i>';
                });
            }
        });
    }

    // ── 书卷绪论（精读本各卷的「0」章，版式对齐 App 端 BookIntroduction）──
    // 卷首扉页 → 书卷档案卡 → 节内目录 → 论述专文 → 层级大纲 → 「进入第 1 章」
    const INTRO_FACT_LABELS = ['标题', '作者', '写作年代', '写作目的', '写作背景', '特点'];
    // 只有这三项有真正的「值」（书名/人名/年代）；目的与特点是整段论述，首行只是折行产物
    const INTRO_VALUED = ['标题', '作者', '写作年代'];
    let _studyIntroBook = null; // 正在看绪论的书卷；null = 显示本章注释

    function introText(s) {
        return zhTypeset(_escapeHtml(s || ''));
    }

    // 大纲行层级：第一部 → 一．→ 1．→ 1）
    function introOutlineLevel(line) {
        if (/^第[一二三四五六七八九十]+部/.test(line)) return 0;
        if (/^[一二三四五六七八九十]+[．.、]/.test(line)) return 1;
        if (/^\d+[．.]/.test(line)) return 2;
        if (/^\d+[）)]/.test(line)) return 3;
        return 2;
    }

    // 行尾经文范围（…/1:1-2:25）拆出来弱化显示
    function introSplitRef(line) {
        const at = line.lastIndexOf('/');
        if (at > 0 && /^\d+:\d/.test(line.slice(at + 1))) return [line.slice(0, at), line.slice(at + 1)];
        return [line, ''];
    }

    function bookIntroEntryHtml(book) {
        return `<button type="button" class="win-entry" data-intro-open>
            <span class="win-entry-index">绪论</span>
            <span class="win-entry-copy">
                <b>读${_escapeHtml(bookDisplayName(book))}前，先看这一篇</b>
                <small>书卷档案 · 综览 · 全书大纲</small>
            </span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;
    }

    function bookIntroductionHtml(book, sections) {
        const name = bookDisplayName(book);
        const isOT = Object.keys(BOOK_CHAPTERS).indexOf(book) < 39;
        const items = sections.map((s) => ({ title: s.verses, body: s.text || '' }));
        const facts = items.filter((s) => INTRO_FACT_LABELS.includes(s.title));
        const articles = items.filter((s) => !INTRO_FACT_LABELS.includes(s.title));

        const factsHtml = facts.length ? `<section class="win-facts" aria-label="书卷档案">
            ${facts.map((fact) => {
                const [value, ...rest] = fact.body.split('\n');
                const detail = rest.join('\n').trim();
                const hasValue = INTRO_VALUED.includes(fact.title) && value.length <= 24 && detail;
                return `<div class="win-fact">
                    <small>${introText(fact.title)}</small>
                    <div>${hasValue
                        ? `<b>${introText(value)}</b><p>${introText(detail)}</p>`
                        : `<p>${introText(fact.body.replace(/\n/g, ''))}</p>`}</div>
                </div>`;
            }).join('')}
        </section>` : '';

        const tocHtml = articles.length > 1 ? `<nav class="win-toc" aria-label="绪论目录">
            ${articles.map((s, i) => `<button type="button" data-intro-jump="${i}">${introText(s.title)}</button>`).join('')}
        </nav>` : '';

        const articlesHtml = articles.map((s, i) => `
        <section class="win-section" id="win-article-${i}">
            <h2><span>${introText(s.title)}</span></h2>
            ${s.title === '大纲'
                ? `<div class="win-outline">${s.body.split('\n').map((raw) => {
                    const [label, ref] = introSplitRef(raw.trim());
                    if (!label) return '';
                    return `<div class="win-outline-row is-l${introOutlineLevel(label)}"><span>${introText(label)}</span>${ref ? `<small>${_escapeHtml(ref)}</small>` : ''}</div>`;
                }).join('')}</div>`
                : `<p class="win-body">${introText(s.body)}</p>`}
        </section>`).join('');

        return `<div class="win-intro">
            <button type="button" class="win-back" data-intro-close><i class="fa-solid fa-chevron-left"></i> 第 1 章注释</button>
            <header class="win-hero">
                <span class="win-watermark" aria-hidden="true">${_escapeHtml(Array.from(name)[0] || '')}</span>
                <div class="win-eyebrow">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2.5c.9 5.2 3.4 7.7 8.6 8.6-5.2.9-7.7 3.4-8.6 8.6-.9-5.2-3.4-7.7-8.6-8.6 5.2-.9 7.7-3.4 8.6-8.6Z"/></svg>
                    精读本注释 · 绪论
                </div>
                <h1>${_escapeHtml(name)}</h1>
                <div class="win-meta">
                    <span>${isOT ? '旧约' : '新约'} · 共 ${BOOK_CHAPTERS[book] || ''} 章</span>
                    <button type="button" class="win-start-inline" data-intro-close>进入第 1 章 <i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </header>
            ${factsHtml}
            ${tocHtml}
            ${articlesHtml}
            <button type="button" class="win-start" data-intro-close>
                <span><small>绪论读完</small>进入第 1 章</span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>`;
    }

    function bindBookIntroduction(cont, book, chapter) {
        const scrollPanelTop = () => cont.closest('.tab-content')?.scrollTo({ top: 0 });
        cont.querySelectorAll('[data-intro-open]').forEach((btn) => btn.addEventListener('click', () => {
            _studyIntroBook = book;
            showChapterCommentary(book, chapter);
            scrollPanelTop();
        }));
        cont.querySelectorAll('[data-intro-close]').forEach((btn) => btn.addEventListener('click', () => {
            _studyIntroBook = null;
            showChapterCommentary(book, chapter);
            scrollPanelTop();
        }));
        cont.querySelectorAll('[data-intro-jump]').forEach((btn) => btn.addEventListener('click', () => {
            $(`win-article-${btn.dataset.introJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
    }

    // NOTE: 全章注释模式——直接返回本章 jingduCache 里所有条目，不逐节过滤
    // 用于注释 Tab 默认状态（无经文选中时显示全章）
    async function showChapterCommentary(book, chapter) {
        const cont = $('study-tab-commentary-content');
        if (!cont) return;
        // 换了书卷或离开第 1 章：退出绪论，回到章注释
        if (_studyIntroBook && (_studyIntroBook !== book || String(chapter) !== '1')) _studyIntroBook = null;

        cont.innerHTML = `<div class="skeleton-commentary">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line" style="width:100%"></div>
            <div class="skeleton-line" style="width:88%"></div>
            <div class="skeleton-line short" style="width:60%"></div>
            <div class="skeleton-spacer"></div>
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line" style="width:95%"></div>
            <div class="skeleton-line short" style="width:45%"></div>
        </div>`;

        // 懒加载整本书的注释数据
        if (!jingduBookFetched.has(book)) {
            try {
                const bookIndex = Object.keys(BOOK_CHAPTERS).indexOf(book) + 1;
                const url = `data/commentary/jingdu/${bookIndex}.json`;
                const res = await fetch(url);
                if (res.ok) {
                    const text = await res.text();
                    const data = deobfuscate(text);
                    for (const chapterKey in data) {
                        jingduCache[`${book}-${chapterKey}`] = data[chapterKey] || [];
                    }
                    jingduBookFetched.add(book);
                }
            } catch (e) {
                console.error('Failed to load jingdu commentary:', e);
            }
        }

        const introSections = jingduCache[`${book}-0`] || [];

        // 绪论视图（从第 1 章顶部入口进入）
        if (_studyIntroBook === book && introSections.length) {
            cont.innerHTML = bookIntroductionHtml(book, introSections);
            bindBookIntroduction(cont, book, chapter);
            return;
        }

        const cacheKey = `${book}-${chapter}`;
        const allComm = jingduCache[cacheKey] || [];

        // 按节号排序
        const sorted = [...allComm].sort((a, b) => {
            const numA = parseInt(a.verses?.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.verses?.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });

        // 第 1 章顶部放绪论入口（与 App 端一致）
        const introEntry = String(chapter) === '1' && introSections.length ? bookIntroEntryHtml(book) : '';

        if (sorted.length) {
            cont.innerHTML = introEntry
                + `<div class="commentary-count">本章共 ${sorted.length} 条注释</div>`
                + sorted.map(commentaryItemHtml).join('');
            bindBookIntroduction(cont, book, chapter);
            setupCommentaryCollapse(cont);
            // 绑定防复制事件
            cont.addEventListener('copy', e => e.preventDefault());
            cont.addEventListener('contextmenu', e => e.preventDefault());
            cont.addEventListener('selectstart', e => e.preventDefault());
        } else {
            cont.innerHTML = introEntry + '<p style="color:var(--text-tertiary);font-size:0.88rem;padding:8px 0;">本章暂无注释数据</p>';
            bindBookIntroduction(cont, book, chapter);
        }
    }



    function showCrossRefs(ref) {
        const cont = $('study-tab-cross-content');
        const section = $('study-tab-cross-section');
        if (!cont) return;
        const refs = CROSS_REFS[ref];
        if (refs && refs.length) {
            if (section) section.style.display = 'block';
            cont.innerHTML = `<div class="cross-ref-list">${refs.map(r => `
            <div class="cross-ref-item"><i class="fa-solid fa-book-bible"></i>${r}</div>`).join('')}</div>`;
        } else {
            if (section) section.style.display = 'none';
            cont.innerHTML = '';
        }
    }


    // ── Left Nav ──
    function renderBookList() {
        const otList = $('book-list');
        if (!otList) return;
        const isOT = document.querySelector('.testament-btn.active')?.dataset.testament === 'ot';
        const books = isOT ? OT_BOOKS : NT_BOOKS;
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const chWord = lang === 'ko' ? '장' : lang === 'en' ? 'ch' : '章';
        otList.innerHTML = books.map(([key]) => {
            const displayName = bookDisplayName(key);
            const active = key === S.book;
            return `<div>
          <button class="book-btn${active ? ' active' : ''}" data-book="${key}">
            <span>${displayName}</span><span class="book-abbr">${BOOK_CHAPTERS[key]}${chWord}</span>
          </button>
          ${active ? renderChapterChips(key) : ''}
        </div>`;
        }).join('');
        otList.querySelectorAll('.book-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const book = btn.dataset.book;
                if (book === S.book) return; // already active
                navigateTo(book, 1);
            });
        });
        otList.querySelectorAll('.ch-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                S.chapter = chip.dataset.ch; S.selection.clear(); S.lastRef = null;
                stopBibleAudio();  // NOTE: 点选章节芯片时停止旧音频
                clearAIChat();     // 清空 AI 对话
                renderBibleText(); updateSelectionBar(); updateStudyPanel();
                renderBookList();
            });
        });
    }

    function renderChapterChips(book) {
        const max = BOOK_CHAPTERS[book] || 1;
        let html = '<div class="chapter-chips">';
        for (let i = 1; i <= max; i++) {
            html += `<button class="ch-chip${String(i) === S.chapter ? ' active' : ''}" data-ch="${i}">${i}</button>`;
        }
        html += '</div>';
        return html;
    }

    // ── Panel Tabs ──
    function switchPanelTab(tab) {
        if (tab === 'community' && !SHOW_COMMUNITY) tab = 'ai';
        S.panelTab = tab;
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.tab-content').forEach(c => {
            c.classList.toggle('hidden', c.id !== `tab-${tab}`);
        });
        // Render tab-specific content based on current selection
        if (tab === 'study') renderStudyTabContent();
        if (tab === 'community') renderCommunityPanel();
        if (tab === 'profile') { _profileSub = null; renderProfileView(); }   // 每次进入回到概览，避免停在上次的子页
    }

    // ── Render Study (注释) tab based on current selection ──
    function renderStudyTabContent() {
        const hasSelection = S.selection.size > 0;
        const noSel = $('study-tab-no-sel');
        const content = $('study-tab-content');
        if (!content) return;

        // NOTE: 不再显示「请点击经文」占位，改为默认加载本章全章注释
        noSel?.classList.add('hidden');
        content.classList.remove('hidden');

        const crossSection = $('study-tab-cross-section');

        if (!hasSelection) {
            // 无选节——显示本章注释，隐藏交叉参考（交叉参考仅针对选节有意义）
            if (crossSection) crossSection.style.display = 'none';

            // ref pill 显示「本章」标识
            const pill = $('study-tab-ref-pill');
            if (pill) {
                const chLabel = `${bookDisplayName(S.book)} 第${S.chapter}章`;
                pill.querySelector('.tab-ref-text').textContent = chLabel;
            }

            // NOTE: 将本章第1节作为触发 ref 加载全章注释数据
            // showCommentary 按 book+chapter 整体加载，传第1节足够触发缓存
            showChapterCommentary(S.book, S.chapter);
            return;
        }

        // 有选节——正常按选节显示
        if (crossSection) crossSection.style.display = 'block';
        noSel?.classList.add('hidden');
        content.classList.remove('hidden');

        // Update ref pill
        const pill = $('study-tab-ref-pill');
        if (pill) pill.querySelector('.tab-ref-text').textContent = refLabel(S.selection);

        // Get sorted selected refs 
        const sortedRefs = [...S.selection].sort((a, b) => +a.split('-')[2] - +b.split('-')[2]);
        if (sortedRefs.length > 0) {
            // Commentary
            showCommentary(sortedRefs);

            // Cross references
            const firstRef = sortedRefs[0];
            showCrossRefs(firstRef);
        }
    }


    // ── Sync Notes tab selection state ──
    // 笔记视图（左侧「我的」组）：沿用原页签的两个渲染函数，
    // 选中经文后从选区/右键点「笔记」切到这里，引用会自动带过来。
    function renderNotesView() {
        syncNotesTabSelection();
        renderNotesList();
    }

    function syncNotesTabSelection() {
        const hasSelection = S.selection.size > 0;
        const noSel = $('notes-tab-no-sel');
        const content = $('notes-tab-content');
        const refWrap = $('notes-tab-ref-wrap');   // ref pill 区域
        const noteInputSection = content?.querySelector('.note-input-area')?.closest('.panel-section'); // 输入区
        if (!noSel || !content) return;

        // NOTE: 无论是否选节，只要有历史笔记就始终显示内容区（历史笔记不依赖选节）
        // 「请先选节」提示仅在无选节 且 无任何历史笔记时显示
        const hasNotes = S.notes.length > 0;
        if (!hasSelection && !hasNotes) {
            noSel.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        noSel.classList.add('hidden');
        content.classList.remove('hidden');

        // 无选节时：隐藏 ref pill 和写笔记输入区；仍显示历史笔记列表
        if (refWrap) refWrap.style.display = hasSelection ? '' : 'none';
        if (noteInputSection) noteInputSection.style.display = hasSelection ? '' : 'none';

        if (!hasSelection) return;

        // Update ref pill
        const pill = $('notes-tab-ref-pill');
        if (pill) pill.querySelector('.tab-ref-text').textContent = refLabel(S.selection);

        // Update context label
        const noteCtx = $('note-context-label');
        if (noteCtx) noteCtx.textContent = `当前选节：${refLabel(S.selection)}`;
    }

    // ── Notes ──

    // Build a Set of raw refs (e.g. "gen-1-2") that have at least one note
    function getNotedRefs() {
        const set = new Set();
        S.notes.forEach(n => {
            if (n.refs && Array.isArray(n.refs)) {
                n.refs.forEach(r => set.add(r));
            }
        });
        return set;
    }

    // Refresh note indicator icons in the current bible text view
    function renderNoteIndicators() {
        const notedRefs = getNotedRefs();
        document.querySelectorAll('.verse[data-ref]').forEach(vEl => {
            const ref = vEl.dataset.ref;
            // Remove existing icon if present
            const existing = vEl.querySelector('.verse-note-icon');
            if (existing) existing.remove();
            // Add icon if this ref has notes
            if (notedRefs.has(ref)) {
                const icon = document.createElement('span');
                icon.className = 'verse-note-icon';
                icon.dataset.noteRef = ref;
                icon.title = t('notes.view') || '查看笔记';
                icon.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
                // Insert before the trailing space (last child text node)
                vEl.appendChild(icon);
            }
        });
    }

    async function syncUserNotesCloud() {
        // 整合后网页版与 App 同源共用会话 Cookie，不再需要 Bearer token。
        // 未登录时 /user-notes/sync 会返回 401，这里直接静默跳过。

        let needsSaveLocal = false;
        const notesToSync = S.notes.map(n => {
            if (!n.id) {
                n.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                needsSaveLocal = true;
            }
            return {
                verse_ref: n.id,
                content: JSON.stringify(n)
            };
        });

        if (needsSaveLocal) {
            localStorage.setItem('ob_notes', JSON.stringify(S.notes));
        }

        try {
            const res = await fetch(`${S.apiBase}/user-notes/sync`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notesToSync)
            });
            if (res.ok) {
                const data = await res.json();
                const mergedNotes = data.map(item => {
                    try {
                        const noteObj = JSON.parse(item.content);
                        noteObj.id = item.verse_ref;
                        return noteObj;
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);

                mergedNotes.sort((a, b) => {
                    const da = new Date(a.date || 0);
                    const db = new Date(b.date || 0);
                    return db - da;
                });

                S.notes = mergedNotes;
                localStorage.setItem('ob_notes', JSON.stringify(S.notes));
                renderNotesList();
                renderNoteIndicators();
            }
        } catch (e) {
            console.error("Sync user notes failed:", e);
        }
    }

    window._syncNotes = syncUserNotesCloud;

    function saveNote() {
        const input = $('note-input');
        const text = input.value.trim();
        if (!text) return;
        const note = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            ref: S.selection.size > 0 ? refLabel(S.selection) : '（无经文）',
            refs: S.selection.size > 0 ? [...S.selection] : [],
            text, date: new Date().toLocaleDateString('zh-CN')
        };
        S.notes.unshift(note);
        localStorage.setItem('ob_notes', JSON.stringify(S.notes));
        input.value = '';
        renderNotesList();
        renderNoteIndicators();
        showToast(t('toast.saved'));
        syncUserNotesCloud();
    }

    // ── 历史笔记视图状态：搜索 / 类型 / 书卷 / 排序 / 分组 ──
    const notesView = { q: '', type: 'all', book: 'all', sort: 'new', group: false };
    const _collapsedNoteGroups = new Set();

    // 取笔记所属书卷 code（无经文笔记归入 '_none'）
    function noteBookCode(n) {
        if (n.refs && n.refs.length > 0) {
            return (n.refs[0].split('-')[0] || '').toLowerCase() || '_none';
        }
        return '_none';
    }

    // 用于搜索的全文（经文引用 + 手写内容 + AI 问答）
    function noteSearchText(n) {
        return [n.ref, n.text, n.question, n.answer].filter(Boolean).join('\n').toLowerCase();
    }

    function _escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    // 本地 HTML 转义（escapeHTML 定义在别的函数作用域内，此处不可见，故自带一份）
    function escapeNoteHTML(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 在已转义的 HTML 文本中高亮搜索词
    function highlightMatch(escaped, q) {
        if (!q) return escaped;
        try {
            return escaped.replace(new RegExp('(' + _escapeRegExp(q) + ')', 'gi'), '<mark class="note-hl">$1</mark>');
        } catch (e) { return escaped; }
    }

    function _notesL() {
        const lang = (typeof getLang === 'function' ? getLang() : 'zh');
        return {
            history: lang === 'en' ? 'History' : lang === 'ko' ? '기록' : '历史笔记',
            search: lang === 'en' ? 'Search notes…' : lang === 'ko' ? '노트 검색…' : '搜索笔记…',
            all: lang === 'en' ? 'All' : lang === 'ko' ? '전체' : '全部',
            hand: lang === 'en' ? 'Notes' : lang === 'ko' ? '노트' : '手写',
            none: lang === 'en' ? 'No verse' : lang === 'ko' ? '구절 없음' : '无经文',
            allBooks: lang === 'en' ? 'All books' : lang === 'ko' ? '모든 책' : '全部书卷',
            noMatch: lang === 'en' ? 'No matching notes' : lang === 'ko' ? '일치하는 노트가 없습니다' : '没有匹配的笔记',
            sortNew: lang === 'en' ? 'Newest first' : lang === 'ko' ? '최신순' : '最新在前',
            sortOld: lang === 'en' ? 'Oldest first' : lang === 'ko' ? '오래된순' : '最早在前',
            group: lang === 'en' ? 'Group by book' : lang === 'ko' ? '책별 그룹' : '按书卷分组'
        };
    }

    // 本地化工具栏静态文案（随语言切换刷新）
    function localizeNotesToolbar() {
        const L = _notesL();
        const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
        set('notes-history-title', L.history);
        const s = $('notes-search-input'); if (s) s.placeholder = L.search;
        const chips = document.querySelectorAll('#notes-type-chips .notes-chip');
        if (chips[0]) chips[0].textContent = L.all;
        if (chips[1]) chips[1].textContent = L.hand;
        if (chips[2]) chips[2].textContent = 'AI';
        const sortBtn = $('notes-sort-btn');
        if (sortBtn) sortBtn.title = notesView.sort === 'new' ? L.sortNew : L.sortOld;
        const groupBtn = $('notes-group-btn');
        if (groupBtn) groupBtn.title = L.group;
    }

    // 按笔记内容填充「书卷筛选」下拉（仅列出有笔记的书卷，按圣经顺序）
    function populateNoteBookFilter() {
        const sel = $('notes-book-filter');
        if (!sel) return;
        const L = _notesL();
        const counts = {};
        S.notes.forEach(n => { const c = noteBookCode(n); counts[c] = (counts[c] || 0) + 1; });
        let html = `<option value="all">${L.allBooks}</option>`;
        ALL_BOOKS.forEach(([code]) => {
            if (counts[code]) html += `<option value="${code}">${bookDisplayName(code)} (${counts[code]})</option>`;
        });
        if (counts['_none']) html += `<option value="_none">${L.none} (${counts['_none']})</option>`;
        sel.innerHTML = html;
        if (notesView.book !== 'all' && !counts[notesView.book]) notesView.book = 'all';
        sel.value = notesView.book;
    }

    // 生成单张笔记卡片（i = 在 S.notes 中的原始索引，供删除/分享定位）
    // 生成单张笔记卡片（i = 在 S.notes 中的原始索引，供删除/分享定位）
    // 统一外壳：元信息一行（引用 + 类型 + 日期 + 操作），正文为主体。
    // 操作按钮悬停才显现——每张卡都常驻分享/删除会让列表很吵。
    function noteCardHTML(n, i, q) {
        const isAi = n.type === 'ai_qa';
        let refClick = '';
        if (n.refs && n.refs.length > 0) {
            const parts = n.refs[0].split('-');
            refClick = `onclick="navigateToNoteRef('${parts[0]}','${parts[1] || '1'}')"`;
        }
        const refHtml = n.ref
            ? `<button class="note-ref"${refClick ? ' ' + refClick : ' disabled'}>${escapeNoteHTML(n.ref)}</button>`
            : '';
        const body = isAi
            ? `<p class="note-q">${highlightMatch(escapeNoteHTML(n.question || ''), q)}</p>
               <div class="note-a clampable">${(n.answer || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>`
            : `<div class="note-body clampable">${highlightMatch(escapeNoteHTML(n.text || ''), q)}</div>`;

        return `
        <article class="note-card${isAi ? ' is-ai' : ''}" data-note-idx="${i}">
            <div class="note-meta">
                ${refHtml}
                ${isAi ? `<span class="note-kind">${t('notes.kindAi') || '慧读'}</span>` : ''}
                <time>${escapeNoteHTML(noteDateLabel(n.date))}</time>
                <span class="note-acts">
                    <button class="note-act" onclick="event.stopPropagation();shareNote(${i})" title="${t('sel.share') || '分享'}" aria-label="${t('sel.share') || '分享'}"><i class="fa-solid fa-share-from-square"></i></button>
                    <button class="note-act is-danger" onclick="event.stopPropagation();deleteNote(${i})" title="${t('notes.delete') || '删除'}" aria-label="${t('notes.delete') || '删除'}"><i class="fa-solid fa-trash"></i></button>
                </span>
            </div>
            ${body}
        </article>`;
    }
    // 按书卷分组渲染（圣经顺序，无经文组置末，组头可折叠）
    function renderGroupedNotes(items, q) {
        const L = _notesL();
        const groups = {};
        items.forEach(it => { const c = noteBookCode(it.n); (groups[c] = groups[c] || []).push(it); });
        const order = ALL_BOOKS.map(([c]) => c).filter(c => groups[c]);
        if (groups['_none']) order.push('_none');
        return order.map(code => {
            const label = code === '_none' ? L.none : bookDisplayName(code);
            const collapsed = _collapsedNoteGroups.has(code);
            const cards = groups[code].map(it => noteCardHTML(it.n, it.idx, q)).join('');
            return `
        <div class="notes-group ${collapsed ? 'collapsed' : ''}" data-group="${code}">
            <div class="notes-group-header" data-group="${code}">
                <i class="fa-solid fa-chevron-down chevron"></i>
                <span>${label}</span>
                <span class="notes-group-count">${groups[code].length}</span>
            </div>
            ${cards}
        </div>`;
        }).join('');
    }

    function renderNotesList() {
        const list = $('notes-list');
        if (!list) return;
        syncNotesTabSelection();
        const toolbar = $('notes-toolbar');

        // 完全没有笔记 → 隐藏工具栏，显示空状态
        if (!S.notes.length) {
            if (toolbar) toolbar.classList.add('hidden');
            list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-note-sticky"></i><p>${t('notes.empty')}</p></div>`;
            return;
        }
        if (toolbar) toolbar.classList.remove('hidden');
        localizeNotesToolbar();
        populateNoteBookFilter();

        // 携带原始索引，便于过滤/排序后仍能正确删除/分享
        let items = S.notes.map((n, idx) => ({ n, idx }));

        // 类型筛选
        if (notesView.type === 'note') items = items.filter(it => it.n.type !== 'ai_qa');
        else if (notesView.type === 'ai_qa') items = items.filter(it => it.n.type === 'ai_qa');
        // 书卷筛选
        if (notesView.book !== 'all') items = items.filter(it => noteBookCode(it.n) === notesView.book);
        // 关键词搜索
        const q = notesView.q.trim().toLowerCase();
        if (q) items = items.filter(it => noteSearchText(it.n).includes(q));
        // 排序（S.notes 本身为最新在前，反转即最早在前）
        if (notesView.sort === 'old') items = items.slice().reverse();

        // 计数徽标：匹配数/总数
        const badge = $('notes-count-badge');
        if (badge) {
            const total = S.notes.length;
            badge.textContent = (items.length === total) ? `${total}` : `${items.length}/${total}`;
        }

        // 无匹配
        if (!items.length) {
            const L = _notesL();
            list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>${L.noMatch}</p></div>`;
            return;
        }

        list.innerHTML = notesView.group
            ? renderGroupedNotes(items, q)
            : items.map(it => noteCardHTML(it.n, it.idx, q)).join('');
    }

    // 工具栏事件（仅绑定一次；工具栏为静态 DOM，列表重渲染不影响）
    function setupNotesToolbar() {
        const search = $('notes-search-input');
        const clearBtn = $('notes-search-clear');
        if (search) {
            search.addEventListener('input', () => {
                notesView.q = search.value;
                if (clearBtn) clearBtn.classList.toggle('hidden', !search.value);
                renderNotesList();
            });
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                notesView.q = '';
                if (search) search.value = '';
                clearBtn.classList.add('hidden');
                renderNotesList();
                search && search.focus();
            });
        }
        document.querySelectorAll('#notes-type-chips .notes-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                notesView.type = chip.dataset.type;
                document.querySelectorAll('#notes-type-chips .notes-chip')
                    .forEach(c => c.classList.toggle('active', c === chip));
                renderNotesList();
            });
        });
        const bookSel = $('notes-book-filter');
        if (bookSel) bookSel.addEventListener('change', () => { notesView.book = bookSel.value; renderNotesList(); });
        const sortBtn = $('notes-sort-btn');
        if (sortBtn) sortBtn.addEventListener('click', () => {
            notesView.sort = notesView.sort === 'new' ? 'old' : 'new';
            sortBtn.classList.toggle('active', notesView.sort === 'old');
            const ic = sortBtn.querySelector('i');
            if (ic) ic.className = notesView.sort === 'new'
                ? 'fa-solid fa-arrow-down-wide-short'
                : 'fa-solid fa-arrow-up-wide-short';
            renderNotesList();
        });
        const groupBtn = $('notes-group-btn');
        if (groupBtn) groupBtn.addEventListener('click', () => {
            notesView.group = !notesView.group;
            groupBtn.classList.toggle('active', notesView.group);
            renderNotesList();
        });
    }

    async function deleteUserNoteCloud(verseRef) {
        if (typeof Auth === 'undefined' || !Auth.getUser()) return;
        try {
            await fetch(`${S.apiBase}/user-notes/${encodeURIComponent(verseRef)}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });
        } catch (e) {
            console.error("Cloud delete note failed:", e);
        }
    }

    /**
     * 全局美化的异步确认弹窗
     * @param {string} title 弹窗标题
     * @param {string} desc 弹窗描述内容
     * @returns {Promise<boolean>} 用户确认返回 true，取消返回 false
     */
    window.showConfirmDialog = function(title, desc) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const tEl = document.getElementById('confirm-modal-title');
            const dEl = document.getElementById('confirm-modal-desc');
            const btnConfirm = document.getElementById('confirm-modal-confirm');
            const btnCancel = document.getElementById('confirm-modal-cancel');
            const backdrop = document.getElementById('confirm-modal-backdrop');
            if (!modal) {
                resolve(false);
                return;
            }

            const lang = typeof getLang === 'function' ? getLang() : 'zh';
            const cancelText = lang === 'en' ? 'Cancel' : lang === 'ko' ? '취소' : '取消';
            const confirmText = lang === 'en' ? 'Confirm' : lang === 'ko' ? '확인' : '确认';

            if (btnCancel) btnCancel.textContent = cancelText;
            if (btnConfirm) btnConfirm.textContent = confirmText;

            if (title) tEl.textContent = title;
            if (desc) dEl.textContent = desc;

            modal.classList.remove('hidden');

            const cleanUp = (result) => {
                modal.classList.add('hidden');
                if (btnConfirm) btnConfirm.onclick = null;
                if (btnCancel) btnCancel.onclick = null;
                if (backdrop) backdrop.onclick = null;
                resolve(result);
            };

            if (btnConfirm) btnConfirm.onclick = () => cleanUp(true);
            if (btnCancel) btnCancel.onclick = () => cleanUp(false);
            if (backdrop) backdrop.onclick = () => cleanUp(false);
        });
    };

    window.deleteNote = async function (i) {
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const title = lang === 'en' ? 'Delete Note' : lang === 'ko' ? '노트 삭제' : '删除笔记';
        const confirmMsg = t('notes.confirm-delete') || '确定要删除这条笔记吗？';
        const confirmed = await window.showConfirmDialog(title, confirmMsg);
        if (!confirmed) return;

        const n = S.notes[i];
        S.notes.splice(i, 1);
        localStorage.setItem('ob_notes', JSON.stringify(S.notes));
        renderNotesList();
        renderNoteIndicators();
        showToast(t('toast.deleted'));
        if (n && n.id) {
            deleteUserNoteCloud(n.id);
        }
    };

    window.navigateToNoteRef = function (book, chapter) {
        switchView('reading');
        navigateTo(book, chapter);
    };

    window.clearAllNotes = async function() {
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const title = lang === 'en' ? 'Clear Notes' : lang === 'ko' ? '노트 지우기' : '清空笔记';
        const confirmMsg = lang === 'en' ? 'Clear all notes?' : lang === 'ko' ? '모든 노트를 지우시겠습니까?' : '确认清空所有笔记？';
        const confirmed = await window.showConfirmDialog(title, confirmMsg);
        if (confirmed) {
            S.notes = [];
            localStorage.removeItem('ob_notes');
            renderSettingsView();
            showToast(lang === 'en' ? 'Cleared' : lang === 'ko' ? '지워짐' : '已清空');
        }
    };

    window.clearAllBookmarks = async function() {
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const title = lang === 'en' ? 'Clear Bookmarks' : lang === 'ko' ? '북마크 지우기' : '清空资源';
        const confirmMsg = lang === 'en' ? 'Clear all bookmarks?' : lang === 'ko' ? '모든 북마크를 지우시겠습니까?' : '确认清空所有资源？';
        const confirmed = await window.showConfirmDialog(title, confirmMsg);
        if (confirmed) {
            S.bookmarks = [];
            localStorage.removeItem('ob_bookmarks');
            renderSettingsView();
            showToast(lang === 'en' ? 'Cleared' : lang === 'ko' ? '지워짐' : '已清空');
        }
    };

    // ── Share Card Generator ──
    window.shareNote = function(i) {
        const n = S.notes[i];
        if (!n) return;
        if (n.type === 'ai_qa') {
            generateShareCard('ai', { ref: n.ref, question: n.question, answer: n.answer, date: noteDateLabel(n.date) });
        } else {
            generateShareCard('note', { ref: n.ref, text: _stripLeadingRef(n.text, n.ref), date: noteDateLabel(n.date) });
        }
    };

    // 若正文开头重复了经文引用(如标题已显示「创世记 27:5,7」，正文又以同样一行开头)，去掉该行避免重复
    function _stripLeadingRef(text, ref) {
        if (!text || !ref) return text || '';
        const lines = text.split('\n');
        // 跳过开头空行，找到第一行非空内容
        let idx = 0;
        while (idx < lines.length && !lines[idx].trim()) idx++;
        if (idx < lines.length) {
            const first = lines[idx].trim();
            const r = ref.trim();
            // 完全相等，或首行就是「引用」本身(允许结尾标点差异)
            if (first === r || first.replace(/[：:。.\s]+$/, '') === r) {
                lines.splice(0, idx + 1);
                // 去掉紧随其后的空行
                while (lines.length && !lines[0].trim()) lines.shift();
                return lines.join('\n');
            }
        }
        return text;
    }

    window.shareAIAnswer = function(text, ref, question) {
        generateShareCard('ai', { ref: ref || '', text: text, question: question });
    };

    function generateShareCard(type, data) {
        const overlay = $('share-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');

        const canvas = $('share-canvas');
        const ctx = canvas.getContext('2d');
        const W = 500, padding = 28;
        const isDark = S.theme === 'dark';

        // 与渲染时的卡内文本宽度保持一致：cardX=padding-6, 卡内左右各留 26
        const maxTextW = (W - (padding - 6) * 2) - 52;
        let textBlockH = 0;
        let qLines = [];
        let aParas = [];
        let pLines = [];

        let question = data.question || "";
        let answer = data.answer || data.text || "";

        if (type === 'ai') {
            if (!question && answer.startsWith('问：') && answer.includes('\n\n答：')) {
                const idx = answer.indexOf('\n\n答：');
                question = answer.substring(2, idx).trim();
                answer = answer.substring(idx + 4).trim();
            }
            if (!question) {
                question = "关于此经文的解析";
            }

            const lang = typeof getLang === 'function' ? getLang() : 'zh';
            if (lang === 'zh' && answer) {
                answer = answer.split('\n').map(p => {
                    const trimmed = p.trim();
                    if (!trimmed) return p;
                    if (trimmed.startsWith('　') || trimmed.startsWith('\u3000') || trimmed.startsWith('  ')) return p;
                    return '\u3000\u3000' + trimmed;
                }).join('\n');
            }

            // 1. 问题换行与高度计算
            ctx.font = '600 13.5px "Noto Sans SC", sans-serif';
            const qWrapped = wrapText(ctx, question, maxTextW - 36);
            qLines = qWrapped[0] || [];
            const qBgH = qLines.length * 22 + 16;

            // 2. 回答换行与高度计算
            ctx.font = '14px "Noto Sans SC", sans-serif';
            aParas = wrapText(ctx, answer, W - (padding + 36) * 2);
            let aTotalLines = 0;
            aParas.forEach(p => aTotalLines += p.length);
            const aBlockH = aTotalLines * 24 + Math.max(0, aParas.length - 1) * 12;

            textBlockH = qBgH + 16 + aBlockH;
        } else {
            // 普通笔记
            ctx.font = '15.5px "Noto Sans SC", sans-serif';
            pLines = wrapText(ctx, data.text, maxTextW);
            let pTotalLines = 0;
            pLines.forEach(p => pTotalLines += p.length);
            textBlockH = pTotalLines * 26 + Math.max(0, pLines.length - 1) * 12;
        }

        const H = Math.max(320, 176 + textBlockH + 112);
        canvas.width = W * 2; canvas.height = H * 2;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.scale(2, 2);

        // ── 背景：暖金纸感渐变（阅读语境），角落缀品牌星 ──
        const grad = ctx.createLinearGradient(0, 0, W, H);
        if (isDark) {
            grad.addColorStop(0, '#211d17'); grad.addColorStop(0.55, '#26211a'); grad.addColorStop(1, '#2e2519');
        } else {
            grad.addColorStop(0, '#fdf6e3'); grad.addColorStop(0.55, '#faf0d8'); grad.addColorStop(1, '#f6e7c5');
        }
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
        // 右上角四芒星（logo 元素），低透明度作纹理
        const star = (cx, cy, r, alpha) => {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#E89A2C';
            ctx.beginPath();
            ctx.moveTo(cx, cy - r);
            ctx.quadraticCurveTo(cx + r * 0.12, cy - r * 0.12, cx + r, cy);
            ctx.quadraticCurveTo(cx + r * 0.12, cy + r * 0.12, cx, cy + r);
            ctx.quadraticCurveTo(cx - r * 0.12, cy + r * 0.12, cx - r, cy);
            ctx.quadraticCurveTo(cx - r * 0.12, cy - r * 0.12, cx, cy - r);
            ctx.fill();
            ctx.restore();
        };
        star(W - 44, 30, 16, isDark ? 0.5 : 0.75);
        star(W - 70, 44, 7, isDark ? 0.35 : 0.5);
        star(28, H - 26, 9, isDark ? 0.3 : 0.45);

        // ── 内卡片：更大圆角 + 柔和投影 ──
        const cardX = padding - 6, cardW = W - cardX * 2;
        const cardY = 44, cardH = H - 88;
        ctx.save();
        ctx.shadowColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(60,60,120,0.14)';
        ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
        ctx.fillStyle = isDark ? 'rgba(36,32,74,0.92)' : '#ffffff';
        roundRect(ctx, cardX, cardY, cardW, cardH, 22); ctx.fill();
        ctx.restore();

        const innerX = cardX + 26;          // 卡内左边距
        const innerR = cardX + cardW - 26;   // 卡内右边距
        const innerW = innerR - innerX;

        // ── 顶部品牌 chip（胶囊底 + 图标 + 文字）──
        const lang = typeof getLang === 'function' ? getLang() : 'zh';
        const brandLabel = type === 'note'
            ? (lang === 'en' ? 'Devotional Note' : lang === 'ko' ? '큐티 노트' : '灵修笔记')
            : (lang === 'en' ? 'AI Insight' : lang === 'ko' ? 'AI 해석' : 'AI 解析');
        const brandIcon = type === 'note' ? '📖' : '✨';
        ctx.font = '600 12.5px "Inter", "Noto Sans SC", sans-serif';
        const chipLabel = brandIcon + ' ' + brandLabel;
        const chipTextW = ctx.measureText(chipLabel).width;
        const chipH = 26, chipPadX = 12, chipY = cardY + 24;
        const chipGold = type === 'note';
        ctx.fillStyle = chipGold
            ? (isDark ? 'rgba(241,198,98,0.16)' : 'rgba(244,199,95,0.22)')
            : (isDark ? 'rgba(183,137,218,0.18)' : 'rgba(130,80,171,0.10)');
        roundRect(ctx, innerX, chipY, chipTextW + chipPadX * 2, chipH, 13); ctx.fill();
        ctx.fillStyle = chipGold
            ? (isDark ? '#f1c662' : '#714a08')
            : (isDark ? '#cdb4de' : '#8250ab');
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(chipLabel, innerX + chipPadX, chipY + chipH / 2 + 1);
        ctx.textBaseline = 'alphabetic';

        // ── 经文引用大标题 ──
        let headY = chipY + chipH + 34;
        if (data.ref) {
            ctx.font = '700 25px "Songti SC", "Noto Serif SC", serif';
            ctx.fillStyle = isDark ? '#f2f0eb' : '#202229';
            ctx.textAlign = 'left';
            ctx.fillText(data.ref, innerX, headY);
        }

        // ── 装饰性大引号（仅笔记类）──
        if (type === 'note') {
            ctx.font = '700 46px Georgia, "Noto Sans SC", serif';
            ctx.fillStyle = isDark ? 'rgba(165,180,252,0.22)' : 'rgba(88,101,242,0.16)';
            ctx.textAlign = 'left';
            ctx.fillText('“', innerX - 2, headY + 36);
        }

        // ── 渐变细分隔线 ──
        const divY = headY + 16;
        ctx.fillStyle = isDark ? '#f1c662' : '#f4c75f';
        roundRect(ctx, innerX, divY, 44, 3.5, 2); ctx.fill();

        // Content text
        ctx.textAlign = 'left';
        let ty = divY + 30;

        if (type === 'ai') {
            // ── 绘制问题区域 (带背景气泡) ──
            const qBgY = ty - 8;
            const qBgH = qLines.length * 22 + 16;
            const qBgX = innerX;
            const qBgW = innerW;

            // 问题气泡背景
            ctx.fillStyle = isDark ? 'rgba(183, 137, 218, 0.15)' : 'rgba(130, 80, 171, 0.06)';
            roundRect(ctx, qBgX, qBgY, qBgW, qBgH, 10);
            ctx.fill();

            // 问题气泡细边框
            ctx.strokeStyle = isDark ? 'rgba(183, 137, 218, 0.25)' : 'rgba(130, 80, 171, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 绘制“问”字徽章圆角背景
            ctx.fillStyle = isDark ? 'rgba(183, 137, 218, 0.2)' : 'rgba(102, 59, 139, 0.1)';
            roundRect(ctx, qBgX + 8, qBgY + 8, 20, 20, 6);
            ctx.fill();

            // 绘制“问”字
            ctx.fillStyle = isDark ? '#cdb4de' : '#663b8b';
            ctx.font = 'bold 11px "Noto Sans SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('问', qBgX + 18, qBgY + 22);
            ctx.textAlign = 'left';

            // 绘制问题文本
            ctx.fillStyle = isDark ? '#e5d8f0' : '#2f1d40';
            ctx.font = '600 13.5px "Noto Sans SC", sans-serif';
            let qy = qBgY + 22;
            qLines.forEach(line => {
                ctx.fillText(line, qBgX + 36, qy);
                qy += 22;
            });

            ty += qBgH + 16; // 气泡高度 + 间距

            // ── 绘制回答区域 ──
            // 绘制“答”字徽章圆角背景
            ctx.fillStyle = isDark ? 'rgba(224, 117, 159, 0.2)' : 'rgba(201, 56, 112, 0.1)';
            roundRect(ctx, innerX, ty - 14, 20, 20, 6);
            ctx.fill();

            // 绘制“答”字
            ctx.fillStyle = isDark ? '#e0759f' : '#c93870';
            ctx.font = 'bold 11px "Noto Sans SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('答', innerX + 10, ty);
            ctx.textAlign = 'left';

            // 绘制回答文本（两端对齐 + 段间距）
            ctx.fillStyle = isDark ? '#e5d8f0' : '#202229';
            ctx.font = '14px "Noto Sans SC", sans-serif';
            let ay = ty;
            const aTextX = innerX + 28;
            const aWidth = innerR - aTextX;
            aParas.forEach((para, pIdx) => {
                para.forEach((line, lIdx) => {
                    const isLastLine = lIdx === para.length - 1;
                    drawJustifiedText(ctx, line, aTextX, ay, aWidth, isLastLine);
                    ay += 24;
                });
                if (pIdx < aParas.length - 1) {
                    ay += 12; // 段间距
                }
            });
            ty = ay;
        } else {
            // 普通笔记（两端对齐 + 段间距，行高更舒适）
            ctx.font = '15.5px "Noto Sans SC", sans-serif';
            ctx.fillStyle = isDark ? '#e5d8f0' : '#202229';
            pLines.forEach((para, pIdx) => {
                para.forEach((line, lIdx) => {
                    const isLastLine = lIdx === para.length - 1;
                    drawJustifiedText(ctx, line, innerX, ty, innerW, isLastLine);
                    ty += 26;
                });
                if (pIdx < pLines.length - 1) {
                    ty += 12; // 段落间距
                }
            });
        }

        // ── 底部：真 logo（星+金书页）+ 双色字标 + 日期 ──
        const footY = cardY + cardH - 22;
        ctx.fillStyle = isDark ? 'rgba(241,198,98,0.18)' : 'rgba(160,120,40,0.14)';
        ctx.fillRect(innerX, footY - 17, innerW, 1);
        // 迷你 logo：以 16px 高绘制（源几何 viewBox 22 5 76 88）
        ctx.save();
        const lh = 16, lscale = lh / 88;
        ctx.translate(innerX, footY - 13);
        ctx.scale(lscale, lscale);
        ctx.translate(-22, -5);
        const ink = isDark ? '#f2f0eb' : '#202229';
        ctx.fillStyle = '#E89A2C';
        ctx.beginPath();
        [[60,9],[63.2,15.8],[72,19],[63.2,22.2],[60,31],[56.8,22.2],[48,19],[56.8,15.8]].forEach((pt,i)=> i?ctx.lineTo(pt[0],pt[1]):ctx.moveTo(pt[0],pt[1]));
        ctx.closePath(); ctx.fill();
        const book = (flip) => {
            ctx.beginPath();
            if (!flip) { ctx.moveTo(60,53); ctx.bezierCurveTo(50,45,34,45,26,52); ctx.lineTo(26,88); ctx.bezierCurveTo(34,79,50,79,60,88); }
            else { ctx.moveTo(60,53); ctx.bezierCurveTo(70,45,86,45,94,52); ctx.lineTo(94,88); ctx.bezierCurveTo(86,79,70,79,60,88); }
            ctx.closePath();
            ctx.fillStyle = '#F2C96D'; ctx.fill();
            ctx.strokeStyle = ink; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
        };
        book(false); book(true);
        ctx.beginPath(); ctx.moveTo(60,53); ctx.lineTo(60,88); ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.stroke();
        ctx.restore();
        // 双色字标：橙「慧读」+ 墨「圣经」
        ctx.font = '800 13px "Noto Sans SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#E89A2C';
        ctx.fillText('慧读', innerX + 22, footY);
        const bw = ctx.measureText('慧读').width;
        ctx.fillStyle = ink;
        ctx.fillText('圣经', innerX + 22 + bw + 1, footY);
        // 日期（右）
        if (data.date) {
            ctx.font = '12px "Inter", sans-serif';
            ctx.fillStyle = isDark ? 'rgba(242,240,235,0.5)' : 'rgba(120,110,90,0.75)';
            ctx.textAlign = 'right';
            ctx.fillText(data.date, innerR, footY);
        }
        ctx.textAlign = 'left';
    }

    /**
     * 高级两端对齐文本绘制算法
     */
    function drawJustifiedText(ctx, text, x, y, maxW, isLastLine) {
        if (isLastLine || text.length <= 1) {
            ctx.fillText(text, x, y);
            return;
        }

        const words = text.split('');
        const totalW = ctx.measureText(text).width;
        
        // 如果文字本身非常接近或超出了可用最大宽度，直接输出
        if (totalW >= maxW - 4) {
            ctx.fillText(text, x, y);
            return;
        }

        const remainW = maxW - totalW;
        const gaps = words.length - 1;
        const space = remainW / gaps;

        let curX = x;
        for (let i = 0; i < words.length; i++) {
            const char = words[i];
            ctx.fillText(char, curX, y);
            curX += ctx.measureText(char).width + space;
        }
    }

    /**
     * 将文本进行按段落、最大折行宽度的二维切分
     */
    function wrapText(ctx, text, maxW) {
        const paragraphs = text.split('\n');
        const result = [];
        let lineCount = 0;
        
        for (const para of paragraphs) {
            const words = para.split('');
            let line = '';
            const paraLines = [];
            for (const ch of words) {
                const test = line + ch;
                if (ctx.measureText(test).width > maxW && line) {
                    paraLines.push(line);
                    line = ch;
                    lineCount++;
                } else {
                    line = test;
                }
            }
            if (line) {
                paraLines.push(line);
                lineCount++;
            }
            if (lineCount > 30) { // 限制最大总行数，防范卡片无限拉长
                if (paraLines.length > 0) result.push(paraLines);
                break;
            }
            result.push(paraLines);
        }
        return result;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── VIP Quota System ──
    function getAIQuotaLimit() {
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        if (!user) return 20;
        const plan = user.plan || 'free';
        if (plan === 'basic') return 100;
        if (plan === 'pro') return 300;
        if (plan === 'supporter') return 400;
        return 20;
    }

    function getAIUsageToday() {
        const thisMonth = localDateKey().slice(0, 7);
        const key = `ob_ai_usage_${thisMonth}`;
        return parseInt(localStorage.getItem(key) || '0');
    }

    function incrementAIUsage() {
        const thisMonth = localDateKey().slice(0, 7);
        const key = `ob_ai_usage_${thisMonth}`;
        const count = parseInt(localStorage.getItem(key) || '0') + 1;
        localStorage.setItem(key, String(count));
        updateQuotaDisplay();
    }

    function updateQuotaDisplay() {
        const quotaEl = $('ai-quota-remaining');
        if (!quotaEl) return;
        const used = getAIUsageToday();
        const limit = getAIQuotaLimit();
        const remaining = Math.max(0, limit - used);
        quotaEl.textContent = remaining;
        quotaEl.classList.toggle('exhausted', remaining === 0);
    }

    function checkAIQuota() {
        const used = getAIUsageToday();
        const limit = getAIQuotaLimit();
        return used < limit;
    }

    function showVIPUpgradePrompt() {
        // 超出次数不再往聊天对话框里插入卡片，而是直接弹出支持方案模态框，并显示 Toast 通知
        showToast(t('msg.quota_used'), 5000);
        openSupportModal();
    }

    // ── Bookmarks ──
    function addBookmark() {
        if (S.selection.size === 0) { showToast(t('toast.no-sel')); return; }
        const data = window.bibleData[S.version]?.[S.book]?.[S.chapter];
        const firstRef = [...S.selection].sort((a, b) => +a.split('-')[2] - +b.split('-')[2])[0];
        const vn = firstRef.split('-')[2];
        const v = data?.find(v => String(v.verse) === vn);
        const bm = { ref: refLabel(S.selection), text: v?.text || '', book: S.book, chapter: S.chapter };
        if (!S.bookmarks.find(b => b.ref === bm.ref)) {
            S.bookmarks.unshift(bm);
            localStorage.setItem('ob_bookmarks', JSON.stringify(S.bookmarks));
            showToast(t('toast.bm-added'));
        } else showToast(t('toast.bm-exists'));
    }

    function renderBookmarksList() {
        const list = $('bookmarks-list');
        if (!list) return;
        if (!S.bookmarks.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-bookmark empty-state-icon"></i>
                    <div class="empty-state-text">您还没有收藏任何经文。<br>在左侧阅读经文时，长按或右键并选择“添加书签”即可将经文收藏至此。</div>
                </div>
            `;
            return;
        }
        list.innerHTML = S.bookmarks.map((bm, i) => `
        <div class="bookmark-card" onclick="navigateTo('${bm.book}','${bm.chapter}'); window.closeCollectionsModal();">
            <div class="bookmark-ref"><i class="fa-solid fa-bookmark"></i> ${bm.ref}</div>
            <div class="bookmark-text">${bm.text}</div>
            <button class="delete-bm-btn" onclick="event.stopPropagation(); window.deleteBookmark(${i});" title="取消收藏"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    }

    window.deleteBookmark = function (i) {
        S.bookmarks.splice(i, 1);
        localStorage.setItem('ob_bookmarks', JSON.stringify(S.bookmarks));
        renderBookmarksList();
    };

    function renderOrdersList() {
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        let orders = JSON.parse(localStorage.getItem('ob_orders') || '[]');
        
        if (user && user.plan && user.plan !== 'free' && orders.length === 0) {
            const planNames = {
                'basic': '基础计划 (连续每月)',
                'pro': '进阶计划 (连续每月)',
                'supporter': '支持者计划 (连续每月)'
            };
            const planPrices = {
                'basic': '$4.99',
                'pro': '$9.99',
                'supporter': '$14.99'
            };
            
            const subId = user.stripe_subscription_id || '';
            const channel = subId.startsWith('mock_') ? 'Mock 支付' : 'Stripe 支付';
            
            let orderTime = '2026-05-28 10:41:00';
            if (user.plan_expires_at) {
                try {
                    const expires = new Date(user.plan_expires_at);
                    const orderDate = new Date(expires.getTime() - 30 * 24 * 60 * 60 * 1000);
                    orderTime = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(orderDate.getDate()).padStart(2, '0')} ${String(orderDate.getHours()).padStart(2, '0')}:${String(orderDate.getMinutes()).padStart(2, '0')}:${String(orderDate.getSeconds()).padStart(2, '0')}`;
                } catch(e) {}
            }
            
            orders = [{
                id: `OB${Math.floor(Math.random() * 90000000 + 10000000)}`,
                planName: planNames[user.plan] || '高级支持套餐',
                price: planPrices[user.plan] || '$0.00',
                date: orderTime,
                status: 'paid',
                channel: channel
            }];
            localStorage.setItem('ob_orders', JSON.stringify(orders));
        }

        const list = $('orders-list');
        if (!list) return;

        if (orders.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-receipt empty-state-icon"></i>
                    <div class="empty-state-text">您目前还是免费计划，暂无订单历史。支持我们可解锁更高 AI 额度！</div>
                    <button class="btn-go-support" id="orders-go-support">去支持我们</button>
                </div>
            `;
            $('orders-go-support')?.addEventListener('click', () => {
                window.closeOrdersModal();
                openSupportModal();
            });
            return;
        }

        list.innerHTML = orders.map(o => `
            <div class="order-item-card">
                <div class="order-info-left">
                    <div class="order-plan-name">${o.planName}</div>
                    <div class="order-meta-sub">
                        <span>单号: <span class="order-id-tag">${o.id}</span></span>
                        <span>时间: ${o.date}</span>
                    </div>
                </div>
                <div class="order-right-section">
                    <div class="order-price-val">${o.price}</div>
                    <span class="order-status-badge paid">${o.channel} · 已支付</span>
                </div>
            </div>
        `).join('');
    }

    function addOrderRecord(plan, stripeSubId) {
        if (!plan || plan === 'free') return;
        
        const planNames = {
            'basic': '基础计划 (连续每月)',
            'pro': '进阶计划 (连续每月)',
            'supporter': '支持者计划 (连续每月)'
        };
        const planPrices = {
            'basic': '$4.99',
            'pro': '$9.99',
            'supporter': '$14.99'
        };

        const channel = (stripeSubId && stripeSubId.startsWith('mock_')) ? 'Mock 支付' : 'Stripe 支付';
        const now = new Date();
        const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const newOrder = {
            id: `OB${Date.now().toString().slice(-8)}`,
            planName: planNames[plan] || '高级支持套餐',
            price: planPrices[plan] || '$0.00',
            date: formattedDate,
            status: 'paid',
            channel: channel
        };

        const orders = JSON.parse(localStorage.getItem('ob_orders') || '[]');
        orders.unshift(newOrder);
        localStorage.setItem('ob_orders', JSON.stringify(orders));
    }

    window.openCollectionsModal = function() {
        $('collections-modal')?.classList.remove('hidden');
        renderBookmarksList();
    };

    window.closeCollectionsModal = function() {
        $('collections-modal')?.classList.add('hidden');
    };

    window.openOrdersModal = function() {
        $('orders-modal')?.classList.remove('hidden');
        renderOrdersList();
    };

    window.closeOrdersModal = function() {
        $('orders-modal')?.classList.add('hidden');
    };


    // ── AI Chat ──
    window.explainThemeTag = async function(bookName, chNum, tag) {
        if (!checkAIQuota()) {
            showVIPUpgradePrompt();
            return;
        }

        const overlay = $('tag-explain-overlay');
        const kEl = $('tag-explain-keyword');
        const rEl = $('tag-explain-ref');
        const loading = $('tag-explain-loading');
        const errorEl = $('tag-explain-error');
        const contentEl = $('tag-explain-content');

        if (!overlay || !kEl || !rEl) return;

        // Bind close events
        $('tag-explain-close').onclick = () => overlay.classList.add('hidden');
        $('tag-explain-backdrop').onclick = () => overlay.classList.add('hidden');

        kEl.textContent = tag;
        
        const targetLang = getContentLang();
        
        // 1. Localize Modal Subtitle and Loading Text
        const strSubtitle = targetLang === 'en' ? 'Keyword In-depth Analysis' :
                            targetLang === 'ko' ? '핵심 단어 심층 분석' : '关键词深度解读';
        const strThinking = targetLang === 'en' ? 'AI is analyzing deeply...' :
                            targetLang === 'ko' ? 'AI가 심층 분석 중입니다...' : 'AI 正在深度思考...';
        const strDims = targetLang === 'en' ? 'Explaining keyword from three dimensions' :
                        targetLang === 'ko' ? '세 가지 관점에서 핵심 단어 분석' : '从三个维度解读关键词';
        
        const subtitleEl = overlay.querySelector('.tag-explain-subtitle');
        if (subtitleEl) subtitleEl.textContent = strSubtitle;
        const pTexts = loading.querySelectorAll('p');
        if (pTexts.length >= 2) {
            pTexts[0].textContent = strThinking;
            pTexts[1].textContent = strDims;
        }

        // 2. Localize Chapter Reference
        const refLabel = targetLang === 'en' ? `${bookName} ${chNum}` : 
                         targetLang === 'ko' ? `${bookName} 제${chNum}장` :
                         `${bookName} 第${chNum}章`;
        rEl.textContent = refLabel;
        
        loading.classList.remove('hidden');
        errorEl.classList.add('hidden');
        contentEl.classList.add('hidden');
        contentEl.innerHTML = '';
        overlay.classList.remove('hidden');

        try {
            // Determine target model based on version
            let targetModel = 'qwen-plus';
            if (S.version === 'kjv') {
                targetModel = 'claude-haiku-4-5-20251001';
            } else if (S.version === 'keb' || S.version === 'krv') {
                targetModel = 'glm-4.7';
            }

            // 会话在同源 Cookie 里，后端据此按用户套餐计月配额（匿名则按 IP 限流）
            const statReq = await fetch(`${S.apiBase}/ai/eval/tag-explain`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    book_code: S.book,
                    book_name: bookName,
                    chapter: parseInt(chNum) || 1,
                    tag: tag,
                    model: targetModel,
                    version: S.version
                })
            });

            if (!statReq.ok) {
                let msg = `HTTP ${statReq.status}`;
                try { const e = await statReq.json(); msg = e.detail || msg; } catch(e){}
                throw new Error(msg);
            }

            const data = await statReq.json();
            const answer = data.answer || '';
            
            // 将回答按 1. / 2. / 3. 分段
            const sectionsText = answer.split(/(?=\n?[123]\.\s)/).map(s => s.trim()).filter(Boolean);
            const sectionMetaZh = [
                { title: '为何选为关键词', cls: 's1' },
                { title: '本章中的涵义', cls: 's2' },
                { title: '跨书卷关联', cls: 's3' }
            ];
            const sectionMetaEn = [
                { title: 'Why Selected', cls: 's1' },
                { title: 'Meaning in Context', cls: 's2' },
                { title: 'Cross-Book References', cls: 's3' }
            ];
            const sectionMetaKo = [
                { title: '선정 이유', cls: 's1' },
                { title: '본문 속 의미', cls: 's2' },
                { title: '성경 전체와의 연관성', cls: 's3' }
            ];
            const sectionMeta = targetLang === 'en' ? sectionMetaEn : 
                                targetLang === 'ko' ? sectionMetaKo : sectionMetaZh;

            if (sectionsText.length >= 3) {
                let html = '';
                sectionsText.forEach((secStr, i) => {
                    const meta = sectionMeta[i] || sectionMeta[0];
                    const bodyText = secStr.replace(/^[123]\.\s*/, '').trim();
                    html += `
                    <div class="tag-explain-section tag-explain-${meta.cls}">
                        <div class="tag-explain-section-header">
                            <span class="tag-explain-section-header-num">${i + 1}</span>
                            <span class="tag-explain-section-header-title">${meta.title}</span>
                        </div>
                        <div class="tag-explain-section-body">
                            ${bodyText.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}
                        </div>
                    </div>`;
                });
                contentEl.innerHTML = html;
            } else {
                contentEl.innerHTML = `<div style="font-size:0.9rem;line-height:1.6;color:var(--text-secondary);">${answer.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}</div>`;
            }

            loading.classList.add('hidden');
            contentEl.classList.remove('hidden');

            if (typeof updateAIQuotaUI === 'function') {
                const qEl = $('ai-quota-remaining');
                if (qEl) {
                    let remain = parseInt(qEl.textContent) || 0;
                    if (remain > 0) {
                        remain--;
                        qEl.textContent = remain;
                    }
                }
            }
        } catch(err) {
            loading.classList.add('hidden');
            errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${t('err.parse_fail')}：${err.message}`;
            errorEl.classList.remove('hidden');
        }
    };

    // NOTE: 清空之前与 AI 的对话历史，避免在切换译本或切换章节后聊天上下文产生歧义或错乱
    function clearAIChat() {
        const msgs = $('ai-messages');
        if (msgs) {
            msgs.innerHTML = '';
        }
        const input = $('ai-search-input');
        if (input) {
            input.value = '';
        }
    }

    // ── 慧读会话跨端同步：网页端问答推送到云端，App 慧读列表下次同步即可见 ──
    // 一次页面会话累积为一条对话，标题取首个问题。
    let _webConvId = null;
    const _webConvMessages = [];
    function pushWebConversation(question, answer) {
        if (typeof Auth === 'undefined' || !Auth.getUser()) return;
        _webConvMessages.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
        if (!_webConvId) _webConvId = 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const title = (_webConvMessages[0].content || '网页问答').slice(0, 30);
        fetch('/api/mobile/huidu/conversations', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversations: [{
                    id: _webConvId,
                    kind: 'general',
                    title: title,
                    createdAt: new Date().toISOString(),
                    messages: _webConvMessages
                }],
                deletions: []
            })
        }).catch(() => { /* 离线时静默，笔记同步仍在 */ });
    }

    // ── 慧读输入框：发送键空输入禁用 + 语音输入（移植自 App 端）──
    // 当前附件：{ name, size, text }。发送时把正文作为上下文并入提问。
    let _aiAttachment = null;

    function setupAIComposer() {
        const input = $('ai-search-input');
        const sendBtn = $('ai-search-btn');
        const voiceBtn = $('ai-voice-btn');
        const status = $('ai-voice-status');
        if (!input || !sendBtn) return;

        // 与 App 一致：没输入内容时发送键置灰不可点
        const syncSend = () => { sendBtn.disabled = !input.value.trim(); };
        input.addEventListener('input', syncSend);
        syncSend();
        window._syncAISendBtn = syncSend;

        // 附件：只收文本类文件，正文并入提问作为上下文
        const attachBtn = $('ai-attach-btn');
        const attachInput = $('ai-attach-input');
        const attachChip = $('ai-attach-chip');
        const MAX_ATTACH_BYTES = 200 * 1024;
        const MAX_ATTACH_CHARS = 8000;

        const renderAttachChip = () => {
            if (!attachChip) return;
            if (!_aiAttachment) {
                attachChip.classList.add('hidden');
                attachChip.innerHTML = '';
                return;
            }
            const kb = Math.max(1, Math.round(_aiAttachment.size / 1024));
            attachChip.classList.remove('hidden');
            attachChip.innerHTML = `<i class="fa-solid fa-paperclip"></i>
                <span>${escapeNoteHTML(_aiAttachment.name)}</span>
                <small>${kb} KB</small>
                <button type="button" class="ai-attach-remove" aria-label="${t('ai.attachRemove') || '移除附件'}"><i class="fa-solid fa-xmark"></i></button>`;
            attachChip.querySelector('.ai-attach-remove')?.addEventListener('click', () => {
                _aiAttachment = null;
                if (attachInput) attachInput.value = '';
                renderAttachChip();
            });
        };

        attachBtn?.addEventListener('click', () => attachInput?.click());
        attachInput?.addEventListener('change', () => {
            const file = attachInput.files && attachInput.files[0];
            if (!file) return;
            if (file.size > MAX_ATTACH_BYTES) {
                showToast(t('ai.attachTooLarge') || '附件不能超过 200KB');
                attachInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                _aiAttachment = {
                    name: file.name,
                    size: file.size,
                    text: String(reader.result || '').slice(0, MAX_ATTACH_CHARS),
                };
                renderAttachChip();
                input.focus();
            };
            reader.onerror = () => {
                showToast(t('ai.attachFail') || '附件读取失败');
                attachInput.value = '';
            };
            reader.readAsText(file);
        });
        window._clearAIAttachment = () => {
            _aiAttachment = null;
            if (attachInput) attachInput.value = '';
            renderAttachChip();
        };

        // 语音输入：浏览器不支持时按钮保持隐藏（App 是 isSupported 判断）
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR || !voiceBtn) return;
        voiceBtn.classList.remove('hidden');

        let recognition = null;
        let listening = false;

        const setStatus = (msg, isError) => {
            if (!status) return;
            status.textContent = msg || '';
            status.classList.toggle('hidden', !msg);
            status.classList.toggle('is-error', Boolean(isError));
        };

        const stop = () => {
            listening = false;
            voiceBtn.classList.remove('is-listening');
            voiceBtn.setAttribute('aria-pressed', 'false');
            voiceBtn.setAttribute('aria-label', t('ai.voiceStart') || '开始语音输入');
            voiceBtn.title = voiceBtn.getAttribute('aria-label');
            setStatus('');
        };

        voiceBtn.addEventListener('click', () => {
            if (listening) { recognition?.stop(); return; }
            try {
                recognition = new SR();
                recognition.lang = getLang() === 'en' ? 'en-US' : getLang() === 'ko' ? 'ko-KR' : 'zh-CN';
                recognition.interimResults = true;
                recognition.continuous = false;
                recognition.onresult = (event) => {
                    let text = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        text += event.results[i][0].transcript;
                    }
                    input.value = text;
                    syncSend();
                };
                recognition.onerror = (event) => {
                    stop();
                    if (event.error !== 'aborted' && event.error !== 'no-speech') {
                        setStatus(t('ai.voiceError') || '语音输入失败，请重试', true);
                    }
                };
                recognition.onend = stop;
                recognition.start();
                listening = true;
                voiceBtn.classList.add('is-listening');
                voiceBtn.setAttribute('aria-pressed', 'true');
                voiceBtn.setAttribute('aria-label', t('ai.voiceStop') || '停止语音输入');
                voiceBtn.title = voiceBtn.getAttribute('aria-label');
                setStatus(t('ai.voiceListening') || '正在聆听…说完后再点一次麦克风');
            } catch (e) {
                stop();
                setStatus(t('ai.voiceError') || '语音输入失败，请重试', true);
            }
        });
    }

    function sendAIQuestion() {
        if (typeof Auth !== 'undefined' && !Auth.getUser()) {
            Auth.showModal('login');
            return;
        }
        const input = $('ai-search-input');
        const q = input.value.trim();
        if (!q) return;

        // VIP quota check
        if (!checkAIQuota()) {
            showVIPUpgradePrompt();
            return;
        }

        input.value = '';
        // 先取走附件再清空输入区，否则请求体构建时附件已被置空
        const attachment = _aiAttachment;
        if (typeof window._syncAISendBtn === 'function') window._syncAISendBtn();
        if (typeof window._clearAIAttachment === 'function') window._clearAIAttachment();
        const msgs = $('ai-messages');
        if (!msgs) return;

        // 用户气泡 — 使用个人头像
        const _userAvatarHtml = getUserAvatarHtml();
        msgs.innerHTML += `<div class="ai-bubble user-bubble"><div class="ai-bubble-icon">${_userAvatarHtml}</div><div class="ai-bubble-text">${q}</div></div>`;

        // loading 气泡 — 使用 logo 头像
        const loadId = 'ai-load-' + Date.now();
        msgs.innerHTML += `<div class="ai-bubble" id="${loadId}"><div class="ai-bubble-icon ai-logo-icon"><img src="images/logo-mark.svg" alt="AI"></div><div class="ai-bubble-text"><div class="ai-loading"><span></span><span></span><span></span></div></div></div>`;
        
        const scrollContainer = $('ai-panel-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }

        // 当前阅读经文作为上下文
        const ref = S.selection.size > 0 ? refLabel(S.selection) : (S.book && S.chapter ? `${bookDisplayName(S.book)} ${S.chapter}章` : '');

        // NOTE: 从 localStorage 读取用户灵命阶段，将 level 传给后端路由 Claude / Grok
        const obProfile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
        const stageLevel = parseInt(obProfile.level || '2');

        // NOTE: 调用后端 /api/ai/question，后端会先查缓存，未命中再调 n1n.ai
        // 会话在同源 Cookie 里，后端据此按用户套餐计月配额（匿名则按 IP 限流）
        fetch(`${S.apiBase}/ai/question`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // 附件正文作为上下文前置，模型据此回答；引用信息仍走 context
                question: attachment
                    ? `【附件：${attachment.name}】\n${attachment.text}\n\n${q}`
                    : q,
                context: ref,
                stage_level: stageLevel,
                version: S.version
            })
        })
        .then(r => r.json())
        .then(data => {
            const loadEl = document.getElementById(loadId);
            if (!loadEl) return;
            if (data.answer) {
                const answerHtml = data.answer.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
                const safeAnswer = data.answer.replace(/['"]/g, '').replace(/\n/g, ' ').substring(0, 300);
                const safeQuestion = q.replace(/['"]/g, '').replace(/\n/g, ' ').substring(0, 100);
                const safeRef = ref.replace(/['"]/g, '');
                const shareBtn = `<button class="ai-share-btn" onclick="shareAIAnswer('${safeAnswer}','${safeRef}','${safeQuestion}')"><i class="fa-solid fa-share-from-square"></i> 分享</button>`;
                loadEl.querySelector('.ai-bubble-text').innerHTML = `<p>${answerHtml}</p><div style="display:flex;align-items:center;justify-content:flex-end;margin-top:6px;">${shareBtn}</div>`;
                incrementAIUsage();

                // NOTE: 自动将 AI 问答存入笔记，无论是否有选中经文都进行保存。
                // 若无选中经文，则以当前阅读的“书卷名 章节”作为 ref 关联。
                const noteRef = S.selection.size > 0 
                    ? refLabel(S.selection)
                    : (S.book && S.chapter ? `${bookDisplayName(S.book)} ${S.chapter}章` : '通用问答');

                const aiNote = {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                    type: 'ai_qa',                          // 区分手写笔记与 AI 问答笔记
                    ref: noteRef,
                    refs: S.selection.size > 0 ? [...S.selection] : [],
                    question: q,
                    answer: data.answer,
                    source: data.source || 'ai',
                    date: new Date().toLocaleDateString('zh-CN')
                };
                S.notes.unshift(aiNote);
                localStorage.setItem('ob_notes', JSON.stringify(S.notes));
                renderNoteIndicators();
                renderNotesList(); // 确保笔记列表及时刷新渲染
                syncUserNotesCloud();
                pushWebConversation(q, data.answer);
            } else {
                loadEl.querySelector('.ai-bubble-text').innerHTML = `<p style="color:var(--text-tertiary);">${data.detail || t('err.generic')}</p>`;
            }
            
            const scrollContainer = $('ai-panel-scroll');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        })
        .catch(err => {
            const loadEl = document.getElementById(loadId);
            if (loadEl) loadEl.querySelector('.ai-bubble-text').innerHTML = `<p style="color:var(--text-tertiary);">${t('err.request_fail')}：${err.message}</p>`;
            
            const scrollContainer = $('ai-panel-scroll');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        });
    }

    // ── Smart Search System ──
    const SEARCH_HISTORY_KEY = 'ob_search_history';
    const MAX_HISTORY = 10;
    let _searchActiveIdx = -1; // keyboard navigation index
    let _searchNavigables = []; // all navigable items currently visible
    let _searchScope = 'all';  // 搜索范围：all / ot(旧约) / nt(新约)
    let _searchSeq = 0;        // 搜索请求序号：快切 旧约/新约 时丢弃过期响应，避免旧结果覆盖新结果
    let _searchShown = 0;      // 当前已展示的搜索结果数（用于「加载更多」分页 offset）
    let _searchTotal = 0;      // 后端返回的命中总数
    let _lastSearchQuery = ''; // 最近一次搜索词（加载更多时复用）
    const SEARCH_PAGE = 40;    // 每页结果数

    // Semantic keyword map — common Bible themes
    const SEMANTIC_HINTS = {
        '爱': '关于"爱"的经文…',
        '平安': '关于"平安"的经文…',
        '信心': '关于"信心"的经文…',
        '盼望': '关于"盼望"与"希望"的经文…',
        '恩典': '关于"恩典"的经文…',
        '救恩': '关于"救恩"与"拯救"的经文…',
        '智慧': '关于"智慧"的经文…',
        '祷告': '关于"祷告"与"祈求"的经文…',
        '喜乐': '关于"喜乐"与"快乐"的经文…',
        '公义': '关于"公义"与"正义"的经文…',
        '饶恕': '关于"饶恕"与"赦免"的经文…',
        '十字架': '关于"十字架"与"受难"的经文…',
        '复活': '关于"复活"的经文…',
        '圣灵': '关于"圣灵"的经文…',
        '永生': '关于"永生"与"永恒"的经文…',
        '苦难': '关于"苦难"与"试炼"的经文…',
        '光': '关于"光"与"光明"的经文…',
    };

    function getSearchHistory() {
        try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); }
        catch { return []; }
    }
    function saveSearchHistory(arr) {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(arr.slice(0, MAX_HISTORY)));
    }
    function addSearchHistory(q) {
        if (!q || !q.trim()) return;
        let h = getSearchHistory().filter(x => x !== q.trim());
        h.unshift(q.trim());
        saveSearchHistory(h);
    }
    function removeSearchHistoryItem(q) {
        saveSearchHistory(getSearchHistory().filter(x => x !== q));
    }

    function openSearch() {
        const overlay = $('search-overlay');
        overlay.classList.remove('hidden');
        const input = $('search-input');
        input.value = '';
        $('search-results').innerHTML = '';
        _searchActiveIdx = -1;
        // 重置搜索范围为「全部」并同步按钮高亮
        _searchScope = 'all';
        document.querySelectorAll('#search-scope-bar .search-scope-chip')
            .forEach(c => c.classList.toggle('active', c.dataset.scope === 'all'));
        updateSearchClearBtn();
        renderSearchSuggestions('');
        setTimeout(() => input.focus(), 60);
    }

    function closeSearch() {
        $('search-overlay').classList.add('hidden');
    }

    function updateSearchClearBtn() {
        const val = $('search-input')?.value || '';
        const clearBtn = $('search-clear-btn');
        const hintEl = $('search-shortcut-hint');
        if (clearBtn) clearBtn.classList.toggle('hidden', !val);
        if (hintEl) hintEl.style.display = val ? 'none' : '';
    }

    // ── Render smart suggestions based on current input ──
    function renderSearchSuggestions(query) {
        const sugBox = $('search-suggestions');
        const resBox = $('search-results');
        if (!sugBox) return;

        // If query length >= 2, use API search instead of suggestions
        if (query.trim().length >= 2) {
            sugBox.innerHTML = '';
            return;
        }

        // Hide results when showing suggestions
        if (resBox) resBox.innerHTML = '';

        let html = '';
        const q = query.trim().toLowerCase();

        // 1. Book name matching
        if (q) {
            const matchedBooks = ALL_BOOKS.filter(([code, name]) =>
                name.includes(q) || code.includes(q)
            ).slice(0, 8);

            if (matchedBooks.length > 0) {
                html += `<div class="search-suggest-group">
                    <div class="search-suggest-label"><i class="fa-solid fa-book-bible"></i> 书卷</div>
                    <div class="search-book-pills">
                        ${matchedBooks.map(([code, name]) =>
                            `<div class="search-book-pill" data-action="book" data-book="${code}" data-name="${name}">
                                ${name} <span class="pill-abbr">${BOOK_CHAPTERS[code]}章</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>`;
            }

            // 2. Semantic hints
            const semanticMatches = Object.entries(SEMANTIC_HINTS)
                .filter(([key]) => key.includes(q) || q.includes(key))
                .slice(0, 3);
            if (semanticMatches.length > 0) {
                html += `<div class="search-suggest-group">
                    <div class="search-suggest-label"><i class="fa-solid fa-sparkles"></i> 语义搜索</div>
                    ${semanticMatches.map(([key, hint]) =>
                        `<div class="search-semantic-item" data-action="semantic" data-query="${key}">
                            <i class="fa-solid fa-lightbulb"></i>
                            <span>${hint}</span>
                        </div>`
                    ).join('')}
                </div>`;
            }
        }

        // 3. Search history (always show if empty query or partial match)
        const history = getSearchHistory();
        const filteredHistory = q
            ? history.filter(h => h.includes(q)).slice(0, 5)
            : history.slice(0, 6);

        if (filteredHistory.length > 0) {
            html += `<div class="search-suggest-group">
                <div class="search-suggest-label">
                    <i class="fa-solid fa-clock-rotate-left"></i> 搜索历史
                    <button class="search-history-clear-btn" data-action="clear-history">清除全部</button>
                </div>
                ${filteredHistory.map(h =>
                    `<div class="search-history-item" data-action="history" data-query="${h.replace(/"/g, '&quot;')}">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                        <span class="history-text">${h}</span>
                        <button class="history-remove" data-action="remove-history" data-query="${h.replace(/"/g, '&quot;')}" title="删除">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>`
                ).join('')}
            </div>`;
        }

        // Empty state when no query and no history
        if (!html && !q) {
            html = `<div class="search-empty">
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>输入关键词搜索经文内容或书卷名</span>
            </div>`;
        }

        sugBox.innerHTML = html;

        // Bind suggestion clicks via delegation
        sugBox.onclick = e => {
            const removeBtn = e.target.closest('[data-action="remove-history"]');
            if (removeBtn) {
                e.stopPropagation();
                removeSearchHistoryItem(removeBtn.dataset.query);
                renderSearchSuggestions($('search-input').value);
                return;
            }
            const clearBtn = e.target.closest('[data-action="clear-history"]');
            if (clearBtn) {
                e.stopPropagation();
                saveSearchHistory([]);
                renderSearchSuggestions($('search-input').value);
                return;
            }
            const bookPill = e.target.closest('[data-action="book"]');
            if (bookPill) {
                navigateTo(bookPill.dataset.book, 1);
                closeSearch();
                return;
            }
            const historyItem = e.target.closest('[data-action="history"]');
            if (historyItem) {
                const q = historyItem.dataset.query;
                $('search-input').value = q;
                updateSearchClearBtn();
                triggerSearch(q);
                return;
            }
            const semanticItem = e.target.closest('[data-action="semantic"]');
            if (semanticItem) {
                const q = semanticItem.dataset.query;
                $('search-input').value = q;
                updateSearchClearBtn();
                triggerSearch(q);
                return;
            }
        };

        // Update navigable items for keyboard nav
        updateSearchNavigables();
    }

    function triggerSearch(query) {
        $('search-suggestions').innerHTML = '';
        doSearch(query);
    }

    async function doSearch(query, append = false) {
        const results = $('search-results');
        const sugBox = $('search-suggestions');
        if (!results) return;
        if (!append && !query.trim()) { results.innerHTML = ''; renderSearchSuggestions(''); return; }

        if (!append) {
            // 新搜索：重置分页状态并显示加载态
            if (sugBox) sugBox.innerHTML = '';
            _lastSearchQuery = query;
            _searchShown = 0; _searchTotal = 0;
            results.innerHTML = `<div class="search-empty" style="padding:24px 16px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size:1.2rem;opacity:0.5;"></i>
                <span>${t('search.searching')}</span>
            </div>`;
        }

        const offset = append ? _searchShown : 0;
        const mySeq = ++_searchSeq;   // 标记本次请求
        let found = [], total = 0;
        try {
            const scopeParam = (_searchScope && _searchScope !== 'all') ? `&testament=${_searchScope}` : '';
            const url = `${S.apiBase}/verses/search?q=${encodeURIComponent(query)}&version=${S.version}&offset=${offset}&limit=${SEARCH_PAGE}${scopeParam}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                found = json.results || [];
                total = (typeof json.total === 'number') ? json.total : (offset + found.length);
            }
        } catch (e) {
            console.error("Search failed:", e);
        }

        // 防竞态：等待期间若又发起了新搜索/翻页，丢弃本次过期结果
        if (mySeq !== _searchSeq) return;

        if (!append) addSearchHistory(query);

        if (!append && !found.length) {
            results.innerHTML = `<div class="search-empty">
                <i class="fa-solid fa-face-meh"></i>
                <span>${t('search.none')}</span>
            </div>`;
            return;
        }

        _searchTotal = total;
        const escQ = (_lastSearchQuery || query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const hl = txt => txt.replace(new RegExp(escQ, 'gi'), m => `<mark class="search-highlight">${m}</mark>`);
        const itemsHtml = found.map((r) => {
            const bname = bookDisplayName(r.book);
            return `<div class="search-result-item" data-action="result" data-book="${r.book}" data-ch="${r.ch}">
                <div class="search-result-ref">${bname} ${r.ch}:${r.verse}</div>
                <div class="search-result-text">${hl(r.text)}</div>
            </div>`;
        }).join('');

        if (append) {
            $('search-result-list')?.insertAdjacentHTML('beforeend', itemsHtml);
            _searchShown += found.length;
        } else {
            _searchShown = found.length;
            results.innerHTML = `
                <div class="search-result-count"><i class="fa-solid fa-check-circle"></i> ${total} ${t('search.results_unit')}</div>
                <div id="search-result-list">${itemsHtml}</div>
                <div id="search-load-more-wrap"></div>`;
            // Bind result clicks (事件委托，追加的结果同样生效)
            results.onclick = e => {
                const item = e.target.closest('[data-action="result"]');
                if (item) { navigateTo(item.dataset.book, item.dataset.ch); closeSearch(); }
            };
        }

        // 加载更多按钮：还有更多结果时显示，避免高频字结果被静默截断
        const wrap = $('search-load-more-wrap');
        if (wrap) {
            wrap.innerHTML = (_searchShown < _searchTotal)
                ? `<button type="button" class="search-load-more" id="search-load-more">${t('search.load_more')} (${_searchShown}/${_searchTotal})</button>`
                : '';
            $('search-load-more')?.addEventListener('click', () => doSearch(_lastSearchQuery, true));
        }

        // Update navigables
        _searchActiveIdx = -1;
        updateSearchNavigables();
    }

    // ── Keyboard Navigation ──
    function updateSearchNavigables() {
        _searchNavigables = [
            ...document.querySelectorAll('.search-book-pill'),
            ...document.querySelectorAll('.search-history-item'),
            ...document.querySelectorAll('.search-semantic-item'),
            ...document.querySelectorAll('.search-result-item'),
        ];
        _searchActiveIdx = -1;
        _searchNavigables.forEach(el => el.classList.remove('active'));
    }

    function navigateSearchItems(direction) {
        if (_searchNavigables.length === 0) return;
        // Remove current
        if (_searchActiveIdx >= 0 && _searchActiveIdx < _searchNavigables.length) {
            _searchNavigables[_searchActiveIdx].classList.remove('active');
        }
        _searchActiveIdx += direction;
        if (_searchActiveIdx < 0) _searchActiveIdx = _searchNavigables.length - 1;
        if (_searchActiveIdx >= _searchNavigables.length) _searchActiveIdx = 0;

        const el = _searchNavigables[_searchActiveIdx];
        el.classList.add('active');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function activateSearchItem() {
        if (_searchActiveIdx < 0 || _searchActiveIdx >= _searchNavigables.length) {
            // No item selected: just search with current input value
            const q = $('search-input').value.trim();
            if (q) triggerSearch(q);
            return;
        }
        const el = _searchNavigables[_searchActiveIdx];
        el.click();
    }

    // ── Chapter Picker ──
    function openBookPicker() {
        const overlay = $('chapter-overlay');
        overlay.classList.remove('hidden');
        $('picker-title').textContent = t('picker.title') || '选择书卷';
        $('picker-books').classList.remove('hidden');
        $('picker-chapters').classList.add('hidden');
        const otGrid = $('picker-ot'), ntGrid = $('picker-nt');
        if (!otGrid) return;
        otGrid.innerHTML = OT_BOOKS.map(([k]) => `<button class="picker-book-btn${k === S.book ? ' selected' : ''}" data-book="${k}">${bookDisplayName(k)}</button>`).join('');
        ntGrid.innerHTML = NT_BOOKS.map(([k]) => `<button class="picker-book-btn${k === S.book ? ' selected' : ''}" data-book="${k}">${bookDisplayName(k)}</button>`).join('');
        overlay.querySelectorAll('.picker-book-btn').forEach(btn => {
            btn.addEventListener('click', () => showChapterGrid(btn.dataset.book));
        });
    }

    function openChapterPicker() {
        const overlay = $('chapter-overlay');
        overlay.classList.remove('hidden');
        showChapterGrid(S.book);
    }

    let _pickerBook = null;
    function showChapterGrid(book) {
        _pickerBook = book;
        $('picker-title').textContent = bookDisplayName(book);
        $('picker-books').classList.add('hidden');
        $('picker-chapters').classList.remove('hidden');
        const grid = $('chapter-grid');
        const max = BOOK_CHAPTERS[book] || 1;
        grid.innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(i =>
            `<button class="picker-ch-btn${book === S.book && String(i) === S.chapter ? ' selected' : ''}" data-ch="${i}">${i}</button>`
        ).join('');
        grid.querySelectorAll('.picker-ch-btn').forEach(btn => {
            btn.addEventListener('click', () => navigateTo(_pickerBook, btn.dataset.ch));
        });
    }


    // ── Context Menu ──
    function showCtxMenu(ref, e) {
        e.preventDefault();
        const menu = $('ctx-menu');
        if (!menu) return;
        if (!S.selection.has(ref)) { S.selection.clear(); S.selection.add(ref); S.lastRef = ref; renderVerseStates(); updateSelectionBar(); updateStudyPanel(); }
        menu.classList.remove('hidden');
        const x = Math.min(e.clientX, window.innerWidth - 190);
        const y = Math.min(e.clientY, window.innerHeight - 200);
        menu.style.left = x + 'px'; menu.style.top = y + 'px';
    }

    function hideCtxMenu() { $('ctx-menu')?.classList.add('hidden'); }

    // ── View Switching ──
    function switchView(view) {
        // NOTE: 需要登录的视图不再直接弹登录框（用户点导航却被弹窗打断，
        // 且导航项不会激活，看起来像点击无效）。改为正常进入视图，
        // 由视图内部给出说明与登录入口，和社群面板的处理保持一致。
        S.view = view;
        try { localStorage.setItem('ob_last_view', view); } catch (e) { /* ignore */ }
        document.querySelectorAll('.view').forEach(v => { v.classList.remove('active-view'); v.classList.add('hidden-view'); });
        const target = document.getElementById(`view-${view}`);
        if (target) { target.classList.remove('hidden-view'); target.classList.add('active-view'); }
        document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
        const bibleNav = $('bible-nav');
        const topBar = $('top-bar');
        if (view === 'reading') {
            if (bibleNav) bibleNav.style.display = ''; if (topBar) topBar.style.display = '';
            renderBibleText();
        } else {
            if (bibleNav) bibleNav.style.display = 'none';
            if (view === 'plan') renderPlanView();
            else if (view === 'donate') renderDonateView();
            else if (view === 'video') renderVideoView();
            else if (view === 'audio') renderAudioView();
            else if (view === 'notes') renderNotesView();
            else if (view === 'settings') renderSettingsView();
            else if (view === 'profile') renderProfileView();
            else if (view === 'about') renderAboutView();
            else if (view === 'download') renderDownloadView();
            else if (view === 'privacy') renderPrivacyView();
        }
    }


    // ══ 社群面板（右栏）══════════════════════════════════════════════
    // 直接复用 App 的 /api/mobile/community/*：同一套会话 Cookie、同一份数据，
    // 在网页发的动态 App 里立刻可见，反之亦然。
    // 面板宽度有限，只承载核心闭环：社群列表 → 群动态 → 发帖/点赞/评论；
    // 活动、资源、成员、设置等管理型功能仍在 App 与后台管理里。
    const COMMUNITY_API = '/api/mobile/community';
    // comments：按 postId 缓存「查看全部」展开后的完整评论，
    // { items: [], nextCursor: string|null, loading: bool }。未展开的帖子不在表里。
    // view: 'list' | 'workspace'；tab 与 App 端 GroupPage 同构（助手为默认栏目）
    const _cmty = {
        view: 'list', tab: 'assistant', list: null, activeId: null, workspace: null,
        online: null, joinRequests: null, loading: false, error: '', composerOpen: false,
        comments: {}, discoverOpen: false, discoverKeyword: '', discoverMsg: '',
        joiningId: '', resFilter: 'ALL', memberKeyword: '', reportPid: null,
    };

    // 经文引用解析：把 "约翰福音 3:16-18"、"创世记 1章"、"John 3:16" 这类
    // 引用文本还原成 { book, chapter }，供点击跳转阅读器。
    // 反查表懒构建：三种语言的书名都收进来，按名字长度降序匹配（先试长名，
    // 避免「约翰福音」被「约翰一书」之类的短前缀截胡）。
    // 和合本通用缩写（"约 3:16" 这类手写引用的主要形态）。
    // 注意几个易混条目的归属：约=约翰福音（约一/约二/约三是书信）、
    // 书=约书亚记、伯=约伯记、歌=雅歌、西=歌罗西书。
    const _refAbbr = {
        '创': 'gen', '出': 'exo', '利': 'lev', '民': 'num', '申': 'deu',
        '书': 'jos', '士': 'jdg', '得': 'rut', '撒上': '1sa', '撒下': '2sa',
        '王上': '1ki', '王下': '2ki', '代上': '1ch', '代下': '2ch',
        '拉': 'ezr', '尼': 'neh', '斯': 'est', '伯': 'job', '诗': 'psa',
        '箴': 'pro', '传': 'ecc', '歌': 'sng', '赛': 'isa', '耶': 'jer',
        '哀': 'lam', '结': 'ezk', '但': 'dan', '何': 'hos', '珥': 'jol',
        '摩': 'amo', '俄': 'oba', '拿': 'jon', '弥': 'mic', '鸿': 'nah',
        '哈': 'hab', '番': 'zep', '该': 'hag', '亚': 'zec', '玛': 'mal',
        '太': 'mat', '可': 'mrk', '路': 'luk', '约': 'jhn', '徒': 'act',
        '罗': 'rom', '林前': '1co', '林后': '2co', '加': 'gal', '弗': 'eph',
        '腓': 'php', '西': 'col', '帖前': '1th', '帖后': '2th',
        '提前': '1ti', '提后': '2ti', '多': 'tit', '门': 'phm', '来': 'heb',
        '雅': 'jas', '彼前': '1pe', '彼后': '2pe',
        '约一': '1jn', '约二': '2jn', '约三': '3jn',
        '约壹': '1jn', '约贰': '2jn', '约叁': '3jn',
        '犹': 'jud', '启': 'rev',
    };

    let _refBookIndex = null;
    function _refParse(refText) {
        if (!refText) return null;
        if (!_refBookIndex) {
            const names = [];
            const tables = (typeof bookNames !== 'undefined') ? Object.values(bookNames) : [BOOK_NAME];
            for (const table of tables) {
                for (const [code, name] of Object.entries(table)) {
                    if (name) names.push([String(name), code, false]);
                }
            }
            for (const [abbr, code] of Object.entries(_refAbbr)) names.push([abbr, code, true]);
            names.sort((a, b) => b[0].length - a[0].length);
            _refBookIndex = names;
        }
        const text = String(refText).trim();
        const lower = text.toLowerCase();
        for (const [name, code, isAbbr] of _refBookIndex) {
            if (!lower.startsWith(name.toLowerCase())) continue;
            const rest = text.slice(name.length);
            // 缩写后面必须紧跟数字/空格/标点：避免「约翰一书」被缩写「约」抢先命中
            if (isAbbr && rest && /[一-鿿]/.test(rest[0])) continue;
            const m = rest.match(/(\d+)/);   // 第一个数字就是章号；没有数字则跳到第 1 章
            return { book: code, chapter: m ? parseInt(m[1], 10) : 1 };
        }
        return null;
    }

    // 点社群动态里的经文引用 → 左侧阅读器直接翻到那一章
    function _refJump(refText) {
        const target = _refParse(refText);
        if (!target) return;
        navigateTo(target.book, target.chapter);   // 内部会自动切回阅读视图
        showToast(`${bookDisplayName(target.book)} ${getChLabel(target.chapter)}`);
    }

    // 面板里所有内容都来自用户输入（社群名、动态正文、评论），必须转义后再拼进 HTML
    function _escapeHtml(str) {
        if (str === undefined || str === null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function _cmtyFetch(path, options) {
        const res = await fetch(`${COMMUNITY_API}${path}`, Object.assign({ credentials: 'same-origin' }, options || {}));
        let data = null;
        try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
        if (!res.ok || (data && data.ok === false)) {
            const err = new Error((data && data.message) || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    function _cmtyAvatar(name, color) {
        const ch = (name || '?').trim().charAt(0).toUpperCase();
        return `<span class="cmty-avatar" style="background:${color || 'var(--accent)'}">${_escapeHtml(ch)}</span>`;
    }

    function _cmtyTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const diff = Date.now() - d.getTime();
        if (diff < 60000) return t('cmty.justNow') || '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t('cmty.minAgo') || '分钟前'}`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} ${t('cmty.hourAgo') || '小时前'}`;
        return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function renderCommunityPanel() {
        const c = $('community-render');
        if (!c) return;
        // 固定页脚模式只属于群动态视图，其余视图（列表/空态/错误）整面板照常滚动
        c.classList.remove('is-feed');

        if (typeof Auth !== 'undefined' && !Auth.getUser()) {
            c.innerHTML = `<div class="cmty-empty">
                <i class="fa-solid fa-user-group"></i>
                <p>${t('cmty.loginPrompt') || '登录后查看你的社群动态'}</p>
                <button class="primary-btn cmty-login-btn">${t('auth.login') || '登录'}</button>
            </div>`;
            c.querySelector('.cmty-login-btn')?.addEventListener('click', () => Auth.showModal());
            return;
        }

        if (_cmty.error) {
            c.innerHTML = `<div class="cmty-empty">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>${_escapeHtml(_cmty.error)}</p>
                <button class="primary-btn cmty-retry-btn">${t('cmty.retry') || '重试'}</button>
            </div>`;
            c.querySelector('.cmty-retry-btn')?.addEventListener('click', () => {
                _cmty.error = '';
                if (_cmty.view === 'workspace') _cmtyOpen(_cmty.activeId); else _cmtyLoadList();
            });
            return;
        }

        if (_cmty.view === 'workspace') { _cmtyRenderWorkspace(c); return; }
        _cmtyRenderList(c);
    }

    // ── 社群列表（与 App 端 CommunityPage 同构） ──
    // 总群置顶卡 + 「我的社群与小组」+ 一人一群说明 + 搜索/发现并加入。
    function _cmtyListRow(g) {
        const role = g.membershipRole === 'OWNER' ? ('群主')
            : g.membershipRole === 'ADMIN' ? ('管理员') : '';
        const pending = g.pendingJoinRequestCount > 0
            ? `<span class="cmty-badge is-alert">${g.pendingJoinRequestCount} ${'个申请'}</span>` : '';
        const sub = g.isOfficial
            ? `${'公共空间'} · ${'全体已注册成员'}`
            : `${'私有空间'} · ${g.memberCount || 0} ${t('cmty.members') || '成员'}`;
        return `<button class="cmty-list-row${g.isOfficial ? ' is-official' : ''}" data-cid="${_escapeHtml(g.id)}">
            ${_cmtyAvatar(g.abbreviation || g.name, g.avatarColor)}
            <span class="cmty-list-copy">
                <span class="cmty-list-title">
                    <b>${_escapeHtml(g.name)}</b>
                    ${g.isOfficial ? `<span class="cmty-badge is-official">${'公共社群'}</span>`
                        : role ? `<span class="cmty-badge is-role">${role}</span>` : ''}
                    ${pending}
                </span>
                <small>${sub}</small>
            </span>
            <i class="fa-solid fa-chevron-right"></i>
        </button>`;
    }

    function _cmtyRenderList(c) {
        if (!_cmty.list) {
            c.innerHTML = `<div class="cmty-loading">${t('cmty.loading') || '加载中…'}</div>`;
            _cmtyLoadList();
            return;
        }
        const dir = _cmty.list;
        const all = dir.communities || [];
        const official = all.find(g => g.isOfficial);
        const joined = all.filter(g => !g.isOfficial);
        const owned = all.find(g => g.membershipRole === 'OWNER');
        const discoverable = dir.discoverableCommunities || [];
        const kw = _cmty.discoverKeyword.trim();

        c.innerHTML = `
            ${official ? _cmtyListRow(official) : ''}
            <div class="cmty-sect">
                <b>${'我的社群与小组'}</b>
                <span>${joined.length}</span>
            </div>
            ${joined.length === 0
                ? `<div class="cmty-status">${'还没有加入其他社群'}</div>`
                : `<div class="cmty-list">${joined.map(_cmtyListRow).join('')}</div>`}
            ${!dir.canCreateCommunity && owned
                ? `<p class="cmty-note">${'每位用户只能创建一个社群，你已经创建了'}「${_escapeHtml(owned.name)}」。</p>`
                : ''}
            <button class="cmty-discover-toggle">
                <i class="fa-solid fa-magnifying-glass"></i>
                ${_cmty.discoverOpen ? ('收起发现社群') : ('搜索或发现社群')}
            </button>
            ${_cmty.discoverOpen ? `<div class="cmty-discover">
                <label class="cmty-discover-search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input class="cmty-discover-input" value="${_escapeHtml(_cmty.discoverKeyword)}"
                        placeholder="${'搜索社群名称或介绍'}" aria-label="${'搜索社群名称或介绍'}">
                </label>
                ${_cmty.discoverMsg ? `<div class="cmty-status" role="status">${_escapeHtml(_cmty.discoverMsg)}</div>` : ''}
                ${discoverable.length === 0
                    ? `<div class="cmty-status">${kw ? ('没有找到匹配的社群') : ('暂时没有可发现的社群')}</div>`
                    : discoverable.map(g => `<div class="cmty-discover-row">
                        ${_cmtyAvatar(g.abbreviation || g.name, g.avatarColor)}
                        <span class="cmty-list-copy">
                            <b>${_escapeHtml(g.name)}</b>
                            <small>${g.memberCount || 0} ${t('cmty.members') || '成员'}${g.description ? ` · ${_escapeHtml(g.description)}` : ''}</small>
                        </span>
                        <button class="cmty-join-btn" data-cid="${_escapeHtml(g.id)}"${_cmty.joiningId ? ' disabled' : ''}>
                            ${_cmty.joiningId === g.id ? ('处理中')
                                : g.joinPolicy === 'OPEN' ? ('加入') : ('申请')}
                        </button>
                    </div>`).join('')}
            </div>` : ''}`;

        c.querySelectorAll('.cmty-list-row').forEach(row => {
            row.addEventListener('click', () => _cmtyOpen(row.dataset.cid));
        });
        c.querySelector('.cmty-discover-toggle')?.addEventListener('click', () => {
            _cmty.discoverOpen = !_cmty.discoverOpen;
            _cmty.discoverMsg = '';
            renderCommunityPanel();
        });
        // 搜索走服务端全量检索；输入不触发重渲染（会丢焦点），停顿后拉数据再渲染
        const input = c.querySelector('.cmty-discover-input');
        if (input) {
            input.addEventListener('input', () => {
                _cmty.discoverKeyword = input.value;
                clearTimeout(_cmtyDiscoverTimer);
                _cmtyDiscoverTimer = setTimeout(() => _cmtyLoadList(true), 320);
            });
        }
        c.querySelectorAll('.cmty-join-btn').forEach(btn => {
            btn.addEventListener('click', () => _cmtyJoin(btn.dataset.cid));
        });
    }
    let _cmtyDiscoverTimer = null;

    async function _cmtyLoadList(isSearch) {
        if (_cmty.loading) return;
        _cmty.loading = true;
        const kw = _cmty.discoverKeyword.trim();
        try {
            _cmty.list = await _cmtyFetch(kw ? `?keyword=${encodeURIComponent(kw)}` : '');
        } catch (e) {
            if (isSearch) { _cmty.discoverMsg = e.message || (t('cmty.loadFail') || '社群加载失败'); }
            else { _cmty.error = e.message || (t('cmty.loadFail') || '社群加载失败'); }
        } finally {
            _cmty.loading = false;
            // 只有列表视图需要跟着刷新；已进工作台就别把人拽回列表
            if (_cmty.view === 'list') {
                const wasFocused = document.activeElement?.classList?.contains('cmty-discover-input');
                renderCommunityPanel();
                if (wasFocused) {
                    const box = document.querySelector('.cmty-discover-input');
                    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
                }
            }
        }
    }

    async function _cmtyJoin(communityId) {
        if (_cmty.joiningId) return;
        _cmty.joiningId = communityId;
        _cmty.discoverMsg = '';
        renderCommunityPanel();
        try {
            const data = await _cmtyFetch(`/${encodeURIComponent(communityId)}/join`, { method: 'POST' });
            _cmty.discoverMsg = data.message || ('已提交');
            _cmty.list = null;   // 加入成功后目录会变化，重拉
        } catch (e) {
            _cmty.discoverMsg = e.message || ('操作失败');
        } finally {
            _cmty.joiningId = '';
            renderCommunityPanel();
        }
    }

    async function _cmtyOpen(communityId) {
        _cmty.view = 'workspace';
        _cmty.tab = 'assistant';   // 与 App 一致：进群先落在助手栏目
        _cmty.activeId = communityId;
        _cmty.workspace = null;
        _cmty.online = null;
        _cmty.joinRequests = null;
        _cmty.composerOpen = false;
        _cmty.resFilter = 'ALL';
        _cmty.memberKeyword = '';
        _cmty.comments = {};   // 换社群或刷新时丢弃上一次展开的评论
        // 换社群才清对话；同群内刷新走 _cmtyReload，不经过这里
        if (_asstLastGroup !== communityId) { _asstReset(); _asstLastGroup = communityId; }
        renderCommunityPanel();
        try {
            _cmty.workspace = await _cmtyFetch(`/${encodeURIComponent(communityId)}/workspace`);
        } catch (e) {
            _cmty.error = e.message || (t('cmty.loadFail') || '社群加载失败');
        }
        renderCommunityPanel();
        _cmtyHeartbeat();
    }

    // 同群内的数据刷新：保住当前栏目、助手对话和滚动语境
    async function _cmtyReload() {
        if (!_cmty.activeId) return;
        try {
            _cmty.workspace = await _cmtyFetch(`/${encodeURIComponent(_cmty.activeId)}/workspace`);
            _cmty.comments = {};
        } catch (e) {
            showToast(e.message || (t('cmty.loadFail') || '刷新失败'));
        }
        renderCommunityPanel();
    }

    // 单次在线心跳：换取「N 在线」。失败就保持成员数展示，不重试不打扰。
    async function _cmtyHeartbeat() {
        const id = _cmty.activeId;
        const ws = _cmty.workspace;
        if (!id || !ws || ws.access.role === 'GUEST') return;
        try {
            const data = await _cmtyFetch(`/${encodeURIComponent(id)}/presence`, { method: 'POST' });
            if (_cmty.activeId === id && typeof data.onlineCount === 'number') {
                _cmty.online = data.onlineCount;
                renderCommunityPanel();
            }
        } catch (e) { /* 在线数是锦上添花 */ }
    }

    // ── 社群工作台（与 App 端 GroupPage 同构） ──
    // 顶部固定：标题行 + 标签页；各栏目内容在 .cmty-feed-scroll 里自己滚。
    // 官方群只有 助手/动态/活动；私有群多出 成员/资料，管理员再多一个 小组。
    function _cmtyRenderWorkspace(c) {
        c.classList.add('is-feed');
        const ws = _cmty.workspace;
        if (!ws) {
            c.classList.remove('is-feed');
            c.innerHTML = `<div class="cmty-loading">${t('cmty.loading') || '加载中…'}</div>`;
            return;
        }
        const isOfficial = ws.community.isOfficial;
        const tabs = [['assistant', '助手'], ['feed', '动态'], ['events', '活动']];
        if (!isOfficial) {
            tabs.push(['members', '成员']);
            if (ws.access.isAdmin) tabs.push(['groups', '小组']);
            tabs.push(['resources', '资料']);
        }
        // 降级或切群后落在看不到的栏目时回到助手，不留空白页
        if (!tabs.some(item => item[0] === _cmty.tab)) _cmty.tab = 'assistant';

        // 整段替换 DOM 会重建助手输入框：先留存文字与焦点，渲染后写回
        const keepBox = c.querySelector('.cmty-asst-input');
        const keepVal = keepBox ? keepBox.value : '';
        const keepFocus = Boolean(keepBox && document.activeElement === keepBox);

        const sub = _cmty.online !== null
            ? `${_cmty.online} ${'在线'}`
            : `${ws.usage.members} ${t('cmty.members') || '成员'}`;

        let body;
        if (_cmty.tab === 'assistant') body = _asstTabHtml(ws);
        else if (_cmty.tab === 'feed') body = `<div class="cmty-feed-scroll">${_cmtyFeedHtml(ws)}</div>`;
        else if (_cmty.tab === 'events') body = `<div class="cmty-feed-scroll">${_cmtyEventsHtml(ws)}</div>`;
        else if (_cmty.tab === 'members') body = `<div class="cmty-feed-scroll">${_cmtyMembersHtml(ws)}</div>`;
        else if (_cmty.tab === 'groups') body = `<div class="cmty-feed-scroll">${_cmtyGroupsHtml(ws)}</div>`;
        else body = `<div class="cmty-feed-scroll">${_cmtyResourcesHtml(ws)}</div>`;

        c.innerHTML = `
            <div class="cmty-feed-head">
                <button class="cmty-back" aria-label="${t('cmty.back') || '返回社群列表'}"><i class="fa-solid fa-chevron-left"></i></button>
                <b>${_escapeHtml(ws.community.name)}</b>
                <small class="cmty-head-sub">${sub}</small>
            </div>
            <div class="cmty-tabs" role="tablist" aria-label="${'社群功能'}">
                ${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}" aria-selected="${_cmty.tab === id}"
                    class="${_cmty.tab === id ? 'active' : ''}">${label}</button>`).join('')}
            </div>
            ${body}`;

        c.querySelector('.cmty-back')?.addEventListener('click', () => {
            _cmty.view = 'list'; _cmty.activeId = null; _cmty.workspace = null;
            _cmty.list = null;   // 申请数、成员数可能已变化，回列表重拉
            renderCommunityPanel();
        });
        c.querySelectorAll('.cmty-tabs [data-tab]').forEach(b => {
            b.addEventListener('click', () => {
                if (_cmty.tab === b.dataset.tab) return;
                _cmty.tab = b.dataset.tab;
                renderCommunityPanel();
            });
        });

        if (_cmty.tab === 'assistant') _cmtyBindAssistant(c, ws);
        else if (_cmty.tab === 'feed') _cmtyBindFeed(c, ws);
        else if (_cmty.tab === 'events') _cmtyBindEvents(c);
        else if (_cmty.tab === 'members') _cmtyBindMembers(c, ws);
        else if (_cmty.tab === 'groups') _cmtyBindGroups(c);
        else if (_cmty.tab === 'resources') _cmtyBindResources(c);

        const box = c.querySelector('.cmty-asst-input');
        if (box && keepVal && !box.value) box.value = keepVal;
        if (box && keepFocus) box.focus();
    }

    // 把助手输入框预填一句可编辑的指令——App 端建议芯片的交互
    function _asstPrefill(text) {
        _cmty.tab = 'assistant';
        renderCommunityPanel();
        const box = document.querySelector('.cmty-asst-input');
        if (box) {
            box.value = text;
            box.focus();
            box.setSelectionRange(box.value.length, box.value.length);
        }
    }

    // 「上传群资料 / 添加资料」直达附件选择：文件输入框只存在于助手栏目
    function _asstAttachPrompt() {
        _cmty.tab = 'assistant';
        renderCommunityPanel();
        document.querySelector('.cmty-asst-file')?.click();
    }

    // ── 动态栏目 ──
    function _cmtyRefLabelNow() {
        return S.selection.size > 0 ? refLabel(S.selection)
            : (S.book && S.chapter ? `${bookDisplayName(S.book)} ${S.chapter}${t('cmty.chapter') || '章'}` : '');
    }

    function _cmtyFeedHtml(ws) {
        const posts = ws.posts || [];
        const refLabelNow = _cmtyRefLabelNow();
        return `
            ${ws.access && ws.access.canPublish
                ? `<button class="cmty-create-btn cmty-new"><i class="fa-solid fa-pen-to-square"></i> ${t('cmty.newPost') || '发布内容'}</button>` : ''}
            ${_cmtyPlansHtml(ws.readingPlans)}
            ${_cmty.composerOpen ? `
            <div class="cmty-composer">
                <textarea id="cmty-composer-text" rows="3" placeholder="${t('cmty.composerPh') || '分享你的思考…'}"></textarea>
                <label class="cmty-composer-ref">
                    <input type="checkbox" id="cmty-attach-ref" ${refLabelNow ? 'checked' : 'disabled'}>
                    <span>${t('cmty.attachRef') || '附上当前经文'}${refLabelNow ? ` · ${_escapeHtml(refLabelNow)}` : ''}</span>
                </label>
                <label class="cmty-composer-ref">
                    <input type="checkbox" id="cmty-as-prayer">
                    <span>🙏 ${t('cmty.asPrayer') || '作为代祷请求发布'}</span>
                </label>
                <div class="cmty-composer-actions">
                    <button class="cmty-composer-cancel">${t('cmty.cancel') || '取消'}</button>
                    <button class="primary-btn cmty-composer-submit">${t('cmty.publish') || '发布'}</button>
                </div>
            </div>` : ''}
            <div class="cmty-posts">
                ${posts.length === 0 ? `<div class="cmty-empty"><p>${t('cmty.noPosts') || '这个社群还没有动态'}</p></div>`
                  : posts.map(p => _cmtyPostHtml(p)).join('')}
                ${ws.postsNextCursor ? `<button class="cmty-more cmty-more-posts"${_cmty.loadingPosts ? ' disabled' : ''}>
                    ${_cmty.loadingPosts ? (t('cmty.loading') || '加载中…') : (t('cmty.morePosts') || '加载更多动态')}
                </button>` : ''}
            </div>`;
    }

    function _cmtyBindFeed(c, ws) {
        const refLabelNow = _cmtyRefLabelNow();
        c.querySelector('.cmty-new')?.addEventListener('click', () => {
            _cmty.composerOpen = !_cmty.composerOpen;
            renderCommunityPanel();
        });
        c.querySelector('.cmty-composer-cancel')?.addEventListener('click', () => {
            _cmty.composerOpen = false; renderCommunityPanel();
        });
        c.querySelector('.cmty-composer-submit')?.addEventListener('click', () => {
            const text = $('cmty-composer-text')?.value.trim();
            const attach = $('cmty-attach-ref')?.checked;
            const asPrayer = $('cmty-as-prayer')?.checked;
            _cmtyPublish(text, attach ? refLabelNow : '', asPrayer ? 'PRAYER' : 'POST');
        });
        c.querySelectorAll('.cmty-like').forEach(btn => {
            btn.addEventListener('click', () => _cmtyToggleLike(btn.dataset.pid));
        });
        c.querySelectorAll('.cmty-comment-send').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = c.querySelector(`.cmty-comment-input[data-pid="${btn.dataset.pid}"]`);
                _cmtyComment(btn.dataset.pid, input?.value.trim());
            });
        });
        c.querySelectorAll('.cmty-post-ref.is-link').forEach(btn => {
            btn.addEventListener('click', () => _refJump(btn.dataset.ref));
        });
        c.querySelectorAll('.cmty-plan-card').forEach(card => {
            card.addEventListener('click', () => {
                if (typeof switchView === 'function') switchView('plan');
            });
        });
        c.querySelector('.cmty-more-posts')?.addEventListener('click', _cmtyLoadMorePosts);
        c.querySelectorAll('.cmty-more-comments').forEach(btn => {
            btn.addEventListener('click', () => _cmtyLoadComments(btn.dataset.pid));
        });
        // 举报：点旗标展开原因行，选原因即提交（REPORT_POST 与 App 端同一接口）
        c.querySelectorAll('.cmty-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _cmty.reportPid = _cmty.reportPid === btn.dataset.pid ? null : btn.dataset.pid;
                renderCommunityPanel();
            });
        });
        c.querySelectorAll('.cmty-report-cancel').forEach(btn => {
            btn.addEventListener('click', () => { _cmty.reportPid = null; renderCommunityPanel(); });
        });
        c.querySelectorAll('.cmty-report-reason').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const data = await _cmtyAction({ action: 'REPORT_POST', postId: btn.dataset.pid, reason: btn.dataset.reason });
                    showToast((data && data.message) || '举报已提交，平台将尽快处理');
                } catch (e) {
                    showToast(e.message || '举报失败，请稍后重试');
                }
                _cmty.reportPid = null;
                renderCommunityPanel();
            });
        });
    }

    // ── 活动栏目 ──
    function _cmtyEventTime(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso || '';
        return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function _cmtyEventCard(ev) {
        const ended = ev.state === 'ENDED';
        const full = ev.capacity !== null && ev.signupCount >= ev.capacity && !ev.signedUpByMe;
        const status = ended ? '已结束' : ev.state === 'ACTIVE' ? '进行中' : '报名中';
        return `<article class="cmty-event${ended ? ' is-ended' : ''}">
            <span class="cmty-event-kicker">${status}</span>
            <b>${_escapeHtml(ev.title)}</b>
            ${ev.description ? `<p>${_escapeHtml(ev.description)}</p>` : ''}
            <small><i class="fa-solid fa-calendar"></i> ${_cmtyEventTime(ev.startAt)}${ev.endAt ? ` – ${_cmtyEventTime(ev.endAt)}` : ''}</small>
            ${ev.location ? `<small><i class="fa-solid fa-location-dot"></i> ${_escapeHtml(ev.location)}</small>` : ''}
            <span class="cmty-event-foot">
                <small>已报名 ${ev.signupCount}${ev.capacity === null ? ' 人' : `/${ev.capacity}`}</small>
                <button class="cmty-ev-signup${ev.signedUpByMe || ended ? '' : ' is-primary'}" data-eid="${_escapeHtml(ev.id)}"${ended || full ? ' disabled' : ''}>
                    ${ended ? '已结束' : full ? '名额已满' : ev.signedUpByMe ? '取消报名' : '报名'}
                </button>
            </span>
        </article>`;
    }

    function _cmtyEventsHtml(ws) {
        const events = ws.events || [];
        const upcoming = events.filter(e => e.state !== 'ENDED');
        const ended = events.filter(e => e.state === 'ENDED');
        return `
            ${ws.access.isAdmin ? `<button class="cmty-create-btn cmty-ev-create"><i class="fa-solid fa-pen-to-square"></i> 创建活动</button>` : ''}
            ${events.length === 0 ? `<div class="cmty-status">${ws.community.isOfficial ? '暂时没有公共活动。' : '暂时没有群活动。'}${ws.access.isAdmin ? '点上方「创建活动」，由助手一句话建好。' : ''}</div>` : ''}
            ${upcoming.length === 0 && ended.length > 0 ? `<div class="cmty-status">近期没有可报名的活动。</div>` : ''}
            ${upcoming.map(_cmtyEventCard).join('')}
            ${ended.length ? `<details class="cmty-past"><summary>已结束的活动 <span>${ended.length}</span></summary>${ended.map(_cmtyEventCard).join('')}</details>` : ''}`;
    }

    function _cmtyBindEvents(c) {
        c.querySelector('.cmty-ev-create')?.addEventListener('click', () =>
            _asstPrefill('创建活动，标题“周五查经”，时间“YYYY-MM-DD 19:30”，地点“线上”，说明“”'));
        c.querySelectorAll('.cmty-ev-signup').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    const data = await _cmtyAction({ action: 'TOGGLE_SIGNUP', eventId: btn.dataset.eid });
                    if (data && data.message) showToast(data.message);
                    await _cmtyReload();
                } catch (e) {
                    showToast(e.message || '操作失败');
                    btn.disabled = false;
                }
            });
        });
    }

    // ── 成员栏目 ──
    function _cmtyMembersHtml(ws) {
        const lim = ws.entitlements ? ws.entitlements.memberLimit : null;
        const reqs = _cmty.joinRequests;
        const kw = _cmty.memberKeyword.trim().toLowerCase();
        const members = (ws.members || []).filter(m =>
            !kw || `${m.user.name} ${m.user.email || ''}`.toLowerCase().includes(kw));
        const roleLabel = r => r === 'OWNER' ? '群主' : r === 'ADMIN' ? '管理员' : '成员';
        const statusLabel = s => s === 'ACTIVE' ? '正常' : s === 'MUTED' ? '已禁言' : '已封禁';
        return `
            <div class="cmty-usage">
                <span>成员 ${ws.usage.members}${lim == null ? '' : `/${lim}`}</span>
                ${ws.entitlements && ws.entitlements.label ? `<span>${_escapeHtml(ws.entitlements.label)}方案</span>` : ''}
            </div>
            ${ws.access.canManageMembers && Array.isArray(reqs) && reqs.length ? `<div class="cmty-reqs">
                <div class="cmty-sect"><b>加入申请</b><span>${reqs.length}</span></div>
                ${reqs.map(r => `<div class="cmty-req">
                    ${_cmtyAvatar(r.user.name, r.user.avatarColor)}
                    <span class="cmty-list-copy">
                        <b>${_escapeHtml(r.user.name)}</b>
                        <small>${_escapeHtml(r.user.email || '已注册用户')}</small>
                        ${r.message ? `<small>${_escapeHtml(r.message)}</small>` : ''}
                    </span>
                    <span class="cmty-req-actions">
                        <button class="cmty-req-no" data-rid="${_escapeHtml(r.id)}">拒绝</button>
                        <button class="cmty-req-ok" data-rid="${_escapeHtml(r.id)}">批准</button>
                    </span>
                </div>`).join('')}
            </div>` : ''}
            ${ws.access.canManageMembers ? `<div class="cmty-invite">
                <input class="cmty-invite-input" type="email" placeholder="邀请成员：填写对方注册邮箱">
                <button class="cmty-invite-btn">邀请</button>
            </div>` : ''}
            ${(ws.members || []).length > 6 ? `<label class="cmty-discover-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input class="cmty-member-search" value="${_escapeHtml(_cmty.memberKeyword)}" placeholder="搜索成员姓名或邮箱">
            </label>` : ''}
            ${kw && members.length === 0 ? `<div class="cmty-status">没有匹配的成员。</div>` : ''}
            ${members.map(m => `<div class="cmty-member">
                ${_cmtyAvatar(m.user.name, m.user.avatarColor)}
                <span class="cmty-list-copy">
                    <b>${_escapeHtml(m.user.name)}</b>
                    <small>${roleLabel(m.role)} · ${statusLabel(m.user.status)}</small>
                </span>
                ${ws.access.canManageMembers && m.role !== 'OWNER' ? `<span class="cmty-member-actions">
                    ${ws.access.canManageRoles ? `<button class="cmty-role-btn" data-uid="${_escapeHtml(m.user.id)}" data-role="${m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'}">${m.role === 'ADMIN' ? '取消管理员' : '设为管理员'}</button>` : ''}
                    <button class="cmty-remove-btn" data-uid="${_escapeHtml(m.user.id)}" data-name="${_escapeHtml(m.user.name)}">移除</button>
                </span>` : ''}
            </div>`).join('')}`;
    }

    async function _cmtyLoadJoinRequests() {
        const ws = _cmty.workspace;
        if (!ws || !ws.access.canManageMembers || _cmty.joinRequests !== null) return;
        try {
            const data = await _cmtyFetch(`/${encodeURIComponent(_cmty.activeId)}/join-requests`);
            _cmty.joinRequests = data.requests || [];
        } catch (e) {
            _cmty.joinRequests = [];
        }
        if (_cmty.tab === 'members') renderCommunityPanel();
    }

    function _cmtyBindMembers(c, ws) {
        if (ws.access.canManageMembers && _cmty.joinRequests === null) _cmtyLoadJoinRequests();
        const search = c.querySelector('.cmty-member-search');
        if (search) {
            search.addEventListener('input', () => {
                _cmty.memberKeyword = search.value;
                clearTimeout(_cmtyMemberTimer);
                _cmtyMemberTimer = setTimeout(() => {
                    renderCommunityPanel();
                    const box = document.querySelector('.cmty-member-search');
                    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
                }, 200);
            });
        }
        const review = async (requestId, decision) => {
            try {
                const data = await _cmtyFetch(`/${encodeURIComponent(_cmty.activeId)}/join-requests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ requestId, decision }),
                });
                if (data && data.message) showToast(data.message);
                _cmty.joinRequests = null;   // 重取剩余申请
                await _cmtyReload();
                _cmtyLoadJoinRequests();
            } catch (e) {
                showToast(e.message || '处理失败');
            }
        };
        c.querySelectorAll('.cmty-req-ok').forEach(b => b.addEventListener('click', () => review(b.dataset.rid, 'APPROVE')));
        c.querySelectorAll('.cmty-req-no').forEach(b => b.addEventListener('click', () => review(b.dataset.rid, 'REJECT')));
        c.querySelector('.cmty-invite-btn')?.addEventListener('click', async () => {
            const input = c.querySelector('.cmty-invite-input');
            const email = input ? input.value.trim() : '';
            if (!email) { showToast('请填写对方注册邮箱'); return; }
            try {
                const data = await _cmtyAction({ action: 'INVITE_MEMBER', email });
                if (data && data.message) showToast(data.message);
                await _cmtyReload();
            } catch (e) {
                showToast(e.message || '邀请失败');
            }
        });
        c.querySelectorAll('.cmty-role-btn').forEach(b => {
            b.addEventListener('click', async () => {
                try {
                    const data = await _cmtyAction({ action: 'UPDATE_MEMBER_ROLE', userId: b.dataset.uid, role: b.dataset.role });
                    if (data && data.message) showToast(data.message);
                    await _cmtyReload();
                } catch (e) { showToast(e.message || '操作失败'); }
            });
        });
        c.querySelectorAll('.cmty-remove-btn').forEach(b => {
            b.addEventListener('click', async () => {
                // 移除不可逆且影响他人，浏览器原生确认足够醒目
                if (!window.confirm(`将 ${b.dataset.name} 移出社群？移除后对方将无法查看群内内容。`)) return;
                try {
                    const data = await _cmtyAction({ action: 'REMOVE_MEMBER', userId: b.dataset.uid });
                    if (data && data.message) showToast(data.message);
                    await _cmtyReload();
                } catch (e) { showToast(e.message || '操作失败'); }
            });
        });
    }
    let _cmtyMemberTimer = null;

    // ── 小组栏目（仅管理员可见） ──
    function _cmtyGroupsHtml(ws) {
        const lim = ws.entitlements ? ws.entitlements.groupLimit : null;
        const limitReached = lim != null && ws.usage.groups >= lim;
        const groups = ws.groups || [];
        return `
            <div class="cmty-usage"><span>小组 ${ws.usage.groups}${lim == null ? '' : `/${lim}`}</span></div>
            ${ws.access.canCreateGroups && !limitReached ? `<button class="cmty-create-btn cmty-grp-create"><i class="fa-solid fa-pen-to-square"></i> 新建小组</button>` : ''}
            ${ws.access.canCreateGroups && limitReached ? `<div class="cmty-status">当前方案最多创建 ${lim} 个小组。</div>` : ''}
            ${groups.length === 0 ? `<div class="cmty-status">还没有下属小组。${ws.access.canCreateGroups && !limitReached ? '点上方「新建小组」，由助手一句话建好。' : ''}</div>` : ''}
            ${groups.map(g => `<button class="cmty-list-row" data-cid="${_escapeHtml(g.id)}">
                ${_cmtyAvatar(g.abbreviation || g.name, g.avatarColor)}
                <span class="cmty-list-copy">
                    <b>${_escapeHtml(g.name)}</b>
                    <small>${g.memberCount || 0} 成员${g.description ? ` · ${_escapeHtml(g.description)}` : ''}</small>
                </span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>`).join('')}`;
    }

    function _cmtyBindGroups(c) {
        c.querySelector('.cmty-grp-create')?.addEventListener('click', () =>
            _asstPrefill('新建小组，名称“青年查经组”，简称“青年”，简介“”'));
        c.querySelectorAll('.cmty-list-row').forEach(row => {
            row.addEventListener('click', () => _cmtyOpen(row.dataset.cid));
        });
    }

    // ── 资料栏目 ──
    function _cmtyResourcesHtml(ws) {
        const lim = ws.entitlements ? ws.entitlements.resourceLimit : null;
        const typeLabel = { LINK: '链接', DOCUMENT: '文档', AUDIO: '音频', VIDEO: '视频', IMAGE: '图片', TEXT: '文本', OTHER: '文件' };
        const typeIcon = { AUDIO: 'fa-volume-high', VIDEO: 'fa-circle-play', IMAGE: 'fa-image', TEXT: 'fa-file-lines', LINK: 'fa-link' };
        const ks = r => r.knowledgeStatus === 'PARSING' ? ['正在解析', 'is-parsing']
            : r.knowledgeStatus === 'INDEXED' ? ['已加入知识库', 'is-indexed']
            : r.knowledgeStatus === 'FAILED' ? ['解析失败', 'is-failed']
            : ['需要重新索引', 'is-reindex'];
        const match = r => _cmty.resFilter === 'ALL' ? true
            : _cmty.resFilter === 'DOCUMENT' ? (r.type === 'DOCUMENT' || r.type === 'TEXT')
            : _cmty.resFilter === 'MEDIA' ? ['IMAGE', 'AUDIO', 'VIDEO'].includes(r.type)
            : r.type === 'LINK';
        const size = v => typeof v !== 'number' ? ''
            : v < 1024 ? `${v} B` : v < 1048576 ? `${(v / 1024).toFixed(1)} KB` : `${(v / 1048576).toFixed(1)} MB`;
        const all = ws.resources || [];
        const shown = all.filter(match);
        return `
            <div class="cmty-usage">
                <span>群资料 ${ws.usage.resources}${lim == null ? ' 份' : `/${lim}`}</span>
                <span>仅供本群 · AI 可检索已解析资料</span>
            </div>
            ${ws.access.canManageResources ? `<button class="cmty-create-btn cmty-res-add"><i class="fa-solid fa-paperclip"></i> 添加资料</button>` : ''}
            ${all.length ? `<div class="cmty-res-filters">${[['ALL', '全部'], ['DOCUMENT', '文档'], ['MEDIA', '影音'], ['LINK', '链接']]
                .map(([v, l]) => `<button data-f="${v}" class="${_cmty.resFilter === v ? 'is-active' : ''}">${l}</button>`).join('')}</div>` : ''}
            ${all.length === 0 ? `<div class="cmty-status">暂时没有共享资料。${ws.access.canManageResources ? '点上方「添加资料」上传。' : ''}</div>` : ''}
            ${all.length && !shown.length ? `<div class="cmty-status">这个分类暂时没有资料。</div>` : ''}
            ${shown.map(r => {
                const status = ks(r);
                const title = (r.title || '').trim() || (r.fileName || '').replace(/\.[^.]+$/, '') || `${typeLabel[r.type] || '文件'}资料`;
                return `<article class="cmty-res">
                    <span class="cmty-res-icon"><i class="fa-solid ${typeIcon[r.type] || 'fa-file'}"></i></span>
                    <span class="cmty-list-copy">
                        <b>${_escapeHtml(title)}</b>
                        <small>${typeLabel[r.type] || '文件'}${typeof r.fileSize === 'number' ? ` · ${size(r.fileSize)}` : ''} · ${r.visibility === 'ADMINS' ? '仅管理员' : '全体成员'}${r.uploader && r.uploader.name ? ` · ${_escapeHtml(r.uploader.name)}` : ''}</small>
                        ${r.description ? `<small>${_escapeHtml(r.description)}</small>` : ''}
                        <span class="cmty-res-status ${status[1]}">${status[0]}</span>
                    </span>
                    <span class="cmty-res-actions">
                        <button class="cmty-res-ask" data-title="${_escapeHtml(title)}">问助手</button>
                        ${r.url ? `<a href="${_escapeHtml(r.url)}" target="_blank" rel="noreferrer">打开</a>` : ''}
                        ${ws.access.canManageResources && r.knowledgeStatus !== 'INDEXED' ? `<button class="cmty-res-reindex" data-rid="${_escapeHtml(r.id)}">重新索引</button>` : ''}
                        ${ws.access.canManageResources ? `<button class="cmty-res-hide" data-rid="${_escapeHtml(r.id)}" data-title="${_escapeHtml(title)}">下架</button>` : ''}
                    </span>
                </article>`;
            }).join('')}`;
    }

    function _cmtyBindResources(c) {
        c.querySelector('.cmty-res-add')?.addEventListener('click', _asstAttachPrompt);
        c.querySelectorAll('.cmty-res-filters [data-f]').forEach(b => {
            b.addEventListener('click', () => {
                _cmty.resFilter = b.dataset.f;
                renderCommunityPanel();
            });
        });
        c.querySelectorAll('.cmty-res-ask').forEach(b => {
            b.addEventListener('click', () => _asstPrefill(`请根据本群资料《${b.dataset.title}》回答：`));
        });
        c.querySelectorAll('.cmty-res-reindex').forEach(b => {
            b.addEventListener('click', async () => {
                try {
                    const data = await _cmtyAction({ action: 'REINDEX_RESOURCE', resourceId: b.dataset.rid });
                    if (data && data.message) showToast(data.message);
                    await _cmtyReload();
                } catch (e) { showToast(e.message || '操作失败'); }
            });
        });
        c.querySelectorAll('.cmty-res-hide').forEach(b => {
            b.addEventListener('click', async () => {
                if (!window.confirm(`下架「${b.dataset.title}」？成员将不再看到，也不再参与助手检索。`)) return;
                try {
                    const data = await _cmtyAction({ action: 'UPDATE_RESOURCE_STATUS', resourceId: b.dataset.rid, status: 'HIDDEN' });
                    if (data && data.message) showToast(data.message);
                    await _cmtyReload();
                } catch (e) { showToast(e.message || '操作失败'); }
            });
        });
    }

    // ── 助手栏目 ──
    // 无对话时是「首页」：身份卡 + 建议芯片（App 端 community-assistant-home 的同构）；
    // 有对话后变成消息流。输入栏固定在面板底部。
    function _asstHeroHtml(ws) {
        const isOfficial = ws.community.isOfficial;
        const name = ws.community.name;
        const role = ws.access.role;
        const roleLabel = role === 'OWNER' ? '群主' : role === 'ADMIN' ? '管理员' : role === 'GUEST' ? '游客' : '成员';
        const dir = _cmty.list;
        const chips = [];
        if (isOfficial) {
            chips.push(['解释一段经文', '请解释这段经文的背景、重点和生活应用：']);
            chips.push(['查询总群资料', '请根据慧读总群资料回答：']);
            if (dir && dir.canCreateCommunity) chips.push(['创建我的社群', '创建社群“”，简称“”，简介“”']);
            chips.push(['管理我的社群', '管理我的社群']);
            chips.push(['查找可加入社群', '搜索适合我的社群：']);
            chips.push(['申请加入社群', '申请加入社群“”']);
        } else {
            chips.push(['整理为群动态', '发布动态，请把这段内容整理成适合群内发布的动态：']);
            chips.push(ws.access.isAdmin
                ? ['创建查经活动', '创建活动，标题“周五查经”，时间“YYYY-MM-DD 19:30”，地点“线上”，说明“”']
                : ['查看近期活动', `请查看${name}近期有哪些活动。`]);
            chips.push(ws.access.isAdmin ? ['邀请新成员', '邀请成员，请填写已注册邮箱：'] : ['查找群内成员', '查找成员：']);
            chips.push(['查询本群资料', `请根据${name}的群资料回答：`]);
            chips.push(ws.access.canCreateGroups
                ? ['新建社群小组', '新建小组，名称“青年查经组”，简称“青年”，简介“”']
                : ['解释一段经文', '请解释这段经文的背景、重点和生活应用：']);
            chips.push(ws.access.canManageResources
                ? ['上传群资料', '__attach__']
                : ['提炼内容重点', '请帮我提炼下面这段内容的重点：']);
        }
        const note = isOfficial
            ? (role === 'GUEST' ? '动态和活动可直接浏览，互动与提问需要登录' : '公共内容由平台维护，管理操作会先确认权限')
            : '本群资料独立隔离，管理操作会先请你确认';
        return `<div class="cmty-hero${isOfficial ? ' is-official' : ''}">
            <span class="cmty-hero-mark"${isOfficial ? '' : ` style="background:${_escapeHtml(ws.community.avatarColor || 'var(--accent)')}"`}>
                ${isOfficial ? '<i class="fa-solid fa-wand-magic-sparkles"></i>' : _escapeHtml((ws.community.abbreviation || name || '群').slice(0, 2))}
            </span>
            <h3>
                ${isOfficial ? '今天想一起做什么？' : `${_escapeHtml(name)}助手`}
                <span class="cmty-hero-type">${isOfficial ? (role === 'GUEST' ? '公共社群 · 游客浏览' : '公共社群') : `私有社群 · ${roleLabel}`}</span>
            </h3>
            <p>${isOfficial ? '问经文、查总群资料，或用一句话办理社群事务。' : `问经文、查${_escapeHtml(name)}资料，或用一句话办理群事务。`}</p>
            <div class="cmty-hero-chips">
                ${chips.map(([label, fill]) => `<button class="cmty-hero-chip" data-fill="${_escapeHtml(fill)}">${label}</button>`).join('')}
            </div>
            <small class="cmty-hero-note">${note}</small>
        </div>`;
    }

    function _asstTabHtml(ws) {
        const hasThread = _asst.messages.length > 0 || _asst.pending.length > 0 || _asst.sending || _asst.error;
        return `<div class="cmty-feed-scroll cmty-asst-scroll">
            ${hasThread ? _asstThreadHtml() : _asstHeroHtml(ws)}
        </div>
        ${_asstBarHtml()}`;
    }

    function _cmtyBindAssistant(c, ws) {
        _asstBind(c);
        c.querySelectorAll('.cmty-hero-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const fill = chip.dataset.fill;
                if (fill === '__attach__') { c.querySelector('.cmty-asst-file')?.click(); return; }
                const box = c.querySelector('.cmty-asst-input');
                if (box) {
                    box.value = fill;
                    box.focus();
                    box.setSelectionRange(box.value.length, box.value.length);
                }
            });
        });
        // 有对话时停在最新消息
        const scroll = c.querySelector('.cmty-asst-scroll');
        if (scroll && (_asst.messages.length || _asst.pending.length || _asst.sending)) {
            scroll.scrollTop = scroll.scrollHeight;
        }
    }

    // 群动态翻页：workspace 只带首屏，其余按游标从 /posts 续取。
    async function _cmtyLoadMorePosts() {
        const ws = _cmty.workspace;
        if (!ws || !ws.postsNextCursor || _cmty.loadingPosts) return;
        _cmty.loadingPosts = true;
        renderCommunityPanel();
        try {
            const data = await _cmtyFetch(
                `/${encodeURIComponent(_cmty.activeId)}/posts?cursor=${encodeURIComponent(ws.postsNextCursor)}`
            );
            ws.posts = (ws.posts || []).concat(data.posts || []);
            ws.postsNextCursor = data.nextCursor || null;
        } catch (e) {
            showToast(e.message || (t('cmty.loadFail') || '加载失败'));
        } finally {
            _cmty.loadingPosts = false;
            renderCommunityPanel();
        }
    }

    // 「查看全部评论」：workspace 每帖只带最新两条，完整列表按游标从 /comments 取。
    // 同一个按钮承担首次展开与后续翻页——两者都是「再取一页」。
    async function _cmtyLoadComments(postId) {
        const state = _cmty.comments[postId] || { items: [], nextCursor: undefined, loading: false };
        if (state.loading || state.nextCursor === null) return;   // null 表示已取完
        state.loading = true;
        _cmty.comments[postId] = state;
        renderCommunityPanel();
        try {
            const query = state.nextCursor ? `?cursor=${encodeURIComponent(state.nextCursor)}` : '';
            const data = await _cmtyFetch(
                `/${encodeURIComponent(_cmty.activeId)}/posts/${encodeURIComponent(postId)}/comments${query}`
            );
            state.items = state.items.concat(data.comments || []);
            state.nextCursor = data.nextCursor || null;
        } catch (e) {
            showToast(e.message || (t('cmty.loadFail') || '加载失败'));
            // 首次展开就失败：清掉状态，让按钮回到「查看全部」可重试
            if (!state.items.length) delete _cmty.comments[postId];
        } finally {
            state.loading = false;
            renderCommunityPanel();
        }
    }

    // 共读进度卡：社群首屏第一眼看到「今天群里有多少人读了」。
    // 点击整卡跳到读经计划视图（打卡在那边完成，这里只做召唤）。
    function _cmtyPlansHtml(plans) {
        if (!Array.isArray(plans) || plans.length === 0) return '';
        return plans.map(pl => {
            const pct = pl.enrolledCount > 0 ? Math.round(pl.readTodayCount / pl.enrolledCount * 100) : 0;
            const mine = pl.myCompletedDays !== null
                ? (pl.myReadToday
                    ? `<span class="cmty-plan-mine is-done">✓ ${t('cmty.planReadToday') || '今日已读'}</span>`
                    : `<span class="cmty-plan-mine">${t('cmty.planMyProgress') || '我的进度'} ${pl.myCompletedDays}/${pl.totalDays}</span>`)
                : `<span class="cmty-plan-mine">${t('cmty.planJoin') || '去参加'} ›</span>`;
            return `<button class="cmty-plan-card" data-plan="${_escapeHtml(pl.id)}">
                <span class="cmty-plan-head">
                    <i class="fa-solid fa-book-bible"></i>
                    <b>${_escapeHtml(pl.title)}</b>
                    <small>${pl.totalDays} ${t('cmty.planDays') || '天'}</small>
                </span>
                <span class="cmty-plan-stats">
                    <span class="cmty-plan-bar"><span style="width:${pct}%"></span></span>
                    <small>${(t('cmty.planToday') || '今天已读')} ${pl.readTodayCount}/${pl.enrolledCount}${pl.completedCount ? ` · ${t('cmty.planDone') || '已完成'} ${pl.completedCount}` : ''}</small>
                </span>
                ${mine}
            </button>`;
        }).join('');
    }

    function _cmtyPostHtml(p) {
        const author = p.author || {};
        const isPrayer = p.postType === 'PRAYER';
        // 引用解析得出来才渲染成按钮；解析不了就保持纯文本，不给一个点了没反应的入口
        const refClickable = p.verseRef && _refParse(p.verseRef);
        // 未展开时用 workspace 带的预览（每帖最新两条），展开后用完整列表。
        const expanded = _cmty.comments[p.id];
        const comments = expanded ? expanded.items : (p.comments || []);
        const total = p.commentCount ?? comments.length;
        // 还有没显示出来的评论时才给入口：未展开看总数，展开后看游标。
        const hasMoreComments = expanded ? expanded.nextCursor !== null : total > comments.length;
        const moreLabel = expanded
            ? (t('cmty.moreComments') || '加载更多评论')
            : `${t('cmty.viewAllComments') || '查看全部'} ${total} ${t('cmty.commentsUnit') || '条评论'}`;
        return `<article class="cmty-post${isPrayer ? ' is-prayer' : ''}">
            <div class="cmty-post-head">
                ${_cmtyAvatar(author.name, author.avatarColor)}
                <span class="cmty-post-meta"><b>${_escapeHtml(author.name || '')}</b><small>${_cmtyTime(p.createdAt)}</small></span>
                ${isPrayer ? `<span class="cmty-post-kind">🙏 ${t('cmty.prayer') || '代祷'}</span>` : ''}
            </div>
            ${p.title ? `<h4 class="cmty-post-title">${_escapeHtml(p.title)}</h4>` : ''}
            ${p.verseRef ? (refClickable
                ? `<button class="cmty-post-ref is-link" data-ref="${_escapeHtml(p.verseRef)}" title="${t('cmty.refJump') || '在阅读器中打开'}"><i class="fa-solid fa-book-open"></i> ${_escapeHtml(p.verseRef)}</button>`
                : `<span class="cmty-post-ref">${_escapeHtml(p.verseRef)}</span>`) : ''}
            <p class="cmty-post-body">${_escapeHtml(p.content || '').replace(/\n/g, '<br>')}</p>
            <div class="cmty-post-actions">
                ${isPrayer ? `<button class="cmty-like cmty-pray${p.likedByMe ? ' is-on' : ''}" data-pid="${_escapeHtml(p.id)}">
                    🙏 ${p.likedByMe ? (t('cmty.prayed') || '已为你祷告') : (t('cmty.prayFor') || '我为你祷告')}${p.likeCount > 0 ? ` · ${p.likeCount}` : ''}
                </button>` : `<button class="cmty-like${p.likedByMe ? ' is-on' : ''}" data-pid="${_escapeHtml(p.id)}">
                    <i class="fa-solid fa-heart"></i> ${p.likeCount || 0}
                </button>`}
                <span class="cmty-count"><i class="fa-solid fa-comment"></i> ${total}</span>
                <button class="cmty-report-btn" data-pid="${_escapeHtml(p.id)}" aria-label="${t('cmty.report') || '举报这条内容'}" title="${t('cmty.report') || '举报'}">
                    <i class="fa-solid fa-flag"></i>
                </button>
            </div>
            ${_cmty.reportPid === p.id ? `<div class="cmty-report-row" role="group" aria-label="举报原因">
                <small>举报原因：</small>
                ${['不当内容', '垃圾广告', '人身攻击', '虚假信息', '其他'].map(reason =>
                    `<button class="cmty-report-reason" data-pid="${_escapeHtml(p.id)}" data-reason="${reason}">${reason}</button>`).join('')}
                <button class="cmty-report-cancel">取消</button>
            </div>` : ''}
            ${comments.length ? `<div class="cmty-comments">
                ${comments.map(cm => `<div class="cmty-comment"><b>${_escapeHtml(cm.author?.name || '')}</b> ${_escapeHtml(cm.content || '')}</div>`).join('')}
            </div>` : ''}
            ${hasMoreComments ? `<button class="cmty-more cmty-more-comments" data-pid="${_escapeHtml(p.id)}"${expanded && expanded.loading ? ' disabled' : ''}>
                ${expanded && expanded.loading ? (t('cmty.loading') || '加载中…') : moreLabel}
            </button>` : ''}
            <div class="cmty-comment-box">
                <input class="cmty-comment-input" data-pid="${_escapeHtml(p.id)}" placeholder="${t('cmty.commentPh') || '写评论…'}">
                <button class="cmty-comment-send" data-pid="${_escapeHtml(p.id)}" aria-label="${t('cmty.send') || '发送'}"><i class="fa-solid fa-paper-plane"></i></button>
            </div>
        </article>`;
    }

    // 面板每次重渲染都重新绑定：DOM 是整段替换的，旧监听器随节点一起销毁。
    function _asstBind(c) {
        const input = c.querySelector('.cmty-asst-input');
        if (!input) return;
        const send = () => { const v = input.value; input.value = ''; _asstSend(v); };
        c.querySelector('.cmty-asst-send')?.addEventListener('click', send);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

        const file = c.querySelector('.cmty-asst-file');
        c.querySelector('.cmty-asst-attach')?.addEventListener('click', () => file?.click());
        file?.addEventListener('change', () => {
            const f = file.files && file.files[0];
            if (!f) return;
            // 与 App 的「单个不超过 50 MB」一致
            if (f.size > 50 * 1024 * 1024) {
                showToast(t('cmty.asstTooLarge') || '附件不能超过 50MB');
                file.value = '';
                return;
            }
            _asst.attachment = f;
            renderCommunityPanel();
            document.querySelector('.cmty-asst-input')?.focus();
        });
        c.querySelector('.cmty-asst-chip-x')?.addEventListener('click', () => {
            _asst.attachment = null;
            renderCommunityPanel();
        });

        c.querySelectorAll('.cmty-asst-ok').forEach(b => {
            b.addEventListener('click', () => _asstConfirm(b.dataset.token));
        });
        c.querySelectorAll('.cmty-asst-cancel').forEach(b => {
            b.addEventListener('click', () => {
                _asst.pending = _asst.pending.filter(a => a.token !== b.dataset.token);
                renderCommunityPanel();
            });
        });
        c.querySelector('.cmty-asst-clear')?.addEventListener('click', () => {
            _asstReset();
            renderCommunityPanel();
        });

        // 语音输入：与慧读输入框同一套 Web Speech API，不支持的浏览器保持隐藏
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        const voiceBtn = c.querySelector('.cmty-asst-voice');
        if (!SR || !voiceBtn) return;
        voiceBtn.classList.remove('hidden');
        voiceBtn.classList.toggle('is-listening', _asst.listening);
        voiceBtn.addEventListener('click', () => {
            if (_asst.listening) { _asstRecognition?.stop(); return; }
            try {
                const rec = new SR();
                _asstRecognition = rec;
                rec.lang = getLang() === 'en' ? 'en-US' : getLang() === 'ko' ? 'ko-KR' : 'zh-CN';
                rec.interimResults = true;
                rec.continuous = false;
                rec.onresult = ev => {
                    let text = '';
                    for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
                    // 直接写 DOM：重渲染会丢掉输入框里的临时结果
                    const box = document.querySelector('.cmty-asst-input');
                    if (box) box.value = text;
                };
                rec.onerror = ev => {
                    _asst.listening = false;
                    if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
                        _asst.voiceError = t('ai.voiceError') || '语音输入失败，请重试';
                    }
                    renderCommunityPanel();
                };
                rec.onend = () => {
                    if (!_asst.listening) return;
                    _asst.listening = false;
                    // 保住识别结果：重渲染前先把文字取出来，渲染后写回
                    const text = document.querySelector('.cmty-asst-input')?.value || '';
                    renderCommunityPanel();
                    const box = document.querySelector('.cmty-asst-input');
                    if (box) { box.value = text; box.focus(); }
                };
                rec.start();
                _asst.listening = true;
                _asst.voiceError = '';
                renderCommunityPanel();
            } catch (e) {
                _asst.listening = false;
                _asst.voiceError = t('ai.voiceError') || '语音输入失败，请重试';
                renderCommunityPanel();
            }
        });
    }
    let _asstRecognition = null;

    // 消息流：在助手栏目的滚动区里展示，输入栏则固定在面板底部
    function _asstThreadHtml() {
        return `<div class="cmty-asst-thread">
            ${_asst.messages.map(m => `<div class="cmty-asst-msg is-${m.role}">${_escapeHtml(m.text).replace(/\n/g, '<br>')}</div>`).join('')}
            ${_asst.pending.map(a => _asstCardHtml(a)).join('')}
            ${_asst.sending ? `<div class="cmty-asst-msg is-assistant is-thinking">${t('cmty.asstThinking') || '正在思考…'}</div>` : ''}
            ${_asst.error ? `<div class="cmty-asst-error" role="alert">${_escapeHtml(_asst.error)}</div>` : ''}
            <button class="cmty-asst-clear">${t('cmty.asstClear') || '清空对话'}</button>
        </div>`;
    }

    function _asstBarHtml() {
        const att = _asst.attachment;
        return `<div class="cmty-asst">
            ${_asst.voiceError ? `<div class="cmty-asst-error" role="alert">${_escapeHtml(_asst.voiceError)}</div>` : ''}
            ${_asst.listening ? `<div class="cmty-asst-status" role="status">${t('ai.voiceListening') || '正在聆听…说完后再点一次麦克风'}</div>` : ''}
            ${att ? `<div class="cmty-asst-chip">
                <i class="fa-solid fa-paperclip"></i>
                <span>${_escapeHtml(att.name)}</span>
                <small>${Math.max(1, Math.round(att.size / 1024))} KB · ${_asstUploadsToLibrary() ? (t('cmty.asstToLibrary') || '待上传到本群知识库') : (t('cmty.asstPrivateOnly') || '仅用于本次私人对话')}</small>
                <button class="cmty-asst-chip-x" aria-label="${t('ai.attachRemove') || '移除附件'}"><i class="fa-solid fa-xmark"></i></button>
            </div>` : ''}
            <div class="cmty-asst-bar">
                <input type="file" class="cmty-asst-file hidden" aria-hidden="true" tabindex="-1">
                <button class="cmty-asst-attach" aria-label="${t('cmty.asstAttach') || '添加附件'}" title="${t('cmty.asstAttach') || '添加附件'}"${_asst.sending ? ' disabled' : ''}>
                    <i class="fa-solid fa-paperclip"></i>
                </button>
                <button class="cmty-asst-voice hidden" aria-label="${t('ai.voiceStart') || '开始语音输入'}" aria-pressed="false"${_asst.sending ? ' disabled' : ''}>
                    <i class="fa-solid fa-microphone"></i>
                </button>
                <input class="cmty-asst-input" maxlength="1200" placeholder="${_escapeHtml(_asstPlaceholder())}"${_asst.sending ? ' disabled' : ''}>
                <button class="cmty-asst-send" aria-label="${t('cmty.send') || '发送'}"${_asst.sending ? ' disabled' : ''}>
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
            <p class="cmty-asst-note">${t('cmty.asstNote') || '重要社群操作需本人确认，并由后台再次校验权限'}</p>
        </div>`;
    }

    function _asstPlaceholder() {
        if (_asst.listening) return t('cmty.asstListening') || '正在聆听…';
        if (_asst.attachment) {
            return _asstUploadsToLibrary()
                ? (t('cmty.asstWithUpload') || '可补充资料说明，发送后上传…')
                : (t('cmty.asstWithFile') || '可补充问题，发送后分析附件…');
        }
        const name = _cmty.workspace?.community?.name || '';
        return (t('cmty.asstPh') || '提问或办理事务') + (name ? ` · ${name}` : '');
    }

    // 确认卡片：把助手要做的改动摊开给用户看清，确认前不落库。
    function _asstCardHtml(a) {
        return `<div class="cmty-asst-card">
            <span class="cmty-asst-kicker">${t('cmty.asstDraft') || '预览草稿'}</span>
            <b>${_escapeHtml(a.title || '')}</b>
            ${a.summary ? `<p>${_escapeHtml(a.summary).replace(/\n/g, '<br>')}</p>` : ''}
            ${(a.fields || []).length ? `<dl class="cmty-asst-fields">
                ${a.fields.map(f => `<div><dt>${_escapeHtml(f.label)}</dt><dd>${_escapeHtml(f.value)}</dd></div>`).join('')}
            </dl>` : ''}
            <div class="cmty-asst-card-actions">
                <button class="cmty-asst-cancel" data-token="${_escapeHtml(a.token)}">${t('cmty.cancel') || '取消'}</button>
                <button class="primary-btn cmty-asst-ok" data-token="${_escapeHtml(a.token)}"${_asst.sending ? ' disabled' : ''}>
                    ${_escapeHtml(a.confirmLabel || (t('cmty.asstConfirm') || '确认执行'))}
                </button>
            </div>
        </div>`;
    }

    // ── 社群助手 ──
    // App 的社群页本身就是助手对话：建活动、邀成员、建小组、传资料都靠一句话办。
    // 网页版右栏窄，所以反过来——动态流留作主界面，助手停靠底部，
    // 回复与确认卡片浮在输入框上方，办完自动刷新动态流。
    // 接口与 App 完全共用 /api/mobile/community/assistant，同一套会话 Cookie。
    const _asst = { messages: [], pending: [], sending: false, error: '', attachment: null, listening: false, voiceError: '' };
    let _asstLastGroup = null;

    function _asstReset() {
        _asst.messages = [];
        _asst.pending = [];
        _asst.sending = false;
        _asst.error = '';
        _asst.attachment = null;
        _asst.voiceError = '';
    }

    // 只把纯文本对话送回服务端作上下文——附件与卡片不进 history。
    function _asstHistory() {
        return _asst.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-10)
            .map(m => ({ role: m.role, content: m.text }));
    }

    async function _asstPost(body, file) {
        const url = `${COMMUNITY_API}/assistant`;
        let options;
        if (file) {
            // 与 App 一致走 FormData：原文件上传，能进社群知识库
            const form = new FormData();
            Object.entries(body).forEach(([k, v]) => {
                form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
            });
            form.append('file', file);
            options = { method: 'POST', body: form };
        } else {
            options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            };
        }
        const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options));
        let data = null;
        try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
        if (!res.ok || !data || data.ok === false) {
            throw new Error((data && data.message) || `HTTP ${res.status}`);
        }
        return data;
    }

    // 助手返回的动作是一张签名草稿：先让用户看清要改什么，确认后才执行。
    function _asstTake(data) {
        if (data.answer) _asst.messages.push({ role: 'assistant', text: data.answer });
        if (data.action) _asst.pending.push(data.action);
        if (data.effect) {
            // 执行产生了实际变更（建了活动、发了内容…），工作台数据重取；
            // 用 _cmtyReload 保住当前栏目与对话，不要整个重开
            if (data.effect.refresh !== false) _cmtyReload();
        }
    }

    // 附件有两条去处，与 App 的判断一致：
    //   能管资料的社群 → 上传进本群知识库（走 /resources/upload）
    //   官方群且无资料权限 → 只作本次私人对话的附件，交给助手分析
    function _asstUploadsToLibrary() {
        return Boolean(_cmty.workspace?.access?.canManageResources);
    }

    async function _asstSend(text) {
        const file = _asst.attachment;
        if ((!text || !text.trim()) && !file) return;
        const message = (text || '').trim();
        const toLibrary = file && _asstUploadsToLibrary();
        _asst.messages.push({
            role: 'user',
            text: file
                ? `${toLibrary ? (t('cmty.asstUpload') || '上传资料') : (t('cmty.asstSendFile') || '发送附件')}：${file.name}${message ? `\n${message}` : ''}`
                : message,
        });
        _asst.sending = true;
        _asst.error = '';
        const history = _asstHistory();
        _asst.attachment = null;   // 请求体已构好，先清掉避免重复发送
        renderCommunityPanel();
        try {
            if (toLibrary) {
                const form = new FormData();
                form.append('file', file);
                form.append('title', file.name.replace(/\.[^.]+$/, '') || file.name);
                form.append('description', message);
                form.append('knowledgeText', message);
                form.append('visibility', 'MEMBERS');
                const res = await fetch(
                    `${COMMUNITY_API}/${encodeURIComponent(_cmty.activeId)}/resources/upload`,
                    { method: 'POST', credentials: 'same-origin', body: form },
                );
                let data = null;
                try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
                if (!res.ok || !data || data.ok === false) {
                    throw new Error((data && data.message) ||
                        (res.status === 413 ? (t('cmty.asstTooLarge') || '文件过大，请选择较小的文件') : `HTTP ${res.status}`));
                }
                _asst.messages.push({ role: 'assistant', text: data.message || (t('cmty.asstUploaded') || '文件已上传到本群知识库') });
            } else {
                const data = await _asstPost(
                    { groupId: _cmty.activeId, message: message || '请阅读并总结这个附件。', history, visibility: 'private' },
                    file,
                );
                _asstTake(data);
            }
        } catch (e) {
            _asst.error = e.message || (t('cmty.asstFail') || '助手暂时无法回答，请稍后再试');
        } finally {
            _asst.sending = false;
            renderCommunityPanel();
        }
    }

    async function _asstConfirm(token) {
        const action = _asst.pending.find(a => a.token === token);
        _asst.sending = true;
        _asst.error = '';
        renderCommunityPanel();
        try {
            const data = await _asstPost({ groupId: _cmty.activeId, confirmationToken: token });
            _asst.pending = _asst.pending.filter(a => a.token !== token);
            _asstTake(data);
            showToast(t('cmty.asstDone') || `已执行：${action ? action.title : ''}`);
        } catch (e) {
            _asst.error = e.message || (t('cmty.asstFail') || '操作执行失败，请重新发起');
        } finally {
            _asst.sending = false;
            renderCommunityPanel();
        }
    }

    async function _cmtyAction(body) {
        return _cmtyFetch(`/${encodeURIComponent(_cmty.activeId)}/workspace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    async function _cmtyPublish(content, verseRef, postType) {
        if (!content) { showToast(t('cmty.needContent') || '请输入内容'); return; }
        try {
            await _cmtyAction({ action: 'CREATE_POST', postType: postType || 'POST', content, verseRef: verseRef || '' });
            _cmty.composerOpen = false;
            showToast(t('cmty.published') || '已发布');
            await _cmtyReload();
        } catch (e) {
            showToast(e.message || (t('cmty.publishFail') || '发布失败'));
        }
    }

    async function _cmtyToggleLike(postId) {
        try {
            await _cmtyAction({ action: 'TOGGLE_LIKE', postId });
            // 局部更新，避免整屏重刷丢失滚动位置
            const post = (_cmty.workspace.posts || []).find(p => p.id === postId);
            if (post) {
                post.likedByMe = !post.likedByMe;
                post.likeCount = Math.max(0, (post.likeCount || 0) + (post.likedByMe ? 1 : -1));
            }
            renderCommunityPanel();
        } catch (e) {
            showToast(e.message || (t('cmty.actionFail') || '操作失败'));
        }
    }

    async function _cmtyComment(postId, content) {
        if (!content) return;
        try {
            // NOTE: posts/[postId]/comments 只有 GET（翻页读取），发评论走 workspace 的 ADD_COMMENT
            await _cmtyAction({ action: 'ADD_COMMENT', postId, content });
            await _cmtyReload();
        } catch (e) {
            showToast(e.message || (t('cmty.commentFail') || '评论失败'));
        }
    }

    // ── 奉献 ──
    // 布局参考微读圣经的奉献页：致辞 + 金额格 + 自定义金额 + 支付方式 + 登录门槛。
    // 支付通道尚未接入商户凭据，提交时如实告知，不伪造成功状态。
    const _donate = { amount: 20, custom: '', method: 'paypal' };

    function renderDonateView() {
        const c = $('donate-render'); if (!c) return;
        const amounts = [5, 10, 20, 50, 100, 200];
        const logged = typeof Auth !== 'undefined' && Auth.getUser();
        const methods = [
            ['paypal', '<i class="fa-brands fa-paypal" style="color:#0070ba"></i> PayPal'],
            ['card', '<i class="fa-solid fa-credit-card"></i> ' + (t('donate.card') || '信用卡')],
        ];
        c.innerHTML = `
        <div class="donate-hero">
            <h2>${t('donate.heroTitle') || '支持慧读圣经'}</h2>
            <p>${t('donate.p1') || '亲爱的弟兄姊妹，'}</p>
            <p>${t('donate.p2') || '慧读圣经致力于帮助人们随时随地阅读、聆听、默想、查考并活出上帝的话语。如果您有感动参与这项事工，可以奉献支持我们——也许一顿午餐的费用，就能帮助更多人接触到上帝的话语。'}</p>
            <p>${t('donate.p3') || '这是一项长期需要，我们期待与您建立稳固的支持伙伴关系。'}</p>
        </div>
        <div class="donate-card">
            <div class="settings-section-title">${t('donate.amount') || '奉献金额'}</div>
            <div class="donate-amounts">
                ${amounts.map(a => `<button class="donate-amt${_donate.amount === a && !_donate.custom ? ' selected' : ''}" data-amt="${a}">${a} USD</button>`).join('')}
            </div>
            <div class="donate-custom">
                <input id="donate-custom-input" type="number" min="2" max="10000" placeholder="${t('donate.customPh') || '2 ≤ 金额 ≤ 10000'}" value="${_escapeHtml(_donate.custom)}">
                <span>USD</span>
            </div>
            <div class="settings-section-title" style="margin-top:18px;">${t('donate.method') || '支付方式'}</div>
            <div class="donate-methods">
                ${methods.map(([k, label]) => `<button class="donate-method${_donate.method === k ? ' selected' : ''}" data-method="${k}">${label}</button>`).join('')}
            </div>
            <button class="primary-btn donate-submit">${logged ? (t('donate.submit') || '确认奉献') : (t('auth.login') || '请登录')}</button>
            <p class="donate-note">${t('donate.note') || '奉献不购买任何数字商品或特权，属自愿支持事工。'}</p>
        </div>`;

        c.querySelectorAll('.donate-amt').forEach(b => {
            b.addEventListener('click', () => {
                _donate.amount = parseInt(b.dataset.amt, 10);
                _donate.custom = '';
                renderDonateView();
            });
        });
        $('donate-custom-input')?.addEventListener('input', e => {
            _donate.custom = e.target.value;
            c.querySelectorAll('.donate-amt').forEach(b => b.classList.remove('selected'));
        });
        c.querySelectorAll('.donate-method').forEach(b => {
            b.addEventListener('click', () => { _donate.method = b.dataset.method; renderDonateView(); });
        });
        c.querySelector('.donate-submit')?.addEventListener('click', () => {
            if (!logged) { Auth.showModal(); return; }
            const val = _donate.custom ? Number(_donate.custom) : _donate.amount;
            if (!Number.isFinite(val) || val < 2 || val > 10000) {
                showToast(t('donate.badAmount') || '请输入 2–10000 之间的金额');
                return;
            }
            // 商户支付尚未开通：如实告知，不做假支付
            showToast(t('donate.comingSoon') || '支付通道即将开通，感谢您的心意 🙏');
        });
    }

    // ── Plan View — Dynamic Reading Plans ──
    let _fetchedPlans = [];
    let _fetchedUserPlans = [];
    
    // We keep this to handle translations for built-in slugs if they match
    function getPlanI18n(plan, lang) {
        if (!plan) return { name: '', desc: ''};
        // If it's the builtin 'mcheyne', we can provide overrides, otherwise just use what came from DB
        const map = {
            mcheyne: { zh: '麦琴一年读经', en: "M'Cheyne 1-Year", ko: '맥체인 1년 성경 읽기' },
            chronological: { zh: '年代顺序通读', en: 'Chronological', ko: '연대기적 성경 통독' },
            nt90: { zh: '90天新约速读', en: 'NT in 90 Days', ko: '90일 신약 속독' },
            psalms30: { zh: '30天诗篇精读', en: 'Psalms in 30 Days', ko: '30일 시편 정독' },
            gospels: { zh: '60天四福音', en: 'Gospels 60 Days', ko: '60일 사복음서' },
            wisdom: { zh: '45天智慧书卷', en: 'Wisdom 45 Days', ko: '45일 지혜서' }
        };
        const descMap = {
            mcheyne: { zh: '每天4段经文，新约和诗篇读两遍，旧约读一遍', en: '4 daily readings, NT & Psalms twice, OT once', ko: '매일 4장, 신약·시편 2회, 구약 1회' },
            chronological: { zh: '按历史时间顺序通读圣经全本', en: 'Read the entire Bible in historical order', ko: '역사적 시간 순서에 따라 성경 전체를 통독' },
            nt90: { zh: '三个月内完成新约全部27卷', en: 'Complete all 27 NT books in 3 months', ko: '3개월 내에 신약 성경 27권 전체를 완료' },
            psalms30: { zh: '一个月带你深度品读诗篇', en: 'A deep month-long journey through Psalms', ko: '한 달 동안 시편을 깊이 묵상하고 음미' },
            gospels: { zh: '两个月精读马太、马可、路加、约翰', en: 'Study Matthew, Mark, Luke & John', ko: '두 달 동안 마태, 마가, 누가, 요한복음 정독' },
            wisdom: { zh: '箴言、传道书、约伯记、雅歌', en: 'Proverbs, Ecclesiastes, Job & Song of Songs', ko: '잠언, 전도서, 욥기, 아가서 정독' }
        };
        if (map[plan.slug]) {
            return { name: map[plan.slug][lang] || map[plan.slug].zh, desc: descMap[plan.slug][lang] || descMap[plan.slug].zh };
        }
        return { 
            name: lang === 'ko' ? (plan.name_ko || plan.name_en || plan.name_zh) : (lang === 'en' && plan.name_en ? plan.name_en : plan.name_zh), 
            desc: lang === 'ko' ? (plan.desc_ko || plan.desc_en || plan.desc_zh) : (lang === 'en' && plan.desc_en ? plan.desc_en : plan.desc_zh)
        };
    }

    let _activePlan = null; // 旧详情视图的遗留状态，新视图不再使用
    const _planExpanded = new Set();   // 展开了日程的计划 id
    let _planViewLoaded = false;
    let _serverPlans = [];   // 来自 /api/mobile/reading-plans：公共 + 我的社群 + 我创建的

    // 与 App 共用同一套读经计划接口（同一个会话 Cookie），
    // 进度存在服务端 enrollment 上，两端打卡互通。
    // 旧版计划页调用的 /api/web/reading-plans 从未实现过，整页一直是空的；
    // 这里直接重接到真实接口，社群共读计划也从这里出现。
    async function fetchPlansFromBackend() {
        try {
            const res = await fetch('/api/mobile/reading-plans', { credentials: 'same-origin' });
            const data = res.ok ? await res.json() : null;
            _serverPlans = (data && data.plans) || [];
        } catch (e) { console.error('Error fetching plans', e); _serverPlans = []; }
        _planViewLoaded = true;
    }

    async function _planAction(body, doneMsg) {
        try {
            const res = await fetch('/api/mobile/reading-plans', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || data.ok === false) throw new Error((data && data.message) || `HTTP ${res.status}`);
            showToast(data.message || doneMsg);
            _planViewLoaded = false;   // 动作成功后重新拉取，进度以服务端为准
            renderPlanView();
        } catch (e) {
            showToast(e.message || (t('plan.actionFail') || '操作失败，请重试'));
        }
    }

    function _planCardHtml(p, lang) {
        const pct = p.totalDays > 0 ? Math.min(100, Math.round((p.completedDays / p.totalDays) * 100)) : 0;
        const t_days = lang === 'en' ? 'days' : lang === 'ko' ? '일' : '天';
        const communityBadge = p.community
            ? `<span class="plan-card-badge is-community">${_escapeHtml(p.community.abbreviation || p.community.name)}</span>` : '';
        const finished = Boolean(p.completedAt);
        // 今日读段：已加入且未完成时给出直达阅读器的入口
        let todayHtml = '';
        if (p.enrolled && !finished && p.today) {
            const bookName = bookDisplayName(p.today.book);
            const range = p.today.verseStart === p.today.verseEnd ? p.today.verseStart : `${p.today.verseStart}-${p.today.verseEnd}`;
            todayHtml = `<button class="plan-today" data-book="${_escapeHtml(p.today.book)}" data-ch="${p.today.chapter}">
                <i class="fa-solid fa-book-open"></i>
                <span>${lang === 'en' ? 'Today' : lang === 'ko' ? '오늘' : '今日'} · ${p.today.title ? _escapeHtml(p.today.title) + ' · ' : ''}${_escapeHtml(bookName)} ${p.today.chapter}:${range}</span>
            </button>`;
        }
        let actionHtml;
        if (finished) {
            actionHtml = `<span class="plan-card-done">✓ ${lang === 'en' ? 'Finished' : lang === 'ko' ? '완료' : '已完成'}</span>`;
        } else if (p.enrolled) {
            actionHtml = `<button class="primary-btn plan-complete-btn" data-plan="${_escapeHtml(p.id)}">${lang === 'en' ? 'Mark today done' : lang === 'ko' ? '오늘 완료' : '完成今天阅读'}</button>`;
        } else {
            actionHtml = `<button class="primary-btn plan-enroll-btn" data-plan="${_escapeHtml(p.id)}">${lang === 'en' ? 'Join' : lang === 'ko' ? '참여' : '加入计划'}</button>`;
        }
        const days = Array.isArray(p.days) ? p.days : [];
        const expanded = _planExpanded.has(p.id);
        const dayList = days.length ? `
            <button class="plan-days-toggle" data-plan="${_escapeHtml(p.id)}">
                ${expanded ? (t('plan.hideDays') || '收起日程') : `${t('plan.allDays') || '全部'} ${days.length} ${t('cmty.planDays') || '天'}`}
                <i class="fa-solid fa-angle-${expanded ? 'up' : 'down'}"></i>
            </button>
            ${expanded ? `<ol class="plan-day-list">
                ${days.map(d => {
                    const done = p.enrolled && d.dayNumber <= p.completedDays;
                    const range = d.verseStart === d.verseEnd ? d.verseStart : `${d.verseStart}-${d.verseEnd}`;
                    return `<li>
                        <button class="plan-day" data-book="${_escapeHtml(d.book)}" data-ch="${d.chapter}">
                            <span class="plan-day-no${done ? ' is-done' : ''}">${done ? '✓' : d.dayNumber}</span>
                            <span class="plan-day-text">
                                ${d.title ? `<b>${_escapeHtml(d.title)}</b>` : ''}
                                <small>${_escapeHtml(bookDisplayName(d.book))} ${d.chapter}:${range}</small>
                            </span>
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </li>`;
                }).join('')}
            </ol>` : ''}` : '';
        return `<div class="plan-scard${finished ? ' is-finished' : ''}">
            <div class="plan-scard-head">
                <b>${_escapeHtml(p.title)}</b>
                ${communityBadge}
                <small>${p.totalDays} ${t_days}</small>
            </div>
            ${p.description ? `<p class="plan-scard-desc">${_escapeHtml(p.description)}</p>` : ''}
            ${p.enrolled ? `<div class="plan-card-progress"><div class="plan-card-progress-bar" style="width:${pct}%"></div></div>
            <span class="plan-card-progress-text">${p.completedDays}/${p.totalDays}${pct >= 100 ? '' : ` · ${pct}%`}</span>` : ''}
            ${todayHtml}
            ${dayList}
            <div class="plan-scard-actions">${actionHtml}</div>
        </div>`;
    }

    async function renderPlanView() {
        const c = $('plan-render'); if (!c) return;
        const lang = typeof getLang === 'function' ? getLang() : 'zh';

        // 未登录：说明这个功能是做什么的，并给出登录入口，而不是把人挡在门外
        if (typeof Auth !== 'undefined' && !Auth.getUser()) {
            const title = lang === 'en' ? 'Sign in to use reading plans'
                : lang === 'ko' ? '로그인하면 읽기 계획을 사용할 수 있습니다' : '登录后使用读经计划';
            const desc = lang === 'en' ? 'Your plan progress syncs across the app and the web.'
                : lang === 'ko' ? '진도는 앱과 웹에서 함께 동기화됩니다.' : '计划进度会在 App 与网页端之间同步。';
            const btn = lang === 'en' ? 'Sign in' : lang === 'ko' ? '로그인' : '登录';
            c.innerHTML = `<div class="no-data-state">
                <i class="fa-solid fa-calendar-check"></i>
                <p>${title}</p>
                <p style="font-size:0.8rem;opacity:0.8;">${desc}</p>
                <button class="primary-btn plan-login-btn" style="margin-top:12px;padding:8px 24px;">${btn}</button>
            </div>`;
            c.querySelector('.plan-login-btn')?.addEventListener('click', () => Auth.showModal());
            return;
        }

        if (!_planViewLoaded) {
            const loadingText = lang === 'en' ? 'Loading...' : lang === 'ko' ? '로딩 중...' : '加载中...';
            c.innerHTML = `<div class="no-data-state"><i class="fa-solid fa-spinner fa-spin"></i><p>${loadingText}</p></div>`;
            await fetchPlansFromBackend();
        }

        const groups = [
            { key: 'COMMUNITY', title: lang === 'en' ? 'Group reading' : lang === 'ko' ? '커뮤니티 통독' : '社群共读', icon: 'fa-user-group' },
            { key: 'PUBLIC', title: lang === 'en' ? 'Public plans' : lang === 'ko' ? '공개 계획' : '公共计划', icon: 'fa-book-bible' },
            { key: 'PERSONAL', title: lang === 'en' ? 'My plans' : lang === 'ko' ? '내 계획' : '我创建的', icon: 'fa-user-pen' },
        ];
        const sections = groups.map(g => {
            const list = _serverPlans.filter(p => p.scope === g.key);
            if (!list.length) return '';
            return `<section class="plan-section">
                <div class="settings-section-title"><i class="fa-solid ${g.icon}"></i> ${g.title}</div>
                ${list.map(p => _planCardHtml(p, lang)).join('')}
            </section>`;
        }).join('');

        c.innerHTML = sections || `<div class="no-data-state"><i class="fa-solid fa-calendar-check"></i>
            <p>${lang === 'en' ? 'No reading plan data available' : lang === 'ko' ? '읽기 계획 데이터가 없습니다' : '暂无相关读经计划数据'}</p></div>`;

        c.querySelectorAll('.plan-enroll-btn').forEach(b => {
            b.addEventListener('click', () => _planAction({ action: 'ENROLL', planId: b.dataset.plan }, '已加入读经计划'));
        });
        c.querySelectorAll('.plan-complete-btn').forEach(b => {
            b.addEventListener('click', () => _planAction({ action: 'COMPLETE_TODAY', planId: b.dataset.plan }, '今天的阅读已完成'));
        });
        c.querySelectorAll('.plan-days-toggle').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.plan;
                if (_planExpanded.has(id)) _planExpanded.delete(id); else _planExpanded.add(id);
                renderPlanView();
            });
        });
        c.querySelectorAll('.plan-day').forEach(b => {
            b.addEventListener('click', () => navigateTo(b.dataset.book, parseInt(b.dataset.ch, 10) || 1));
        });
        c.querySelectorAll('.plan-today').forEach(b => {
            b.addEventListener('click', () => {
                navigateTo(b.dataset.book, parseInt(b.dataset.ch, 10) || 1);   // 内部会自动切回阅读视图
            });
        });
    }

    function getPlanImpl(slug) {
        if (slug === 'mcheyne' && window.McCheyne) return window.McCheyne;
        const pData = _fetchedPlans.find(p => p.slug === slug);
        if (!pData || (!pData.schedule || pData.schedule.length === 0)) return null;
        if (!pData.pm) {
           pData.pm = new window.PlanManager(pData);
        }
        return pData.pm;
    }

    function renderGenericPlanDetail(c, lang) {
        const M = getPlanImpl(_activePlan);
        const planData = _fetchedPlans.find(p => p.slug === _activePlan) || { name_zh: '读经计划', days: 365, id: 0 };
        if (!M) {
            const loadingText = lang === 'en' ? 'Loading...' : lang === 'ko' ? '로딩 중...' : '加载中...';
            c.innerHTML = `<div class="no-data-state"><i class="fa-solid fa-spinner fa-spin"></i><p>${loadingText}</p></div>`;
            return;
        }

        const startDate = M.getStartDate();

        // ── No plan started yet: auto-start with today's date ──
        if (!startDate) {
            const today = localDateKey();
            M.setStartDate(today);
            
            // Sync start to backend if logged in
            if (window.Auth && Auth.getUser()) {
                if (planData && planData.id) {
                    fetch(`${S.apiBase}/user/reading-plans/${planData.id}/start`, {
                        method: 'POST',
                        credentials: 'same-origin'
                    }).catch(e => console.error(e));
                }
            }
            
            renderGenericPlanDetail(c, lang);
            return;
        }

        // ── Plan active: show dashboard ──
        const todayDay = M.getPlanDayNumber(startDate);
        const progress = M.getProgress();
        const completedDays = M.countCompletedDays();
        const totalD = planData.days || 365;
        const pct = Math.min(100, Math.max(0, Math.round((completedDays / totalD) * 100)));

        // Get today's readings
        const todayReadings = M.getReadingsForDay(todayDay);
        const todayProgress = progress[todayDay] || [false, false, false, false];

        // Get next 5 days
        const upcoming = M.getReadingRange(todayDay + 1, 5);

        const t_title = getPlanI18n(planData, lang).name;
        const fmtDay = (d) => lang === 'en' ? `Day ${d}` : lang === 'ko' ? `${d}일` : `第${d}天`;
        const t_today = lang === 'en' ? "Today's Readings" : lang === 'ko' ? '오늘의 읽기' : '今日读经';
        const t_pct = lang === 'en' ? 'completed' : lang === 'ko' ? '완료' : '已完成';
        const t_upcoming = lang === 'en' ? 'Upcoming' : lang === 'ko' ? '이후 일정' : '近期安排';
        const t_reset = lang === 'en' ? 'Reset Plan' : lang === 'ko' ? '초기화' : '重置计划';
        const t_nav = lang === 'en' ? 'Read' : lang === 'ko' ? '읽기' : '阅读';

        const streamIcons = ['fa-users', 'fa-users', 'fa-user', 'fa-user'];
        const streamColors = ['plan-stream-1', 'plan-stream-2', 'plan-stream-3', 'plan-stream-4'];

        const t_back = lang === 'en' ? 'All Plans' : lang === 'ko' ? '전체 계획' : '全部计划';
        const t_done_title = lang === 'en' ? 'Unmark Done' : lang === 'ko' ? '완료 취소' : '取消完成';
        const t_undone_title = lang === 'en' ? 'Mark Done' : lang === 'ko' ? '완료로 표시' : '标记完成';
        const separator = lang === 'zh' ? '，' : ', ';

        c.innerHTML = `
        <div class="plan-header">
            <div class="plan-title-row">
                <div style="display:flex;align-items:center;gap:10px;">
                    <button class="plan-back-btn" id="plan-back-btn" title="${t_back}">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <div class="plan-title"><i class="fa-solid fa-calendar-check"></i> ${t_title}</div>
                        <div class="plan-subtitle">${fmtDay(todayDay)} / ${totalD}</div>
                    </div>
                </div>
                </div>
                <button class="plan-reset-btn" id="plan-reset-btn" title="${t_reset}">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
            <div class="plan-progress-wrap">
                <div class="plan-progress-bar">
                    <div class="plan-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="plan-progress-label">${completedDays} / ${totalD} ${t_pct} (${pct}%)</div>
            </div>
        </div>

        <div class="plan-today-section">
            <div class="plan-section-label"><i class="fa-solid fa-sun"></i> ${t_today}</div>
            <div class="plan-reading-list" id="plan-today-readings">
                ${todayReadings.map((r, i) => {
                    const rBook = r.book || r.b;
                    const rChapter = r.chapter || r.c;
                    const label = M.getReadingLabel ? (M.getReadingLabel.length >= 3 ? M.getReadingLabel(rBook, rChapter, lang) : M.getReadingLabel(r, lang)) : `${rBook} ${rChapter}`;
                    const streamLabel = M.getStreamLabel ? M.getStreamLabel(r.stream, lang) : (lang === 'en' ? 'Reading ' : lang === 'ko' ? '읽기 ' : '阅读 ') + (i + 1);
                    const done = todayProgress[i];
                    return `<div class="plan-reading-item ${done ? 'plan-reading-done' : ''}" data-day="${todayDay}" data-idx="${i}">
                        <button class="plan-check-btn ${done ? 'checked' : ''}" data-day="${todayDay}" data-idx="${i}" title="${done ? t_done_title : t_undone_title}">
                            <i class="fa-solid fa-${done ? 'circle-check' : 'circle'}"></i>
                        </button>
                        <div class="plan-reading-info">
                            <div class="plan-reading-label ${streamColors[i] || ''}">
                                <i class="fa-solid ${streamIcons[i] || 'fa-book'}"></i> ${streamLabel}
                            </div>
                            <div class="plan-reading-title">${label}</div>
                        </div>
                        <button class="plan-nav-btn" data-book="${rBook}" data-chapter="${rChapter}" title="${t_nav}">
                            <i class="fa-solid fa-book-open"></i>
                        </button>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <div class="plan-upcoming-section">
            <div class="plan-section-label"><i class="fa-solid fa-calendar-days"></i> ${t_upcoming}</div>
            <div class="plan-upcoming-list">
                ${upcoming.map(({day, readings}) => {
                    const dayProg = progress[day] || [false, false, false, false];
                    const doneCnt = dayProg.filter(Boolean).length;
                    const refs = readings.map(r => {
                        const rBook = r.book || r.b;
                        const rChapter = r.chapter || r.c;
                        if (M.getReadingLabel && M.getReadingLabel.length >= 3) return M.getReadingLabel(rBook, rChapter, lang);
                        if (M.getReadingLabel) return M.getReadingLabel(r, lang);
                        return `${rBook} ${rChapter}`;
                    }).join(separator);
                    return `<div class="plan-upcoming-item">
                        <div class="plan-upcoming-day">${fmtDay(day)}</div>
                        <div class="plan-upcoming-refs">${refs}</div>
                        ${doneCnt > 0 ? `<div class="plan-upcoming-done-badge">${doneCnt}/${readings.length}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;

        // ── Attach events ──
        // Check/uncheck reading
        c.querySelectorAll('.plan-check-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = +btn.dataset.day;
                const idx = +btn.dataset.idx;
                const newState = M.toggleReading(day, idx);

                // Sync progress to backend if logged in
                if (window.Auth && Auth.getUser()) {
                    if (planData && planData.id) {
                        const newCompletedDays = M.countCompletedDays();
                        fetch(`${S.apiBase}/user/reading-plans/${planData.id}/progress`, {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ current_day: newCompletedDays })
                        }).catch(e => console.error(e));
                    }
                }

                // Re-render the plan
                renderPlanView();
            });
        });

        // Navigate to chapter
        c.querySelectorAll('.plan-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const book = btn.dataset.book;
                const chapter = btn.dataset.chapter;
                if (typeof navigateTo === 'function') {
                    navigateTo(book, chapter);
                    switchView('reading');
                    // Close mobile panel if open
                    if (window.innerWidth <= 768) {
                        $('study-panel')?.classList.remove('mobile-open');
                        $('mobile-overlay')?.classList.add('hidden');
                    }
                }
            });
        });

        // Back to plan grid
        $('plan-back-btn')?.addEventListener('click', () => {
            _activePlan = null;
            renderPlanView();
        });

        // Reset plan
        $('plan-reset-btn')?.addEventListener('click', async () => {
            const currentLang = typeof getLang === 'function' ? getLang() : 'zh';
            const title = currentLang === 'en' ? 'Reset Plan' : currentLang === 'ko' ? '계획 초기화' : '重置计划';
            const confirmMsg = lang === 'en' ? 'Reset reading plan? Your progress will be lost.' :
                               lang === 'ko' ? '읽기 계획을 초기화하시겠습니까?' :
                               '确认重置读经计划？进度将会清除。';
            const confirmed = await window.showConfirmDialog(title, confirmMsg);
            if (confirmed) {
                M.resetPlan();
                renderPlanView();
            }
        });
    }

    // ── Plan Setup Wizard ──
    function renderPlanSetup(c, M, lang) {
        const today = localDateKey();
        const t_setup = lang === 'en' ? "Start M'Cheyne Reading Plan" : lang === 'ko' ? '맥체인 읽기 계획 시작' : '开始麦琴读经计划';
        const t_desc = lang === 'en'
            ? "Read through the entire Bible in one year with 4 daily chapters. NT & Psalms twice, OT once."
            : lang === 'ko'
            ? '매일 4장씩, 1년 안에 성경 전체를 읽습니다. 신약과 시편은 두 번, 구약은 한 번.'
            : '每天4段经文，一年读完全本圣经。新约和诗篇读两遍，旧约读一遍。';
        const t_start = lang === 'en' ? 'Start Date' : lang === 'ko' ? '시작일' : '开始日期';
        const t_btn = lang === 'en' ? 'Start Plan' : lang === 'ko' ? '계획 시작' : '开始计划';
        const t_preview = lang === 'en' ? 'Day 1 Reading Preview' : lang === 'ko' ? '1일차 읽기 미리보기' : '第1天读经预览';

        const preview = M.getReadingsForDay(1);
        const previewHtml = preview.map((r, i) => {
            const label = M.getReadingLabel(r.book, r.chapter, lang);
            const sl = M.getStreamLabel(r.stream, lang);
            return `<div class="plan-setup-preview-item"><span class="plan-stream-dot plan-stream-${i+1}"></span>${sl}: <strong>${label}</strong></div>`;
        }).join('');

        const t_back = lang === 'en' ? '← All Plans' : lang === 'ko' ? '← 전체 계획' : '← 全部计划';
        c.innerHTML = `
        <div class="plan-setup-back"><a href="#" id="plan-setup-back">${t_back}</a></div>
        <div class="plan-setup-card">
            <div class="plan-setup-icon"><i class="fa-solid fa-book-open-reader"></i></div>
            <h2 class="plan-setup-title">${t_setup}</h2>
            <p class="plan-setup-desc">${t_desc}</p>

            <div class="plan-setup-preview">
                <div class="plan-setup-preview-label">
                    <i class="fa-solid fa-calendar-day"></i> ${t_preview}
                </div>
                ${previewHtml}
            </div>

            <div class="plan-setup-field">
                <label class="plan-setup-label" for="plan-start-date">${t_start}</label>
                <input type="date" id="plan-start-date" class="plan-date-input" value="${today}" max="${today}">
            </div>

            <button class="plan-setup-btn" id="plan-start-btn">
                <i class="fa-solid fa-play"></i> ${t_btn}
            </button>
        </div>`;

        $('plan-start-btn')?.addEventListener('click', () => {
            const dateVal = $('plan-start-date').value;
            if (!dateVal) return;
            M.setStartDate(dateVal);
            renderPlanView();
        });
        $('plan-setup-back')?.addEventListener('click', (e) => {
            e.preventDefault();
            _activePlan = null;
            renderPlanView();
        });
    }

    // ── Video View ──
    let VIDEO_DATA = [];
    let _videoLoaded = false;

    let _videoFilter = '全部';
    let _activeVideo = null;

    function renderVideoView() {
        const c = $('video-render'); if (!c) return;

        if (!_videoLoaded) {
            c.innerHTML = '<div style="padding:40px;text-align:center;color:#999;"><i class="fa-solid fa-spinner fa-spin"></i> 加载视频资源中...</div>';
            fetch(`${S.apiBase}/media?media_type=video`).then(r => r.json()).then(data => {
                VIDEO_DATA = data.map(v => ({
                    id: v.id, title: v.title, series: v.series, category: v.category,
                    dur: v.duration, teacher: v.teacher, desc: v.description, gradient: v.cover_style
                }));
                _videoLoaded = true;
                renderVideoView();
            }).catch(err => {
                console.error(err);
                c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">资源加载失败，请稍后重试。</div>';
            });
            return;
        }

        // If a video is active, show player
        if (_activeVideo) {
            renderVideoPlayer(c, _activeVideo);
            return;
        }

        const categories = ['全部', '旧约', '新约', '专题'];
        const filtered = _videoFilter === '全部' ? VIDEO_DATA : VIDEO_DATA.filter(v => v.category === _videoFilter);

        // Group by series
        const groups = {};
        filtered.forEach(v => {
            if (!groups[v.series]) groups[v.series] = [];
            groups[v.series].push(v);
        });

        c.innerHTML = `
        <div class="mv-header">
            <div class="mv-tabs">
                ${categories.map(cat => `<button class="mv-tab ${cat === _videoFilter ? 'active' : ''}" data-cat="${cat}">${cat}</button>`).join('')}
            </div>
            <div class="mv-count">${filtered.length} 个视频</div>
        </div>
        ${filtered.length === 0 ? `<div class="no-data-state">
            <i class="fa-solid fa-circle-play"></i>
            <p>${t('media.emptyVideo') || '暂无视频内容'}</p>
        </div>` : ''}
        ${Object.entries(groups).map(([series, items]) => `
            <div class="mv-section">
                <div class="mv-section-title"><i class="fa-solid fa-folder-open"></i> ${series}</div>
                <div class="media-grid">
                    ${items.map(v => `
                    <div class="media-card" data-vid="${v.id}">
                        <div class="media-thumb" style="background:${v.gradient};">
                            <div class="media-play-btn"><i class="fa-solid fa-circle-play"></i></div>
                            <div class="media-duration">${v.dur}</div>
                        </div>
                        <div class="media-info">
                            <div class="media-series">${v.series}</div>
                            <div class="media-title">${v.title}</div>
                            <div class="media-teacher"><i class="fa-solid fa-user"></i> ${v.teacher}</div>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        `).join('')}`;

        // Category tab clicks
        c.querySelectorAll('.mv-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                _videoFilter = tab.dataset.cat;
                renderVideoView();
            });
        });

        // Video card clicks
        c.querySelectorAll('.media-card[data-vid]').forEach(card => {
            card.addEventListener('click', () => {
                _activeVideo = VIDEO_DATA.find(v => v.id === card.dataset.vid);
                renderVideoView();
            });
        });
    }

    function renderVideoPlayer(c, video) {
        c.innerHTML = `
        <div class="vp-container">
            <div class="vp-back-row">
                <button class="vp-back-btn" id="vp-back"><i class="fa-solid fa-arrow-left"></i> 返回视频列表</button>
            </div>
            <div class="vp-player-wrap">
                <div class="vp-player" style="background:${video.gradient};">
                    <div class="vp-player-overlay" id="vp-overlay">
                        <button class="vp-big-play" id="vp-play-btn"><i class="fa-solid fa-play"></i></button>
                    </div>
                    <div class="vp-controls" id="vp-controls" style="display:none;">
                        <button class="vp-ctrl-btn" id="vp-toggle"><i class="fa-solid fa-pause"></i></button>
                        <div class="vp-progress-wrap" id="vp-progress-wrap">
                            <div class="vp-progress-bar"><div class="vp-progress-fill" id="vp-fill" style="width:0%"></div></div>
                        </div>
                        <span class="vp-time" id="vp-time">00:00 / ${video.dur}</span>
                        <button class="vp-ctrl-btn" id="vp-fullscreen"><i class="fa-solid fa-expand"></i></button>
                    </div>
                </div>
            </div>
            <div class="vp-info">
                <div class="vp-series-badge">${video.series}</div>
                <h2 class="vp-title">${video.title}</h2>
                <div class="vp-meta">
                    <span><i class="fa-solid fa-user"></i> ${video.teacher}</span>
                    <span><i class="fa-solid fa-clock"></i> ${video.dur}</span>
                    <span><i class="fa-solid fa-tag"></i> ${video.category}</span>
                </div>
                <p class="vp-desc">${video.desc}</p>
            </div>
            <div class="vp-related">
                <div class="vp-related-title"><i class="fa-solid fa-list"></i> 同系列视频</div>
                <div class="vp-related-list">
                    ${VIDEO_DATA.filter(v => v.series === video.series && v.id !== video.id).map(v => `
                    <div class="vp-related-item" data-vid="${v.id}">
                        <div class="vp-related-thumb" style="background:${v.gradient};"><i class="fa-solid fa-play"></i></div>
                        <div class="vp-related-info">
                            <div class="vp-related-name">${v.title}</div>
                            <div class="vp-related-dur">${v.dur}</div>
                        </div>
                    </div>`).join('') || '<div style="color:var(--text-tertiary);font-size:0.85rem;padding:8px 0;">暂无其他同系列视频</div>'}
                </div>
            </div>
        </div>`;

        // Back button
        $('vp-back')?.addEventListener('click', () => { _activeVideo = null; renderVideoView(); });

        // Simulated playback
        let playing = false;
        let progress = 0;
        let interval = null;
        const totalSec = parseDur(video.dur);

        $('vp-play-btn')?.addEventListener('click', () => {
            playing = true;
            $('vp-overlay').style.display = 'none';
            $('vp-controls').style.display = 'flex';
            interval = setInterval(() => {
                progress = Math.min(progress + 1, totalSec);
                $('vp-fill').style.width = (progress / totalSec * 100) + '%';
                $('vp-time').textContent = fmtSec(progress) + ' / ' + video.dur;
                if (progress >= totalSec) { clearInterval(interval); playing = false; }
            }, 1000);
        });

        $('vp-toggle')?.addEventListener('click', () => {
            if (playing) { clearInterval(interval); playing = false; $('vp-toggle').innerHTML = '<i class="fa-solid fa-play"></i>'; }
            else { playing = true; $('vp-toggle').innerHTML = '<i class="fa-solid fa-pause"></i>';
                interval = setInterval(() => {
                    progress = Math.min(progress + 1, totalSec);
                    $('vp-fill').style.width = (progress / totalSec * 100) + '%';
                    $('vp-time').textContent = fmtSec(progress) + ' / ' + video.dur;
                    if (progress >= totalSec) { clearInterval(interval); playing = false; }
                }, 1000);
            }
        });

        $('vp-progress-wrap')?.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            progress = Math.round(pct * totalSec);
            $('vp-fill').style.width = (progress / totalSec * 100) + '%';
            $('vp-time').textContent = fmtSec(progress) + ' / ' + video.dur;
        });

        // Related video clicks
        c.querySelectorAll('.vp-related-item').forEach(item => {
            item.addEventListener('click', () => {
                clearInterval(interval);
                _activeVideo = VIDEO_DATA.find(v => v.id === item.dataset.vid);
                renderVideoView();
            });
        });
    }

    function parseDur(d) { const p = d.split(':').map(Number); return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*60+p[1]; }
    function fmtSec(s) { const m = Math.floor(s/60); const sec = s%60; return String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0'); }

    // ══════════════════════════════════════════════════════════
    //  百科 (Encyclopedia) View — 词典 / 影音 / 文章 / 灵修
    // ══════════════════════════════════════════════════════════
    const _encState = { tab: 'all', letter: 'all', activeEntry: null, expanded: {}, dictQuery: '', playingMedia: null };
    const _encCache = {};          // { dictionary:[], article:[], devotional:[] }
    let _encMedia = null;          // 复用 /api/media 结果
    const _encDictContent = {};    // 词典展开时按需拉取的完整词条(含释义) id->entry，缓存避免重复请求
    const _ENC_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

    // 按当前界面语言取三语字段，缺则回退 zh→en→ko
    function encPick(entry, field) {
        const lang = (typeof getLang === 'function' ? getLang() : 'zh');
        return entry[`${field}_${lang}`] || entry[`${field}_zh`] || entry[`${field}_en`] || entry[`${field}_ko`] || '';
    }

    // ── 中文书卷简称 → code 映射（用于解析词典里的经文引用，如「可14:36」「代上27:30」）──
    // 含常见简称与全名首字，覆盖 66 卷。多字简称(代上/帖前等)需放前面优先匹配。
    const CN_BOOK_ABBR = {
        '创': 'gen', '出': 'exo', '利': 'lev', '民': 'num', '申': 'deu',
        '书': 'jos', '士': 'jdg', '得': 'rut',
        '撒上': '1sa', '撒下': '2sa', '王上': '1ki', '王下': '2ki',
        '代上': '1ch', '代下': '2ch', '拉': 'ezr', '尼': 'neh', '斯': 'est',
        '伯': 'job', '诗': 'psa', '箴': 'pro', '传': 'ecc', '歌': 'sng',
        '赛': 'isa', '耶': 'jer', '哀': 'lam', '结': 'ezk', '但': 'dan',
        '何': 'hos', '珥': 'jol', '摩': 'amo', '俄': 'oba', '拿': 'jon',
        '弥': 'mic', '鸿': 'nah', '哈': 'hab', '番': 'zep', '该': 'hag',
        '亚': 'zec', '玛': 'mal',
        '太': 'mat', '可': 'mrk', '路': 'luk', '约': 'jhn', '徒': 'act',
        '罗': 'rom', '林前': '1co', '林后': '2co', '加': 'gal', '弗': 'eph',
        '腓': 'php', '西': 'col', '帖前': '1th', '帖后': '2th',
        '提前': '1ti', '提后': '2ti', '多': 'tit', '门': 'phm',
        '来': 'heb', '雅': 'jas', '彼前': '1pe', '彼后': '2pe',
        '约一': '1jn', '约二': '2jn', '约三': '3jn', '犹': 'jud', '启': 'rev',
    };
    // 多字简称优先（按长度降序），避免「林前」被「林」之类误截
    const _abbrByLen = Object.keys(CN_BOOK_ABBR).sort((a, b) => b.length - a.length);
    // 匹配「书名+章:节」引用：书名(1-2字) + 数字章 + : + 数字节(可带 ,- 等续节)
    const _refRegex = new RegExp('(' + _abbrByLen.join('|') + ')(\\d+):(\\d+)', 'g');

    // 把释义文本里的经文引用包成可点击链接（输入须为已 HTML 转义的文本）
    function linkifyVerseRefs(escapedText) {
        return escapedText.replace(_refRegex, (m, abbr, ch, vs) => {
            const code = CN_BOOK_ABBR[abbr];
            if (!code) return m;
            return `<a class="enc-verse-ref" data-book="${code}" data-ch="${ch}" data-vs="${vs}">${m}</a>`;
        });
    }

    // 词典/释义里点击经文引用 → 跳到圣经阅读对应章并选中高亮该节
    window.gotoVerseRef = function (book, chapter, verse) {
        switchView('reading');
        navigateTo(book, String(chapter));
        const ref = `${book}-${chapter}-${verse}`;
        // 轮询等待本章渲染出目标节，替代固定 350ms：慢设备/大章节也能命中，快设备更早响应
        let tries = 0;
        const MAX_TRIES = 30;   // 30 × 90ms ≈ 2.7s 上限
        const apply = (el) => {
            S.selection.clear();
            S.selection.add(ref);
            S.lastRef = ref;
            if (typeof renderVerseStates === 'function') renderVerseStates();
            if (typeof updateSelectionBar === 'function') updateSelectionBar();
            if (typeof updateStudyPanel === 'function') updateStudyPanel();
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        const tick = () => {
            const el = document.querySelector(`.verse[data-ref="${ref}"]`);
            if (el) { apply(el); return; }
            if (tries++ >= MAX_TRIES) { apply(null); return; }  // 超时也设好选中态，仅跳过滚动
            setTimeout(tick, 90);
        };
        setTimeout(tick, 60);
    };

    async function _encFetch(entryType) {
        if (_encCache[entryType]) return _encCache[entryType];
        try {
            const res = await fetch(`${S.apiBase}/encyclopedia/entries?entry_type=${entryType}`);
            const data = await res.json();
            _encCache[entryType] = Array.isArray(data) ? data : [];
        } catch (e) {
            // 失败不写缓存：下次进入该栏目会重新请求，而不是永远显示“暂无内容”
            console.error('enc fetch failed', entryType, e);
            return [];
        }
        return _encCache[entryType];
    }

    // 前台词典分页/搜索：轻量(不含释义长文)。避免一次性拉取数千条全量正文导致超时。
    async function _encFetchDictPage({ q, letter, limit, withContent } = {}) {
        const sp = new URLSearchParams({ entry_type: 'dictionary', limit: String(limit || 80) });
        if (q) sp.set('q', q);
        if (letter && letter !== 'all') sp.set('letter', letter);
        if (withContent) sp.set('with_content', '1');
        try {
            const res = await fetch(`${S.apiBase}/encyclopedia/dict?${sp.toString()}`);
            const data = await res.json();
            return { total: data.total || 0, items: Array.isArray(data.items) ? data.items : [] };
        } catch (e) {
            console.error('enc dict page failed', e);
            return { total: 0, items: [] };
        }
    }

    async function _encFetchMedia() {
        if (_encMedia) return _encMedia;
        try {
            const res = await fetch(`${S.apiBase}/media`);
            const data = await res.json();
            _encMedia = Array.isArray(data) ? data : [];
        } catch (e) {
            // 失败不写缓存，下次重新请求
            console.error('media fetch failed', e);
            return [];
        }
        return _encMedia;
    }

    function renderEncyclopediaView() {
        const c = $('encyclopedia-render');
        if (!c) return;

        // 详情阅读态（文章/灵修）
        if (_encState.activeEntry) {
            _encRenderReader(c, _encState.activeEntry);
            return;
        }

        const tabs = [
            { key: 'all', label: t('enc.all') || '全部' },
            { key: 'dictionary', label: t('enc.dictionary') || '词典' },
            { key: 'media', label: t('enc.media') || '影音' },
            { key: 'article', label: t('enc.article') || '文章' },
            { key: 'devotional', label: t('enc.devotional') || '灵修' },
        ];

        c.innerHTML = `
        <div class="mv-header">
            <div class="mv-tabs">
                ${tabs.map(tb => `<button class="mv-tab ${tb.key === _encState.tab ? 'active' : ''}" data-enctab="${tb.key}">${tb.label}</button>`).join('')}
            </div>
        </div>
        <div id="enc-body"></div>`;

        c.querySelectorAll('.mv-tab[data-enctab]').forEach(tab => {
            tab.addEventListener('click', () => {
                _encState.tab = tab.dataset.enctab;
                _encState.letter = 'all';
                _encState.playingMedia = null;   // 切标签时停止/退出播放器
                _encState.activeEntry = null;    // 退出文章/灵修详情态
                renderEncyclopediaView();
            });
        });

        const body = c.querySelector('#enc-body');
        const tab = _encState.tab;
        if (tab === 'dictionary') _encRenderDictionary(body);
        else if (tab === 'media') _encRenderMedia(body);
        else if (tab === 'article') _encRenderArticleList(body, 'article');
        else if (tab === 'devotional') _encRenderArticleList(body, 'devotional');
        else _encRenderAll(body);
    }

    function _encLoading(el) {
        el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    }
    function _encEmpty() {
        return `<div class="empty-state"><i class="fa-solid fa-book-open"></i><p>${t('enc.empty') || '暂无内容'}</p></div>`;
    }

    // 在词名里高亮搜索命中（输入须为已转义文本）
    function _encHighlightTerm(escapedTitle, q) {
        if (!q) return escapedTitle;
        try {
            return escapedTitle.replace(new RegExp('(' + _escapeRegExp(q) + ')', 'gi'), '<mark class="note-hl">$1</mark>');
        } catch (e) { return escapedTitle; }
    }

    // 词条释义 HTML（来自已加载的完整词条）
    function _encDictDefHTML(full) {
        if (!full) return '';
        return linkifyVerseRefs(escapeNoteHTML(encPick(full, 'content'))).replace(/\n/g, '<br>');
    }

    // 渲染词条卡片（列表项轻量、无释义；释义在展开时按需拉取并缓存）
    function _encDictItemHTML(x, q) {
        const open = !!_encState.expanded[x.id];
        const title = _encHighlightTerm(escapeNoteHTML(encPick(x, 'title')), q);
        // 列表项可能不含 content（轻量）；若已缓存完整词条则直接渲染释义
        const full = _encDictContent[x.id] || ((x.content_zh || x.content_en || x.content_ko) ? x : null);
        return `
        <div class="enc-dict-item ${open ? 'open' : ''}" data-did="${x.id}">
            <div class="enc-dict-term">
                <span>${title}</span>
                <i class="fa-solid fa-chevron-down enc-dict-chevron"></i>
            </div>
            <div class="enc-dict-def">${_encDictDefHTML(full)}</div>
        </div>`;
    }

    // 绑定释义内经文引用跳转
    function _encBindVerseRefs(container) {
        container.querySelectorAll('.enc-verse-ref[data-book]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.stopPropagation();
                window.gotoVerseRef(a.dataset.book, a.dataset.ch, a.dataset.vs);
            });
        });
    }

    // 展开/收起词条；首次展开按需拉取完整释义
    async function _encToggleDictItem(item) {
        const id = item.dataset.did;
        const willOpen = !_encState.expanded[id];
        _encState.expanded[id] = willOpen;
        item.classList.toggle('open', willOpen);
        if (!willOpen) return;
        const defEl = item.querySelector('.enc-dict-def');
        if (!defEl || defEl.innerHTML.trim()) return;   // 已有释义则无需拉取
        defEl.innerHTML = '<span class="enc-dict-loading">…</span>';
        try {
            const res = await fetch(`${S.apiBase}/encyclopedia/entries/${id}`);
            const full = await res.json();
            _encDictContent[id] = full;
            defEl.innerHTML = _encDictDefHTML(full);
            _encBindVerseRefs(defEl);
        } catch (e) {
            console.error('enc entry fetch failed', e);
            defEl.innerHTML = '';
            _encState.expanded[id] = false;
            item.classList.remove('open');
        }
    }

    // ── 词典：搜索框 + 首字母索引 + 词条展开 ──
    // NOTE: 搜索框只渲染一次（放进持久容器），输入时仅重渲染结果区 #enc-dict-body，
    // 这样输入框 DOM 不会被销毁，中文输入法的「组字」过程不会被打断。
    async function _encRenderDictionary(el) {
        // 不再一次性拉取全部词条：搜索框常驻，结果区按需向后端分页/搜索
        const q0 = (_encState.dictQuery || '').trim();
        el.innerHTML = `
        <div class="enc-dict-search">
            <i class="fa-solid fa-magnifying-glass enc-dict-search-icon"></i>
            <input type="text" id="enc-dict-search-input" class="enc-dict-search-input"
                name="dict-search" autocomplete="off" autocorrect="off" autocapitalize="off"
                spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other"
                placeholder="${t('enc.searchDict') || '搜索词条…'}" value="${escapeNoteHTML(_encState.dictQuery || '')}">
            <button type="button" class="enc-dict-search-clear ${q0 ? '' : 'hidden'}" id="enc-dict-search-clear" title="清除"><i class="fa-solid fa-circle-xmark"></i></button>
        </div>
        <div id="enc-dict-body"></div>`;

        const input = el.querySelector('#enc-dict-search-input');
        const clearBtn = el.querySelector('#enc-dict-search-clear');
        let composing = false;   // 输入法组字中标记

        const applyFilter = () => {
            _encState.dictQuery = input.value;
            _encState.letter = 'all';
            if (clearBtn) clearBtn.classList.toggle('hidden', !input.value.trim());
            _encRenderDictBody(el);   // 只刷新结果区，不动输入框
        };

        if (input) {
            // 组字期间不过滤，组字结束(选定中文)再过滤
            input.addEventListener('compositionstart', () => { composing = true; });
            input.addEventListener('compositionend', () => { composing = false; applyFilter(); });
            input.addEventListener('input', () => { if (!composing) applyFilter(); });
        }
        if (clearBtn) clearBtn.addEventListener('click', () => {
            _encState.dictQuery = '';
            if (input) { input.value = ''; input.focus(); }
            clearBtn.classList.add('hidden');
            _encRenderDictBody(el);
        });

        _encRenderDictBody(el);
    }

    // 只渲染词典结果区（字母条/分组 或 搜索结果）+ 绑定其内部事件
    async function _encRenderDictBody(el) {
        const bodyEl = el.querySelector('#enc-dict-body');
        if (!bodyEl) return;
        const input = el.querySelector('#enc-dict-search-input');
        const clearBtn = el.querySelector('#enc-dict-search-clear');
        const q = (_encState.dictQuery || '').trim();
        const active = _encState.letter;
        const _lang = (typeof getLang === 'function' ? getLang() : 'zh');

        // 搜索态高亮哪个字母都不选中；浏览态高亮当前字母
        const letterBar = `
            <div class="enc-letter-bar">
                ${_ENC_LETTERS.map(L => `<button class="enc-letter ${(!q && active === L) ? 'active' : ''}" data-letter="${L}">${L}</button>`).join('')}
            </div>`;

        // 渲染后统一绑定事件（字母条、词条展开、经文引用）
        const bindBody = () => {
            bodyEl.querySelectorAll('.enc-letter[data-letter]').forEach(b => {
                b.addEventListener('click', () => {
                    _encState.letter = b.dataset.letter;
                    _encState.dictQuery = '';
                    if (input) input.value = '';
                    if (clearBtn) clearBtn.classList.add('hidden');
                    _encRenderDictBody(el);
                });
            });
            bodyEl.querySelectorAll('.enc-dict-item[data-did]').forEach(item => {
                item.querySelector('.enc-dict-term').addEventListener('click', () => _encToggleDictItem(item));
            });
            _encBindVerseRefs(bodyEl);
        };

        // 加载占位（字母条始终保留，避免闪烁）
        bodyEl.innerHTML = letterBar + `<div class="enc-dict-loading-row"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
        bindBody();

        if (q) {
            // 搜索态：向后端按词名搜索；结果少，连释义一并取回，展开即时显示无需再请求
            const SEARCH_LIMIT = 100;
            const { total, items } = await _encFetchDictPage({ q, limit: SEARCH_LIMIT, withContent: true });
            // 防竞态：等待期间用户又改了输入则放弃本次渲染
            if ((_encState.dictQuery || '').trim() !== q) return;
            const countLabel = _lang === 'en' ? 'results' : _lang === 'ko' ? '개 결과' : '条结果';
            const moreNote = total > items.length
                ? (_lang === 'en' ? ` · showing first ${items.length}` : _lang === 'ko' ? ` · 상위 ${items.length}개` : ` · 仅显示前 ${items.length} 条`)
                : '';
            bodyEl.innerHTML = items.length
                ? letterBar + `<div class="enc-dict-count">${total} ${countLabel}${moreNote}</div>
                   <div class="enc-dict-groups">${items.map(x => _encDictItemHTML(x, q)).join('')}</div>`
                : letterBar + `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>${_lang === 'en' ? 'No matching entries' : _lang === 'ko' ? '일치하는 항목이 없습니다' : '没有匹配的词条'}</p></div>`;
            bindBody();
            return;
        }

        // 浏览态：未选字母 → 提示；选了字母 → 拉该字母全部（轻量）
        if (!active || active === 'all') {
            const hint = _lang === 'en' ? 'Search above, or pick a letter to browse'
                : _lang === 'ko' ? '위에서 검색하거나 글자를 선택해 둘러보세요'
                    : '在上方搜索，或点选字母浏览';
            bodyEl.innerHTML = letterBar + `<div class="empty-state"><i class="fa-solid fa-arrow-pointer"></i><p>${hint}</p></div>`;
            bindBody();
            return;
        }
        // 单个字母最多取 400 条，避免大字母(如 Y 千余条)拉取慢、DOM 过重；超出提示用搜索精确定位
        const LETTER_LIMIT = 400;
        const { total, items } = await _encFetchDictPage({ letter: active, limit: LETTER_LIMIT });
        if (_encState.letter !== active || (_encState.dictQuery || '').trim()) return;   // 防竞态
        const entriesLabel = _lang === 'en' ? 'entries' : _lang === 'ko' ? '개' : '个词条';
        const moreNote = total > items.length
            ? (_lang === 'en' ? ` · first ${items.length}, search to narrow` : _lang === 'ko' ? ` · 상위 ${items.length}개, 검색으로 좁히기` : ` · 仅显示前 ${items.length} 条，搜索可精确查找`)
            : '';
        bodyEl.innerHTML = items.length
            ? letterBar + `<div class="enc-dict-count">${total} ${entriesLabel}${moreNote}</div>
               <div class="enc-dict-groups"><div class="enc-dict-group">
                    <div class="enc-dict-letter-head">${active}</div>
                    ${items.map(x => _encDictItemHTML(x, '')).join('')}
               </div></div>`
            : letterBar + `<div class="empty-state"><p>${_lang === 'en' ? 'No entries' : _lang === 'ko' ? '항목 없음' : '暂无词条'}</p></div>`;
        bindBody();
    }

    // ── 影音：复用 /api/media，音频在前视频在后；点击在本面板内嵌播放 ──
    async function _encRenderMedia(el) {
        _encLoading(el);
        const media = await _encFetchMedia();
        if (!media.length) { el.innerHTML = _encEmpty(); return; }

        // 播放态：在本面板内嵌 audio/video 播放器
        if (_encState.playingMedia) {
            _encRenderMediaPlayer(el, _encState.playingMedia);
            return;
        }

        const audios = media.filter(m => m.media_type === 'audio');
        const videos = media.filter(m => m.media_type === 'video');

        // 卡片：仅标题 + 分类 + 时长（去掉讲员人名）
        const card = (m, isVideo) => `
            <div class="enc-media-card" data-enc-mid="${m.id}">
                <div class="enc-media-icon ${isVideo ? 'is-video' : ''}"><i class="fa-solid ${isVideo ? 'fa-circle-play' : 'fa-play'}"></i></div>
                <div class="enc-media-info">
                    <div class="enc-media-title">${escapeNoteHTML(m.title)}</div>
                    <div class="enc-media-meta">${escapeNoteHTML(m.category || '')}</div>
                </div>
                <div class="enc-media-dur">${escapeNoteHTML(m.duration || '')}</div>
            </div>`;

        el.innerHTML = `
            ${audios.length ? `<div class="mv-section"><div class="mv-section-title"><i class="fa-solid fa-headphones"></i> ${t('enc.audio') || '音频'}</div><div class="enc-media-list">${audios.map(a => card(a, false)).join('')}</div></div>` : ''}
            ${videos.length ? `<div class="mv-section"><div class="mv-section-title"><i class="fa-solid fa-circle-play"></i> ${t('enc.video') || '视频'}</div><div class="enc-media-list">${videos.map(v => card(v, true)).join('')}</div></div>` : ''}`;

        el.querySelectorAll('.enc-media-card[data-enc-mid]').forEach(c => {
            c.addEventListener('click', () => {
                const m = media.find(x => String(x.id) === c.dataset.encMid);
                if (m) { _encState.playingMedia = m; _encRenderMedia(el); }
            });
        });
    }

    // 在百科面板内嵌播放器（音频/视频均在本页播放，不跳转）
    function _encRenderMediaPlayer(el, m) {
        const isVideo = m.media_type === 'video';
        const _lang = (typeof getLang === 'function' ? getLang() : 'zh');
        const backText = _lang === 'en' ? 'Back' : _lang === 'ko' ? '뒤로' : '返回';
        const noUrlText = _lang === 'en' ? 'No playable source for this item.' : _lang === 'ko' ? '재생 가능한 소스가 없습니다.' : '该条目暂无可播放的媒体源。';

        const playerHtml = !m.url
            ? `<div class="enc-media-nourl"><i class="fa-solid fa-circle-exclamation"></i> ${noUrlText}</div>`
            : isVideo
                ? `<video class="enc-media-video" src="${escapeNoteHTML(m.url)}" controls autoplay playsinline preload="metadata"></video>`
                : `<audio class="enc-media-audio" src="${escapeNoteHTML(m.url)}" controls autoplay preload="metadata"></audio>`;

        el.innerHTML = `
        <div class="enc-media-player">
            <button class="ap-back-btn" id="enc-media-back"><i class="fa-solid fa-arrow-left"></i> ${backText}</button>
            <div class="enc-media-player-head">
                <span class="enc-media-player-badge">${escapeNoteHTML(m.category || (isVideo ? '视频' : '音频'))}</span>
                <h3 class="enc-media-player-title">${escapeNoteHTML(m.title)}</h3>
            </div>
            <div class="enc-media-player-stage">${playerHtml}</div>
            ${m.description ? `<p class="enc-media-player-desc">${escapeNoteHTML(m.description)}</p>` : ''}
        </div>`;

        const back = el.querySelector('#enc-media-back');
        if (back) back.addEventListener('click', () => { _encState.playingMedia = null; _encRenderMedia(el); });
    }

    // ── 文章 / 灵修：公众号式卡片列表 ──
    async function _encRenderArticleList(el, entryType) {
        _encLoading(el);
        const items = await _encFetch(entryType);
        if (!items.length) { el.innerHTML = _encEmpty(); return; }

        el.innerHTML = `<div class="enc-article-list">${items.map(x => {
            const cover = x.cover_style || 'linear-gradient(135deg,#8250ab,#663b8b)';
            const isImg = /^https?:|^\//.test(cover);
            const isFa = cover.startsWith('fa-');
            const coverStyle = isImg ? `background-image:url('${cover}');background-size:cover;background-position:center;` : (isFa ? '' : `background:${cover};`);
            return `
            <div class="enc-article-card" data-eid="${x.id}">
                <div class="enc-article-cover" style="${coverStyle}">${isFa ? `<i class="fa-solid ${cover}"></i>` : ''}</div>
                <div class="enc-article-body">
                    <div class="enc-article-title">${escapeNoteHTML(encPick(x, 'title'))}</div>
                    <div class="enc-article-summary">${escapeNoteHTML(encPick(x, 'summary'))}</div>
                    <div class="enc-article-meta">
                        ${x.author ? `<span><i class="fa-solid fa-feather"></i> ${escapeNoteHTML(x.author)}</span>` : ''}
                        ${x.category ? `<span class="enc-tag">${escapeNoteHTML(x.category)}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('')}</div>`;

        el.querySelectorAll('.enc-article-card[data-eid]').forEach(card => {
            card.addEventListener('click', () => {
                const all = _encCache[entryType] || [];
                _encState.activeEntry = all.find(x => x.id === card.dataset.eid) || null;
                renderEncyclopediaView();
            });
        });
    }

    // ── 详情阅读（公众号式长文）──
    function _encRenderReader(el, entry) {
        const cover = entry.cover_style || '';
        const isImg = /^https?:|^\//.test(cover);
        const isFa = cover.startsWith('fa-');
        const bodyHtml = escapeNoteHTML(encPick(entry, 'content'))
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        el.innerHTML = `
        <div class="enc-reader">
            <button class="ap-back-btn" id="enc-reader-back"><i class="fa-solid fa-arrow-left"></i> ${t('enc.back') || '返回'}</button>
            ${cover && !isFa ? `<div class="enc-reader-cover" style="${isImg ? `background-image:url('${cover}');background-size:cover;background-position:center;` : `background:${cover};`}"></div>` : ''}
            <h1 class="enc-reader-title">${escapeNoteHTML(encPick(entry, 'title'))}</h1>
            <div class="enc-reader-meta">
                ${entry.author ? `<span><i class="fa-solid fa-feather"></i> ${escapeNoteHTML(entry.author)}</span>` : ''}
                ${entry.category ? `<span class="enc-tag">${escapeNoteHTML(entry.category)}</span>` : ''}
            </div>
            <div class="enc-reader-content"><p>${bodyHtml}</p></div>
        </div>`;

        const back = el.querySelector('#enc-reader-back');
        if (back) back.addEventListener('click', () => { _encState.activeEntry = null; renderEncyclopediaView(); });
    }

    // ── 全部：各类聚合预览 ──
    async function _encRenderAll(el) {
        _encLoading(el);
        const [dictPage, articles, devos, media] = await Promise.all([
            _encFetchDictPage({ limit: 8 }), _encFetch('article'), _encFetch('devotional'), _encFetchMedia()
        ]);
        const dict = dictPage.items;

        const sections = [];

        if (dict.length) {
            sections.push(`
            <div class="enc-all-section">
                <div class="enc-all-head"><span><i class="fa-solid fa-spell-check"></i> ${t('enc.dictionary') || '词典'}</span>
                    <button class="enc-more" data-goto="dictionary">${t('enc.viewAll') || '查看全部'} <i class="fa-solid fa-chevron-right"></i></button></div>
                <div class="enc-dict-chips">${dict.slice(0, 8).map(x => `<span class="enc-dict-chip" data-did="${x.id}" data-term="${escapeNoteHTML(encPick(x, 'title'))}">${escapeNoteHTML(encPick(x, 'title'))}</span>`).join('')}</div>
            </div>`);
        }
        const audios = media.filter(m => m.media_type === 'audio');
        if (audios.length) {
            sections.push(`
            <div class="enc-all-section">
                <div class="enc-all-head"><span><i class="fa-solid fa-headphones"></i> ${t('enc.media') || '影音'}</span>
                    <button class="enc-more" data-goto="media">${t('enc.viewAll') || '查看全部'} <i class="fa-solid fa-chevron-right"></i></button></div>
                <div class="enc-media-list">${audios.slice(0, 3).map(a => `
                    <div class="enc-media-card" data-enc-mid="${a.id}">
                        <div class="enc-media-icon"><i class="fa-solid fa-play"></i></div>
                        <div class="enc-media-info"><div class="enc-media-title">${escapeNoteHTML(a.title)}</div>
                        <div class="enc-media-meta">${escapeNoteHTML(a.category || '')}</div></div>
                        <div class="enc-media-dur">${escapeNoteHTML(a.duration || '')}</div>
                    </div>`).join('')}</div>
            </div>`);
        }
        const mkCardRow = (arr, type, icon, label) => arr.length ? `
            <div class="enc-all-section">
                <div class="enc-all-head"><span><i class="fa-solid ${icon}"></i> ${label}</span>
                    <button class="enc-more" data-goto="${type}">${t('enc.viewAll') || '查看全部'} <i class="fa-solid fa-chevron-right"></i></button></div>
                <div class="enc-article-list">${arr.slice(0, 2).map(x => {
                    const cover = x.cover_style || 'linear-gradient(135deg,#8250ab,#663b8b)';
                    const isFa = cover.startsWith('fa-');
                    const isImg = /^https?:|^\//.test(cover);
                    const cs = isImg ? `background-image:url('${cover}');background-size:cover;` : (isFa ? '' : `background:${cover};`);
                    return `<div class="enc-article-card" data-eid="${x.id}" data-etype="${type}">
                        <div class="enc-article-cover" style="${cs}">${isFa ? `<i class="fa-solid ${cover}"></i>` : ''}</div>
                        <div class="enc-article-body"><div class="enc-article-title">${escapeNoteHTML(encPick(x, 'title'))}</div>
                        <div class="enc-article-summary">${escapeNoteHTML(encPick(x, 'summary'))}</div></div>
                    </div>`;
                }).join('')}</div>
            </div>` : '';
        sections.push(mkCardRow(articles, 'article', 'fa-newspaper', t('enc.article') || '文章'));
        sections.push(mkCardRow(devos, 'devotional', 'fa-sun', t('enc.devotional') || '灵修'));

        const joined = sections.filter(Boolean).join('');
        el.innerHTML = joined || _encEmpty();

        // 跳转到对应标签
        el.querySelectorAll('.enc-more[data-goto]').forEach(b => {
            b.addEventListener('click', () => { _encState.tab = b.dataset.goto; renderEncyclopediaView(); });
        });
        // 词典 chip → 切到词典并以词名搜索定位、展开
        el.querySelectorAll('.enc-dict-chip[data-did]').forEach(chip => {
            chip.addEventListener('click', () => {
                _encState.tab = 'dictionary';
                _encState.dictQuery = chip.dataset.term || '';
                _encState.expanded[chip.dataset.did] = true;
                renderEncyclopediaView();
            });
        });
        // 影音卡片 → 切到影音标签并在本页播放
        el.querySelectorAll('.enc-media-card[data-enc-mid]').forEach(card => {
            card.addEventListener('click', () => {
                const m = media.find(x => String(x.id) === card.dataset.encMid);
                if (m) { _encState.playingMedia = m; _encState.tab = 'media'; renderEncyclopediaView(); }
            });
        });
        // 文章/灵修卡片 → 详情
        el.querySelectorAll('.enc-article-card[data-eid]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.etype;
                const all = _encCache[type] || [];
                _encState.activeEntry = all.find(x => x.id === card.dataset.eid) || null;
                renderEncyclopediaView();
            });
        });
    }

    // ── Audio View ──
    let AUDIO_DATA = [];
    let _audioLoaded = false;

    let _audioFilter = '全部';
    let _activeAudio = null;
    let _audioPlaying = false;
    let _audioProgress = 0;
    let _audioInterval = null;

    function renderAudioView() {
        const c = $('audio-render'); if (!c) return;

        if (!_audioLoaded) {
            c.innerHTML = '<div style="padding:40px;text-align:center;color:#999;"><i class="fa-solid fa-spinner fa-spin"></i> 加载音频资源中...</div>';
            fetch(`${S.apiBase}/media?media_type=audio`).then(r => r.json()).then(data => {
                AUDIO_DATA = data.map(a => ({
                    id: a.id, title: a.title, category: a.category,
                    dur: a.duration, speaker: a.teacher, desc: a.description, icon: a.cover_style
                }));
                _audioLoaded = true;
                renderAudioView();
            }).catch(err => {
                console.error(err);
                c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-tertiary);">资源加载失败，请稍后重试。</div>';
            });
            return;
        }

        // If audio is active, show player
        if (_activeAudio) {
            renderAudioPlayer(c, _activeAudio);
            return;
        }

        const categories = ['全部', '灵修', '诵读', '敬拜', '教导'];
        const filtered = _audioFilter === '全部' ? AUDIO_DATA : AUDIO_DATA.filter(a => a.category === _audioFilter);

        // Group by category
        const groups = {};
        filtered.forEach(a => {
            if (!groups[a.category]) groups[a.category] = [];
            groups[a.category].push(a);
        });

        const catIcons = { '灵修': 'fa-sun', '诵读': 'fa-book-open', '敬拜': 'fa-music', '教导': 'fa-graduation-cap' };

        c.innerHTML = `
        <div class="mv-header">
            <div class="mv-tabs">
                ${categories.map(cat => `<button class="mv-tab ${cat === _audioFilter ? 'active' : ''}" data-cat="${cat}">${cat}</button>`).join('')}
            </div>
            <div class="mv-count">${filtered.length} 个音频</div>
        </div>
        ${filtered.length === 0 ? `<div class="no-data-state">
            <i class="fa-solid fa-headphones"></i>
            <p>${t('media.emptyAudio') || '暂无音频内容'}</p>
        </div>` : ''}
        ${Object.entries(groups).map(([cat, items]) => `
            <div class="mv-section">
                <div class="mv-section-title"><i class="fa-solid ${catIcons[cat] || 'fa-headphones'}"></i> ${cat}</div>
                <div class="audio-list">
                    ${items.map(a => `
                    <div class="audio-card" data-aid="${a.id}">
                        <div class="audio-play-circle"><i class="fa-solid fa-play"></i></div>
                        <div class="audio-info">
                            <div class="audio-title">${a.title}</div>
                            <div class="audio-meta"><i class="fa-solid fa-user"></i> ${a.speaker} · ${a.category}</div>
                        </div>
                        <div class="audio-dur">${a.dur}</div>
                    </div>`).join('')}
                </div>
            </div>
        `).join('')}`;

        // Category tab clicks
        c.querySelectorAll('.mv-tab').forEach(tab => {
            tab.addEventListener('click', () => { _audioFilter = tab.dataset.cat; renderAudioView(); });
        });

        // Audio card clicks
        c.querySelectorAll('.audio-card[data-aid]').forEach(card => {
            card.addEventListener('click', () => {
                _activeAudio = AUDIO_DATA.find(a => a.id === card.dataset.aid);
                _audioProgress = 0;
                _audioPlaying = false;
                renderAudioView();
            });
        });
    }

    function renderAudioPlayer(c, audio) {
        const totalSec = parseDur(audio.dur);
        const pct = totalSec > 0 ? (_audioProgress / totalSec * 100) : 0;

        // Generate wave bars
        const waveBars = Array.from({length: 48}, (_, i) => {
            const h = 12 + Math.sin(i * 0.7) * 10 + Math.random() * 8;
            return `<div class="ap-wave-bar" style="height:${h}px"></div>`;
        }).join('');

        c.innerHTML = `
        <div class="ap-container">
            <div class="ap-back-row">
                <button class="ap-back-btn" id="ap-back"><i class="fa-solid fa-arrow-left"></i> 返回音频列表</button>
            </div>
            <div class="ap-player-card">
                <div class="ap-top-row">
                <div class="ap-artwork">
                    <div class="ap-artwork-bg"><i class="fa-solid ${audio.icon || 'fa-headphones'}"></i></div>
                </div>
                <div class="ap-details">
                    <span class="ap-category-badge">${audio.category}</span>
                    <h2 class="ap-title">${audio.title}</h2>
                    <div class="ap-speaker"><i class="fa-solid fa-microphone"></i> ${audio.speaker}</div>
                    <p class="ap-desc">${audio.desc}</p>
                </div>
                </div>
                <div class="ap-wave" id="ap-wave">${waveBars}</div>
                <div class="ap-seek-wrap">
                    <div class="ap-seek-bar" id="ap-seek-bar">
                        <div class="ap-seek-fill" id="ap-seek-fill" style="width:${pct}%"></div>
                        <div class="ap-seek-thumb" id="ap-seek-thumb" style="left:${pct}%"></div>
                    </div>
                    <div class="ap-time-row">
                        <span id="ap-cur-time">${fmtSec(_audioProgress)}</span>
                        <span>${audio.dur}</span>
                    </div>
                </div>
                <div class="ap-controls">
                    <button class="ap-ctrl" id="ap-back-10"><i class="fa-solid fa-backward"></i><span>10s</span></button>
                    <button class="ap-play-btn ${_audioPlaying ? 'playing' : ''}" id="ap-toggle">
                        <i class="fa-solid fa-${_audioPlaying ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="ap-ctrl" id="ap-fwd-10"><i class="fa-solid fa-forward"></i><span>10s</span></button>
                </div>
            </div>

            <div class="ap-playlist">
                <div class="ap-playlist-title"><i class="fa-solid fa-list"></i> ${audio.category}分类音频</div>
                ${AUDIO_DATA.filter(a => a.category === audio.category).map(a => `
                <div class="ap-playlist-item ${a.id === audio.id ? 'active' : ''}" data-aid="${a.id}">
                    <div class="ap-pl-icon"><i class="fa-solid fa-${a.id === audio.id && _audioPlaying ? 'volume-high' : 'play'}"></i></div>
                    <div class="ap-pl-info">
                        <div class="ap-pl-name">${a.title}</div>
                        <div class="ap-pl-speaker">${a.speaker}</div>
                    </div>
                    <div class="ap-pl-dur">${a.dur}</div>
                </div>`).join('')}
            </div>
        </div>`;

        // Back button
        $('ap-back')?.addEventListener('click', () => {
            clearInterval(_audioInterval);
            _activeAudio = null; _audioPlaying = false; _audioProgress = 0;
            renderAudioView();
        });

        // Toggle play
        function startPlayback() {
            _audioPlaying = true;
            $('ap-toggle').classList.add('playing');
            $('ap-toggle').innerHTML = '<i class="fa-solid fa-pause"></i>';
            $('ap-wave')?.classList.add('animating');
            _audioInterval = setInterval(() => {
                _audioProgress = Math.min(_audioProgress + 1, totalSec);
                const p = _audioProgress / totalSec * 100;
                $('ap-seek-fill').style.width = p + '%';
                $('ap-seek-thumb').style.left = p + '%';
                $('ap-cur-time').textContent = fmtSec(_audioProgress);
                if (_audioProgress >= totalSec) { clearInterval(_audioInterval); _audioPlaying = false; }
            }, 1000);
        }

        function stopPlayback() {
            clearInterval(_audioInterval);
            _audioPlaying = false;
            $('ap-toggle').classList.remove('playing');
            $('ap-toggle').innerHTML = '<i class="fa-solid fa-play"></i>';
            $('ap-wave')?.classList.remove('animating');
        }

        $('ap-toggle')?.addEventListener('click', () => { _audioPlaying ? stopPlayback() : startPlayback(); });

        // Seek bar click
        $('ap-seek-bar')?.addEventListener('click', (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            _audioProgress = Math.round(pct * totalSec);
            const p = _audioProgress / totalSec * 100;
            $('ap-seek-fill').style.width = p + '%';
            $('ap-seek-thumb').style.left = p + '%';
            $('ap-cur-time').textContent = fmtSec(_audioProgress);
        });

        // Skip buttons
        $('ap-back-10')?.addEventListener('click', () => {
            _audioProgress = Math.max(0, _audioProgress - 10);
            const p = _audioProgress / totalSec * 100;
            $('ap-seek-fill').style.width = p + '%';
            $('ap-seek-thumb').style.left = p + '%';
            $('ap-cur-time').textContent = fmtSec(_audioProgress);
        });
        $('ap-fwd-10')?.addEventListener('click', () => {
            _audioProgress = Math.min(totalSec, _audioProgress + 10);
            const p = _audioProgress / totalSec * 100;
            $('ap-seek-fill').style.width = p + '%';
            $('ap-seek-thumb').style.left = p + '%';
            $('ap-cur-time').textContent = fmtSec(_audioProgress);
        });

        // Playlist clicks
        c.querySelectorAll('.ap-playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                clearInterval(_audioInterval);
                _activeAudio = AUDIO_DATA.find(a => a.id === item.dataset.aid);
                _audioProgress = 0; _audioPlaying = false;
                renderAudioView();
            });
        });
    }


    // ── Settings View ──
    function renderSettingsView() {
        const c = $('settings-render'); if (!c) return;
        const _currentLang = typeof getLang === 'function' ? getLang() : 'zh';
        c.innerHTML = `
    <div class="settings-section">
        <div class="settings-section-title">${t('settings.appearance') || '外观'}</div>
        <div class="settings-card">
            <div class="settings-row">
                <div><div class="settings-label">${t('settings.dark-mode') || '深色模式'}</div></div>
                <label class="toggle"><input type="checkbox" id="settings-dark" ${S.theme === 'dark' ? 'checked' : ''}><span class="toggle-track"></span></label>
            </div>
            <div class="settings-row">
                <div><div class="settings-label">${t('settings.font-size') || '字体大小'}</div><div class="settings-desc" id="font-size-readout">${S.fontSize}px</div></div>
                <input type="range" class="range-input" min="14" max="26" value="${S.fontSize}" id="font-size-range">
            </div>
        </div>
    </div>
    <div class="settings-section">
        <div class="settings-section-title">${t('settings.language') || '语言'}</div>
        <div class="settings-card">
            <div class="settings-row">
                <div class="settings-label">${t('settings.body-font') || '正文字体'}</div>
                <div class="lang-selector">
                    <button class="lang-btn${localStorage.getItem('ob_font') !== 'serif' ? ' active' : ''}" data-font-set="sans">黑体</button>
                    <button class="lang-btn${localStorage.getItem('ob_font') === 'serif' ? ' active' : ''}" data-font-set="serif">宋体</button>
                </div>
            </div>
            <div class="settings-row">
                <div class="settings-label">${t('settings.ui-lang') || '文字'}</div>
                <div class="lang-selector">
                    <button class="lang-btn${localStorage.getItem('ob_script') !== 't' ? ' active' : ''}" data-script-set="s">简体中文</button>
                    <button class="lang-btn${localStorage.getItem('ob_script') === 't' ? ' active' : ''}" data-script-set="t">繁體中文</button>
                </div>
            </div>
        </div>
    </div>
    <div class="settings-section">
        <div class="settings-section-title">${t('settings.data') || '数据'}</div>
        <div class="settings-card">
            <div class="settings-row">
                <div><div class="settings-label">${t('settings.notes-count') || '笔记数量'}</div><div class="settings-desc">${S.notes.length} ${_currentLang === 'en' ? 'note(s)' : _currentLang === 'ko' ? '개 노트' : '条笔记'}</div></div>
                <button onclick="if(confirm('${_currentLang === 'en' ? 'Clear all notes?' : _currentLang === 'ko' ? '모든 노트를 지우시겠습니까?' : '确认清空所有笔记？'}')){S.notes=[];localStorage.removeItem('ob_notes');renderSettingsView();showToast('${_currentLang === 'en' ? 'Cleared' : _currentLang === 'ko' ? '지워짐' : '已清空'}');}" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 12px;color:var(--text-secondary);cursor:pointer;font-size:0.82rem;">${t('settings.clear-notes') || '清空笔记'}</button>
            </div>
            <div class="settings-row">
                <div><div class="settings-label">${t('settings.bm-count') || '资源数量'}</div><div class="settings-desc">${S.bookmarks.length} ${_currentLang === 'en' ? 'item(s)' : _currentLang === 'ko' ? '개' : '个资源'}</div></div>
                <button onclick="if(confirm('${_currentLang === 'en' ? 'Clear all bookmarks?' : _currentLang === 'ko' ? '모든 북마크를 지우시겠습니까?' : '确认清空所有资源？'}')){S.bookmarks=[];localStorage.removeItem('ob_bookmarks');renderSettingsView();showToast('${_currentLang === 'en' ? 'Cleared' : _currentLang === 'ko' ? '지워짐' : '已清空'}');}" style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 12px;color:var(--text-secondary);cursor:pointer;font-size:0.82rem;">${t('settings.clear-bm') || '清空资源'}</button>
            </div>
        </div>
    </div>
    <div class="settings-section">
        <div class="settings-section-title">${t('settings.more') || '更多'}</div>
        <div class="settings-card">
            <div class="settings-row settings-link-row" onclick="switchView('about')" style="cursor:pointer;">
                <div class="settings-label"><i class="fa-solid fa-circle-info" style="width:18px;margin-right:8px;color:var(--text-secondary);"></i>${t('nav.about')}</div>
                <i class="fa-solid fa-chevron-right" style="color:var(--text-secondary);font-size:0.8rem;"></i>
            </div>
            <div class="settings-row settings-link-row" onclick="switchView('privacy')" style="cursor:pointer;">
                <div class="settings-label"><i class="fa-solid fa-shield-halved" style="width:18px;margin-right:8px;color:var(--text-secondary);"></i>${t('nav.privacy')}</div>
                <i class="fa-solid fa-chevron-right" style="color:var(--text-secondary);font-size:0.8rem;"></i>
            </div>
        </div>
    </div>`;
        document.getElementById('settings-dark')?.addEventListener('change', e => {
            applyTheme(e.target.checked ? 'dark' : 'light');
        });
        document.getElementById('font-size-range')?.addEventListener('input', e => {
            S.fontSize = +e.target.value;
            applyVerseFontSize();
            localStorage.setItem('ob_fontsize', S.fontSize);
            const readout = $('font-size-readout');
            if (readout) readout.textContent = `${S.fontSize}px`;
        });
    }

    // 经文字号：以 20px 为基准换算缩放系数（CSS 里各断点的经文字号都乘 --verse-scale），
    // 这样手机/平板宽度原有的字号比例保留，用户只调整相对大小
    function applyVerseFontSize() {
        const root = document.documentElement.style;
        root.setProperty('--verse-scale', String(S.fontSize / 20));
        root.setProperty('--font-size-verse', S.fontSize + 'px');
    }

    // ── About Us & Privacy Policy (premium content pages) ──
    // ── App 下载页 ──
    // 下载渠道集中配置：与 App 端 mobile-app/src/data/referral.ts 同一组地址。
    // 安卓包放在 App 端 nginx 的 /downloads/（见 downloads/README.md），换版本只覆盖文件；
    // 地址变更后需重新生成二维码图片 images/download/qr-android.svg。
    const APP_DOWNLOADS = {
        android: {
            url: 'https://app.openbible.live/downloads/openbible-android.apk',
            available: true,
            version: '1.0',
            size: '32.5 MB',
            minOs: 'Android 7.0',
            qr: 'images/download/qr-android.svg',
        },
        ios: {
            url: 'https://openbible.live/download/ios',
            available: false, // App Store 上架后改 true，并补二维码图片
            version: '1.0',
            minOs: 'iOS 15',
            qr: '',
        },
    };

    function detectMobilePlatform() {
        const ua = navigator.userAgent || '';
        if (/android/i.test(ua)) return 'android';
        // iPadOS 13+ 的 UA 伪装成 Mac：用触点数补判
        if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
        return 'desktop';
    }

    function renderDownloadView() {
        const c = $('download-render'); if (!c) return;
        const platform = detectMobilePlatform();
        const a = APP_DOWNLOADS.android;
        const i = APP_DOWNLOADS.ios;

        // 首屏主按钮跟随访问设备：安卓直接下载；iPhone 提示即将上线；电脑引导扫码
        const heroCta = platform === 'android'
            ? `<a class="dl-btn is-primary" href="${a.url}"><i class="fa-brands fa-android"></i>${t('dl.cta.android')}</a>`
            : platform === 'ios'
                ? (i.available
                    ? `<a class="dl-btn is-primary" href="${i.url}"><i class="fa-brands fa-apple"></i>${t('dl.cta.ios')}</a>`
                    : `<span class="dl-btn is-primary is-disabled" aria-disabled="true"><i class="fa-brands fa-apple"></i>${t('dl.cta.ios_soon')}</span>`)
                : `<a class="dl-btn is-primary" href="#dl-channels" data-dl-scroll><i class="fa-solid fa-qrcode"></i>${t('dl.cta.scan')}</a>`;

        const features = [
            ['fa-cloud-arrow-down', 'dl.f1.title', 'dl.f1.body'],
            ['fa-wand-magic-sparkles', 'dl.f2.title', 'dl.f2.body'],
            ['fa-book-open-reader', 'dl.f3.title', 'dl.f3.body'],
            ['fa-headphones', 'dl.f4.title', 'dl.f4.body'],
        ];
        const steps = ['dl.step1', 'dl.step2', 'dl.step3'];

        c.innerHTML = `
        <div class="dl-page">
            <section class="dl-hero">
                <div class="dl-hero-copy">
                    <div class="dl-app-icon"><img src="images/logo-mark.svg" alt=""></div>
                    <span class="dl-eyebrow">${t('dl.eyebrow')}</span>
                    <h1>${t('dl.title')}</h1>
                    <p>${t('dl.subtitle')}</p>
                    <div class="dl-hero-actions">
                        ${heroCta}
                        <a class="dl-btn is-ghost" href="#dl-channels" data-dl-scroll>${t('dl.cta.all')}</a>
                    </div>
                    <ul class="dl-badges">
                        <li><i class="fa-solid fa-check"></i>${t('dl.badge.free')}</li>
                        <li><i class="fa-solid fa-check"></i>${t('dl.badge.noads')}</li>
                        <li><i class="fa-solid fa-check"></i>${t('dl.badge.lang')}</li>
                    </ul>
                </div>
                <div class="dl-hero-visual" aria-hidden="true">
                    <div class="dl-phone is-back"><img src="images/download/screen-huidu.jpg" alt="" loading="lazy"></div>
                    <div class="dl-phone is-front"><img src="images/download/screen-bible.jpg" alt=""></div>
                </div>
            </section>

            <section class="dl-channels" id="dl-channels" aria-label="${t('dl.channels')}">
                <article class="dl-card${platform === 'android' ? ' is-current' : ''}">
                    <header class="dl-card-head">
                        <span class="dl-platform is-android"><i class="fa-brands fa-android"></i></span>
                        <div class="dl-card-title"><h2>Android</h2><small>${t('dl.android.sub')}</small></div>
                        <span class="dl-status is-ready">${t('dl.status.ready')}</span>
                    </header>
                    <div class="dl-card-body">
                        <div class="dl-qr"><img src="${a.qr}" alt="${t('dl.android.qr_alt')}"></div>
                        <div class="dl-card-info">
                            <dl class="dl-specs">
                                <div><dt>${t('dl.spec.version')}</dt><dd>${a.version}</dd></div>
                                <div><dt>${t('dl.spec.size')}</dt><dd>${a.size}</dd></div>
                                <div><dt>${t('dl.spec.os')}</dt><dd>${a.minOs} ${t('dl.spec.above')}</dd></div>
                            </dl>
                            <a class="dl-btn is-primary is-block" href="${a.url}"><i class="fa-solid fa-download"></i>${t('dl.android.btn')}</a>
                        </div>
                    </div>
                    <p class="dl-card-hint"><i class="fa-solid fa-mobile-screen"></i>${t('dl.android.hint')}</p>
                </article>

                <article class="dl-card${platform === 'ios' ? ' is-current' : ''}${i.available ? '' : ' is-pending'}">
                    <header class="dl-card-head">
                        <span class="dl-platform is-ios"><i class="fa-brands fa-apple"></i></span>
                        <div class="dl-card-title"><h2>iPhone · iPad</h2><small>${t('dl.ios.sub')}</small></div>
                        <span class="dl-status ${i.available ? 'is-ready' : 'is-soon'}">${t(i.available ? 'dl.status.ready' : 'dl.status.soon')}</span>
                    </header>
                    <div class="dl-card-body">
                        ${i.available && i.qr
                            ? `<div class="dl-qr"><img src="${i.qr}" alt="${t('dl.ios.qr_alt')}"></div>`
                            : `<div class="dl-qr is-placeholder"><i class="fa-brands fa-app-store-ios"></i><span>${t('dl.ios.reviewing')}</span></div>`}
                        <div class="dl-card-info">
                            <dl class="dl-specs">
                                <div><dt>${t('dl.spec.version')}</dt><dd>${i.version}</dd></div>
                                <div><dt>${t('dl.spec.channel')}</dt><dd>App Store</dd></div>
                                <div><dt>${t('dl.spec.os')}</dt><dd>${i.minOs} ${t('dl.spec.above')}</dd></div>
                            </dl>
                            ${i.available
                                ? `<a class="dl-btn is-primary is-block" href="${i.url}"><i class="fa-brands fa-apple"></i>${t('dl.ios.btn')}</a>`
                                : `<span class="dl-btn is-block is-disabled" aria-disabled="true"><i class="fa-regular fa-clock"></i>${t('dl.ios.btn_soon')}</span>`}
                        </div>
                    </div>
                    <p class="dl-card-hint"><i class="fa-solid fa-magnifying-glass"></i>${t('dl.ios.hint')}</p>
                </article>
            </section>

            <section class="cpage-section">
                <div class="cpage-section-head"><span class="bar dl-bar"></span><h2>${t('dl.features.title')}</h2></div>
                <div class="dl-features">
                    ${features.map(([icon, title, body]) => `
                    <div class="dl-feature">
                        <span class="dl-feature-icon"><i class="fa-solid ${icon}"></i></span>
                        <h3>${t(title)}</h3>
                        <p>${t(body)}</p>
                    </div>`).join('')}
                </div>
            </section>

            <section class="cpage-section">
                <div class="cpage-section-head"><span class="bar dl-bar"></span><h2>${t('dl.guide.title')}</h2></div>
                <ol class="dl-steps">
                    ${steps.map((key, index) => `
                    <li><span class="dl-step-num">${index + 1}</span><p>${t(key)}</p></li>`).join('')}
                </ol>
                <p class="dl-safety"><i class="fa-solid fa-shield-halved"></i>${t('dl.guide.safety')}</p>
            </section>
        </div>`;

        // 页内锚点：在视图自己的滚动容器里平滑滚动（hash 跳转会被路由占用）
        c.querySelectorAll('[data-dl-scroll]').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                $('dl-channels')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function renderAboutView() {
        const c = $('about-render'); if (!c) return;
        const story = [
            ['about.t1.era', 'about.p1'],
            ['about.t2.era', 'about.p2'],
            ['about.t3.era', 'about.p3'],
        ];
        const feats = [
            ['fa-book-open-reader', 'about.f1.title', 'about.f1.body'],
            ['fa-wand-magic-sparkles', 'about.f2.title', 'about.f2.body'],
            ['fa-language', 'about.f3.title', 'about.f3.body'],
            ['fa-photo-film', 'about.f4.title', 'about.f4.body'],
            ['fa-feather-pointed', 'about.f5.title', 'about.f5.body'],
        ];
        c.innerHTML = `
        <div class="cpage">
            <div class="cpage-hero">
                <div class="cpage-hero-badge"><i class="fa-solid fa-book-bible"></i></div>
                <h1>${t('app.name')}</h1>
            </div>

            <div class="cpage-section">
                <div class="cpage-section-head"><span class="bar"></span><h2>${t('about.story.title')}</h2></div>
                <div class="timeline">
                    ${story.map(([era, body]) => `
                    <div class="timeline-item">
                        <span class="timeline-dot"></span>
                        <div class="timeline-era">${t(era)}</div>
                        <div class="timeline-body">${t(body)}</div>
                    </div>`).join('')}
                </div>
            </div>

            <div class="cpage-section">
                <div class="cpage-section-head"><span class="bar"></span><h2>${t('about.features.title')}</h2></div>
                <div class="feature-grid">
                    ${feats.map(([ico, tk, bk]) => `
                    <div class="feature-card">
                        <div class="feature-ico"><i class="fa-solid ${ico}"></i></div>
                        <h3>${t(tk)}</h3>
                        <p>${t(bk)}</p>
                    </div>`).join('')}
                </div>
            </div>

            <div class="cpage-note">${t('about.closing')}</div>
        </div>`;
    }

    // 隐私政策正文：与 App 端 mobile-app/src/pages/LegalPage.tsx 同一套条款（中文为准），
    // 按网页版场景调整个别措辞。修改条款时两端同步更新，并改这里的日期。
    const PRIVACY_UPDATED = '2026 年 11 月 5 日';
    const PRIVACY_SECTIONS = [
        ['fa-hand-holding-heart', '引言', '慧读圣经（OpenBible）尊重并保护你的个人信息。本政策适用于慧读圣经网页版与手机 App，说明我们收集哪些信息、如何使用与存储、与谁共享，以及你享有的权利。我们遵循最小必要原则：能在本机完成的，就不上传。'],
        ['fa-clipboard-list', '我们收集的信息', '账号信息：注册登录时的邮箱、昵称与头像（使用 Google 或 Apple 登录时由对应平台按其政策提供基本资料）。使用数据：阅读位置、高亮、笔记、祷告记录、读经计划进度、慧读对话、社群发布内容——其中多数仅在你登录后才与账号关联。设备信息：仅收集保障服务所必需的基本信息（如应用版本），不收集通讯录、精确位置、设备唯一标识等与功能无关的信息。'],
        ['fa-laptop', '本机优先与云端同步', '未登录时，高亮、笔记、祷告与慧读记录等个人数据保存在你的浏览器或设备本机，不会上传。登录后，为了多设备同步（包括网页版与 App 之间同步阅读位置、笔记与高亮），相关数据会加密传输至我们的服务器。退出登录时，本机上的个人数据会被清除。'],
        ['fa-wand-magic-sparkles', 'AI 功能的数据处理', '使用慧读问答时，你的提问与所选经文会发送至我们自建的 AI 服务进行处理，仅用于生成回答与改进回答质量；我们不会将你的提问用于广告，也不会出售给任何第三方。语音朗读为预生成音频，不涉及你的个人数据。'],
        ['fa-microphone', '语音输入', '在慧读中使用语音输入时，你的语音由你所用设备的系统语音识别服务（如 Google、Apple）或浏览器厂商提供的识别服务转换为文字，并按其各自的隐私政策处理；我们只接收识别后的文字，不接收、不保存你的录音。语音输入需要你授权麦克风权限，你可以随时在系统或浏览器设置中关闭。'],
        ['fa-gears', '信息的使用', '我们使用收集的信息用于：提供并维护各项功能；多设备同步；向你发送你订阅的读经提醒、每日金句等通知；保障账号与服务安全；在匿名化、聚合化的前提下统计分析以改进产品。我们不做个性化广告，也没有任何广告系统。'],
        ['fa-bell', '推送通知', '在手机 App 中开启系统通知后，我们会登记推送所需的设备令牌、设备平台与应用版本，以及登记时的 IP 地址和据此推算的大致地区（国家、省份、城市级别，不是精确位置），用于送达你订阅的通知与排查推送问题。关闭系统通知或退出登录后，对应的设备登记会停用。'],
        ['fa-comment-dots', '意见反馈', '你通过 App「我的 → 意见反馈」提交留言时，我们会保存留言内容、你选填的联系方式，以及提交时的账号昵称与邮箱（如已登录），仅用于阅读、回复和改进产品。'],
        ['fa-share-nodes', '信息的共享', '我们不出售你的个人信息。仅在以下情形共享：你在社群公开发布的内容对小组成员可见；获得你的明确同意；法律法规或主管机关依法要求。为提供服务使用的基础设施服务商（如服务器托管）仅在必要范围内处理数据并受保密义务约束。'],
        ['fa-lock', '数据安全', '我们采取加密传输（HTTPS）、访问控制、最小授权等措施保护你的数据。虽然没有任何系统能保证绝对安全，但我们会在发生可能影响你权益的安全事件时，依法及时告知你。'],
        ['fa-trash-can', '数据保留与删除', '账号数据在你使用服务期间保留。你删除的笔记、帖子会从服务器移除（备份副本将在备份周期内随之清除）。你可以申请注销账号，注销后我们将删除或匿名化你的个人信息，法律要求留存的除外。'],
        ['fa-user-shield', '你的权利', '你有权访问、更正、导出自己的数据，撤回授权、关闭通知、删除内容、注销账号。多数操作可在网页版「我的」面板或 App「我的 → 数据与账户」中完成；其余可通过下方联系方式向我们提出，我们将在合理期限内响应。'],
        ['fa-child', '未成年人保护', '我们不会在明知的情况下收集未满 14 周岁儿童的个人信息。如监护人发现儿童未经同意使用了本应用，请联系我们删除相关信息。'],
        ['fa-puzzle-piece', '第三方服务', '本应用集成的第三方服务仅限：Google 登录（可选）、Apple 登录（可选）、系统推送通道（Apple APNs / Google FCM，仅在 App 中用于送达你订阅的通知）、设备或浏览器自带的语音识别（仅在你使用语音输入时）。使用这些服务时适用其各自的隐私政策。本应用不接入任何广告 SDK 或数据分析售卖服务。'],
        ['fa-clock-rotate-left', '政策的更新', '本政策可能适时更新，重大变更会在应用内显著位置公告并更新本页日期。继续使用即视为接受更新后的政策。'],
        ['fa-envelope', '联系我们', '对本政策或你的个人信息处理有任何疑问，可通过 App「我的 → 意见反馈」或发送邮件至 mushengbooks@gmail.com 与我们联系。'],
    ];

    function renderPrivacyView() {
        const c = $('privacy-render'); if (!c) return;
        c.innerHTML = `
        <div class="cpage">
            <div class="cpage-hero">
                <div class="cpage-hero-badge"><i class="fa-solid fa-shield-halved"></i></div>
                <h1>${t('nav.privacy')}</h1>
                <p>我们遵循最小必要原则：能在本机完成的，就不上传。</p>
                <div class="cpage-hero-meta"><i class="fa-solid fa-clock-rotate-left"></i> 更新于 ${PRIVACY_UPDATED}</div>
            </div>

            <div class="cpage-section">
                <div class="policy-list">
                    ${PRIVACY_SECTIONS.map(([ico, title, body]) => `
                    <div class="policy-card">
                        <div class="policy-ico"><i class="fa-solid ${ico}"></i></div>
                        <div>
                            <h3>${title}</h3>
                            <p>${body}</p>
                        </div>
                    </div>`).join('')}
                </div>
            </div>

            <div class="cpage-note">本政策同时适用于慧读圣经网页版与手机 App，以中文版本为准。</div>
        </div>`;
    }

    // ── Profile / My Page ──
    // ── 「我的」面板（右栏 290–340px）──
    // 与 App 端 MePage 同构：概览页给身份 + 记录 + 入口，详情收进子页。
    // 窄栏平铺整套表单会堆到 900px+，两级结构才是简洁的做法。
    let _profileSub = null;   // null=概览 | 'info' | 'notify' | 'community'

    function profileStats() {
        const notes = Array.isArray(S.notes) ? S.notes : [];
        return [
            { key: 'highlights', label: t('profile.stat.highlight') || '高亮', value: Object.keys(S.highlights || {}).length },
            { key: 'notes', label: t('profile.stat.note') || '笔记', value: notes.filter(n => n.type !== 'ai_qa').length },
            { key: 'ai', label: t('profile.stat.ai') || '慧读', value: notes.filter(n => n.type === 'ai_qa').length },
        ];
    }

    function renderProfileView() {
        // 「我的」已从左侧栏移入右栏标签；容器随之改为面板内的 panel-profile-render
        const c = $('panel-profile-render') || $('profile-render'); if (!c) return;

        const userAuth = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
        const profile = JSON.parse(localStorage.getItem('ob_profile') || '{}');

        // ── 未登录：只给一句说明和一个入口，不铺任何表单 ──
        if (!userAuth) {
            _profileSub = null;
            c.innerHTML = `<div class="mep-guest">
                <div class="mep-avatar is-guest"><i class="fa-solid fa-user"></i></div>
                <b>${t('profile.guest') || '访客用户'}</b>
                <p>${t('profile.login_desc') || '登录以同步你的笔记、高亮与阅读进度'}</p>
                <button class="primary-btn mep-login">${t('profile.unlogged_btn') || '登录 / 注册'}</button>
            </div>`;
            c.querySelector('.mep-login')?.addEventListener('click', () => Auth.showModal());
            return;
        }

        const avatarSrc = profile.avatar || (typeof userAuth.avatar === 'string' && userAuth.avatar.startsWith('data:') ? userAuth.avatar : '');
        const name = profile.nickname || userAuth.username || userAuth.email || '';
        const avatarHtml = avatarSrc
            ? `<img src="${avatarSrc}" alt="">`
            : _escapeHtml((name || '?')[0].toUpperCase());

        // ── 子页 ──
        if (_profileSub) {
            const titles = { info: t('profile.info_title') || '个人信息', notify: t('profile.notify') || '通知设置', community: t('profile.myCommunity') || '我的社群', highlights: t('profile.stat.highlight') || '高亮' };
            c.innerHTML = `<div class="mep-subhead">
                    <button class="mep-back" aria-label="${t('cmty.back') || '返回'}"><i class="fa-solid fa-chevron-left"></i></button>
                    <b>${titles[_profileSub]}</b>
                </div>
                <div class="mep-subbody">${
                    _profileSub === 'info' ? profileInfoHtml(profile, userAuth)
                    : _profileSub === 'notify' ? profileNotifyHtml()
                    : _profileSub === 'highlights' ? profileHighlightsHtml()
                    : '<div class="mep-loading">' + (t('cmty.loading') || '加载中…') + '</div>'
                }</div>`;
            c.querySelector('.mep-back')?.addEventListener('click', () => { _profileSub = null; renderProfileView(); });
            if (_profileSub === 'info') bindProfileInfo(c, profile);
            if (_profileSub === 'notify') bindProfileNotify(c);
            if (_profileSub === 'community') loadProfileCommunities(c);
            if (_profileSub === 'highlights') bindProfileHighlights(c);
            return;
        }

        // ── 概览 ──
        const menu = [
            ['info', 'fa-id-card', t('profile.info_title') || '个人信息'],
            ['notify', 'fa-bell', t('profile.notify') || '通知设置'],
            ...(SHOW_COMMUNITY ? [['community', 'fa-user-group', t('profile.myCommunity') || '我的社群']] : []),
        ];
        c.innerHTML = `
        <div class="mep-hero">
            <button class="mep-avatar" title="${t('profile.change_avatar') || '更换头像'}">${avatarHtml}</button>
            <div class="mep-id">
                <b>${_escapeHtml(name)}</b>
                <small>${_escapeHtml(userAuth.email || '')}</small>
            </div>
            <input type="file" id="mep-avatar-input" accept="image/*" class="hidden">
        </div>

        <div class="mep-stats">
            ${profileStats().map(st => `<button class="mep-stat" data-stat="${st.key}"${st.value ? '' : ' disabled'}><b>${st.value}</b><small>${st.label}</small></button>`).join('')}
        </div>

        <div class="mep-menu">
            ${menu.map(([k, icon, label]) => `<button class="mep-item" data-sub="${k}">
                <i class="fa-solid ${icon}"></i><span>${label}</span><i class="fa-solid fa-chevron-right"></i>
            </button>`).join('')}
        </div>

        <div class="mep-menu">
            <button class="mep-item" data-view="download"><i class="fa-solid fa-mobile-screen-button"></i><span>${t('nav.download') || 'App 下载'}</span><i class="fa-solid fa-chevron-right"></i></button>
            <button class="mep-item" data-view="about"><i class="fa-solid fa-circle-info"></i><span>${t('nav.about') || '关于我们'}</span><i class="fa-solid fa-chevron-right"></i></button>
            <button class="mep-item" data-view="privacy"><i class="fa-solid fa-shield-halved"></i><span>${t('nav.privacy') || '隐私政策'}</span><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <button class="mep-logout">${t('profile.logout') || '退出登录'}</button>`;

        c.querySelectorAll('.mep-stat[data-stat]').forEach(b => {
            b.addEventListener('click', () => {
                const k = b.dataset.stat;
                if (k === 'highlights') { _profileSub = 'highlights'; renderProfileView(); return; }
                // 笔记与慧读复用笔记视图的类型筛选（手写 / AI）
                notesView.type = k === 'ai' ? 'ai_qa' : 'note';
                switchView('notes');
                document.querySelectorAll('#notes-type-chips .notes-chip').forEach(chip =>
                    chip.classList.toggle('active', chip.dataset.type === notesView.type));
                renderNotesList();
            });
        });
        c.querySelectorAll('.mep-item[data-sub]').forEach(b => {
            b.addEventListener('click', () => { _profileSub = b.dataset.sub; renderProfileView(); });
        });
        c.querySelectorAll('.mep-item[data-view]').forEach(b => {
            b.addEventListener('click', () => switchView(b.dataset.view));
        });
        c.querySelector('.mep-avatar')?.addEventListener('click', () => $('mep-avatar-input')?.click());
        bindAvatarUpload(c);
        c.querySelector('.mep-logout')?.addEventListener('click', () => {
            if (typeof Auth !== 'undefined') { Auth.logout(); _profileSub = null; renderProfileView(); }
        });
    }

    function profileInfoHtml(profile, userAuth) {
        const stages = ['', '慕道友', '初信者', '稳定读经', '同工/传道'];
        return `<div class="mep-form">
            <label><span>${t('profile.nickname') || '昵称'}</span>
                <input id="mep-nickname" value="${_escapeHtml(profile.nickname || userAuth.username || '')}" maxlength="30"></label>
            <label><span>${t('profile.email') || '邮箱'}</span>
                <input value="${_escapeHtml(userAuth.email || '')}" disabled></label>
            <label><span>${t('profile.phone') || '手机号'}</span>
                <input id="mep-phone" value="${_escapeHtml(profile.phone || '')}" placeholder="${t('profile.phone_ph') || '选填'}" maxlength="20"></label>
            <label><span>${t('profile.stage') || '属灵阶段'}</span>
                <select id="mep-stage">${stages.map(v => `<option value="${v}"${profile.stage === v ? ' selected' : ''}>${v || (t('profile.stage_ph') || '请选择…')}</option>`).join('')}</select></label>
            <button class="primary-btn mep-save">${t('profile.save') || '保存'}</button>
        </div>`;
    }

    function bindProfileInfo(c, profile) {
        c.querySelector('.mep-save')?.addEventListener('click', () => {
            profile.nickname = $('mep-nickname')?.value.trim() || '';
            profile.phone = $('mep-phone')?.value.trim() || '';
            profile.stage = $('mep-stage')?.value || '';
            localStorage.setItem('ob_profile', JSON.stringify(profile));
            if (typeof Auth !== 'undefined') Auth.updateTopBar();
            showToast(t('profile.saved') || '已保存');
            _profileSub = null;
            renderProfileView();
        });
    }

    // 高亮列表：网页版此前只能在经文里看到高亮，没有汇总入口。
    // 按书卷顺序排，点条目直接跳到那一节。
    function profileHighlightsHtml() {
        const entries = Object.entries(S.highlights || {});
        if (!entries.length) {
            return `<div class="cmty-empty"><p>${t('profile.noHighlights') || '还没有高亮，长按或右键经文即可标记'}</p></div>`;
        }
        const order = Object.keys(BOOK_CHAPTERS);
        entries.sort((a, b) => {
            const [ba, ca, va] = a[0].split('-'), [bb, cb, vb] = b[0].split('-');
            return (order.indexOf(ba) - order.indexOf(bb)) || (+ca - +cb) || (+va - +vb);
        });
        return `<div class="mep-menu">${entries.map(([ref, color]) => {
            const [bk, ch, vs] = ref.split('-');
            const text = (window.bibleData?.[S.version]?.[bk]?.[ch] || []).find(v => String(v.verse) === vs)?.text || '';
            const plain = plainVerseText(text);
            return `<button class="mep-item mep-hl" data-ref="${_escapeHtml(ref)}">
                <span class="mep-hl-dot" style="background:${_escapeHtml(color)}"></span>
                <span>${_escapeHtml(bookDisplayName(bk))} ${ch}:${vs}${plain ? `<small>${_escapeHtml(plain.slice(0, 30))}</small>` : ''}</span>
                <i class="fa-solid fa-chevron-right"></i>
            </button>`;
        }).join('')}</div>`;
    }

    function bindProfileHighlights(c) {
        c.querySelectorAll('.mep-hl').forEach(b => {
            b.addEventListener('click', () => {
                const [bk, ch, vs] = b.dataset.ref.split('-');
                navigateTo(bk, ch);   // 内部会切回阅读视图
                setTimeout(() => {
                    const el = document.querySelector(`.verse[data-ref="${b.dataset.ref}"]`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 400);
            });
        });
    }

    function profileNotifyHtml() {
        const subs = JSON.parse(localStorage.getItem('ob_subscriptions') || '{"daily":true,"commentary":true,"devotional":false,"video":false,"podcast":false}');
        const items = [
            ['daily', t('profile.sub.daily') || '每日经文', t('profile.sub.dailyDesc') || '每天推送一段经文'],
            ['commentary', t('profile.sub.commentary') || '注释更新', t('profile.sub.commentaryDesc') || '新增注释与研经资料'],
            ['devotional', t('profile.sub.devotional') || '灵修计划', t('profile.sub.devotionalDesc') || '读经计划进度提醒'],
        ];
        return `<div class="mep-switches">
            ${items.map(([k, label, desc]) => `<label class="mep-switch">
                <span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span>
                <input type="checkbox" class="sub-toggle" data-key="${k}"${subs[k] ? ' checked' : ''}>
                <i></i>
            </label>`).join('')}
        </div>`;
    }

    function bindProfileNotify(c) {
        c.querySelectorAll('.sub-toggle').forEach(tog => {
            tog.addEventListener('change', () => {
                const s = JSON.parse(localStorage.getItem('ob_subscriptions') || '{}');
                s[tog.dataset.key] = tog.checked;
                localStorage.setItem('ob_subscriptions', JSON.stringify(s));
                showToast(tog.checked ? (t('profile.subscribed') || '已订阅') : (t('profile.unsubscribed') || '已取消订阅'));
            });
        });
    }

    // 我的社群：与 App 的「管理的社群」同源，走社群列表接口
    async function loadProfileCommunities(c) {
        const body = c.querySelector('.mep-subbody');
        if (!body) return;
        try {
            const data = await _cmtyFetch('');
            const list = (data && data.communities) || [];
            body.innerHTML = list.length
                ? `<div class="mep-menu">${list.map(g => `<button class="mep-item" data-cid="${_escapeHtml(g.id)}">
                        ${_cmtyAvatar(g.abbreviation || g.name, g.avatarColor)}
                        <span>${_escapeHtml(g.name)}<small>${g.memberCount || 0} ${t('cmty.members') || '位成员'}${g.membershipRole === 'OWNER' ? ' · ' + ('群主') : ''}</small></span>
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>`).join('')}</div>`
                : `<div class="cmty-empty"><p>${t('cmty.noGroups') || '还没有加入任何社群'}</p></div>`;
            body.querySelectorAll('.mep-item[data-cid]').forEach(b => {
                b.addEventListener('click', () => {
                    switchPanelTab('community');
                    _cmtyOpen(b.dataset.cid);
                });
            });
        } catch (e) {
            body.innerHTML = `<div class="cmty-empty"><p>${_escapeHtml(e.message || '加载失败')}</p></div>`;
        }
    }

    function bindAvatarUpload(c) {
        $('mep-avatar-input')?.addEventListener('change', e => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { showToast(t('profile.avatar_too_large') || '头像不能超过 2MB'); return; }
            const reader = new FileReader();
            reader.onload = () => {
                const profile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
                profile.avatar = reader.result;
                localStorage.setItem('ob_profile', JSON.stringify(profile));
                if (typeof Auth !== 'undefined') Auth.updateTopBar();
                renderProfileView();
            };
            reader.readAsDataURL(file);
        });
    }
    // ── Update User Dropdown Data ──
    function updateUserDropdown() {
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        if (!user) return;

        // 异步向后端请求最新用户信息，静默同步本地缓存并刷新展示（解决旧账号本地缓存中无 plan 字段的问题）
        // 如果当前正在验证支付，或者 URL 中含有支付成功参数（表明正在处理回调），则不发起静默同步，避免时序竞争导致数据被旧数据覆盖
        const urlParams = new URLSearchParams(window.location.search);
        const isPaymentSuccess = urlParams.get('payment') === 'success';

        if (!isVerifyingPayment && !isPaymentSuccess) {
            fetch(`${S.apiBase}/auth/me`, { credentials: 'same-origin' })
            .then(res => {
                if (res.ok) return res.json();
            })
            .then(userData => {
                if (userData && typeof Auth !== 'undefined') {
                    const cachedUser = Auth.getUser() || {};
                    
                    // 防御性时序覆盖保护：如果本地计划已经更新为高级计划，而静默同步拉取到的仍是免费计划，
                    // 说明后端可能由于主从延迟或支付验证事务未提交，返回了旧数据，此时拒绝用旧的免费计划覆盖本地已升级的计划
                    if (cachedUser.plan && cachedUser.plan !== 'free' && userData.plan === 'free') {
                        console.warn('静默同步拉取到免费计划，但本地已是高级计划，已拦截降级覆盖');
                        return;
                    }

                    // 比对计划或过期时间是否发生变化，或者缓存字段不全时进行同步与局部重刷
                    if (cachedUser.plan !== userData.plan || !('plan' in cachedUser) || cachedUser.plan_expires_at !== userData.plan_expires_at) {
                        Auth.saveUser({
                            username: userData.username || userData.email,
                            email: userData.email,
                            avatar: userData.avatar_url || (userData.username || userData.email)[0].toUpperCase(),
                            role: userData.role,
                            plan: userData.plan,
                            plan_expires_at: userData.plan_expires_at,
                            stripe_subscription_id: userData.stripe_subscription_id
                        });
                        
                        renderQuotaAndPlan(userData);
                        updateQuotaDisplay();
                    }
                }
            })
            .catch(err => console.warn('Failed to silent sync user profile:', err));
        }

        // 先以本地缓存渲染以达到零延迟响应
        renderQuotaAndPlan(user);
        updateQuotaDisplay();
    }

    // ── Open Subscription Management Modal ──
    function openManageSubscriptionModal(user) {
        if (!user) return;
        
        // 1. 设置方案名称及描述
        const plan = user.plan || 'free';
        let planName = '免费计划';
        let planDesc = '每月 20 次 AI 研经对话';
        if (plan === 'basic') {
            planName = '基础计划';
            planDesc = '每月 100 次 AI 研经对话';
        } else if (plan === 'pro') {
            planName = '进阶计划';
            planDesc = '每月 300 次 AI 研经对话';
        } else if (plan === 'supporter') {
            planName = '支持者计划';
            planDesc = '每月 400 次 AI 研经对话';
        }

        const planNameEl = $('ms-plan-name');
        if (planNameEl) planNameEl.textContent = planName;

        const planDescEl = $('ms-plan-desc');
        if (planDescEl) planDescEl.textContent = planDesc;

        // 2. 设置通道
        const subId = user.stripe_subscription_id || '';
        const channelEl = $('ms-channel');
        if (channelEl) {
            if (subId.startsWith('mock_')) {
                channelEl.textContent = '本地 Mock 支付';
            } else if (subId) {
                channelEl.textContent = 'Stripe 快捷支付';
            } else {
                channelEl.textContent = '其他支付方式';
            }
        }

        // 3. 有效期至
        const expiresEl = $('ms-expires-at');
        if (expiresEl) {
            if (user.plan_expires_at) {
                expiresEl.textContent = user.plan_expires_at.substring(0, 10);
            } else {
                expiresEl.textContent = '永久有效 / 单次支付';
            }
        }

        // 4. 展示模态框
        $('manage-sub-modal')?.classList.remove('hidden');
    }

    // ── Open Support Modal with Dynamic Buttons ──
    async function openSupportModal() {
        if (typeof window.loadAndRenderSupportPlans === 'function') {
            await window.loadAndRenderSupportPlans();
        }
        renderSupportModalButtons();
        $('support-modal')?.classList.remove('hidden');
    }

    function renderSupportModalButtons() {
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        const currentPlan = (user && user.plan) ? user.plan : 'free';
        
        const planWeights = {
            'free': 0,
            'basic': 1,
            'pro': 2,
            'supporter': 3
        };
        const currentWeight = planWeights[currentPlan] || 0;
        const currentLang = (typeof getLang === 'function') ? getLang() : 'zh';

        document.querySelectorAll('.sm-card-btn[data-plan]').forEach(btn => {
            const plan = btn.dataset.plan;
            const weight = planWeights[plan] || 0;

            let textLower = '已支持高级方案';
            let textCurrentFree = '当前支持';
            let textCurrentSub = '已支持高级方案';
            let textUpgradeFree = '立即支持';
            let textUpgradeSub = '立即升级';

            if (currentLang === 'en') {
                textLower = 'Higher Plan Active';
                textCurrentFree = 'Current Plan';
                textCurrentSub = 'Active Plan';
                textUpgradeFree = 'Support Now';
                textUpgradeSub = 'Upgrade Now';
            } else if (currentLang === 'ko') {
                textLower = '상위 요금제 사용 중';
                textCurrentFree = '사용 중';
                textCurrentSub = '사용 중';
                textUpgradeFree = '후원하기';
                textUpgradeSub = '업그레이드';
            }

            if (weight < currentWeight) {
                // 比当前方案等级低
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.textContent = textLower;
            } else if (weight === currentWeight) {
                // 当前方案
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.textContent = currentPlan === 'free' ? textCurrentFree : textCurrentSub;
            } else {
                // 比当前方案等级高，可以升级
                btn.disabled = false;
                btn.classList.remove('disabled');
                btn.textContent = currentPlan === 'free' ? textUpgradeFree : textUpgradeSub;
            }
        });
    }

    // ── Render Dropdown Quota and Plan Badge ──
    function renderQuotaAndPlan(user) {
        if (!user) return;

        // 1. 头像和名字
        const localProfile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
        const displayName = localProfile.name || user.username || user.email || '';
        const localAvatar = localProfile.avatar;

        const nameEl = $('ud-name');
        if (nameEl) nameEl.textContent = displayName;

        const udAvatarEl = $('ud-avatar');
        if (udAvatarEl) {
            if (localAvatar && (localAvatar.startsWith('data:') || localAvatar.startsWith('http'))) {
                udAvatarEl.innerHTML = `<img src="${localAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                udAvatarEl.innerHTML = displayName ? displayName[0].toUpperCase() : '?';
            }
        }

        // 2. 配额、进度条与计划状态
        const plan = user.plan || 'free';
        let limit = 20;
        let planI18nKey = 'profile.free_plan';
        let planDefaultName = '免费计划';

        // 优先从加载的数据库套餐缓存中获取对话次数限额
        if (typeof currentPlansData !== 'undefined' && currentPlansData.length > 0) {
            const planConfig = currentPlansData.find(p => p.id === plan);
            if (planConfig) {
                limit = planConfig.dialogue_limit;
                
                const currentLang = (typeof getLang === 'function') ? getLang() : 'zh';
                if (currentLang === 'en') {
                    planDefaultName = planConfig.name_en || planConfig.name;
                } else if (currentLang === 'ko') {
                    planDefaultName = planConfig.name_ko || planConfig.name;
                } else {
                    planDefaultName = planConfig.name;
                }

                if (plan === 'basic') planI18nKey = 'profile.basic_plan';
                else if (plan === 'pro') planI18nKey = 'profile.pro_plan';
                else if (plan === 'supporter') planI18nKey = 'profile.supporter_plan';
            }
        } else {
            // 兜底硬编码
            if (plan === 'basic') {
                limit = 100;
                planI18nKey = 'profile.basic_plan';
                planDefaultName = '基础计划';
            } else if (plan === 'pro') {
                limit = 300;
                planI18nKey = 'profile.pro_plan';
                planDefaultName = '进阶计划';
            } else if (plan === 'supporter') {
                limit = 400;
                planI18nKey = 'profile.supporter_plan';
                planDefaultName = '支持者计划';
            }
        }

        const badgeEl = $('ud-badge');
        if (badgeEl) {
            badgeEl.setAttribute('data-i18n', planI18nKey);
            badgeEl.textContent = window.t ? window.t(planI18nKey) : planDefaultName;
        }

        const planTitleTextEl = $('ud-plan-title-text');
        if (planTitleTextEl) {
            planTitleTextEl.setAttribute('data-i18n', planI18nKey);
            planTitleTextEl.textContent = window.t ? window.t(planI18nKey) : planDefaultName;
        }

        const supportBtn = $('ud-support-btn');
        if (supportBtn) {
            if (plan !== 'free') {
                supportBtn.setAttribute('data-i18n', 'profile.manage_subscription');
                supportBtn.textContent = window.t ? window.t('profile.manage_subscription') : '管理支持';
            } else {
                supportBtn.setAttribute('data-i18n', 'profile.support_us');
                supportBtn.textContent = window.t ? window.t('profile.support_us') : '立即支持';
            }
        }

        const used = getAIUsageToday();
        const remaining = Math.max(0, limit - used);
        const quotaValEl = $('ud-quota-val');
        if (quotaValEl) {
            const _ql = typeof getLang === 'function' ? getLang() : 'zh';
            const _unit = _ql === 'ko' ? '건' : _ql === 'en' ? '' : '条';
            quotaValEl.textContent = `${remaining}/${limit}${_unit ? ' ' + _unit : ''}`;
        }

        const progressFill = $('ud-progress-fill');
        if (progressFill) {
            const pct = (remaining / limit) * 100;
            progressFill.style.width = `${pct}%`;
        }

        // 3. 笔记数
        const notesCountEl = $('ud-notes-count');
        if (notesCountEl) {
            notesCountEl.textContent = (S.notes || []).length;
        }
    }

    // ── Init: event listeners ──
    function setupEvents() {
        // User avatar dropdown control
        $('auth-avatar')?.addEventListener('click', e => {
            e.stopPropagation();
            const dropdown = $('user-dropdown');
            if (dropdown) {
                const isHidden = dropdown.classList.contains('hidden');
                if (isHidden) {
                    updateUserDropdown();
                    dropdown.classList.remove('hidden');
                } else {
                    dropdown.classList.add('hidden');
                }
            }
        });

        // 下拉菜单在 #auth-user-area 内，而后者点击会跳「我的」页；阻止下拉内部点击冒泡，
        // 否则「立即支持」「设置」等菜单项点完会被父级带去 profile 页（而非各自的弹窗/动作）。
        $('user-dropdown')?.addEventListener('click', e => e.stopPropagation());

        // Dropdown menu items click listeners
        $('ud-menu-notes')?.addEventListener('click', () => {
            switchPanelTab('notes');
            $('user-dropdown')?.classList.add('hidden');
        });
        $('ud-menu-bookmarks')?.addEventListener('click', () => {
            $('user-dropdown')?.classList.add('hidden');
            window.openCollectionsModal();
        });
        $('ud-menu-orders')?.addEventListener('click', () => {
            $('user-dropdown')?.classList.add('hidden');
            window.openOrdersModal();
        });
        $('ud-menu-settings')?.addEventListener('click', () => {
            switchView('settings');
            $('user-dropdown')?.classList.add('hidden');
        });
        $('ud-menu-feedback')?.addEventListener('click', () => {
            $('user-dropdown')?.classList.add('hidden');
            showToast(t('msg.feature_dev'));
        });
        $('ud-menu-logout')?.addEventListener('click', () => {
            $('user-dropdown')?.classList.add('hidden');
            if (typeof Auth !== 'undefined') Auth.logout();
        });

        // 点击计划卡片打开支持计划弹窗或管理订阅弹窗
        document.querySelector('.ud-plan-card')?.addEventListener('click', () => {
            $('user-dropdown')?.classList.add('hidden');
            const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
            if (user && user.plan && user.plan !== 'free') {
                openManageSubscriptionModal(user);
            } else {
                openSupportModal();
            }
        });

        // 支持计划模态框关闭
        $('support-modal-close')?.addEventListener('click', () => {
            $('support-modal')?.classList.add('hidden');
        });
        $('support-modal-backdrop')?.addEventListener('click', () => {
            $('support-modal')?.classList.add('hidden');
        });

        // 收藏夹模态框关闭
        $('collections-close')?.addEventListener('click', () => {
            window.closeCollectionsModal();
        });
        $('collections-backdrop')?.addEventListener('click', () => {
            window.closeCollectionsModal();
        });

        // 订单模态框关闭
        $('orders-close')?.addEventListener('click', () => {
            window.closeOrdersModal();
        });
        $('orders-backdrop')?.addEventListener('click', () => {
            window.closeOrdersModal();
        });

        // 管理订阅模态框关闭
        $('manage-sub-close')?.addEventListener('click', () => {
            $('manage-sub-modal')?.classList.add('hidden');
        });
        $('manage-sub-backdrop')?.addEventListener('click', () => {
            $('manage-sub-modal')?.classList.add('hidden');
        });

        // 管理订阅升级按钮
        $('ms-upgrade-btn')?.addEventListener('click', () => {
            $('manage-sub-modal')?.classList.add('hidden');
            openSupportModal();
        });

        // 管理订阅取消支持按钮
        $('ms-cancel-btn')?.addEventListener('click', async () => {
            if (!confirm(t('msg.confirm_cancel_sub'))) return;
            // NOTE: 在线支付暂未开放（Stripe 代码保留，后端未启用）
            showToast('支持计划管理即将开放');
            if (true) return;

            try {
                showToast(t('msg.processing'), 2000);
                const apiBase = '/api/web';

                const res = await fetch(`${apiBase}/payment/customer-portal`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || '操作失败，请稍后重试');
                }
                const data = await res.json();
                
                if (data.url) {
                    showToast(t('msg.going_billing'), 1500);
                    setTimeout(() => {
                        window.location.href = data.url;
                    }, 1000);
                } else if (data.mock) {
                    showToast(t('msg.cancel_success'), 4000);
                    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
                    if (user && typeof Auth !== 'undefined') {
                        Auth.saveUser({
                            ...user,
                            plan: 'free',
                            plan_expires_at: null,
                            stripe_subscription_id: null
                        }, token);
                        Auth.updateTopBar();
                        updateUserDropdown();
                    }
                    $('manage-sub-modal')?.classList.add('hidden');
                }
            } catch (err) {
                showToast(err.message || '操作失败，请重试');
                console.error('Portal redirect error:', err);
            }
        });

        // 动态支持计划缓存
        let currentPlansData = [];
        let currentPlanPeriodMode = 'monthly';

        function escapeHTML(str) {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        // 异步加载并动态绘制支持套餐卡片
        window.loadAndRenderSupportPlans = async function() {
            try {
                const apiBase = '/api/web';
                const res = await fetch(`${apiBase}/support-plans/public`);
                if (!res.ok) throw new Error('API failed');
                const data = await res.json();
                if (data && data.length > 0) {
                    currentPlansData = data;
                    renderSupportCards(data);

                    // 重新根据获取的动态套餐限额，渲染用户的限额展示
                    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
                    if (user) {
                        renderQuotaAndPlan(user);
                    }
                }
            } catch (e) {
                console.warn('Failed to load support plans from API, fallback to default static HTML plans.', e);
            }
        };

        // 监听语言切换事件，以实时重绘卡片和配额
        document.addEventListener('langchange', () => {
            if (currentPlansData && currentPlansData.length > 0) {
                renderSupportCards(currentPlansData);
                const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
                if (user) {
                    renderQuotaAndPlan(user);
                }
            }
        });

        function renderSupportCards(plans) {
            const container = document.querySelector('.sm-cards-container');
            if (!container) return;

            container.innerHTML = '';
            const currentLang = (typeof getLang === 'function') ? getLang() : 'zh';

            plans.forEach(plan => {
                let badgeVal = plan.badge;
                if (currentLang === 'en') {
                    badgeVal = plan.badge_en || plan.badge;
                } else if (currentLang === 'ko') {
                    badgeVal = plan.badge_ko || plan.badge;
                }
                const badgeHtml = badgeVal ? `<div class="sm-card-badge">${escapeHTML(badgeVal)}</div>` : '';
                const priceVal = currentPlanPeriodMode === 'monthly' ? plan.price_monthly : plan.price_once;
                
                let periodVal = '/月';
                if (currentPlanPeriodMode === 'monthly') {
                    periodVal = currentLang === 'en' ? '/month' : (currentLang === 'ko' ? '/월' : '/月');
                } else {
                    periodVal = currentLang === 'en' ? '/once' : (currentLang === 'ko' ? '/회' : '/次');
                }

                const priceValId = `sm-price-${plan.id}`;
                const periodValId = `sm-period-${plan.id}`;

                let planName = plan.name;
                let planFeaturesStr = plan.features;
                if (currentLang === 'en') {
                    planName = plan.name_en || plan.name;
                    planFeaturesStr = plan.features_en || plan.features;
                } else if (currentLang === 'ko') {
                    planName = plan.name_ko || plan.name;
                    planFeaturesStr = plan.features_ko || plan.features;
                }

                // 特性列表以 \n 分隔
                const features = planFeaturesStr.split('\n').filter(f => f.trim() !== '');
                const featuresHtml = features.map(feat => `
                    <div class="sm-feature-item">
                        <i class="fa-regular fa-circle-check"></i>
                        <span>${escapeHTML(feat)}</span>
                    </div>
                `).join('');

                const card = document.createElement('div');
                card.className = `sm-card ${plan.id === 'supporter' ? 'supporter' : ''} ${plan.badge ? 'popular' : ''}`;
                
                const titleIcon = plan.id === 'free' 
                    ? '' 
                    : (plan.id === 'basic' 
                        ? '<i class="fa-solid fa-sparkle" style="color:var(--accent); font-size:0.85rem;"></i> '
                        : '<i class="fa-solid fa-sparkles" style="color:var(--accent); font-size:0.85rem;"></i> ');

                card.innerHTML = `
                    ${badgeHtml}
                    <div class="sm-card-body">
                        <h3 class="sm-card-title">${titleIcon}${escapeHTML(planName)}</h3>
                        <div class="sm-card-price">
                            <span class="sm-currency">$</span><span class="sm-price-val" id="${priceValId}">${priceVal}</span><span class="sm-period" id="${periodValId}">${periodVal}</span>
                        </div>
                        <button class="sm-card-btn sm-action-btn ${plan.id === 'free' ? 'disabled' : ''} ${plan.id === 'supporter' ? 'highlight' : ''}" data-plan="${plan.id}" ${plan.id === 'free' ? 'disabled' : ''}>
                            ${plan.id === 'free' ? (currentLang === 'en' ? 'Current Plan' : (currentLang === 'ko' ? '사용 중' : '当前支持')) : (currentLang === 'en' ? 'Support Now' : (currentLang === 'ko' ? '후원하기' : '立即支持'))}
                        </button>
                        <div class="sm-features-list">
                            ${featuresHtml}
                        </div>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        // 支持计划价格模式（连续每月 / 单月支持）切换
        const togglePlanPeriod = (mode) => {
            currentPlanPeriodMode = mode;
            const btnMonthly = $('sm-toggle-monthly');
            const btnOnce = $('sm-toggle-once');
            if (!btnMonthly || !btnOnce) return;

            const setElText = (id, val) => {
                const el = $(id);
                if (el) el.textContent = val;
            };

            if (mode === 'monthly') {
                btnMonthly.classList.add('active');
                btnOnce.classList.remove('active');
            } else {
                btnMonthly.classList.remove('active');
                btnOnce.classList.add('active');
            }

            if (currentPlansData && currentPlansData.length > 0) {
                const currentLang = (typeof getLang === 'function') ? getLang() : 'zh';
                currentPlansData.forEach(plan => {
                    const price = mode === 'monthly' ? plan.price_monthly : plan.price_once;
                    
                    let period = '/月';
                    if (mode === 'monthly') {
                        period = currentLang === 'en' ? '/month' : (currentLang === 'ko' ? '/월' : '/月');
                    } else {
                        period = currentLang === 'en' ? '/once' : (currentLang === 'ko' ? '/회' : '/次');
                    }
                    
                    setElText(`sm-price-${plan.id}`, price.toString());
                    setElText(`sm-period-${plan.id}`, period);
                });
            } else {
                if (mode === 'monthly') {
                    setElText('sm-price-basic', '4.99');
                    setElText('sm-period-basic', '/月');
                    setElText('sm-price-pro', '9.99');
                    setElText('sm-period-pro', '/月');
                    setElText('sm-price-supporter', '14.99');
                    setElText('sm-period-supporter', '/月');
                } else {
                    setElText('sm-price-basic', '5.99');
                    setElText('sm-period-basic', '/次');
                    setElText('sm-price-pro', '11.99');
                    setElText('sm-period-pro', '/次');
                    setElText('sm-price-supporter', '17.99');
                    setElText('sm-period-supporter', '/次');
                }
            }
        };

        $('sm-toggle-monthly')?.addEventListener('click', () => togglePlanPeriod('monthly'));
        $('sm-toggle-once')?.addEventListener('click', () => togglePlanPeriod('once'));

        // 卡片行动按钮点击事件 (事件委托绑定至容器)
        document.querySelector('.sm-cards-container')?.addEventListener('click', async (e) => {
            const btn = e.target.closest('.sm-action-btn');
            if (!btn || btn.disabled) return;

            const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
            if (!user) {
                showToast(window.t ? window.t('profile.unlogged_prompt') : '请先登录以支持我们');
                if (typeof Auth !== 'undefined') Auth.showModal('login');
                return;
            }

            const planType = btn.dataset.plan;
            const isMonthly = $('sm-toggle-monthly')?.classList.contains('active');
            const period = isMonthly ? 'monthly' : 'once';

            // NOTE: 在线支付暂未开放（Stripe 代码保留，后端未启用）
            showToast('在线支持功能即将开放，感谢你的心意');
            if (true) return;

            try {
                showToast(t('msg.creating_session'), 2000);
                const apiBase = '/api/web';

                const response = await fetch(`${apiBase}/payment/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        plan_type: planType,
                        period: period
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || '创建会话失败');
                }

                if (data.url) {
                    showToast(t('msg.going_payment'), 1500);
                    setTimeout(() => {
                        window.location.href = data.url;
                    }, 1000);
                } else {
                    throw new Error('未获得付款跳转链接');
                }
            } catch (error) {
                showToast(error.message || '跳转付款失败，请重试');
                console.error('Payment redirect error:', error);
            }
        });

        // 底部脚注链接点击事件
        $('sm-apply-sponsor')?.addEventListener('click', e => { e.preventDefault(); showToast(t('msg.sponsor_prep')); });
        $('sm-promo-code')?.addEventListener('click', e => { e.preventDefault(); showToast(t('msg.promo_soon')); });
        $('sm-rules')?.addEventListener('click', e => { e.preventDefault(); showToast(t('msg.rules')); });

        // Nav view switcher
        document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => switchView(btn.dataset.view));
        });

        // Testament toggling
        document.querySelectorAll('.testament-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.testament-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderBookList();
            });
        });

        // Chapter navigation
        $('prev-ch')?.addEventListener('click', () => goChapter(-1));
        $('next-ch')?.addEventListener('click', () => goChapter(1));

        // Breadcrumb chapter picker
        $('book-btn-top')?.addEventListener('click', openBookPicker);
        $('ch-btn-top')?.addEventListener('click', openChapterPicker);

        // Version select — update breadcrumb language based on version, but keep UI language unchanged
        $('version-select')?.addEventListener('change', e => {
            S.version = e.target.value;
            
            // NOTE: Add UI language auto-switching
            if (typeof setLang === 'function') {
                const targetLang = getContentLang();
                if (getLang() !== targetLang) {
                    setLang(targetLang);
                }
            }

            // Update breadcrumb book name and chapter label to match version language
            const bc = $('breadcrumb-book');
            if (bc) bc.textContent = bookDisplayName(S.book);
            const bcc = $('breadcrumb-ch');
            if (bcc) bcc.textContent = getChLabel(S.chapter);
            
            S.selection.clear();
            S.lastRef = null;
            stopBibleAudio(); // Stop any currently playing audio for the previous version
            clearAIChat();    // 清空 AI 对话

            // Re-render sidebar book list with content language
            renderBookList();
            renderBibleText();
            updateSelectionBar();
            updateStudyPanel();
            
            // Refresh contextual AI prompts and chapter overview for the new version
            if (typeof updateAIPresets === 'function') updateAIPresets();
            renderChapterOverview();
            
            // NOTE: 若当前停在注释 Tab，切换版本后刷新注释
            if (S.panelTab === 'study') renderStudyTabContent();
        });

        // Panel tabs（社群关闭时先把标签与面板从 DOM 摘掉，避免空占位）
        if (!SHOW_COMMUNITY) {
            document.querySelector('.panel-tab[data-tab="community"]')?.remove();
            $('tab-community')?.remove();
        }
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => switchPanelTab(tab.dataset.tab));
        });

        // Compare button — opens comparison overlay
        $('compare-btn')?.addEventListener('click', openCompare);

        // Mobile nav
        $('mobile-nav-btn')?.addEventListener('click', () => {
            const nav = $('left-nav');
            nav.classList.toggle('mobile-open');
            $('mobile-overlay').classList.toggle('hidden', !nav.classList.contains('mobile-open'));
        });

        // Mobile overlay close
        $('mobile-overlay')?.addEventListener('click', () => {
            $('left-nav').classList.remove('mobile-open');
            $('study-panel').classList.remove('mobile-open');
            $('mobile-overlay').classList.add('hidden');
        });

        // Shared nav toggle logic
        function toggleNav() {
            const app = document.getElementById('app');
            app.classList.toggle('nav-hidden');
            const collapsed = app.classList.contains('nav-hidden');
            // Update the in-sidebar collapse icon direction
            const collapseIcon = $('nav-collapse-btn')?.querySelector('i');
            if (collapseIcon) collapseIcon.className = `fa-solid fa-angles-${collapsed ? 'right' : 'left'}`;
        }

        // 默认不收起：无论上个会话处于什么状态，启动一律展开侧栏
        document.getElementById('app')?.classList.remove('nav-hidden');
        // 正文字体偏好（黑体/宋体）
        if (localStorage.getItem('ob_font') === 'serif') document.body.classList.add('serif-body');
        // 图标栏没有文字，悬停用 title 提示（文本取自被隐藏的 span，随语言切换过的文案）
        document.querySelectorAll('.nav-item[data-view], #theme-btn').forEach(b => {
            const label = b.querySelector('span')?.textContent.trim();
            if (label) b.title = label;
        });
        // Always-visible top-bar toggle button
        $('nav-toggle-btn')?.addEventListener('click', toggleNav);

        // Theme
        $('theme-btn')?.addEventListener('click', () => applyTheme(S.theme === 'dark' ? 'light' : 'dark'));

        // Search
        $('search-btn')?.addEventListener('click', openSearch);
        $('search-close')?.addEventListener('click', closeSearch);
        $('search-backdrop')?.addEventListener('click', closeSearch);

        // 搜索范围筛选：全部 / 旧约 / 新约
        $('search-scope-bar')?.addEventListener('click', e => {
            const chip = e.target.closest('.search-scope-chip');
            if (!chip) return;
            _searchScope = chip.dataset.scope;
            document.querySelectorAll('#search-scope-bar .search-scope-chip')
                .forEach(c => c.classList.toggle('active', c === chip));
            // 若已有查询词，按新范围重新搜索
            const val = ($('search-input')?.value || '').trim();
            if (val.length >= 2) doSearch(val);
        });

        // Clear button
        $('search-clear-btn')?.addEventListener('click', () => {
            $('search-input').value = '';
            $('search-results').innerHTML = '';
            updateSearchClearBtn();
            renderSearchSuggestions('');
            $('search-input').focus();
        });

        // Debounce search input — suggestions for short, API search for long
        let searchTimeout;
        $('search-input')?.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            const val = e.target.value;
            updateSearchClearBtn();
            _searchActiveIdx = -1;

            if (val.trim().length < 2) {
                // Show suggestions instantly for short input
                renderSearchSuggestions(val);
            } else {
                // Debounce API search for longer input
                renderSearchSuggestions(val); // clear suggestion layer
                searchTimeout = setTimeout(() => {
                    doSearch(val);
                }, 350);
            }
        });

        // Keyboard navigation in search
        $('search-input')?.addEventListener('keydown', e => {
            if (e.key === 'Escape') { closeSearch(); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); navigateSearchItems(1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); navigateSearchItems(-1); return; }
            if (e.key === 'Enter') { e.preventDefault(); activateSearchItem(); return; }
        });

        // Selection bar actions
        $('sel-copy-btn')?.addEventListener('click', copySelection);
        $('sel-clear-btn')?.addEventListener('click', () => { S.selection.clear(); S.lastRef = null; renderVerseStates(); updateSelectionBar(); updateStudyPanel(); });
        $('sel-note-btn')?.addEventListener('click', () => { switchView('notes'); });
        $('sel-share-btn')?.addEventListener('click', () => { copySelection(); });
        document.querySelectorAll('.sel-dot').forEach(dot => {
            dot.addEventListener('click', () => applyColor(dot.dataset.color));
        });

        // Context menu actions
        $('ctx-copy')?.addEventListener('click', () => { copySelection(); hideCtxMenu(); });
        $('ctx-note')?.addEventListener('click', () => { switchView('notes'); hideCtxMenu(); });
        $('ctx-bookmark')?.addEventListener('click', () => { addBookmark(); hideCtxMenu(); });
        document.querySelectorAll('.ctx-color').forEach(dot => {
            dot.addEventListener('click', () => { applyColor(dot.dataset.color); hideCtxMenu(); });
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.ctx-menu')) hideCtxMenu();
            const dropdown = $('user-dropdown');
            if (dropdown && !dropdown.classList.contains('hidden')) {
                if (!e.target.closest('#auth-user-area')) {
                    dropdown.classList.add('hidden');
                }
            }
        });

        // AI send
        $('ai-search-btn')?.addEventListener('click', sendAIQuestion);
        $('ai-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIQuestion(); });
        setupAIComposer();

        // AI preset questions dynamically populated based on spiritual stage
        window.updateAIPresets = async function() {
            const container = $('ai-preset-questions');
            if (!container) return;
            
            // 1. Fetch stages from DB if not already cached
            if (S.spiritualStages.length === 0) {
                try {
                    const res = await fetch(`${S.apiBase}/spiritual/stages?category=general`);
                    if (res.ok) {
                        S.spiritualStages = await res.json();
                    }
                } catch (e) {
                    console.error("Failed to fetch spiritual stages:", e);
                }
            }

            // 2. Determine which stage to use
            const p = JSON.parse(localStorage.getItem('ob_profile') || '{}');
            const levelNum = parseInt(p.level || "2"); 
            
            let targetStage = S.spiritualStages.find(s => s.sort_order === levelNum) || 
                              S.spiritualStages[Math.min(levelNum - 1, S.spiritualStages.length - 1)] ||
                              S.spiritualStages[0];

            // 2.5 Generate contextual prompts based on current book/chapter
            const bookName = bookDisplayName(S.book);
            const chNum = S.chapter;
            const themes = BOOK_THEMES[S.book] || [];
            let contextualHtml = '';
            if (themes.length > 0) {
                // 主题词(BOOK_THEMES)为中文数据，非中文环境拼进去会中英混杂；
                // 改用通用、可完整本地化的提问模板（书名已本地化）。
                const tpl = (k) => t(k).replace('{book}', bookName).replace('{ch}', chNum);
                const q1 = tpl('preset.explain');
                const q2 = tpl('preset.summarize');
                contextualHtml = `
                    <button class="ai-preset-btn contextual" data-question="${q1}"><span>${q1}</span></button>
                    <button class="ai-preset-btn contextual" data-question="${q2}"><span>${q2}</span></button>
                `;
            }

            // 3. Render: contextual first, then stage questions
            let stageHtml = '';
            if (targetStage && targetStage.questions && targetStage.questions.length > 0) {
                stageHtml = targetStage.questions.map((q) => `
                    <button class="ai-preset-btn" data-question="${q.question_text}">
                        <span>${q.question_text}</span>
                    </button>
                `).join('');
            }
            container.innerHTML = contextualHtml + stageHtml;

            // 4. Attach listeners
            container.querySelectorAll('.ai-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const q = btn.dataset.question;
                    if (q) {
                        $('ai-search-input').value = q;
                        sendAIQuestion();
                    }
                });
            });
        };

        // Update Verse Drawer specific questions (桌面端：更新经文研读快捷提问)
        // NOTE: 桌面端没有独立的经文研读 chip 容器，所以选中经文时在 ai-preset-questions 容器中切换为 verse_drawer 问题
        window.updateVerseDrawerPresets = async function(hasSelection) {
            const container = $('ai-preset-questions');
            if (!container) return;

            // 1. Fetch verse drawer questions if not cached
            if (S.spiritualVerseQuestions.length === 0) {
                try {
                    const res = await fetch(`${S.apiBase}/spiritual/stages?category=verse_drawer`);
                    if (res.ok) {
                        S.spiritualVerseQuestions = await res.json();
                    }
                } catch (e) {
                    console.error("Failed to fetch verse drawer stages:", e);
                }
            }

            if (!hasSelection) {
                // 无选中：恢复首页通用问题
                window.updateAIPresets();
                return;
            }

            // 2. Match stage
            S.profile = JSON.parse(localStorage.getItem('ob_profile') || '{"level": "2"}');
            const levelNum = parseInt(S.profile.level || "2");
            let targetStage = S.spiritualVerseQuestions.find(s => s.sort_order === levelNum) || 
                              S.spiritualVerseQuestions[Math.min(levelNum - 1, S.spiritualVerseQuestions.length - 1)] ||
                              S.spiritualVerseQuestions[0];

            if (!targetStage || !targetStage.questions || targetStage.questions.length === 0) {
                // Fallback to default verse questions
                container.innerHTML = `
                    <button class="ai-preset-btn" data-question="解释这段经文的含义"><span>释义</span></button>
                    <button class="ai-preset-btn" data-question="这段经文的历史背景是什么？"><span>历史背景</span></button>
                    <button class="ai-preset-btn" data-question="如何将这段经文应用在生活中？"><span>生活应用</span></button>
                `;
            } else {
                container.innerHTML = targetStage.questions.map((q) => `
                    <button class="ai-preset-btn" data-question="${q.question_text}">
                        <span>${q.question_text}</span>
                    </button>
                `).join('');
            }

            // 3. Bind clicks
            container.querySelectorAll('.ai-preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const q = btn.dataset.question;
                    if (q) {
                        $('ai-search-input').value = q;
                        sendAIQuestion();
                    }
                });
            });
        };

        // Initialize presets on load
        updateAIPresets();
        // Initialize VIP quota display
        updateQuotaDisplay();

        // Notes
        $('save-note-btn')?.addEventListener('click', saveNote);
        $('note-input')?.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') saveNote(); });

        // 历史笔记工具栏（搜索/筛选/排序/分组）只需绑定一次
        setupNotesToolbar();

        // 笔记列表事件委托：AI 答案展开、手写内容展开、分组折叠（列表重渲染无需重新绑定）
        $('notes-list')?.addEventListener('click', e => {
            // 分组组头：折叠/展开该书卷
            const header = e.target.closest('.notes-group-header');
            if (header) {
                const code = header.dataset.group;
                if (_collapsedNoteGroups.has(code)) _collapsedNoteGroups.delete(code);
                else _collapsedNoteGroups.add(code);
                header.closest('.notes-group')?.classList.toggle('collapsed');
                return;
            }
            // AI 问答笔记答案区展开/收起
            const answerEl = e.target.closest('.note-ai-answer');
            if (answerEl) {
                answerEl.classList.toggle('expanded');
                return;
            }
            // 笔记正文超长时点击展开/收起（手写与慧读卡通用）
            const textEl = e.target.closest('.clampable');
            if (textEl) {
                textEl.classList.toggle('is-open');
            }
        });


        // Chapter picker close
        $('picker-close')?.addEventListener('click', () => $('chapter-overlay').classList.add('hidden'));
        $('chapter-backdrop')?.addEventListener('click', () => $('chapter-overlay').classList.add('hidden'));
        $('picker-back-btn')?.addEventListener('click', () => {
            $('picker-books').classList.remove('hidden');
            $('picker-chapters').classList.add('hidden');
            $('picker-title').textContent = '选择书卷';
        });

        // Listen btn
        $('listen-btn')?.addEventListener('click', () => { window._openAudioPlayer && window._openAudioPlayer(); });

        // 声音切换按钮：切换后重新加载音频
        $('apb-voice-toggle')?.addEventListener('click', () => {
            // NOTE: 旧约不支持切换（只有男声），此分支理论上不触发
            const NT_BOOKS = new Set(['mat','mrk','luk','jhn','act','rom','1co','2co','gal','eph',
                'php','col','1th','2th','1ti','2ti','tit','phm','heb',
                'jas','1pe','2pe','1jn','2jn','3jn','jud','rev']);
            if (!NT_BOOKS.has(S.book)) return;
            S.voice = S.voice === 'female' ? 'male' : 'female';
            localStorage.setItem('ob_voice', S.voice);
            $('apb-voice-label').textContent = S.voice === 'female' ? '女声' : '男声';
            // 重新打开播放器（会重新拉取对应声音的音频）
            window._openAudioPlayer && window._openAudioPlayer();
        });

        // Keyboard
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                closeSearch();
                $('chapter-overlay').classList.add('hidden');
                if (_compareMode) { _compareMode = false; $('compare-btn')?.classList.remove('active'); renderBibleText(true); }
                hideCtxMenu();
                // Also close panel on mobile
                if (window.innerWidth <= 768 && $('study-panel').classList.contains('mobile-open')) {
                    $('study-panel').classList.remove('mobile-open');
                    $('mobile-overlay').classList.add('hidden');
                }
            }
            if (e.key === '/' && !e.target.matches('input,textarea')) { e.preventDefault(); openSearch(); }
        });

        // ── Bottom nav bar (mobile) ──
        document.querySelectorAll('.bottom-nav-btn[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                switchView(btn.dataset.view);
                // Update active state on bottom nav
                document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Close any open panels
                $('study-panel').classList.remove('mobile-open');
                $('mobile-overlay').classList.add('hidden');
            });
        });

        // Bottom study/panel button: toggle bottom sheet
        $('bottom-study-btn')?.addEventListener('click', () => {
            const panel = $('study-panel');
            const overlay = $('mobile-overlay');
            const isOpen = panel.classList.contains('mobile-open');
            document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
            if (isOpen) {
                panel.classList.remove('mobile-open');
                overlay.classList.add('hidden');
            } else {
                panel.classList.add('mobile-open');
                overlay.classList.remove('hidden');
                $('bottom-study-btn').classList.add('active');
            }
        });

        // Bottom search button
        $('bottom-search-btn')?.addEventListener('click', openSearch);

        // Touch swipe-down to close bottom sheet
        let touchStartY = 0;
        $('study-panel')?.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
        $('study-panel')?.addEventListener('touchend', e => {
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (dy > 80 && window.innerWidth <= 768) {
                $('study-panel').classList.remove('mobile-open');
                $('mobile-overlay').classList.add('hidden');
                document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.bottom-nav-btn[data-view="reading"]')?.classList.add('active');
            }
        }, { passive: true });
    }

    let _followAlong = false;
    let _followActiveRef = null;
    let _explicitTimestamps = null;

    async function openAudioPlayer() {
        const bar = $('audio-player-bar');
        if (!bar) return;

        // NOTE: 新约书卷支持双声音切换；旧约固定男声
        const NT_BOOKS = new Set(['mat','mrk','luk','jhn','act','rom','1co','2co','gal','eph',
            'php','col','1th','2th','1ti','2ti','tit','phm','heb',
            'jas','1pe','2pe','1jn','2jn','3jn','jud','rev']);
        const isNT = NT_BOOKS.has(S.book);

        // NOTE: 声音由后台统一配置，前端不再允许用户手动切换
        // 旧约始终用 male；新约则使用后端配置的 ntVoice
        S.voice = isNT ? S.ntVoice : 'male';

        // 声音按钮保持隐藏（已移出前端切换）
        const voiceToggleBtn = $('apb-voice-toggle');
        if (voiceToggleBtn) voiceToggleBtn.classList.add('hidden');

        let audioUrl = null;
        _explicitTimestamps = null;

        // 朗读音源与 App 共用 /api/mobile/audio（豆包 TTS 的 CDN 产物）。
        // 旧的 /api/web/audio/* 是 FastAPI 时代的接口，后端整合时未移植，一直 404。
        // 拼音版与和合本同一份经文，共用和合本录音；新译本暂无对应录音。
        if (S.version === 'cnvs') {
            showToast(t('toast.no-audio'));
            return;
        }
        const listenBtn = $('listen-btn');
        if (listenBtn) {
            listenBtn.disabled = true;
            listenBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>加载中...</span>';
        }
        try {
            const res = await fetch(`/api/mobile/audio?version=cuv&book=${S.book}&chapter=${S.chapter}&voice=${S.voice}`);
            const data = res.ok ? await res.json() : null;
            if (data && data.ok && data.audioUrl) {
                audioUrl = data.audioUrl;
                if (Array.isArray(data.timestamps) && data.timestamps.length) {
                    _explicitTimestamps = data.timestamps;
                }
            }
        } catch (e) {
            console.error('Audio fetch failed', e);
        } finally {
            if (listenBtn) {
                listenBtn.disabled = false;
                listenBtn.innerHTML = '<i class="fa-solid fa-headphones"></i> <span data-i18n="topbar.listen">收听</span>';
            }
        }

        if (!audioUrl) {
            showToast(t('toast.no-audio'));
            return;
        }

        bar.classList.remove('hidden');

        bar.classList.remove('hidden');
        const bookName = bookDisplayName(S.book);
        $('apb-title').textContent = bookName + ' ' + getChLabel(S.chapter);

        const audioEl = $('main-audio-player');
        if (audioEl) {
            audioEl.src = audioUrl;
            audioEl.load();
            audioEl.play().catch(e => console.warn("Autoplay blocked", e));
        }

        setupAudioPlayerEvents();
    }

    let _audioEventsReady = false;
    function setupAudioPlayerEvents() {
        if (_audioEventsReady) return;
        _audioEventsReady = true;

        const audioEl = $('main-audio-player');
        const playBtn = $('apb-play');
        const playIcon = $('apb-play-icon');
        const progressEl = $('apb-progress');
        const timeEl = $('apb-time');
        const speedEl = $('apb-speed');
        const followBtn = $('apb-follow');
        const closeBtn = $('apb-close');

        if (!audioEl) return;

        function fmtTime(s) {
            if (isNaN(s)) return '0:00';
            return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
        }

        function updateUI() {
            const cur = audioEl.currentTime;
            const dur = audioEl.duration || 0;
            if (dur > 0) {
                progressEl.value = Math.round((cur / dur) * 100);
            }
            timeEl.textContent = fmtTime(cur) + ' / ' + fmtTime(dur);
            if (_followAlong) doFollowAlong(cur);
        }

        audioEl.addEventListener('timeupdate', updateUI);
        audioEl.addEventListener('play', () => { if (playIcon) playIcon.className = 'fa-solid fa-pause'; });
        audioEl.addEventListener('pause', () => { if (playIcon) playIcon.className = 'fa-solid fa-play'; });
        audioEl.addEventListener('ended', () => { if (playIcon) playIcon.className = 'fa-solid fa-play'; });

        playBtn?.addEventListener('click', () => {
            if (audioEl.paused) audioEl.play();
            else audioEl.pause();
        });

        progressEl?.addEventListener('input', () => {
            if (audioEl.duration) {
                audioEl.currentTime = (audioEl.duration * progressEl.value) / 100;
            }
        });

        speedEl?.addEventListener('change', () => {
            audioEl.playbackRate = parseFloat(speedEl.value) || 1;
        });

        followBtn?.addEventListener('click', () => {
            _followAlong = !_followAlong;
            followBtn.classList.toggle('active', _followAlong);
            if (!_followAlong) clearFollowHighlight();
        });

        closeBtn?.addEventListener('click', () => {
            audioEl.pause();
            clearFollowHighlight();
            $('audio-player-bar').classList.add('hidden');
        });
    }

    let _dynamicVerseTimes = null;
    let _dynamicVerseKey = null;

    function calculateDynamicTimes(audioDur) {
        const key = S.version + '-' + S.book + '-' + S.chapter;
        if (_dynamicVerseKey === key && _dynamicVerseTimes) return _dynamicVerseTimes;

        // 这里需要兼容异步从 API 拉取的经文数据。我们尝试回退到已渲染到 DOM 中的经文节点来统计字数
        const verseNodes = document.querySelectorAll('.verse');
        if (verseNodes.length === 0 || !audioDur) return null;

        // TTS 在合并经文时使用了 "。" 进行连接，这会在音频中产生额外约 0.5~0.8 秒停顿。
        // 为了防止漂移，我们给每节经文加上一个固定权重（大约相当于 4~5 个汉字的时间）
        const pauseWeight = 5; 
        
        let charCounts = [];
        verseNodes.forEach(node => {
            // 只统计实际文本的长度（过滤掉前面的数字节号等标识）
            const p = node.querySelector('p');
            const text = p ? p.textContent.trim() : (node.textContent || "");
            charCounts.push(text.length + pauseWeight);
        });

        const totalChars = charCounts.reduce((a, b) => a + b, 0);

        let times = [0];
        let acc = 0;
        for (let i = 0; i < charCounts.length; i++) {
            acc += charCounts[i];
            times.push((acc / totalChars) * audioDur);
        }

        _dynamicVerseKey = key;
        _dynamicVerseTimes = times;
        return times;
    }

    function clearFollowHighlight() {
        document.querySelectorAll('.follow-along-active').forEach(el => el.classList.remove('follow-along-active'));
        _followActiveRef = null;
    }

    function doFollowAlong(currentTime) {
        const audioEl = $('main-audio-player');
        if (!audioEl || !audioEl.duration) return;

        const verseNodes = document.querySelectorAll('.verse');
        if (verseNodes.length === 0) return;

        let activeRef = null;

        // 如果后端提供了绝对时间戳 (JSON array with {verse, start, end})
        if (_explicitTimestamps && _explicitTimestamps.length > 0 && typeof _explicitTimestamps[0] === 'object') {
            const times = _explicitTimestamps;
            for (let i = 0; i < times.length; i++) {
                if (currentTime >= times[i].start && currentTime <= times[i].end) {
                    activeRef = S.book + '-' + S.chapter + '-' + times[i].verse;
                    break;
                }
            }
            // 如果没匹配到但时间超出了最后，保持最后一个亮起
            if (!activeRef && currentTime > times[times.length - 1].end) {
                activeRef = S.book + '-' + S.chapter + '-' + times[times.length - 1].verse;
            }
        } else {
            // 降级使用动态估算逻辑 (times: [0, 4.5, 9.2, ...])
            let times = calculateDynamicTimes(audioEl.duration);
            if (!times) return;

            let vi = 0;
            for (let i = 0; i < times.length - 1; i++) {
                if (currentTime >= times[i] && currentTime < times[i + 1]) {
                    vi = i;
                    break;
                }
                if (i === times.length - 2 && currentTime >= times[i + 1]) {
                    vi = i; 
                }
            }
            
            if (verseNodes[vi]) {
                activeRef = verseNodes[vi].dataset.ref;
            }
        }

        if (!activeRef || activeRef === _followActiveRef) return;

        _followActiveRef = activeRef;
        
        // Remove old highlight
        document.querySelectorAll('.follow-along-active').forEach(e => e.classList.remove('follow-along-active'));

        // querySelector 用属性选择器必须用转义或确保没有特殊字符，这里用 dataset 的更安全匹配
        const el = Array.from(verseNodes).find(n => n.dataset.ref === activeRef);
        
        if (el) {
            el.classList.add('follow-along-active');
            
            // Only scroll if the element is not fully in the viewport
            const rect = el.getBoundingClientRect();
            const viewHeight = window.innerHeight || document.documentElement.clientHeight;
            const topBarHeight = 60; // Approximate top bar height
            const bottomBarHeight = 120; // Approximate bottom player height
            
            if (rect.top < topBarHeight || rect.bottom > (viewHeight - bottomBarHeight)) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    function openVideoPlayer(type, title, src) {
        // Navigate to in-page video player instead of modal
        const match = VIDEO_DATA.find(v => v.title === title);
        _activeVideo = match || VIDEO_DATA[0];
        switchView('video');
        renderVideoView();
    }


    document.addEventListener('langchange', (e) => {
        updateBrandLogo();
        if (S.view === 'settings') renderSettingsView();
        if (S.panelTab === 'profile') renderProfileView();
        if (S.view === 'plan') renderPlanView();
        if (S.view === 'about') renderAboutView();
        if (S.view === 'privacy') renderPrivacyView();
        if (S.panelTab) switchPanelTab(S.panelTab);
    });

    document.addEventListener('authchange', (e) => {
        if (S.panelTab === 'profile') renderProfileView();
        const user = e.detail;
        if (!user) {
            // 未登录 ≠ 无笔记：游客的本地笔记要照常显示。
            // 真正退出登录时 auth.js 的 clearUser 已删除 ob_notes，这里重载自然为空；
            // 而游客冷启动时重载能拿回本地笔记——此前无条件清空导致游客笔记永不显示。
            S.notes = JSON.parse(localStorage.getItem('ob_notes') || '[]');
            renderNotesList();
            renderNoteIndicators();
            $('user-dropdown')?.classList.add('hidden');
        }
    });

    // ── Onboarding Flow ──
    const OB_STAGE_LEVEL_MAP = { seeker: '1', beginner: '2', regular: '3', advanced: '4' };

    const OB_RECOMMENDATIONS = {
        'seeker-5':    { name: '约翰福音 21天精读', icon: 'fa-dove', days: 21, book: 'jhn', chapter: 1, desc: '约翰福音是最适合初次接触圣经的书卷，用简洁有力的语言阐述耶稣的身份和使命。每天阅读一章，配合 AI 解析，轻松入门。', emoji: '🕊️' },
        'seeker-15':   { name: '约翰福音 21天精读', icon: 'fa-dove', days: 21, book: 'jhn', chapter: 1, desc: '约翰福音是认识耶稣最好的入口。每天一章，搭配 AI 经文解析和注释，帮助你系统了解基督信仰的核心。', emoji: '🕊️' },
        'seeker-30':   { name: '新约入门 30天', icon: 'fa-book-open', days: 30, book: 'mat', chapter: 1, desc: '从马太福音到使徒行传，30天走进新约世界。每天约30分钟深度阅读，了解耶稣的生平、教导和初代教会的诞生。', emoji: '📖' },
        'beginner-5':  { name: '约翰福音 21天精读', icon: 'fa-dove', days: 21, book: 'jhn', chapter: 1, desc: '21天读完约翰福音，每天只需5分钟。AI 会根据你的阶段提供易懂的解析，帮助你扎根信仰。', emoji: '🕊️' },
        'beginner-15': { name: '约翰福音 21天精读', icon: 'fa-dove', days: 21, book: 'jhn', chapter: 1, desc: '约翰福音是初信者的最佳读经起点。搭配注释和 AI 提问功能，15分钟的日常灵修让信仰根基更扎实。', emoji: '🕊️' },
        'beginner-30': { name: '新约入门 30天', icon: 'fa-book-open', days: 30, book: 'mat', chapter: 1, desc: '30天从四福音到使徒行传，系统了解耶稣的生平和教会的建立。每天30分钟深度研读配合 AI 解析。', emoji: '📖' },
        'regular-5':   { name: '诗篇灵修 30天', icon: 'fa-feather', days: 30, book: 'psa', chapter: 1, desc: '每天一篇诗篇，用5分钟开启感恩与赞美的一天。AI 会按照你的信仰阶段提供适切的默想引导。', emoji: '🎵' },
        'regular-15':  { name: '麦琴一年读经计划', icon: 'fa-calendar-check', days: 365, book: 'gen', chapter: 1, desc: '经典的麦琴通读计划，每天4段经文系统性通读全年。新约和诗篇读两遍，旧约读一遍，一年通读全圣经。', emoji: '📅' },
        'regular-30':  { name: '麦琴一年读经计划', icon: 'fa-calendar-check', days: 365, book: 'gen', chapter: 1, desc: '麦琴读经法 + 深度笔记，每天30分钟不仅通读经文，还结合 AI 进行深入讨论分析和跨参考研究。', emoji: '📅' },
        'advanced-5':  { name: '箴言智慧 31天', icon: 'fa-lightbulb', days: 31, book: 'pro', chapter: 1, desc: '每天一章箴言，汲取古老的生活智慧。5分钟高效灵修，适合繁忙服事者以智慧语录开始每一天。', emoji: '💡' },
        'advanced-15': { name: '麦琴一年读经计划', icon: 'fa-calendar-check', days: 365, book: 'gen', chapter: 1, desc: '久经验证的系统性通读计划。对于资深信徒，结合 AI 深度解析和原文释义，在通读中获得新的洞见。', emoji: '📅' },
        'advanced-30': { name: '全年深度研经', icon: 'fa-graduation-cap', days: 365, book: 'gen', chapter: 1, desc: '全年系统研读旧约与新约，每天30分钟以上，借助 AI 进行原文词义分析、历史背景研究和神学主题探讨。', emoji: '🎓' }
    };

    const OB_AI_ANSWERS = {
        seeker: '"道"在希腊文中是 Logos，有"话语"和"理性"的意思。简单来说，约翰用这个词来告诉我们：耶稣不是普通人，祂从起初就存在，祂就是神自己来到人间的方式。就像我们用话语表达内心，神用耶稣向我们表达祂的爱。',
        beginner: '"道"（希腊文 Logos）是约翰福音最核心的概念之一。它表示耶稣基督在创世之前就已存在，与神同在，并且祂本身就是神。这节经文宣告了三个真理：基督的永恒性（太初有道）、基督与父的关系（道与神同在）、基督的神性（道就是神）。',
        regular: '"道"（Logos）兼具旧约"神的话语"创造大能和希腊哲学中"宇宙理性"的双重含义。约翰巧妙地桥接犹太与希腊读者：对犹太人指向创世记开篇神说"要有光"的创造之道；对希腊人则关联万物背后的终极理性。三重宣告——太初有道（先在性）、道与神同在（位格区分）、道就是神（本质合一）——奠定了三位一体教义的圣经基础。',
        advanced: 'Ἐν ἀρχῇ ἦν ὁ λόγος——约翰以创世记 1:1 的 בְּרֵאשִׁית 为文学框架，用 ἦν（imperfect tense）而非 ἐγένετο 表示道的先在性超越时间起点。Logos 一词在斐洛的中间存在观（De Opificio Mundi）和智慧文学（箴 8:22-31）中都有前史，但约翰赋予其全新的位格性含义。πρὸς τὸν θεόν 中的 πρός + accusative 暗示面对面的亲密关系（非静态 παρά），为后续道成肉身的敬拜神学奠基。'
    };

    let _obStep = 1;
    let _obStage = null;
    let _obTime = null;
    let _obTypingTimer = null;

    function showOnboarding() {
        const modal = document.getElementById('onboarding-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        _obStep = 1;
        _obStage = null;
        _obTime = null;

        // Reset all step states
        updateObProgress();
        modal.querySelectorAll('.ob-step').forEach(s => { s.classList.remove('active-step'); });
        modal.querySelector('.ob-step[data-step="1"]').classList.add('active-step');
        modal.querySelectorAll('.ob-option-card').forEach(c => c.classList.remove('selected'));

        // Bind option clicks for Step 1
        document.querySelectorAll('#ob-stage-options .ob-option-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('#ob-stage-options .ob-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                _obStage = card.dataset.value;
                // Auto-advance after selection
                setTimeout(() => goObStep(2), 350);
            };
        });

        // Bind option clicks for Step 2
        document.querySelectorAll('#ob-time-options .ob-option-card').forEach(card => {
            card.onclick = () => {
                document.querySelectorAll('#ob-time-options .ob-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                _obTime = card.dataset.value;
                // Auto-advance after selection
                setTimeout(() => goObStep(3), 350);
            };
        });

        // Back buttons
        document.getElementById('ob-back-1')?.addEventListener('click', () => goObStep(1));
        document.getElementById('ob-back-2')?.addEventListener('click', () => goObStep(2));

        // Skip
        document.getElementById('ob-skip-btn')?.addEventListener('click', finishOnboarding);

        // Start button
        document.getElementById('ob-start-btn')?.addEventListener('click', () => {
            finishOnboarding(true);
        });
    }

    function goObStep(step) {
        const modal = document.getElementById('onboarding-modal');
        if (!modal) return;

        // Animate out current step
        const currentStep = modal.querySelector('.ob-step.active-step');
        if (currentStep) {
            currentStep.style.animation = 'obStepOut 0.25s ease forwards';
            setTimeout(() => {
                currentStep.classList.remove('active-step');
                currentStep.style.animation = '';

                // Show new step
                _obStep = step;
                const newStep = modal.querySelector(`.ob-step[data-step="${step}"]`);
                if (newStep) {
                    newStep.classList.add('active-step');
                    newStep.style.animation = 'obStepIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94) both';
                }
                updateObProgress();

                // If entering step 3, populate recommendation + AI demo
                if (step === 3) renderObRecommendation();
            }, 250);
        } else {
            _obStep = step;
            const newStep = modal.querySelector(`.ob-step[data-step="${step}"]`);
            if (newStep) newStep.classList.add('active-step');
            updateObProgress();
            if (step === 3) renderObRecommendation();
        }
    }

    function updateObProgress() {
        const dots = document.querySelectorAll('.ob-progress .ob-dot');
        const connectors = document.querySelectorAll('.ob-progress .ob-connector');
        dots.forEach(dot => {
            const s = parseInt(dot.dataset.step);
            dot.classList.remove('active', 'done');
            if (s === _obStep) dot.classList.add('active');
            else if (s < _obStep) dot.classList.add('done');
        });
        connectors.forEach((conn, i) => {
            conn.classList.toggle('done', i + 1 < _obStep);
        });
    }

    function renderObRecommendation() {
        const container = document.getElementById('ob-recommendation');
        if (!container) return;

        const stage = _obStage || 'beginner';
        const time = _obTime || '15';
        const key = `${stage}-${time}`;
        const rec = OB_RECOMMENDATIONS[key] || OB_RECOMMENDATIONS['beginner-15'];

        container.innerHTML = `
            <div class="ob-rec-card">
                <span class="ob-rec-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> 为你推荐</span>
                <div class="ob-rec-header">
                    <div class="ob-rec-icon"><i class="fa-solid ${rec.icon}"></i></div>
                    <div class="ob-rec-info">
                        <div class="ob-rec-name">${rec.emoji} ${rec.name}</div>
                        <div class="ob-rec-meta"><i class="fa-regular fa-calendar"></i> ${rec.days} 天 · <i class="fa-regular fa-clock"></i> 每天${time}分钟</div>
                    </div>
                </div>
                <div class="ob-rec-desc">${rec.desc}</div>
            </div>`;

        // Start AI typing demo
        startObAIDemo(stage);
    }

    function startObAIDemo(stage) {
        if (_obTypingTimer) clearTimeout(_obTypingTimer);

        const typing = document.getElementById('ob-ai-typing');
        const answer = document.getElementById('ob-ai-answer');
        const answerText = document.getElementById('ob-ai-answer-text');
        if (!typing || !answer || !answerText) return;

        typing.classList.remove('hidden');
        answer.classList.add('hidden');
        answerText.innerHTML = '';

        const text = OB_AI_ANSWERS[stage] || OB_AI_ANSWERS.beginner;

        // After 1.5s "typing", show the answer with typewriter
        _obTypingTimer = setTimeout(() => {
            typing.classList.add('hidden');
            answer.classList.remove('hidden');

            let i = 0;
            answerText.innerHTML = '<span class="ob-ai-cursor"></span>';

            function typeChar() {
                if (i < text.length) {
                    const cursor = answerText.querySelector('.ob-ai-cursor');
                    if (cursor) cursor.remove();
                    answerText.innerHTML = text.substring(0, i + 1) + '<span class="ob-ai-cursor"></span>';
                    i++;
                    _obTypingTimer = setTimeout(typeChar, 18 + Math.random() * 12);
                } else {
                    // Remove cursor after done
                    setTimeout(() => {
                        const cursor = answerText.querySelector('.ob-ai-cursor');
                        if (cursor) cursor.remove();
                    }, 1500);
                }
            }
            typeChar();
        }, 1500);
    }

    function finishOnboarding(navigate) {
        const modal = document.getElementById('onboarding-modal');
        if (modal) modal.classList.add('hidden');

        if (_obTypingTimer) { clearTimeout(_obTypingTimer); _obTypingTimer = null; }

        // Mark as done
        localStorage.setItem('ob_onboarding_done', 'true');

        // Save to profile
        const profile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
        if (_obStage) {
            profile.level = OB_STAGE_LEVEL_MAP[_obStage] || '2';
        }
        if (_obTime) {
            profile.dailyTime = _obTime;
        }

        // Get recommended plan info
        const stage = _obStage || 'beginner';
        const time = _obTime || '15';
        const key = `${stage}-${time}`;
        const rec = OB_RECOMMENDATIONS[key] || OB_RECOMMENDATIONS['beginner-15'];
        profile.recommendedPlan = rec.name;
        localStorage.setItem('ob_profile', JSON.stringify(profile));

        // Update AI presets if function exists
        if (typeof window.updateAIPresets === 'function') window.updateAIPresets();

        // Navigate to recommended book
        if (navigate && rec.book) {
            navigateTo(rec.book, rec.chapter || 1);
            showToast('🎉 ' + rec.name + ' — 开始阅读吧！');
        }
    }

    function handlePaymentCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get('payment');
        const sessionId = urlParams.get('session_id');

        if (!payment) return;

        // 如果是支付成功，将正在验证支付的标识设为 true
        if (payment === 'success' && sessionId) {
            isVerifyingPayment = true;
        }

        // 清理 URL 参数，防止刷新页面时重复触发
        const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);

        if (payment === 'success' && sessionId) {
            showToast(t('msg.verifying_support'), 5000);
            
            const apiBase = '/api/web';

            fetch(`${apiBase}/payment/verify-session?session_id=${sessionId}`, {
                credentials: 'same-origin'
            })
            .then(res => {
                if (!res.ok) throw new Error('验证支持状态失败');
                return res.json();
            })
            .then(userData => {
                // 验证完成，重置标识
                isVerifyingPayment = false;
                if (typeof Auth !== 'undefined') {
                    Auth.saveUser({
                        username: userData.username || userData.email,
                        email: userData.email,
                        avatar: userData.avatar_url || (userData.username || userData.email)[0].toUpperCase(),
                        role: userData.role,
                        plan: userData.plan,
                        plan_expires_at: userData.plan_expires_at,
                        stripe_subscription_id: userData.stripe_subscription_id
                    }, token);
                    
                    Auth.updateTopBar();
                    updateUserDropdown();
                    addOrderRecord(userData.plan, userData.stripe_subscription_id);
                }
                showToast(t('msg.pay_success'), 5000);
            })
            .catch(err => {
                // 验证失败，重置标识
                isVerifyingPayment = false;
                showToast(t('msg.pay_verify_fail'), 5000);
                console.error('Verify session error:', err);
            });
        } else if (payment === 'cancel') {
            showToast(t('msg.pay_canceled'));
        }
    }

    // Expose for auth.js to trigger
    window.showOnboarding = showOnboarding;

    // ── Init ──
    function init() {
        updateBrandLogo();
        const savedTheme = localStorage.getItem('ob_theme');
        if (savedTheme) applyTheme(savedTheme);
        else if (window.matchMedia('(prefers-color-scheme:dark)').matches) applyTheme('dark');

        window._retryBibleText = () => renderBibleText(true);
        window._runAIAnalysis = runAIAnalysis;
        window._openAudioPlayer = openAudioPlayer;
        window._openVideoPlayer = openVideoPlayer;
        window.switchView = switchView;
        window.switchPanelTab = switchPanelTab;
        window.navigateTo = navigateTo;

        if (typeof Auth !== 'undefined') Auth.init();

        // 高亮：先载本地副本立即渲染；登录态确认后与云端全量合并
        loadLocalHighlights();
        let _hlSyncedFor = null;
        document.addEventListener('authchange', (e) => {
            const email = e.detail && e.detail.email;
            if (email && email !== _hlSyncedFor) {
                _hlSyncedFor = email;
                syncHighlights();
            } else if (!email && _hlSyncedFor) {
                _hlSyncedFor = null;
                loadLocalHighlights();
                renderVerseStates();
            }
        });

        // ── Parse URL Hash or LocalStorage ──
        const savedPos = window.location.hash ? window.location.hash.substring(1) : localStorage.getItem('ob_last_pos');
        if (savedPos) {
            // format: cuv/gen/1
            const parts = savedPos.split('/');
            if (parts.length >= 3) {
                // 英/韩文版已下架：老书签或本地存档里的版本回落到和合本
                if (!['cuv', 'cnvs', 'pinyin'].includes(parts[0])) parts[0] = 'cuv';
                S.version = parts[0];
                S.book = parts[1];
                S.chapter = parts[2];
                const vs = $('version-select');
                if (vs) vs.value = S.version;
                // Pre-configure language from version
                let initLang = 'zh';
                if (['kjv', 'niv'].includes(S.version)) initLang = 'en';
                else if (['krv', 'keb'].includes(S.version)) initLang = 'ko';
                if (typeof setLang === 'function' && getLang() !== initLang) {
                    setLang(initLang);
                }
            }
        }

        renderBookList();
        setupEvents();
        if (typeof window.loadAndRenderSupportPlans === 'function') {
            window.loadAndRenderSupportPlans();
        }
        handlePaymentCallback();

        // Apply saved font size to Bible text
        applyVerseFontSize();

        document.addEventListener('click', e => {
            const card = e.target.closest('.media-card');
            if (card) openVideoPlayer('video', card.querySelector('.media-title')?.textContent || '视频');
            const ac = e.target.closest('.audio-card');
            if (ac && (e.target.closest('.audio-play-circle') || e.target.closest('button')))
                openVideoPlayer('audio', ac.querySelector('.audio-title')?.textContent || '音频');
            const lb = e.target.closest('.lang-btn');
            if (lb && lb.dataset.lang) setLang(lb.dataset.lang);
            // 设置页的简/繁：与顶栏共用 ob_script，刷新后由启动逻辑统一应用
            const fb = e.target.closest('[data-font-set]');
            if (fb) {
                const serif = fb.dataset.fontSet === 'serif';
                localStorage.setItem('ob_font', serif ? 'serif' : 'sans');
                document.body.classList.toggle('serif-body', serif);
                document.querySelectorAll('[data-font-set]').forEach(b => b.classList.toggle('active', b === fb));
            }
            const sb = e.target.closest('[data-script-set]');
            if (sb) {
                const next = sb.dataset.scriptSet;
                if ((localStorage.getItem('ob_script') === 't' ? 't' : 's') !== next) {
                    localStorage.setItem('ob_script', next);
                    location.reload();
                }
            }
        });

        // ── 简/繁切换 ──
        // 没有繁体数据源，繁体是显示层实时转换（OpenCC 词组级，
        // 保证「王后/头发/五谷/一只」这类多对一映射不出错字）。
        // 转换器 423KB 按需加载：只有切到繁体才拉取。
        // 切回简体直接刷新页面——源内容本来就是简体，无需反向转换。
        (function initScriptToggle() {
            const KEY = 'ob_script';
            let converter = null;
            let observing = false;

            const current = () => localStorage.getItem(KEY) === 't' ? 't' : 's';
            const syncBtns = () => {
                document.querySelectorAll('#script-switcher [data-script]').forEach(b => {
                    b.classList.toggle('active', b.dataset.script === current());
                });
            };

            const loadOpenCC = () => new Promise((resolve, reject) => {
                if (window.OpenCC) return resolve();
                const sc = document.createElement('script');
                sc.src = 'js/vendor-opencc-cn2t.js?v=1';
                sc.onload = resolve;
                sc.onerror = () => reject(new Error('load failed'));
                document.head.appendChild(sc);
            });

            const convertTree = (root) => {
                if (!converter) return;
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
                let n;
                while ((n = walker.nextNode())) {
                    const tag = n.parentNode && n.parentNode.nodeName;
                    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
                    const out = converter(n.nodeValue);
                    // 只在变化时写回：繁体文本幂等，这也是防观察器死循环的关键
                    if (out !== n.nodeValue) n.nodeValue = out;
                }
                if (root.querySelectorAll) {
                    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
                        for (const a of ['placeholder', 'title', 'aria-label']) {
                            const v = el.getAttribute(a);
                            if (v) { const o = converter(v); if (o !== v) el.setAttribute(a, o); }
                        }
                    });
                }
            };

            const startObserver = () => {
                if (observing) return;
                observing = true;
                new MutationObserver(muts => {
                    for (const m of muts) {
                        if (m.type === 'characterData') {
                            const out = converter(m.target.nodeValue);
                            if (out !== m.target.nodeValue) m.target.nodeValue = out;
                        } else {
                            m.addedNodes.forEach(node => {
                                if (node.nodeType === 3) {
                                    const out = converter(node.nodeValue);
                                    if (out !== node.nodeValue) node.nodeValue = out;
                                } else if (node.nodeType === 1) {
                                    convertTree(node);
                                }
                            });
                        }
                    }
                }).observe(document.body, { subtree: true, childList: true, characterData: true });
            };

            const enableTraditional = async () => {
                try {
                    await loadOpenCC();
                    converter = converter || window.OpenCC.Converter({ from: 'cn', to: 'tw' });
                    convertTree(document.body);
                    startObserver();
                } catch (e) {
                    showToast('繁体转换暂不可用，请稍后再试');
                    localStorage.setItem(KEY, 's');
                    syncBtns();
                }
            };

            $('script-switcher')?.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-script]');
                if (!btn || btn.dataset.script === current()) return;
                localStorage.setItem(KEY, btn.dataset.script);
                syncBtns();
                if (btn.dataset.script === 't') enableTraditional();
                else location.reload();
            });

            syncBtns();
            if (current() === 't') enableTraditional();
        })();

        // 恢复上次所在的页面（刷新后停留在原页，而非总跳回阅读视图）。
        // 'plan' 需登录，排除以免刷新时弹登录框；未知值回退到阅读。
        // video/donate 视图已随「与 App 端功能统一」撤下，不再恢复
        const RESTORE_VIEWS = ['reading', 'about', 'privacy', 'settings', 'audio'];
        const lastView = localStorage.getItem('ob_last_view');
        switchView(RESTORE_VIEWS.includes(lastView) ? lastView : 'reading');
        switchPanelTab('ai');
        renderNotesList();
        renderBookmarksList();
        initPanelResize();
        renderChapterOverview();

        // Check if onboarding should be shown (first-time logged-in user)
        if (!localStorage.getItem('ob_onboarding_done')) {
            const user = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
            if (user) {
                setTimeout(() => showOnboarding(), 600);
            }
        }
        syncUserNotesCloud();
    }

    // ── Compare (经文对照 — 正文内上下文对照) ──
    // 译本标识用同一紫的深浅阶，不引入额外色相；文字标签本身已能区分译本
    const CMP_VERS = [
        { id: 'cuv', label: '和合本', color: '#4e2b6b' },
        { id: 'cnvs', label: '新译本', color: '#8250ab' },
        { id: 'pinyin', label: '拼音和合本', color: '#a678cd' }
    ];
    // 过滤掉本地存档里已下架的版本（如 kjv），空了回落到新译本
    let _cmpEnabled = (JSON.parse(localStorage.getItem('ob_cmp_vers') || 'null') || ['cnvs'])
        .filter(id => CMP_VERS.some(v => v.id === id));
    if (_cmpEnabled.length === 0) _cmpEnabled = ['cnvs'];
    let _compareMode = false;

    function toggleCompareMode() {
        _compareMode = !_compareMode;
        // Update button active state
        const btn = $('compare-btn');
        if (btn) btn.classList.toggle('active', _compareMode);
        renderBibleText(true); // force=true: bypass key check since only display mode changed
    }

    function openCompare() {
        // Now just toggles inline mode instead of opening overlay
        toggleCompareMode();
    }

    // Render the compare version bar at top of reading area
    function renderCompareBar() {
        const existing = document.querySelector('.compare-inline-bar');
        if (existing) existing.remove();

        if (!_compareMode) return '';

        let html = `<div class="compare-inline-bar">
            <div class="cmp-bar-left">
                <i class="fa-solid fa-book-open-reader"></i>
                <span>经文对照</span>
            </div>
            <div class="cmp-bar-versions" id="cmp-bar-versions">
                ${CMP_VERS.filter(v => v.id !== S.version).map(v => {
                    const isOn = _cmpEnabled.includes(v.id);
                    return `<button class="cmp-ver-btn ${isOn ? 'active' : ''}" data-v="${v.id}" style="--ver-color:${v.color}">
                        <span class="cmp-ver-dot"></span>${v.label}
                    </button>`;
                }).join('')}
            </div>
            <button class="cmp-bar-close" title="关闭对照">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
        return html;
    }

    // Fetch compare data for all enabled versions
    async function fetchCompareData() {
        const versionsToFetch = _cmpEnabled.filter(v => v !== S.version);
        const results = {};

        await Promise.all(versionsToFetch.map(async ver => {
            const cached = window.bibleData?.[ver]?.[S.book]?.[S.chapter];
            if (cached) { results[ver] = cached; return; }
            try {
                const r = await fetch(`${S.apiBase}/verses/public?version=${ver}&book=${S.book}&chapter=${S.chapter}`);
                if (r.ok) {
                    const j = await r.json();
                    const d = j.verses || [];
                    if (!window.bibleData) window.bibleData = {};
                    if (!window.bibleData[ver]) window.bibleData[ver] = {};
                    if (!window.bibleData[ver][S.book]) window.bibleData[ver][S.book] = {};
                    window.bibleData[ver][S.book][S.chapter] = d;
                    results[ver] = d;
                }
            } catch (e) { console.error('Compare fetch:', e); }
        }));

        return results;
    }

    // Build the inline compare verse HTML for a single verse
    function buildCompareVerseHtml(verseNum, compareData) {
        const versionsToShow = _cmpEnabled.filter(v => v !== S.version);
        if (versionsToShow.length === 0) return '';

        let html = '<div class="cmp-inline-block">';
        versionsToShow.forEach(ver => {
            const verData = compareData[ver];
            if (!verData) return;
            const match = verData.find(v => v.verse == verseNum);
            if (!match) return;
            const verInfo = CMP_VERS.find(c => c.id === ver);
            html += `<div class="cmp-inline-row" data-v="${ver}" style="--ver-color:${verInfo?.color || '#888'}">
                <span class="cmp-inline-label">${verInfo?.label || ver}</span>
                <span class="cmp-inline-text">${match.text}</span>
            </div>`;
        });
        html += '</div>';
        return html;
    }

    // Legacy renderCompare kept as no-op (overlay removed)
    function renderCompare() {}

    // Attach compare bar events (called after renderBibleText)
    function attachCompareBarEvents() {
        const container = $('bible-text');
        if (!container) return;

        const bar = container.querySelector('.compare-inline-bar');
        if (!bar) return;

        bar.querySelector('.cmp-bar-close')?.addEventListener('click', () => {
            _compareMode = false;
            const btn = $('compare-btn');
            if (btn) btn.classList.remove('active');
            renderBibleText(true);
        });

        bar.querySelectorAll('.cmp-ver-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ver = btn.dataset.v;
                const idx = _cmpEnabled.indexOf(ver);
                if (idx >= 0) _cmpEnabled.splice(idx, 1);
                else _cmpEnabled.push(ver);
                localStorage.setItem('ob_cmp_vers', JSON.stringify(_cmpEnabled));
                renderBibleText(true);
            });
        });
    }

    // ── Panel Resize Handle ──
    function getMaxPanelWidth() {
        const leftNav = $('left-nav');
        const leftW = leftNav ? leftNav.getBoundingClientRect().width : 0;
        const available = window.innerWidth - leftW - 4;
        const twoThirds = Math.floor(available * 2 / 3);
        const minCenter = 640;
        const maxFromCenter = Math.max(240, window.innerWidth - leftW - minCenter - 4);
        // Absolute cap: never exceed 2/3 of the total viewport width
        const absoluteMax = Math.floor(window.innerWidth * 2 / 3);
        return Math.max(240, Math.min(twoThirds, maxFromCenter, absoluteMax));
    }

    function initPanelResize() {
        const handle = $('panel-resize-handle');
        const appShell = $('app');
        if (!handle || !appShell) return;

        // Restore saved width (clamped to current screen)
        const saved = localStorage.getItem('ob_panel_w');
        if (saved) {
            const w = parseInt(saved);
            const maxW = getMaxPanelWidth();
            const clamped = Math.max(240, Math.min(maxW, w));
            document.documentElement.style.setProperty('--right-panel-w', clamped + 'px');
        }

        let dragging = false;
        let startX = 0;
        let startW = 0;

        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            dragging = true;
            startX = e.clientX;
            const panel = $('study-panel');
            startW = panel ? panel.getBoundingClientRect().width : 340;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', e => {
            if (!dragging) return;
            e.preventDefault();
            const maxW = getMaxPanelWidth();
            const delta = startX - e.clientX;
            let newW = Math.round(startW + delta);
            newW = Math.max(240, Math.min(maxW, newW));
            document.documentElement.style.setProperty('--right-panel-w', newW + 'px');
        });

        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            handle.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const panel = $('study-panel');
            if (panel) {
                const w = Math.round(panel.getBoundingClientRect().width);
                localStorage.setItem('ob_panel_w', w);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

})(); // end IIFE
