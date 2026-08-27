# 慧读圣经 · 工作交接

> 最后更新：2026-08-26 ｜ 分支 `huidu-init`，HEAD `61f4e81`
>
> ⚠️ **本地领先远端 3 个提交，尚未推送**（`307b233` / `c9be5f8` / `61f4e81`，
> 均为后台 UI 改造）。推送前务必先 `git fetch` 看远端是否也前进了，见第六节。

## 一、项目速览

三端共用一个后端，都由 `admin-app`（Next.js 16）托管：

| 入口 | 路径 | 说明 |
|---|---|---|
| 网页版 | `/read`（会重定向到 `/bible`） | 静态 HTML/JS/CSS，源码在 `web-app/` |
| App 端 | `/app` | React 19 + Vite + Capacitor，源码在 `mobile-app/`，托管的是 `mobile-app/dist` |
| 后台管理 | `/admin` | Next.js 页面，需登录 |
| 接口 | `/api/mobile/*`、`/api/web/*` | 三端共用；会话是同源 httpOnly Cookie |

数据：`data/bible/<版本>/<书卷>.json`、`data/commentary/jingdu/<书卷序号>.json`

## 二、如何启动（有坑，务必按此来）

```bash
# 1) 数据库：必须带 --name openbible
cd admin-app && npx prisma dev --name openbible
```

**坑**：不带 `--name openbible` 会连到名为 `default` 的**空库**（表都不存在），
且端口随机分配，与 `.env.development.local` 里固定的 51214 对不上。
数据实际存放在 `~/Library/Application Support/prisma-dev-nodejs/openbible/`。

```bash
# 2) 应用（用 preview_start，不要用 Bash 跑 dev server）
#    .claude/launch.json 里的配置名是 admin-app，端口 3000
```

改了 Prisma schema 后：`npx prisma generate` + **重启 dev server**（否则服务端
仍持有旧 client，报 `db.xxx is undefined`）。

## 三、验证手段

```bash
cd admin-app
npm test                      # 46 个测试（6 个文件）
npm run verify:web:community  # 36 项接口回归（社群 + 代祷 + 共读）
npm run check:config          # 部署前配置自检
npx tsc --noEmit              # 两个 app 都要跑
```

后台组件层还有一个**免登录自检页** `/ui-preview`，把所有组件的全部状态
（正常 / 骨架 / 空 / 错误 / 长文本溢出）摊在一页上。改了组件先看这里，
比登录后翻真实页面快得多——本会话的 Context 崩溃就是它抓出来的。

本会话新增的两个规范扫描器（防"引用了但不存在"类静默失效）：
- CSS 令牌扫描：找出 `var(--x)` 用了但从未定义的令牌
- 接口存在性扫描：前端 fetch 的路径 vs 后端实际路由

### ⚠️ 验证方法论（本会话踩过的坑）

**判断"用户能看见"要用渲染面积，不能只看 DOM 存在**：

```js
// ✗ 错：元素在 DOM 里但整个视图被隐藏时，这个判断仍为真
document.querySelectorAll('.verse').length > 0
// ✓ 对
const r = el.getBoundingClientRect(); r.width > 0 && r.height > 0
```

曾因此漏掉一个白屏 bug（`switchView('bible')` 指向不存在的 `view-bible`）。

另：浏览器里做多步验证时，**视图切换与测量容易赛跑**，多次出现"元素找不到"
的假阴性。稳妥做法是每步之间留足等待，或在同一次调用内完成切换+测量。

**`:focus-visible` 不能用脚本 `.focus()` 验证**：它只在真实键盘导航时匹配。
本会话曾据此误报"焦点环缺失"，实际用 Tab 键测是好的。

**`tsc` + `build` 全过 ≠ 运行时没问题**：Server Component 里用 React Context
两者都不报错，一跑就 `Element type is invalid`。涉及 RSC 边界的改动必须实跑。

