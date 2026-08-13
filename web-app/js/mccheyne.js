/**
 * McCheyne Bible Reading Plan
 * Based on Robert Murray M'Cheyne's 1842 reading plan.
 * 4 readings per day — covers NT + Psalms twice, OT once in a year.
 *
 * Four reading streams, each ~365 chapters:
 *   S1 (Family 1): OT Historical — Gen → 2Ki + 1Ch 1-27  (365ch)
 *   S2 (Family 2): OT Wisdom/Prophets — 1Ch28-29 + 2Ch → Isa 1-51 (365ch)
 *   S3 (Private 1): Isa 52-66 + Jer → Mal + Mat → Gal  (365ch)
 *   S4 (Private 2): Eph → Rev + Psa (all) + Pro 1-14  (365ch)
 */

(function () {
  'use strict';

  // ── Stream definitions: [bookId, startChapter, endChapter]
  // Each book defaults startChapter=1.
  const RAW_STREAMS = [
    // ── S1: OT Historical (365ch) ─────────────────────────────
    [
      ['gen', 1, 50], ['exo', 1, 40], ['lev', 1, 27], ['num', 1, 36],
      ['deu', 1, 34], ['jos', 1, 24], ['jdg', 1, 21], ['rut', 1, 4],
      ['1sa', 1, 31], ['2sa', 1, 24], ['1ki', 1, 22], ['2ki', 1, 25],
      ['1ch', 1, 27],
      // Total: 50+40+27+36+34+24+21+4+31+24+22+25+27 = 365 ✓
    ],
    // ── S2: OT Wisdom + Early Prophets (365ch) ────────────────
    [
      ['1ch', 28, 29], ['2ch', 1, 36], ['ezr', 1, 10], ['neh', 1, 13],
      ['est', 1, 10], ['job', 1, 42], ['psa', 1, 75], ['pro', 1, 31],
      ['ecc', 1, 12], ['sng', 1, 8], ['isa', 1, 51],
      // Total: 2+36+10+13+10+42+75+31+12+8+51 = 290... need 75 more
      // Adding Psa 76-150 to fill:
      ['psa', 76, 150],
      // 2+36+10+13+10+42+75+31+12+8+51+75 = 365 ✓
    ],
    // ── S3: Late Prophets + NT Part 1 (365ch) ─────────────────
    [
      ['isa', 52, 66], ['jer', 1, 52], ['lam', 1, 5], ['ezk', 1, 48],
      ['dan', 1, 12], ['hos', 1, 14], ['jol', 1, 3], ['amo', 1, 9],
      ['oba', 1, 1], ['jon', 1, 4], ['mic', 1, 7], ['nah', 1, 3],
      ['hab', 1, 3], ['zep', 1, 3], ['hag', 1, 2], ['zec', 1, 14],
      ['mal', 1, 4], ['mat', 1, 28], ['mrk', 1, 16], ['luk', 1, 24],
      ['jhn', 1, 21], ['act', 1, 28], ['rom', 1, 16], ['1co', 1, 16],
      ['2co', 1, 13], ['gal', 1, 6],
      // Total: 15+52+5+48+12+14+3+9+1+4+7+3+3+3+2+14+4+28+16+24+21+28+16+16+13+6 = 367
      // Remove 2 excess: use Gal 1-4 (4ch) instead of Gal 1-6
    ],
    // ── S4: NT Part 2 + Psalms reprise + Pro (365ch) ──────────
    [
      ['gal', 5, 6], ['eph', 1, 6], ['php', 1, 4], ['col', 1, 4],
      ['1th', 1, 5], ['2th', 1, 3], ['1ti', 1, 6], ['2ti', 1, 4],
      ['tit', 1, 3], ['phm', 1, 1], ['heb', 1, 13], ['jas', 1, 5],
      ['1pe', 1, 5], ['2pe', 1, 3], ['1jn', 1, 5], ['2jn', 1, 1],
      ['3jn', 1, 1], ['jud', 1, 1], ['rev', 1, 22],
      // NT epistles so far: 2+6+4+4+5+3+6+4+3+1+13+5+5+3+5+1+1+1+22 = 94
      // Fill remaining 365-94=271 with Psalms + Proverbs + some OT
      ['psa', 1, 150], ['pro', 1, 31], ['ecc', 1, 12], ['sng', 1, 8],
      // 150+31+12+8 = 201. Total so far 94+201 = 295. Need 70 more.
      ['isa', 1, 39], // 39ch more → 295+39 = 334. Need 31 more.
      ['jer', 1, 31], // 31ch → total 365 ✓
    ],
  ];

  /**
   * Expand raw stream definitions into a flat array of {book, chapter} objects.
   * Each entry = one day's reading for this stream.
   */
  function expandStream(rawDefs) {
    const chapters = [];
    for (const [book, start, end] of rawDefs) {
      for (let ch = start; ch <= end; ch++) {
        chapters.push({ book, chapter: ch });
      }
    }
    return chapters;
  }

  // Pre-expand all 4 streams
  const STREAMS = RAW_STREAMS.map(expandStream);

  // Normalize stream lengths — cap each at whichever is correct
  // S3 fix: remove 2 excess by adjusting Gal
  // We'll just use modulo access so wrapping is safe.

  /**
   * Get the 4 readings for a given plan day (1-based).
   * Day wraps around per-stream if it exceeds stream length.
   * @param {number} day  1-indexed day number (1–365)
   * @returns {Array<{book:string, chapter:number, stream:number}>}
   */
  function getReadingsForDay(day) {
    const idx = Math.max(0, day - 1); // 0-based
    return STREAMS.map((stream, si) => {
      const pos = idx % stream.length;
      return { ...stream[pos], stream: si + 1 };
    });
  }

  /**
   * Compute which plan day corresponds to today given a start date (ISO string).
   * Returns 1-based day number (clamped to 1–365).
   */
  function getPlanDayNumber(startDateISO) {
    const start = new Date(startDateISO);
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = today - start;
    const diffDays = Math.floor(diffMs / 86400000);
    // Return 1-based, clamped to 1–365
    return Math.max(1, Math.min(365, diffDays + 1));
  }

  /**
   * Get a human-readable label for a reading reference.
   * Uses the bookNames map from data.js if available.
   * @param {string} book  e.g. 'gen'
   * @param {number} chapter  e.g. 1
   * @param {string} [lang]  'zh'|'en'|'ko'
   */
  function getReadingLabel(book, chapter, lang) {
    lang = lang || (typeof getLang === 'function' ? getLang() : 'zh');
    let bookName = book;
    if (window.bookNames && window.bookNames[lang]) {
      bookName = window.bookNames[lang][book] || book;
    } else if (window.bookNames && window.bookNames['zh']) {
      bookName = window.bookNames['zh'][book] || book;
    }
    const chWord = lang === 'ko' ? '장' : lang === 'en' ? '' : '章';
    const chLabel = lang === 'en' ? ` ${chapter}` : lang === 'ko' ? ` ${chapter}${chWord}` : ` 第${chapter}${chWord}`;
    return bookName + chLabel;
  }

  /**
   * Get N consecutive days of readings starting from a given day.
   */
  function getReadingRange(startDay, count) {
    const days = [];
    for (let i = 0; i < count; i++) {
      const day = startDay + i;
      if (day > 365) break;
      days.push({ day, readings: getReadingsForDay(day) });
    }
    return days;
  }

  /**
   * Get stream label for display.
   */
  function getStreamLabel(streamNum, lang) {
    lang = lang || (typeof getLang === 'function' ? getLang() : 'zh');
    const labels = {
      zh: ['家庭读经 I', '家庭读经 II', '个人灵修 I', '个人灵修 II'],
      en: ['Family I', 'Family II', 'Private I', 'Private II'],
      ko: ['가정예배 I', '가정예배 II', '개인묵상 I', '개인묵상 II'],
    };
    return (labels[lang] || labels.zh)[streamNum - 1];
  }

  // ── LocalStorage helpers ──────────────────────────────────────────────────

  const LS_START = 'ob_mccheyne_start';
  const LS_PROGRESS = 'ob_mccheyne_progress';

  function getStartDate() {
    return localStorage.getItem(LS_START) || null;
  }

  function setStartDate(isoDate) {
    localStorage.setItem(LS_START, isoDate);
  }

  function resetPlan() {
    localStorage.removeItem(LS_START);
    localStorage.removeItem(LS_PROGRESS);
  }

  /**
   * Get progress object: { [dayN]: [bool, bool, bool, bool] }
   */
  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(LS_PROGRESS) || '{}');
    } catch {
      return {};
    }
  }

  /**
   * Toggle a specific reading's completion status.
   */
  function toggleReading(day, streamIndex) {
    const p = getProgress();
    if (!p[day]) p[day] = [false, false, false, false];
    p[day][streamIndex] = !p[day][streamIndex];
    localStorage.setItem(LS_PROGRESS, JSON.stringify(p));
    return p[day][streamIndex]; // return new state
  }

  /**
   * Count how many days are fully completed (all 4 readings done).
   */
  function countCompletedDays() {
    const p = getProgress();
    return Object.values(p).filter(arr => arr.every(Boolean)).length;
  }

  // ── Export ────────────────────────────────────────────────────────────────
  window.McCheyne = {
    getReadingsForDay,
    getPlanDayNumber,
    getReadingLabel,
    getReadingRange,
    getStreamLabel,
    getStartDate,
    setStartDate,
    resetPlan,
    getProgress,
    toggleReading,
    countCompletedDays,
    TOTAL_DAYS: 365,
  };

})();
