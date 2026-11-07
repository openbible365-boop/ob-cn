// 阅读统计（网页版）：与 App 端同一套规则——
// 停留满 8 秒且页面在前台才算读过这一章；同一章每天只记一次；先进本机队列，空闲时批量上传。
// 只记「哪一章被读了」，不记任何阅读内容。未登录用随机设备 id 计人数。
(function () {
    const DEVICE_KEY = 'ob_device_id';
    const QUEUE_KEY = 'ob_read_stats_queue';
    const SEEN_KEY = 'ob_read_stats_seen';
    const MIN_READ_MS = 8000;
    const timers = { bible: null, commentary: null };
    let flushTimer = null;
    let flushing = false;

    const read = (key, fallback) => {
        try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
    };
    const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 存不了就不统计 */ } };

    function deviceId() {
        let id = read(DEVICE_KEY, '');
        if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
            id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
            write(DEVICE_KEY, id);
        }
        return id;
    }

    function localDay() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function record(event) {
        const today = localDay();
        const key = `${event.kind}|${event.version || ''}|${event.book}|${event.chapter}`;
        const seen = read(SEEN_KEY, { day: today, keys: [] });
        const keys = seen.day === today ? seen.keys : [];
        if (keys.includes(key)) return;
        write(SEEN_KEY, { day: today, keys: [...keys, key].slice(-500) });
        const queue = read(QUEUE_KEY, []);
        write(QUEUE_KEY, [...queue, { ...event, at: new Date().toISOString() }].slice(-300));
        scheduleFlush(15000);
    }

    function scheduleFlush(delay) {
        clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, delay);
    }

    async function flush() {
        if (flushing) return;
        const queue = read(QUEUE_KEY, []);
        if (!queue.length) return;
        flushing = true;
        const batch = queue.slice(0, 100);
        try {
            const res = await fetch('/api/mobile/reading-stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                keepalive: true,
                body: JSON.stringify({ deviceId: deviceId(), platform: 'web', events: batch }),
            });
            if (res.ok || (res.status >= 400 && res.status < 500)) {
                const sent = new Set(batch.map(e => `${e.at}|${e.kind}|${e.book}|${e.chapter}`));
                const rest = read(QUEUE_KEY, []).filter(e => !sent.has(`${e.at}|${e.kind}|${e.book}|${e.chapter}`));
                write(QUEUE_KEY, rest);
                if (rest.length) scheduleFlush(2000);
            }
        } catch { /* 离线：下次再传 */ } finally {
            flushing = false;
        }
    }

    /**
     * 某类内容（经文 / 注释）换到新的一章时调用：重新计时，满 8 秒且前台、且 isVisible() 为真才记一次。
     * isVisible 用于注释栏——侧栏没展开或不在注释标签时不算读注释。
     */
    function start(kind, event, isVisible) {
        clearTimeout(timers[kind]);
        timers[kind] = setTimeout(() => {
            if (document.visibilityState !== 'visible') return;
            if (isVisible && !isVisible()) return;
            record({ kind, ...event });
        }, MIN_READ_MS);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });
    setTimeout(flush, 3000); // 补传上次没传完的

    window.obReadStats = { start };
})();
