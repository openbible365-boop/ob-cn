import React, { useState } from 'react';
import { FlaskConical, Play, Clock, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';

// ── 常量 ──────────────────────────────────────────────────────────────────────

/** 圣经书卷列表多语言支持（版本 → 代码 → 显示名） */
const BOOK_LISTS = {
  cuv: [
    { code: 'gen', name: '创世记' }, { code: 'exo', name: '出埃及记' },
    { code: 'lev', name: '利未记' }, { code: 'num', name: '民数记' },
    { code: 'deu', name: '申命记' }, { code: 'jos', name: '约书亚记' },
    { code: 'jdg', name: '士师记' }, { code: 'rut', name: '路得记' },
    { code: '1sa', name: '撒母耳记上' }, { code: '2sa', name: '撒母耳记下' },
    { code: '1ki', name: '列王纪上' }, { code: '2ki', name: '列王纪下' },
    { code: '1ch', name: '历代志上' }, { code: '2ch', name: '历代志下' },
    { code: 'ezr', name: '以斯拉记' }, { code: 'neh', name: '尼希米记' },
    { code: 'est', name: '以斯帖记' }, { code: 'job', name: '约伯记' },
    { code: 'psa', name: '诗篇' }, { code: 'pro', name: '箴言' },
    { code: 'ecc', name: '传道书' }, { code: 'sng', name: '雅歌' },
    { code: 'isa', name: '以赛亚书' }, { code: 'jer', name: '耶利米书' },
    { code: 'lam', name: '耶利米哀歌' }, { code: 'ezk', name: '以西结书' },
    { code: 'dan', name: '但以理书' }, { code: 'hos', name: '何西阿书' },
    { code: 'jol', name: '约珥书' }, { code: 'amo', name: '阿摩司书' },
    { code: 'oba', name: '俄巴底亚书' }, { code: 'jon', name: '约拿书' },
    { code: 'mic', name: '弥迦书' }, { code: 'nam', name: '那鸿书' },
    { code: 'hab', name: '哈巴谷书' }, { code: 'zep', name: '西番雅书' },
    { code: 'hag', name: '哈该书' }, { code: 'zec', name: '撒迦利亚书' },
    { code: 'mal', name: '玛拉基书' },
    { code: 'mat', name: '马太福音' }, { code: 'mrk', name: '马可福音' },
    { code: 'luk', name: '路加福音' }, { code: 'jhn', name: '约翰福音' },
    { code: 'act', name: '使徒行传' }, { code: 'rom', name: '罗马书' },
    { code: '1co', name: '哥林多前书' }, { code: '2co', name: '哥林多后书' },
    { code: 'gal', name: '加拉太书' }, { code: 'eph', name: '以弗所书' },
    { code: 'php', name: '腓立比书' }, { code: 'col', name: '歌罗西书' },
    { code: '1th', name: '帖撒罗尼迦前书' }, { code: '2th', name: '帖撒罗尼迦后书' },
    { code: '1ti', name: '提摩太前书' }, { code: '2ti', name: '提摩太后书' },
    { code: 'tit', name: '提多书' }, { code: 'phm', name: '腓利门书' },
    { code: 'heb', name: '希伯来书' }, { code: 'jas', name: '雅各书' },
    { code: '1pe', name: '彼得前书' }, { code: '2pe', name: '彼得后书' },
    { code: '1jn', name: '约翰一书' }, { code: '2jn', name: '约翰二书' },
    { code: '3jn', name: '约翰三书' }, { code: 'jud', name: '犹大书' },
    { code: 'rev', name: '启示录' },
  ],
  kjv: [
    { code: 'gen', name: 'Genesis' }, { code: 'exo', name: 'Exodus' },
    { code: 'lev', name: 'Leviticus' }, { code: 'num', name: 'Numbers' },
    { code: 'deu', name: 'Deuteronomy' }, { code: 'jos', name: 'Joshua' },
    { code: 'jdg', name: 'Judges' }, { code: 'rut', name: 'Ruth' },
    { code: '1sa', name: '1 Samuel' }, { code: '2sa', name: '2 Samuel' },
    { code: '1ki', name: '1 Kings' }, { code: '2ki', name: '2 Kings' },
    { code: '1ch', name: '1 Chronicles' }, { code: '2ch', name: '2 Chronicles' },
    { code: 'ezr', name: 'Ezra' }, { code: 'neh', name: 'Nehemiah' },
    { code: 'est', name: 'Esther' }, { code: 'job', name: 'Job' },
    { code: 'psa', name: 'Psalms' }, { code: 'pro', name: 'Proverbs' },
    { code: 'ecc', name: 'Ecclesiastes' }, { code: 'sng', name: 'Song of Solomon' },
    { code: 'isa', name: 'Isaiah' }, { code: 'jer', name: 'Jeremiah' },
    { code: 'lam', name: 'Lamentations' }, { code: 'ezk', name: 'Ezekiel' },
    { code: 'dan', name: 'Daniel' }, { code: 'hos', name: 'Hosea' },
    { code: 'jol', name: 'Joel' }, { code: 'amo', name: 'Amos' },
    { code: 'oba', name: 'Obadiah' }, { code: 'jon', name: 'Jonah' },
    { code: 'mic', name: 'Micah' }, { code: 'nam', name: 'Nahum' },
    { code: 'hab', name: 'Habakkuk' }, { code: 'zep', name: 'Zephaniah' },
    { code: 'hag', name: 'Haggai' }, { code: 'zec', name: 'Zechariah' },
    { code: 'mal', name: 'Malachi' },
    { code: 'mat', name: 'Matthew' }, { code: 'mrk', name: 'Mark' },
    { code: 'luk', name: 'Luke' }, { code: 'jhn', name: 'John' },
    { code: 'act', name: 'Acts' }, { code: 'rom', name: 'Romans' },
    { code: '1co', name: '1 Corinthians' }, { code: '2co', name: '2 Corinthians' },
    { code: 'gal', name: 'Galatians' }, { code: 'eph', name: 'Ephesians' },
    { code: 'php', name: 'Philippians' }, { code: 'col', name: 'Colossians' },
    { code: '1th', name: '1 Thessalonians' }, { code: '2th', name: '2 Thessalonians' },
    { code: '1ti', name: '1 Timothy' }, { code: '2ti', name: '2 Timothy' },
    { code: 'tit', name: 'Titus' }, { code: 'phm', name: 'Philemon' },
    { code: 'heb', name: 'Hebrews' }, { code: 'jas', name: 'James' },
    { code: '1pe', name: '1 Peter' }, { code: '2pe', name: '2 Peter' },
    { code: '1jn', name: '1 John' }, { code: '2jn', name: '2 John' },
    { code: '3jn', name: '3 John' }, { code: 'jud', name: 'Jude' },
    { code: 'rev', name: 'Revelation' },
  ],
  keb: [
    { code: 'gen', name: '창세기' }, { code: 'exo', name: '출애굽기' },
    { code: 'lev', name: '레위기' }, { code: 'num', name: '민수기' },
    { code: 'deu', name: '신명기' }, { code: 'jos', name: '여호수아' },
    { code: 'jdg', name: '사사기' }, { code: 'rut', name: '룻기' },
    { code: '1sa', name: '사무엘상' }, { code: '2sa', name: '사무엘하' },
    { code: '1ki', name: '열왕기상' }, { code: '2ki', name: '열왕기하' },
    { code: '1ch', name: '역대상' }, { code: '2ch', name: '역대하' },
    { code: 'ezr', name: '에스라' }, { code: 'neh', name: '느헤미야' },
    { code: 'est', name: '에스더' }, { code: 'job', name: '욥기' },
    { code: 'psa', name: '시편' }, { code: 'pro', name: '잠언' },
    { code: 'ecc', name: '전도서' }, { code: 'sng', name: '아가' },
    { code: 'isa', name: '이사야' }, { code: 'jer', name: '예레미야' },
    { code: 'lam', name: '예레미야 애가' }, { code: 'ezk', name: '에스겔' },
    { code: 'dan', name: '다니엘' }, { code: 'hos', name: '호세아' },
    { code: 'jol', name: '요엘' }, { code: 'amo', name: '아모스' },
    { code: 'oba', name: '오바댜' }, { code: 'jon', name: '요나' },
    { code: 'mic', name: '미가' }, { code: 'nam', name: '나훔' },
    { code: 'hab', name: '하박국' }, { code: 'zep', name: '스바냐' },
    { code: 'hag', name: '학개' }, { code: 'zec', name: '스가랴' },
    { code: 'mal', name: '말라기' },
    { code: 'mat', name: '마태복음' }, { code: 'mrk', name: '마가복음' },
    { code: 'luk', name: '누가복음' }, { code: 'jhn', name: '요한복음' },
    { code: 'act', name: '사도행전' }, { code: 'rom', name: '로마서' },
    { code: '1co', name: '고린도전서' }, { code: '2co', name: '고린도후서' },
    { code: 'gal', name: '갈라디아서' }, { code: 'eph', name: '에베소서' },
    { code: 'php', name: '빌립보서' }, { code: 'col', name: '골로새서' },
    { code: '1th', name: '데살로니가전서' }, { code: '2th', name: '데살로니가후서' },
    { code: '1ti', name: '디모데전서' }, { code: '2ti', name: '디모데후서' },
    { code: 'tit', name: '디도서' }, { code: 'phm', name: '빌레몬서' },
    { code: 'heb', name: '히브리서' }, { code: 'jas', name: '야고보서' },
    { code: '1pe', name: '베드로전서' }, { code: '2pe', name: '베드로후서' },
    { code: '1jn', name: '요한1서' }, { code: '2jn', name: '요한2서' },
    { code: '3jn', name: '요한3서' }, { code: 'jud', name: '유다서' },
    { code: 'rev', name: '요한계시록' },
  ]
};

function getBookList(version: string) {
  if (version === 'kjv') return BOOK_LISTS.kjv;
  if (version === 'keb' || version === 'krv') return BOOK_LISTS.keb;
  return BOOK_LISTS.cuv;
}

/** 可评测的模型列表（按厂商分组）*/
const MODELS = [
  // ── OpenAI ───────────────────────────────────────────────────────────────
  { id: 'gpt-4o-mini',                 label: 'GPT-4o Mini',         provider: 'OpenAI',    color: '#10a37f', price: '$0.15/M' },
  { id: 'gpt-4o',                      label: 'GPT-4o',              provider: 'OpenAI',    color: '#10a37f', price: '$2.50/M' },
  { id: 'gpt-4.5-preview',             label: 'GPT-4.5 Preview',     provider: 'OpenAI',    color: '#10a37f', price: '$75.0/M' },
  { id: 'gpt-5-chat-latest',           label: 'GPT-5 (Beta)',        provider: 'OpenAI',    color: '#10a37f', price: '未定'    },
  { id: 'o1',                          label: 'o1',                  provider: 'OpenAI',    color: '#10a37f', price: '$15.0/M' },
  { id: 'o1-preview',                  label: 'o1-preview',          provider: 'OpenAI',    color: '#10a37f', price: '$15.0/M' },
  { id: 'o3-mini-2025-01-31',          label: 'o3 Mini',             provider: 'OpenAI',    color: '#10a37f', price: '$1.10/M' },
  // ── xAI Grok ─────────────────────────────────────────────────────────────
  { id: 'grok-3',                      label: 'Grok 3',              provider: 'xAI',       color: '#1da1f2', price: '$2.00/M' },
  { id: 'grok-3-mini',                 label: 'Grok 3 Mini',         provider: 'xAI',       color: '#1da1f2', price: '$0.30/M' },
  { id: 'grok-3-reasoner',             label: 'Grok 3 Reasoner',     provider: 'xAI',       color: '#1da1f2', price: '$3.00/M' },
  { id: 'grok-4',                      label: 'Grok 4',              provider: 'xAI',       color: '#1da1f2', price: '$3.00/M' },
  { id: 'grok-4.1',                    label: 'Grok 4.1',            provider: 'xAI',       color: '#1da1f2', price: '未定'    },
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  { id: 'claude-3-haiku-20240307',     label: 'Claude 3 Haiku',      provider: 'Anthropic', color: '#d4774c', price: '$0.25/M' },
  { id: 'claude-3-5-sonnet-20240620',  label: 'Claude 3.5 Sonnet',   provider: 'Anthropic', color: '#d4774c', price: '$3.00/M' },
  { id: 'claude-sonnet-4-5-20250929',  label: 'Claude Sonnet 4.5',   provider: 'Anthropic', color: '#d4774c', price: '$3.00/M' },
  { id: 'claude-haiku-4-5-20251001',   label: 'Claude Haiku 4.5',    provider: 'Anthropic', color: '#d4774c', price: '$0.80/M' },
  { id: 'claude-opus-4-6',             label: 'Claude Opus 4.6',     provider: 'Anthropic', color: '#d4774c', price: '$15.0/M' },
  { id: 'claude-opus-4-1-20250805',    label: 'Claude Opus 4.1',     provider: 'Anthropic', color: '#d4774c', price: '$15.0/M' },
  // ── DeepSeek ─────────────────────────────────────────────────────────────
  { id: 'deepseek-chat',               label: 'DeepSeek V3',         provider: 'DeepSeek',  color: '#5b8dee', price: '$0.14/M' },
  { id: 'deepseek-v3',                 label: 'DeepSeek V3 (Raw)',   provider: 'DeepSeek',  color: '#5b8dee', price: '$0.14/M' },
  { id: 'deepseek-v3-fast',            label: 'DeepSeek V3 Fast',    provider: 'DeepSeek',  color: '#5b8dee', price: '$0.07/M' },
  { id: 'deepseek-v3.2',               label: 'DeepSeek V3.2',       provider: 'DeepSeek',  color: '#5b8dee', price: '$0.14/M' },
  { id: 'deepseek-reasoner',           label: 'DeepSeek R1',         provider: 'DeepSeek',  color: '#5b8dee', price: '$0.55/M' },
  { id: 'deepseek-r1',                 label: 'DeepSeek R1 (Raw)',   provider: 'DeepSeek',  color: '#5b8dee', price: '$0.55/M' },
  { id: 'deepseek-r1-0528',            label: 'DeepSeek R1-0528',    provider: 'DeepSeek',  color: '#5b8dee', price: '$0.55/M' },
  // ── Alibaba Qwen ─────────────────────────────────────────────────────────
  { id: 'qwen-plus',                   label: 'Qwen Plus',           provider: 'Alibaba',   color: '#615ded', price: '¥0.8/M'  },
  { id: 'qwen-max',                    label: 'Qwen Max',            provider: 'Alibaba',   color: '#615ded', price: '¥20/M'   },
  { id: 'qwen3-32b',                   label: 'Qwen3 32B',           provider: 'Alibaba',   color: '#615ded', price: '¥0.8/M'  },
  { id: 'qwen3-235b-a22b',             label: 'Qwen3 235B-A22B',     provider: 'Alibaba',   color: '#615ded', price: '¥5.0/M'  },
  { id: 'qwen3-max-2026-01-23',        label: 'Qwen3 Max',           provider: 'Alibaba',   color: '#615ded', price: '¥20/M'   },
  // ── Meta Llama ───────────────────────────────────────────────────────────
  { id: 'llama-3-70b',                 label: 'Llama 3 70B',         provider: 'Meta',      color: '#0868c4', price: '$0.35/M' },
  { id: 'llama-3.1-70b',               label: 'Llama 3.1 70B',       provider: 'Meta',      color: '#0868c4', price: '$0.35/M' },
  { id: 'llama-3.1-405b-instruct',     label: 'Llama 3.1 405B',      provider: 'Meta',      color: '#0868c4', price: '$1.00/M' },
  { id: 'meta-llama/llama-4-scout',    label: 'Llama 4 Scout',       provider: 'Meta',      color: '#0868c4', price: '$0.18/M' },
  { id: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick',    provider: 'Meta',      color: '#0868c4', price: '$0.27/M' },
  // ── Zhipu GLM ────────────────────────────────────────────────────────────
  { id: 'glm-4',                       label: 'GLM-4',               provider: '智谱',      color: '#3b82f6', price: '¥0.1/M'  },
  { id: 'glm-4-air',                   label: 'GLM-4 Air',           provider: '智谱',      color: '#3b82f6', price: '¥0.5/M'  },
  { id: 'glm-4.7',                     label: 'GLM-4.7',             provider: '智谱',      color: '#3b82f6', price: '¥2.0/M'  },
  // ── MiniMax ──────────────────────────────────────────────────────────────
  { id: 'MiniMax-M2',                  label: 'MiniMax M2',          provider: 'MiniMax',   color: '#7c3aed', price: '¥0.8/M'  },
  { id: 'minimax-m2.5',                label: 'MiniMax M2.5',        provider: 'MiniMax',   color: '#7c3aed', price: '¥1.0/M'  },
  // ── Moonshot Kimi ────────────────────────────────────────────────────────
  { id: 'kimi-k2',                     label: 'Kimi K2',             provider: 'Moonshot',  color: '#0ea5e9', price: '$0.15/M' },
  { id: 'kimi-k2-instruct',            label: 'Kimi K2 Instruct',    provider: 'Moonshot',  color: '#0ea5e9', price: '$0.15/M' },
  { id: 'kimi-k2-thinking',            label: 'Kimi K2 Thinking',    provider: 'Moonshot',  color: '#0ea5e9', price: '$0.50/M' },
  // ── Mistral ──────────────────────────────────────────────────────────────
  { id: 'mistral-large-latest',        label: 'Mistral Large',       provider: 'Mistral',   color: '#f97316', price: '$2.00/M' },
  { id: 'mistral-small-latest',        label: 'Mistral Small',       provider: 'Mistral',   color: '#f97316', price: '$0.20/M' },
];

// ── 类型 ──────────────────────────────────────────────────────────────────────

interface ExploreChip {
  emoji: string;
  question: string;
}

interface ModelResult {
  model: string;
  overview: string | null;
  theme_tags: string[];
  explore_chips: ExploreChip[];
  latency_ms: number | null;
  error: string | null;
  http_status?: number | null;
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

// NOTE: 本地开发用 localhost:8000，线上 Vercel 用相对路径（同域）
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : '';

const TOKEN_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

function tagColor(i: number) {
  return TOKEN_COLORS[i % TOKEN_COLORS.length];
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

const I18N = {
  cuv: { 
    overview: '本章速览', tags: '主题标签', explore: '启发探索', success: '生成成功', fail: '生成失败', httpFail: '生成失败', clickTag: '点击深度解读',
    modalTitle: '关键词深度解读', modalThinking: 'AI 正在深度思考...', modalThinkingSub: '从三个维度解读关键词', modalFail: '请求失败',
    sec1: '为何选为关键词', sec2: '本章中的涵义', sec3: '跨书卷关联',
    bookChapter: (book: string, chapter: number) => `《${book}》第 ${chapter} 章`
  },
  cnvs: { 
    overview: '本章速览', tags: '主题标签', explore: '启发探索', success: '生成成功', fail: '生成失败', httpFail: '生成失败', clickTag: '点击深度解读',
    modalTitle: '关键词深度解读', modalThinking: 'AI 正在深度思考...', modalThinkingSub: '从三个维度解读关键词', modalFail: '请求失败',
    sec1: '为何选为关键词', sec2: '本章中的涵义', sec3: '跨书卷关联',
    bookChapter: (book: string, chapter: number) => `《${book}》第 ${chapter} 章`
  },
  kjv: { 
    overview: 'Chapter Overview', tags: 'Theme Tags', explore: 'Explore Questions', success: 'Generation Successful', fail: 'Generation Failed', httpFail: 'Failed', clickTag: 'Click for deep explanation',
    modalTitle: 'Keyword Deep Dive', modalThinking: 'AI is thinking deeply...', modalThinkingSub: 'Interpreting from three dimensions', modalFail: 'Request Failed',
    sec1: 'Why Chosen as Keyword', sec2: 'Meaning in this Chapter', sec3: 'Cross-Book Correlations',
    bookChapter: (book: string, chapter: number) => `${book} Chapter ${chapter}`
  },
  keb: { 
    overview: '장 개요', tags: '주제 태그', explore: '탐구 질문', success: '생성 성공', fail: '생성 실패', httpFail: '생성 실패', clickTag: '클릭하여 깊이 이해하기',
    modalTitle: '키워드 심층 해설', modalThinking: 'AI가 깊이 생각하고 있습니다...', modalThinkingSub: '세 가지 관점에서 해석', modalFail: '요청 실패',
    sec1: '키워드 선정 이유', sec2: '본 장에서의 의미', sec3: '성경 내 다른 책과의 연관성',
    bookChapter: (book: string, chapter: number) => `《${book}》 ${chapter}장`
  },
  krv: { 
    overview: '장 개요', tags: '주제 태그', explore: '탐구 질문', success: '생성 성공', fail: '생성 실패', httpFail: '생성 실패', clickTag: '클릭하여 깊이 이해하기',
    modalTitle: '키워드 심층 해설', modalThinking: 'AI가 깊이 생각하고 있습니다...', modalThinkingSub: '세 가지 관점에서 해석', modalFail: '요청 실패',
    sec1: '키워드 선정 이유', sec2: '본 장에서의 의미', sec3: '성경 내 다른 책과의 연관성',
    bookChapter: (book: string, chapter: number) => `《${book}》 ${chapter}장`
  },
};

function getI18n(version: string) {
  return I18N[version as keyof typeof I18N] || I18N.cuv;
}

/** 单个模型结果卡片 */
function ResultCard({ result, version = 'cuv', onTagClick }: { result: ModelResult; version?: string; onTagClick?: (tag: string) => void }) {
  const modelMeta = MODELS.find((m) => m.id === result.model);
  const t = getI18n(version);

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* 卡片头部 */}
      <div
        className="p-4 text-white"
        style={{ background: modelMeta?.color ?? '#6b7280' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-base leading-tight">{modelMeta?.label ?? result.model}</div>
            <div className="text-[0.7rem] opacity-80 mt-0.5">{modelMeta?.provider}</div>
          </div>
          {result.latency_ms !== null && (
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1 text-xs">
              <Clock size={11} />
              {(result.latency_ms / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      </div>

      {/* 卡片体 */}
      <div className="p-4 flex-1 flex flex-col gap-4">
        {result.error ? (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold text-red-700">
                {result.http_status ? `HTTP ${result.http_status}` : t.httpFail}
              </span>
              <span className="mt-1">{result.error}</span>
            </div>
          </div>
        ) : (
          <>
            {/* 速览 */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                {t.overview}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed">
                {result.overview ?? '—'}
              </p>
            </div>

            {/* 主题标签 */}
            {result.theme_tags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t.tags}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.theme_tags.map((tag, i) => (
                    <span 
                      key={i} 
                      onClick={() => onTagClick?.(tag)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-transform hover:scale-105 ${tagColor(i)}`}
                      title={t.clickTag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 启发探索 */}
            {result.explore_chips.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t.explore}
                </div>
                <ul className="space-y-2">
                  {result.explore_chips.map((chip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="shrink-0 text-base leading-snug">{chip.emoji}</span>
                      <span className="leading-relaxed">{chip.question}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* 状态指示 */}
      <div className="px-4 pb-4">
        {result.error ? (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle size={12} /> {t.fail}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 size={12} /> {t.success}
          </div>
        )}
      </div>
    </div>
  );
}

/** 加载骨架卡片 */
function SkeletonCard({ modelId }: { modelId: string }) {
  const modelMeta = MODELS.find((m) => m.id === modelId);
  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      <div className="p-4 h-16" style={{ background: modelMeta?.color ?? '#6b7280', opacity: 0.7 }} />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-4/6" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-1/4 mt-4" />
        <div className="flex gap-1.5">
          <div className="h-5 bg-gray-100 rounded-full w-16" />
          <div className="h-5 bg-gray-100 rounded-full w-14" />
          <div className="h-5 bg-gray-100 rounded-full w-12" />
        </div>
      </div>
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

/** 支持的圣经版本 */
const BIBLE_VERSIONS = [
  { code: 'cuv',  label: '和合本 CUV'    },
  { code: 'cnvs', label: '新译本 CNV'    },
  { code: 'kjv',  label: 'KJV (English)' },
  { code: 'keb',  label: '쉬운성경 (한국어)' },
  { code: 'krv',  label: '개역한글 (한국어)' },
];

const AIEval: React.FC = () => {
  const [bookCode, setBookCode] = useState('gen');
  const [chapter, setChapter] = useState(1);
  const [bibleVersion, setBibleVersion] = useState('cuv');
  const [selectedModels, setSelectedModels] = useState<string[]>(['qwen-plus', 'grok-3', 'claude-3-5-sonnet-20240620', 'deepseek-chat']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  // 弹窗状态
  const [explainModal, setExplainModal] = useState<{tag: string, bookName: string, chapter: number} | null>(null);
  const [explainResult, setExplainResult] = useState<{loading: boolean, answer: string, error: string}>({loading:false, answer:'', error:''});

  const handleTagClick = async (tag: string, bName: string, ch: number, model: string) => {
    setExplainModal({ tag, bookName: bName, chapter: ch });
    setExplainResult({ loading: true, answer: '', error: '' });
    try {
      const token = localStorage.getItem('admin_token');
      // 改用新的专用评测接口
      const resp = await fetch(`${API_BASE}/api/ai/eval/tag-explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ book_code: bookCode, book_name: bName, chapter: ch, tag: tag, model: model, version: bibleVersion }),
      });
      if (!resp.ok) throw new Error(`API Error: ${resp.status}`);
      const data = await resp.json();
      setExplainResult({ loading: false, answer: data.answer || data.detail || '暂无内容', error: '' });
    } catch (e: any) {
      setExplainResult({ loading: false, answer: '', error: String(e) });
    }
  };

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedModels.length === 0) {
      setError('请至少勾选一个模型');
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setRan(false);

    try {
      const token = localStorage.getItem('admin_token');
      const resp = await fetch(`${API_BASE}/api/ai/eval/chapter-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          book_code: bookCode,
          chapter,
          version: bibleVersion,
          models: selectedModels,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail ?? `请求失败 (${resp.status})`);
      }

      const data = await resp.json();
      // NOTE: 按勾选顺序排列，保持视觉一致性
      const ordered = selectedModels
        .map((m) => data.results.find((r: ModelResult) => r.model === m))
        .filter(Boolean) as ModelResult[];
      setResults(ordered);
      setRan(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  const books = getBookList(bibleVersion);
  const bookName = books.find((b) => b.code === bookCode)?.name ?? bookCode;

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <FlaskConical size={20} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">模型评测对比</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            同一章节内容用多个模型并发生成，团队并排对比选出最优模型
          </p>
        </div>
      </div>

      {/* 配置面板 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 选圣经版本 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">圣经版本</label>
            <div className="relative">
              <select
                value={bibleVersion}
                onChange={(e) => setBibleVersion(e.target.value)}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              >
                {BIBLE_VERSIONS.map((v) => (
                  <option key={v.code} value={v.code}>{v.label}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 选书卷 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">书卷</label>
            <div className="relative">
              <select
                value={bookCode}
                onChange={(e) => setBookCode(e.target.value)}
                className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
              >
                {books.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 选章节 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">章节</label>
            <input
              type="number"
              min={1}
              value={chapter}
              onChange={(e) => setChapter(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>

          {/* 生成按钮 */}
          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              disabled={loading || selectedModels.length === 0}
              id="btn-eval-generate"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-lg font-medium text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  生成中…
                </>
              ) : (
                <>
                  <Play size={15} />
                  一键生成对比
                </>
              )}
            </button>
          </div>
        </div>

        {/* 模型多选 */}
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择模型（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m) => {
              const checked = selectedModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                    checked
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {/* 小色点对应模型品牌色 */}
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: m.color }}
                  />
                  {m.label}
                  <span className="text-xs font-normal opacity-60">
                    {m.provider} · {m.price}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedModels.length === 0 && (
            <p className="text-xs text-red-500 mt-1.5">请至少勾选一个模型</p>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* 结果区 */}
      {(loading || ran) && (
        <div>
          {/* 小标题 */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              {loading ? '正在生成…' : `《${bookName}》第 ${chapter} 章 — ${results.length} 个模型结果`}
            </h2>
            {!loading && results.length > 0 && (
              <span className="text-xs text-gray-400">
                横向滚动查看全部
              </span>
            )}
          </div>

          {/* 并排卡片 */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {loading
              ? selectedModels.map((m) => <SkeletonCard key={m} modelId={m} />)
              : results.map((r) => <ResultCard key={r.model} result={r} version={bibleVersion} onTagClick={(tag) => handleTagClick(tag, bookName, chapter, r.model)} />)}
          </div>
        </div>
      )}

      {/* 初始空态 */}
      {!loading && !ran && (
        <div className="text-center py-20 text-gray-400">
          <FlaskConical size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">选择书卷、章节和模型，点击「一键生成对比」开始</p>
        </div>
      )}

      {/* 标签深度解读弹窗 */}
      {explainModal && (() => {
        const t = getI18n(bibleVersion);
        
        // 将 AI 回答按 1. / 2. / 3. 分割为三段，逐段渲染
        const sections = explainResult.answer
          ? explainResult.answer
              .split(/(?=\n?[123]\.\s)/)
              .map(s => s.trim())
              .filter(Boolean)
          : [];
        const sectionMeta = [
          { label: t.sec1, color: 'from-violet-500 to-purple-600', lightBg: 'bg-violet-50', border: 'border-violet-200', textColor: 'text-violet-700' },
          { label: t.sec2,   color: 'from-blue-500 to-cyan-600',   lightBg: 'bg-blue-50',   border: 'border-blue-200',   textColor: 'text-blue-700'   },
          { label: t.sec3,     color: 'from-emerald-500 to-teal-600', lightBg: 'bg-emerald-50', border: 'border-emerald-200', textColor: 'text-emerald-700' },
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setExplainModal(null)}>
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col"
              style={{ maxHeight: '86vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* 弹窗顶部渐变 Header */}
              <div className="relative bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-6 pt-6 pb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-violet-200 text-xs font-medium mb-1 tracking-wider uppercase">{t.modalTitle}</div>
                    <h3 className="text-white text-2xl font-bold tracking-tight">「{explainModal.tag}」</h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-violet-200 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-300 inline-block" />
                      {t.bookChapter(explainModal.bookName, explainModal.chapter)}
                    </div>
                  </div>
                  <button
                    onClick={() => setExplainModal(null)}
                    className="text-white/60 hover:text-white transition-colors mt-0.5"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                {/* 底部曲线 */}
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-white rounded-t-3xl" />
              </div>

              {/* 内容区 */}
              <div className="overflow-y-auto px-6 pb-6 pt-2 flex-1">
                {explainResult.loading ? (
                  <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                    <div className="relative mb-4">
                      <span className="w-12 h-12 border-4 border-violet-100 border-t-violet-500 rounded-full animate-spin inline-block" />
                      <span className="absolute inset-0 flex items-center justify-center text-lg">✨</span>
                    </div>
                    <p className="text-sm font-medium text-gray-500">{t.modalThinking || 'AI 正在深度思考...'}</p>
                    <p className="text-xs text-gray-400 mt-1">{t.modalThinkingSub}</p>
                  </div>
                ) : explainResult.error ? (
                  <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mt-4">
                    <span className="text-red-400 text-lg">⚠️</span>
                    <div>
                      <p className="text-red-700 font-medium text-sm">{t.modalFail}</p>
                      <p className="text-red-500 text-xs mt-1">{explainResult.error}</p>
                    </div>
                  </div>
                ) : sections.length >= 3 ? (
                  <div className="space-y-3 mt-2">
                    {sections.map((sec, i) => {
                      const meta = sectionMeta[i] ?? sectionMeta[0];
                      // 去掉开头的「1. 」「2. 」「3. 」编号
                      const bodyText = sec.replace(/^[123]\.\s*/, '').trim();
                      return (
                        <div key={i} className={`rounded-2xl border ${meta.border} ${meta.lightBg} overflow-hidden`}>
                          <div className={`px-4 py-2.5 bg-gradient-to-r ${meta.color} flex items-center gap-2`}>
                            <span className="text-white font-bold text-sm w-6 h-6 rounded-full bg-white/25 flex items-center justify-center shrink-0 leading-none">{i + 1}</span>
                            <span className="text-white font-semibold text-sm">{meta.label}</span>
                          </div>
                          <p className={`px-4 py-3 text-sm leading-relaxed ${meta.textColor.replace('700','800')} text-gray-700`}>
                            {bodyText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // 兜底：AI 没有按三段回答时，直接渲染原始文本
                  <div
                    className="prose prose-sm text-gray-700 text-sm leading-relaxed mt-4"
                    dangerouslySetInnerHTML={{ __html: explainResult.answer.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>') }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default AIEval;
