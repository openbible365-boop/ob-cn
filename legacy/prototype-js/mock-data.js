/* Shared mock content for the OpenBible prototype — matches the Design Canvas copy verbatim. */
const MOCK = {
  chapterRef: '约翰福音 3',
  translation: '和合本',
  verses: [
    { n: 13, para: 0, text: '除了从天降下、仍旧在天的人子，没有人升过天。' },
    { n: 14, para: 0, text: '摩西在旷野怎样举蛇，人子也必照样被举起来，' },
    { n: 15, para: 0, text: '叫一切信他的都得永生。' },
    { n: 16, para: 1, text: '「神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。', highlighted: true, id: 'v16', selectable: true },
    { n: 17, para: 1, text: '因为神差他的儿子降世，不是要定世人的罪，乃是要叫世人因他得救。' },
    { n: 18, para: 2, text: '信他的人，不被定罪；不信的人，罪已经定了，因为他不信神独生子的名。' },
    { n: 19, para: 2, text: '光来到世间，世人因自己的行为是恶的，不爱光，倒爱黑暗，定他们的罪就是在此。', highlighted: true },
    { n: 20, para: 3, text: '凡作恶的便恨光，并不来就光，恐怕他的行为受责备。' },
    { n: 21, para: 3, text: '但行真理的必来就光，要显明他所行的是靠神而行。」' },
  ],
  selectedVerseRef: '约翰福音 3:16',
  selectedVerseText: '「神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。',

  aiAnswer: [
    { tag: '历史背景', color: '#FFD465', dark: false, text: '这句话出自耶稣与法利赛人尼哥底母的夜间对话。「举蛇」呼应民数记 21 章：旷野中仰望铜蛇得医治，预表人子将在十字架上被举起。' },
    { tag: '核心含义', color: '#BF78F6', dark: true, text: '「神爱世人」宣告救恩源于神主动的爱；「独生子」强调基督身份的独一。领受永生的途径是信靠，而非行为的积累。' },
    { tag: '生活应用', color: '#E98264', dark: true, text: '永生不是遥远的奖赏，而是从相信那一刻开始的新生命。试着把「不至灭亡」的确据，带进你今天正在担忧的事情里，以感恩回应这份主动的爱。' },
  ],

  followupQuestion: '「爱」在希腊文原意中还有其他含义吗？',
  followupAnswer: [
    '本节用的是 <b>agapaō（ἀγαπάω）</b>：指意志性的、舍己的爱，与出于情感的 phileō（友爱）不同。约翰选用此词，强调神的爱是主动的决定与行动，而非被爱者配得。',
    '新约中 agapē 常与十字架相连（罗 5:8）：爱的定义不是感觉，而是「赐给」——这正是 3:16 的动词结构所强调的。',
  ],

  highlightColors: [
    { c: '#FFD465', selected: true },
    { c: '#BF78F6', selected: false },
    { c: '#E98264', selected: false },
    { c: '#7FD1AE', selected: false },
    { c: '#8FB8E8', selected: false },
  ],

  commentary: [
    { range: '3:1–8 · 重生的对话', highlight: false, text: '尼哥底母是法利赛人、犹太公会的成员，夜里来见耶稣，既出于谨慎，也暗示他尚在黑暗中摸索。「重生」原文亦作「从上头生」：不是道德修补，而是圣灵所赐的全新生命。「风随着意思吹」以风喻灵，指明重生是神主权的工作。' },
    { range: '3:9–15 · 举蛇的预表', highlight: false, text: '耶稣引用民数记 21 章旷野举铜蛇的事件：百姓仰望铜蛇便得医治，预表人子将被举起在十字架上——凡仰望信靠他的，就得永生。「举起」在约翰福音中兼指被钉与得荣耀。' },
    { range: '3:16–17 · 福音中的福音', highlight: true, text: '本段是整卷约翰福音信息的浓缩。「爱」（agapaō）指神主动、舍己的爱；「世人」表明这爱临到普世众人。「独生子」（monogenēs）强调基督与父独一无二的关系；「赐给」呼应 3:14 被举起的人子——爱在十字架上成为具体行动。定罪不是神差子的目的（3:17），信而得生才是。' },
    { range: '3:18–21 · 光与黑暗的分野', highlight: false, text: '信与不信在此刻已分出结局：不信者「罪已经定了」。光来到世间成为试金石——人对光的态度显明其行为的本相；行真理的必来就光。' },
  ],

  huiduHistory: {
    today: [
      { ref: '约翰福音 3:16', rounds: '6 轮 · 14:32', title: '神爱世人的历史背景与生活应用', highlight: true },
    ],
    yesterday: [
      { ref: '马可福音 2:27', rounds: '4 轮 · 21:05', title: '安息日设立的本意是什么' },
      { ref: '诗篇 23:1', rounds: '3 轮 · 09:18', title: '「牧者」意象在旧约中的含义' },
    ],
  },

  groups: [
    { id: 'official', letter: '慧', color: 'rgba(191,120,246,.3)', name: '慧读总群', badge: '官方', badgeStyle: 'official', desc: '全体用户 · 官方公告与慧读答疑' },
    { id: 'youth', letter: '青', color: '#FFD465', name: '青年查经小组', badge: '群主', badgeStyle: 'owner', desc: '32 成员 · 周五线上查经报名中', joined: true },
    { id: 'grace', letter: '恩', color: 'rgba(191,120,246,.3)', name: '恩典读经群', badge: '3 条新消息', badgeStyle: 'muted', desc: '118 成员 · 一年读经计划进行中' },
    { id: 'prayer', letter: '祷', color: 'rgba(233,130,100,.3)', name: '姊妹祷告会', desc: '21 成员 · 今晨祷告接力已完成' },
  ],

  groupDetail: {
    name: '青年查经小组',
    letter: '青',
    members: '32 成员',
    announcement: '本周五 20:00 线上共读约翰福音 3 章，到「活动」页一键报名。',
    posts: [
      { avatar: '陈', color: 'rgba(233,130,100,.3)', name: '陈姊妹', time: '今天 14:05', text: '今天重读这节，被「甚至」两个字击中——神的爱不是抽象的，是舍己的行动。', verseRef: '约翰福音 3:16 · 和合本', verseText: '「神爱世人，甚至将他的独生子赐给他们……」', likes: 24, comments: 8 },
      { avatar: '李', color: 'rgba(191,120,246,.3)', name: '李弟兄', time: '昨天 22:41', text: '周五查经前建议大家先读完 3 章，把不明白的地方先问问慧读，带着问题来。', likes: 11, comments: 3 },
    ],
    assistantName: '灵修小助手',
    assistantIntro: '本群专属 AI 助理 · 人设由群主配置',
    assistantWelcome: '平安！我是灵修小助手。查经中有任何经文或信仰疑问，随时问我。',
    memberQuestion: '「重生」和「悔改」有什么区别？',
    assistantAnswer: [
      '好问题！简单说：<b>悔改</b>（metanoia）是人的回应——心思与方向的转变；<b>重生</b>（约 3:3）是神的作为——圣灵赐下全新的生命。',
      '两者相伴发生：悔改是重生生命的第一个记号，而重生是悔改得以持续的动力源泉。',
    ],
    events: [
      { tag: '线上查经班', tagStyle: 'purple', status: '报名中', title: '约翰福音 3 章共读', when: '本周五 20:00 – 21:30', where: '线上 · 会议链接报名后可见', progress: 60, progressLabel: '已报名 12/20', cta: '一键报名' },
      { tag: '每日读经打卡', tagStyle: 'orange', status: '进行中 · 第 18 天', title: '四福音 40 天通读', note: '今日已有 8 人完成打卡', reminder: '开始前 2 小时自动提醒', cta: '去打卡', ctaStyle: 'outline' },
    ],
    signupConfirmation: '你已报名「约翰福音 3 章共读」，开始前 2 小时将收到提醒。',
  },

  groupTiers: [
    { name: '初阶群组', price: '$0', priceNote: '/月 · 免费', desc: '基础功能 · 适合小型群组', selected: true },
    { name: '中阶群组', price: '$5', priceNote: '/月', desc: '组成员 100 名以下，每一成员均享受【中阶群用户】级别' },
    { name: '高阶群组', price: '$10', priceNote: '/月', desc: '组成员 100 名以上，每一成员均享受【高阶群用户】级别' },
  ],

  settingsList: [
    { icon: 'bell', label: '通知管理', action: 'open-notifications' },
    { icon: 'sun', label: '外观与阅读偏好', value: '跟随系统' },
    { icon: 'lock', label: '账号与隐私' },
    { icon: 'mail', label: '关于与反馈', value: 'v1.0.0' },
    { icon: 'log-out', label: '退出登录', action: 'logout', danger: true },
  ],

  myNotes: [
    { ref: '约翰福音 3:16', highlight: true, time: '今天 14:20', text: '「甚至」二字提醒我：爱是有代价的行动。为周五分享准备一个见证。' },
    { ref: '约翰福音 3:8', time: '周二 21:47', text: '风的比喻：看不见风，却能看见被风吹动的树。生命的改变就是圣灵工作的痕迹。' },
    { ref: '约翰福音 2:5', time: '上周日 10:12', text: '马利亚的嘱咐：「他告诉你们什么，你们就做什么。」顺服先于明白。' },
  ],

  webVerses: [
    { n: 14, para: 0, text: '摩西在旷野怎样举蛇，人子也必照样被举起来，' },
    { n: 15, para: 0, text: '叫一切信他的都得永生。' },
    { n: 16, para: 1, text: '「神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。', highlighted: true },
    { n: 17, para: 1, text: '因为神差他的儿子降世，不是要定世人的罪，乃是要叫世人因他得救。' },
    { n: 18, para: 2, text: '信他的人，不被定罪；不信的人，罪已经定了，因为他不信神独生子的名。' },
    { n: 19, para: 2, text: '光来到世间，世人因自己的行为是恶的，不爱光，倒爱黑暗，定他们的罪就是在此。' },
    { n: 20, para: 3, text: '凡作恶的便恨光，并不来就光，恐怕他的行为受责备。' },
    { n: 21, para: 3, text: '但行真理的必来就光，要显明他所行的是靠神而行。」' },
  ],

  calendarWeekdays: ['一', '二', '三', '四', '五', '六', '日'],
  calendarDays: [
    { d: 29, muted: true }, { d: 30, muted: true }, { d: 1 }, { d: 2 },
    { d: 3, badge: '✓ 线上查经 · 已结束', badgeStyle: 'muted' }, { d: 4 }, { d: 5 },
    { d: 6, badge: '读经打卡 · 每日', badgeStyle: 'orange' }, { d: 7 }, { d: 8 }, { d: 9 }, { d: 10 }, { d: 11, isToday: true }, { d: 12 },
    { d: 13 }, { d: 14 }, { d: 15 }, { d: 16 }, { d: 17, badge: '约翰福音 3 章共读 20:00 · 已报名', badgeStyle: 'purple' }, { d: 18 }, { d: 19 },
    { d: 20 }, { d: 21 }, { d: 22 }, { d: 23 }, { d: 24, badge: '线下聚会 · 未开始', badgeStyle: 'purple' }, { d: 25 }, { d: 26 },
  ],

  adminSidebar: [
    { id: '7a', label: '数据看板' },
    { id: 'content', label: '内容管理', disabled: true },
    { id: '7b', label: 'AI 模型与提示词' },
    { id: '7d', label: '社群管理' },
    { id: '7e', label: '用户管理' },
    { id: '7c', label: '内容审核', badge: 5 },
    { id: 'events', label: '活动监管', disabled: true },
    { id: 'audit', label: '权限与审计', disabled: true },
  ],

  adminKpis: [
    { label: 'DAU（双端）', value: '12,483', delta: '↑ 8.2% 周环比', deltaColor: 'var(--purple)' },
    { label: 'MAU', value: '38,905', delta: 'DAU/MAU 32.1%' },
    { label: '次日留存', value: '43.6%', delta: '7 日 27.4% · 30 日 18.9%' },
    { label: '慧读渗透（周）', value: '37.8%', delta: '人均 3.4 轮/会话', deltaColor: 'var(--purple)' },
  ],
  adminModuleUsage: [
    { label: '读经', pct: 46, color: 'var(--yellow)' },
    { label: '慧读', pct: 27, color: 'var(--purple)' },
    { label: '社群', pct: 19, color: 'var(--orange)' },
    { label: '注释', pct: 8, color: 'var(--body)' },
  ],
  adminAiUsage: [
    { value: '8,214', label: '调用量' },
    { value: '4.2M', label: 'Token' },
    { value: '1.4s', label: '平均首字' },
    { value: '91%', label: '点赞率' },
  ],
  adminCommunityRanking: [
    { name: '青年查经小组', stat: '日互动 486' },
    { name: '恩典读经群', stat: '日互动 352' },
    { name: '姊妹祷告会', stat: '日互动 291' },
    { name: '职场灵修站', stat: '日互动 204', muted: true },
  ],
  adminHotTopics: ['重生的含义', '安息日', '希腊文原意'],

  adminModels: [
    { name: '主模型 · claude-sonnet-4-5', status: '温度 0.4 · 正常', dot: 'var(--purple)' },
    { name: '备用模型 · glm-4.7', status: '待命', dot: 'var(--line)' },
  ],
  adminPromptVersions: [
    { version: 'v3.2', desc: '强化三段式结构 + 释经框架约束收紧', status: '灰度 20%', statusStyle: 'purple', like: '93.1%', dislike: '1.8%', actions: ['扩大灰度', '编辑'] },
    { version: 'v3.1', desc: '增加免责声明注入与敏感话题绕行', status: '全量 80%', statusStyle: 'yellow', like: '90.7%', dislike: '2.4%', actions: ['查看'] },
    { version: 'v3.0', desc: '初版三段式释经 Prompt', status: '已归档', statusStyle: 'muted', like: '88.2%', dislike: '3.1%', actions: ['回滚至此版'], faded: true },
  ],
  adminTokenTop: [
    { name: '青年查经小组', value: '182K/日' },
    { name: '恩典读经群', value: '121K/日' },
  ],

  adminWordTiers: [
    { label: '拦截级词条', count: '1,240', dot: 'var(--pink)' },
    { label: '待审级词条', count: '386', dot: 'var(--orange)' },
    { label: '仅记录词条', count: '92', dot: 'var(--line)' },
  ],
  adminReportQueue: [
    { content: '「加我微信购买特效保健品，包治百病…」', group: '恩典读经群', reason: '垃圾广告', level: '拦截', levelStyle: 'pink', actions: [{ t: '删除', c: 'pink' }, { t: '屏蔽', c: 'body' }, { t: '通过', c: 'purple' }, { t: '封禁用户', c: 'body' }] },
    { content: '「你们这群人懂什么，全都是异端……」', group: '青年查经小组', reason: '人身攻击', level: '待审', levelStyle: 'orange', actions: [{ t: '删除', c: 'pink' }, { t: '屏蔽', c: 'body' }, { t: '通过', c: 'purple' }, { t: '禁言 7 天', c: 'body' }] },
    { content: '活动「免费圣地旅游，先交定金」', group: '职场灵修站', reason: '虚假活动', level: '拦截', levelStyle: 'pink', actions: [{ t: '强制下架', c: 'pink' }, { t: '通知报名者', c: 'body' }, { t: '通过', c: 'purple' }] },
  ],

  adminCommunities: [
    { letter: '慧', color: 'rgba(191,120,246,.3)', name: '慧读总群', badge: '官方', owner: '平台运营', members: '38,905', activity: '2,140', created: '2026-03-01', tier: '官方免费', tierStyle: 'muted', actions: ['查看'] },
    { letter: '青', color: '#FFD465', name: '青年查经小组', owner: '王弟兄', members: '32', activity: '486', created: '2026-05-14', tier: '中阶 $5/月', tierStyle: 'purple', actions: ['查看', '警告', '封禁', '解散'] },
    { letter: '恩', color: 'rgba(191,120,246,.3)', name: '恩典读经群', owner: '张长老', members: '118', activity: '352', created: '2026-04-02', tier: '高阶 $10/月', tierStyle: 'pink', actions: ['查看', '警告', '封禁', '解散'] },
    { letter: '祷', color: 'rgba(233,130,100,.3)', name: '姊妹祷告会', badge: '已警告 1 次', badgeStyle: 'orange', owner: '刘姊妹', members: '21', activity: '291', created: '2026-06-08', tier: '初阶 免费', tierStyle: 'muted', actions: ['查看', '警告', '封禁', '解散'] },
  ],

  adminUsers: [
    { letter: '王', color: 'var(--yellow)', name: '王弟兄', uid: '10382', login: 'email + Apple', groups: '3 个', level: '中阶群用户', status: '正常', actions: [{ t: '资料', c: 'body' }, { t: '禁言', c: 'orange' }, { t: '封禁', c: 'pink' }] },
    { letter: '陈', color: 'rgba(233,130,100,.3)', name: '陈姊妹', uid: '11205', login: 'email + Google', groups: '2 个', level: '中阶群用户', status: '正常', actions: [{ t: '资料', c: 'body' }, { t: '禁言', c: 'orange' }, { t: '封禁', c: 'pink' }] },
    { letter: '赵', color: 'var(--surface-2)', name: '赵某', uid: '12981', login: 'email', groups: '1 个', level: '初阶群用户', status: '封禁中', statusStyle: 'pink', actions: [{ t: '资料', c: 'body' }, { t: '解封', c: 'purple' }, { t: '封禁原因：垃圾广告', c: 'body' }] },
  ],

  notificationSettings: [
    { title: '每日金句推送', desc: '每天早上 7:30 推送一节经文', on: false },
    { title: '社群活动提醒', desc: '已报名活动开始前 2 小时提醒', on: true },
    { title: '留言回复通知', desc: '我的帖子收到评论或回复时', on: true },
    { title: 'AI 助理相关通知', desc: '社群 AI 助理的公开问答动态', on: false },
  ],
};