## 四、本会话完成的工作

### 功能
- **社群 × 读经联动**：经文引用可点跳转（含 66 卷缩写表）、代祷请求类型
  （`PRAYER` 迁移，三端支持"我为你祷告"）、群共读进度上社群首屏
- **读经计划**：重接真实接口（旧 `/api/web/reading-plans` 从未存在过），
  加入/打卡与 App 端进度互通；计划卡可展开「全部 N 天」逐日跳转
- **收听**：改接 `/api/mobile/audio`（旧 `/api/web/audio/*` 未移植，一直 404）
- **拼音和合本**上线；译本三端统一为 和合本/新译本/拼音和合本（英韩版下架）
- **简/繁切换**（OpenCC 词组级，按需加载 423KB，观察器实时转换新内容）
- **奉献页**（金额格 + 支付方式 + 登录门槛；**支付通道未接**，见下）
- **「我的」移入右栏标签**，改为概览 + 子页两级结构，与 App 端 MePage 同构
- **笔记页重设计**：元信息一行、操作悬停显现、AI 与手写卡统一外壳

### 后台 UI 改造（3 个提交，未推送）

目标是"数据可读性 + 高信息密度"，做法是先建组件层再逐页替换，而不是逐页调 CSS。

**组件层在 `admin-app/src/components/ui/`：**

| 文件 | 内容 |
|---|---|
| `DataTable.tsx` | 组合组件 `DataTable` / `.Row` / `.Cell`，列定义只写一次 |
| `gridTemplate.ts` | `templateOf()`——列宽推导，单拆出来是为了能单测 |
| `States.tsx` | `EmptyState` / `ErrorState` / `TableSkeleton` |
| `Primitives.tsx` | `Badge` / `Stat` / `PageHeader` / `Section` / `Grid` / `Split` / `Card` |
| `SearchShortcut.tsx` | `/` 聚焦搜索、Esc 失焦（唯一的 `"use client"`） |

**两个必须记住的实现约束：**

1. **列宽不能走 React Context**，因为后台页面全是 Server Component，Context
   在 RSC 中不受支持。现在由根组件算出轨道、经 CSS 变量 `--dt-cols` 下发——
   CSS 变量天然继承，跨得过 Server/Client 边界。改这里前先读
   `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`。
2. **弹性列必须包 `minmax(0, Xfr)`**。grid 轨道默认 `min-width: auto`，
   不包的话长文本会把轨道撑破，`text-overflow` 永远不触发。已有单测锁住。

**令牌**（`globals.css`）：状态色 `--st-{ok,warn,err,info}` 各带一个浅底；
密度 `--den-row-y / --den-cell-x / --den-gap / --den-section`；焦点环 `--focus-ring`。
**调密度改令牌，不要去各页改 padding。**

**成果**：`gridTemplateColumns` 31 → 2、内联 `style` 239 → 113、
空状态 6/17 → 14 页（全部带引导文案）、组件层接入 13/16 页、测试 34 → 46。

剩下的 2 处 `gridTemplateColumns` 在 [annotations](admin-app/src/app/admin/annotations/page.tsx:116)
和 [ai](admin-app/src/app/admin/ai/page.tsx:68)，是一次性等分布局，**故意保留**——
套 `Grid` 反而绕。

**尚未做**：真实数据下的密度手感没人确认过（需登录后台）。建议先看 users
（验证表格密度）和 dashboard（验证指标区留白）两页。

### 配色规范（已在三端统一）
```
紫 #8250ab = 交互（主按钮、AI 语境）
金 #f4c75f = 阅读（经文引用、书卷芯片、注释徽章、侧栏激活）
灰          = 骨架（装饰图标、身份标识如头像、数据如统计数字）
绿/玫红      = 状态反馈
```
判断依据：**是不是可交互的主操作**。头像是身份、统计数字是数据、页头图标是
装饰——都不该占用紫色。

