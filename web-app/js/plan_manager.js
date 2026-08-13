/**
 * Universal Plan Manager
 * Handles arbitrary JSON reading plans fetched from the backend.
 * 
 * Replaces the static mccheyne.js and tracks progress locally,
 * while syncing complete-day counts to the backend in app.js.
 */

(function () {
  'use strict';

  class PlanManager {
    constructor(planObj) {
        this.plan = planObj;
        this.slug = planObj.slug;
        this.schedule = planObj.schedule || []; // Array of days, each day is Array of {b: book, c: chapter}
        this.LS_START = `ob_plan_${this.slug}_start`;
        this.LS_PROGRESS = `ob_plan_${this.slug}_progress`;
    }

    getReadingsForDay(day) {
        // day is 1-indexed
        const idx = Math.max(0, day - 1);
        if (idx < this.schedule.length) {
            return this.schedule[idx]; 
        }
        return [];
    }
    
    // Convert {b:"gen", c:1} to label based on language
    getReadingLabel(reading, lang) {
        lang = lang || (typeof getLang === 'function' ? getLang() : 'zh');
        const book = reading.b;
        const chapter = reading.c;
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
    
    getPlanDayNumber(startDateISO) {
        if (!startDateISO) return 1;
        const start = new Date(startDateISO);
        start.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffMs = today - start;
        const diffDays = Math.floor(diffMs / 86400000);
        return Math.max(1, Math.min(this.plan.days || 365, diffDays + 1));
    }
    
    getStartDate() {
        return localStorage.getItem(this.LS_START) || null;
    }
    
    setStartDate(isoDate) {
        localStorage.setItem(this.LS_START, isoDate);
    }
    
    getProgress() {
        try {
            return JSON.parse(localStorage.getItem(this.LS_PROGRESS) || '{}');
        } catch {
            return {};
        }
    }
    
    toggleReading(day, streamIndex) {
        const p = this.getProgress();
        if (!p[day]) p[day] = {};
        p[day][streamIndex] = !p[day][streamIndex];
        localStorage.setItem(this.LS_PROGRESS, JSON.stringify(p));
        return p[day][streamIndex];
    }
    
    countCompletedDays() {
        const p = this.getProgress();
        let count = 0;
        const totalDays = this.plan.days || 365;
        for (let day = 1; day <= totalDays; day++) {
             const dayReadings = this.getReadingsForDay(day);
             if (!dayReadings || dayReadings.length === 0) continue;
             // Check if all readings for this day are done
             let allDone = true;
             for (let i = 0; i < dayReadings.length; i++) {
                 if (!p[day] || !p[day][i]) {
                     allDone = false;
                     break;
                 }
             }
             if (allDone) count++;
        }
        return count;
    }
    
    getReadingRange(startDay, count) {
        const days = [];
        const totalDays = this.plan.days || 365;
        for (let i = 0; i < count; i++) {
            const day = startDay + i;
            if (day > totalDays) break;
            days.push({ day, readings: this.getReadingsForDay(day) });
        }
        return days;
    }
    
    resetPlan() {
        localStorage.removeItem(this.LS_START);
        localStorage.removeItem(this.LS_PROGRESS);
    }
  }

  window.PlanManager = PlanManager;
})();