### 修掉的 bug（按严重度）
1. **数据丢失**：慧读问答笔记只有 `question`/`answer` 没有 `text`，同步时
   既存不进云端也不进 `localOnly` 兜底，被静默丢弃 —— 登录状态下每次刷新即丢
2. **白屏**：两处 `switchView('bible')` 指向不存在的视图
3. **老用户高亮整批同步失败**：旧 Tailwind 色值不被服务端接受，已加色值归一
4. **游客笔记永不显示**：登出分支无条件清空内存笔记，改为从 localStorage 重载
5. 四个"引用了但从未定义"：`--font-serif`、`.primary-btn`、9 个 CSS 令牌、
   两条不存在的接口路径

## 五、待办（按优先级）

### 需要你的凭据，我无法代劳
1. **轮换 Neon 数据库密码** ⚠️ —— `web-app/.env.example` 里曾有真实连接串
   （已从 huidu-ob 清除，但**仍在 openbible-ai 私有仓库中**）。
   删文件只是止血，轮换密码才是补救。
2. `OPENBIBLE_LLM_API_KEY` —— 慧读 AI 问答目前不可用
3. Google / Apple 登录凭据 —— 未配置时入口自动隐藏（这是有意的 fail-closed）
4. `COMMUNITY_UPLOAD_DIR` —— 未配置时社群附件写默认目录，重新部署会丢
5. 微信支付 / PayPal 商户凭据 —— 奉献页已就绪，**目前点确认只提示"即将开通"，
   没有伪造任何支付成功状态**

### 已定位、待决策
6. **活动时间按服务端时区解析**（App 与网页版同存）：输入 19:30 存成服务器
   本地时间。生产若跑 UTC 而用户在国内，每个活动差 8 小时。
   修法二选一：前端传时区偏移，或服务端固定按 `Asia/Shanghai` 解析。
7. **慧读笔记不跨设备同步**：共享 `Note` 表按单节纯文本存储（App 那么读），
   塞不下问答结构。要同步需给表加字段。**目前只是不同步，不会再丢**。
8. **网页版无举报入口**：`REPORT_POST` 接口在、App 有入口，网页面板没接。
   UGC 产品每个能看到内容的界面都该能举报。
9. **社群通知缺失**：入群审批结果、评论回复、内容处置告知都没有通知。
   社群产品没有反馈回路，留存起不来。
10. 后台文案仍是"OpenBible 后台管理"，是否统一为"慧读圣经"未定
11. 后台还有 3 页未接组件层（13/16）。不是硬伤，接完更一致。
    做法：照已改造页的写法替换，改完在 `/ui-preview` 对一眼密度。

### 运营/合规（放开注册前必须想清楚）
- 内容库为空：百科/影音/灵修都是 0 条（百科入口已从网页版移除）
- 宗教类 UGC 在大陆有《互联网宗教信息服务管理办法》的许可要求，
  这决定服务器放哪、面向谁开放注册

## 六、协作注意

远端 `huidu/main` 上有其他人的提交（朝鲜语圣经 nkv、注释防抓取/解密改造等）。
本会话最后做了一次合并（`4205547`），无冲突，两边功能实测共存：
对方的注释解密正常解出 14 条，我的面板/计划页正常。

**推送前先 `git fetch` 看远端是否领先**，不要直接 force。

### ⚠️ 撤销修改前先确认改动已进版本库

本会话曾用 `git checkout <文件>` 想撤掉一次失败的替换，但那两个文件**整轮
改造都还没提交**，全部丢失、只能重做。`git checkout` / `restore` 对未提交的
改动是不可逆的。要试探性改动就先 `git stash` 或先提交一个临时点。

## 七、当前资源版本

`app.js?v=90` / `auth.js?v=7` / `i18n.js?v=30` / `style.css?v=99`

网页版改动后**必须提升对应版本号**，否则用户浏览器会用缓存的旧文件。
