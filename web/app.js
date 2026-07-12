/* OpenBible web portal prototype — top-nav panel switching + audio modal + group workspace. */

const WEB_CHROME = {
  '6a': { title: 'OpenBible · 阅读页', url: 'openbible.live/bible/john/3' },
  '6b': { title: 'OpenBible · 社群', url: 'openbible.live/community/youth-group' },
  '6c': { title: 'OpenBible · 活动', url: 'openbible.live/community/youth-group/events' },
};

function switchWebPanel(id) {
  document.querySelectorAll('.panel').forEach((el) => el.classList.remove('active'));
  const target = document.querySelector(`.panel[data-panel="${id}"]`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.web-nav-item[data-web-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.webNav === id);
  });

  const chrome = WEB_CHROME[id];
  if (chrome) {
    document.getElementById('chrome-tab-title').textContent = chrome.title;
    document.getElementById('chrome-url').textContent = chrome.url;
  }
  const label = document.getElementById('current-panel-label');
  if (label) label.textContent = id;
}

function renderWebVerses() {
  const container = document.getElementById('web-verses-container');
  if (!container) return;
  const byPara = {};
  MOCK.webVerses.forEach((v) => { (byPara[v.para] = byPara[v.para] || []).push(v); });
  const keys = Object.keys(byPara).sort((a, b) => a - b);
  container.innerHTML = keys.map((k, i) => {
    const inner = byPara[k].map((v) => {
      const sup = `<sup style="font-size:12px;font-weight:400;color:var(--body);margin:0 4px;">${v.n}</sup>`;
      const text = v.highlighted ? `<mark style="background:var(--yellow);color:var(--ink);padding:1px 2px;">${v.text}</mark>` : `<span>${v.text}</span>`;
      return sup + text;
    }).join('');
    return `<p style="margin:0 0 ${i === keys.length - 1 ? '0' : '16px'};font-size:18px;font-weight:400;line-height:2;text-wrap:pretty;">${inner}</p>`;
  }).join('');
}

function renderWebCommentary() {
  const container = document.getElementById('web-commentary-list');
  if (!container) return;
  const items = MOCK.commentary.slice(2);
  container.innerHTML = items.map((c, i) => `
    <div class="card" style="border-radius:16px;padding:16px 18px;margin-bottom:10px;${i > 0 ? 'opacity:.65;' : ''}">
      <div style="align-self:flex-start;display:inline-block;font-size:11px;font-weight:800;${c.highlight ? 'background:var(--yellow);border-radius:6px;padding:2px 8px;' : 'color:var(--purple);'}margin-bottom:8px;">${c.range}</div>
      <p style="margin:0;font-size:13px;font-weight:400;line-height:1.85;color:var(--ink);text-wrap:pretty;">${c.text}</p>
    </div>
  `).join('');
}

function renderWebGroupList() {
  const container = document.getElementById('web-group-list');
  if (!container) return;
  container.innerHTML = MOCK.groups.map((g) => `
    <div class="group-list-row${g.id === 'youth' ? ' active' : ''}">
      <div style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${g.color};border-radius:9px;font-size:13px;font-weight:800;">${g.letter}</div>
      <div style="flex:1;font-size:13px;font-weight:${g.id === 'youth' ? '800' : '700'};color:${g.id === 'youth' ? 'var(--ink)' : 'var(--body)'};">${g.name}</div>
      ${g.badge === '官方' ? '<div style="font-size:9px;font-weight:800;background:var(--yellow);border-radius:5px;padding:2px 5px;">官方</div>' : ''}
      ${g.id === 'grace' ? '<div style="width:8px;height:8px;background:var(--pink);border-radius:100px;"></div>' : ''}
    </div>
  `).join('');
}

const WEB_GROUP_TABS = [
  { id: 'chat', label: '交流' },
  { id: 'info', label: '信息' },
  { id: 'events', label: '活动' },
];
let webGroupTab = 'info';

function renderWebGroupSubtabs() {
  const container = document.getElementById('web-group-subtabs');
  if (!container) return;
  container.innerHTML = WEB_GROUP_TABS.map((t) => `
    <div class="web-group-subtab" data-subtab="${t.id}" style="position:relative;font-weight:${t.id === webGroupTab ? '800' : '600'};color:${t.id === webGroupTab ? 'var(--ink)' : 'var(--body)'};cursor:pointer;">
      ${t.label}
      ${t.id === webGroupTab ? '<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:24px;height:3px;background:var(--purple);border-radius:100px;"></div>' : ''}
    </div>
  `).join('');
}

function renderWebGroupFeed() {
  const container = document.getElementById('web-group-feed');
  if (!container) return;
  const d = MOCK.groupDetail;
  if (webGroupTab === 'info') {
    container.innerHTML = `
      <div class="card" style="padding:14px 16px;">
        <div style="font-size:14px;font-weight:500;color:var(--body);padding:4px 0 12px;">分享此刻的领受…</div>
        <div style="display:flex;align-items:center;gap:6px;border-top:1px solid var(--surface-2);padding-top:10px;">
          <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-weight:800;cursor:pointer;">B</div>
          <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-weight:600;font-style:italic;cursor:pointer;">I</div>
          <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;font-size:13px;font-weight:600;text-decoration:underline;cursor:pointer;">U</div>
          <div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;color:var(--body);cursor:pointer;"><span data-icon="image" data-size="14"></span></div>
          <div style="display:flex;align-items:center;gap:5px;height:30px;padding:0 10px;background:rgba(191,120,246,.14);border:1px solid var(--line);border-radius:8px;font-size:12px;font-weight:700;color:var(--purple);cursor:pointer;">插入经文引用</div>
          <div style="flex:1;"></div>
          <div style="display:flex;align-items:center;justify-content:center;height:34px;padding:0 18px;background:var(--purple);border-radius:100px;font-size:13px;font-weight:700;color:#fff;box-shadow:var(--shadow-card);cursor:pointer;">发布</div>
        </div>
      </div>
      <div style="background:var(--yellow);border-radius:16px;box-shadow:var(--shadow-card);padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="font-size:10px;font-weight:800;letter-spacing:.1em;background:var(--ink);color:#fff;padding:3px 6px;border-radius:6px;">公告</div>
          <div style="font-size:11px;font-weight:700;color:var(--body);">群主 · 王弟兄 · 置顶</div>
        </div>
        <div style="font-size:13px;font-weight:600;line-height:1.7;">${d.announcement}</div>
      </div>
      ${d.posts.map((p) => `
        <div class="card" style="padding:14px 16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:${p.color};border-radius:100px;font-size:12px;font-weight:800;">${p.avatar}</div>
            <div style="flex:1;font-size:13px;font-weight:800;">${p.name} <span style="font-size:11px;font-weight:600;color:var(--body);margin-left:6px;">${p.time}</span></div>
          </div>
          <div style="font-size:14px;font-weight:500;line-height:1.75;margin-bottom:10px;">${p.text}</div>
          ${p.verseRef ? `
            <div style="display:flex;align-items:center;gap:10px;background:rgba(191,120,246,.10);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer;">
              <div style="flex:1;"><div style="font-size:11px;font-weight:800;color:var(--purple);margin-bottom:3px;">${p.verseRef}</div><div style="font-size:12px;font-weight:500;color:var(--body);line-height:1.6;">${p.verseText}</div></div>
              <span data-icon="chevron-right" data-size="16" style="color:var(--purple);"></span>
            </div>` : ''}
          <div style="display:flex;align-items:center;gap:18px;color:var(--body);font-size:12px;font-weight:700;">
            <div style="display:flex;align-items:center;gap:5px;cursor:pointer;"><span data-icon="heart" data-size="14"></span> ${p.likes}</div>
            <div style="display:flex;align-items:center;gap:5px;cursor:pointer;"><span data-icon="message-square" data-size="14"></span> ${p.comments}</div>
          </div>
        </div>
      `).join('')}
    `;
  } else if (webGroupTab === 'chat') {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;background:rgba(191,120,246,.14);border-radius:16px;padding:12px 14px;">
        <div style="flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:var(--purple);border-radius:100px;color:#fff;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z"></path><path d="M19 2v4"></path><path d="M17 4h4"></path></svg></div>
        <div style="flex:1;"><div style="font-size:14px;font-weight:800;margin-bottom:2px;">${d.assistantName}</div><div style="font-size:11px;font-weight:600;color:var(--body);">${d.assistantIntro}</div></div>
      </div>
      <div style="align-self:flex-start;max-width:60%;background:var(--white);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-card);padding:10px 14px;font-size:13px;font-weight:500;line-height:1.7;color:var(--body);">${d.assistantWelcome}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div style="align-self:flex-end;max-width:60%;background:var(--ink);color:#fff;border-radius:12px;padding:9px 12px;font-size:14px;font-weight:600;line-height:1.6;box-shadow:var(--shadow-card);">${d.memberQuestion}</div>
      </div>
      <div class="card" style="padding:14px;max-width:640px;">${d.assistantAnswer.map((p, i) => `<p style="margin:0 0 ${i === d.assistantAnswer.length - 1 ? '0' : '10px'};font-size:13px;line-height:1.8;color:var(--body);font-weight:500;">${p}</p>`).join('')}</div>
    `;
  } else {
    container.innerHTML = d.events.map((e) => `
      <div class="card" style="padding:16px;max-width:640px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:800;border-radius:6px;padding:3px 8px;${e.tagStyle === 'purple' ? 'background:rgba(191,120,246,.16);color:var(--purple);' : 'background:rgba(233,130,100,.2);color:#D15B46;'}">${e.tag}</div>
          <div style="font-size:11px;font-weight:600;color:var(--body);">${e.status}</div>
        </div>
        <div style="font-size:16px;font-weight:800;margin-bottom:8px;">${e.title}</div>
        ${e.when ? `<div style="font-size:12px;font-weight:600;color:var(--body);margin-bottom:4px;">📅 ${e.when}</div>` : ''}
        ${e.where ? `<div style="font-size:12px;font-weight:600;color:var(--body);margin-bottom:12px;">📍 ${e.where}</div>` : ''}
        <button style="display:flex;align-items:center;justify-content:center;height:40px;padding:0 18px;background:var(--purple);border:none;border-radius:100px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">${e.cta}</button>
      </div>
    `).join('');
  }
  hydrateIcons(container);
}

function initWebGroupSubtabs() {
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.web-group-subtab');
    if (tab) { webGroupTab = tab.dataset.subtab; renderWebGroupSubtabs(); renderWebGroupFeed(); }
  });
}

function renderWebCalendar() {
  const container = document.getElementById('web-calendar-grid');
  if (!container) return;
  const BADGE_STYLES = {
    muted: 'background:var(--surface-2);color:var(--body);',
    orange: 'background:rgba(233,130,100,.2);color:#D15B46;',
    purple: 'background:rgba(191,120,246,.16);color:var(--purple);',
  };
  container.innerHTML = MOCK.calendarDays.map((day, i) => `
    <div style="border-right:1px solid var(--surface-2);border-bottom:1px solid var(--surface-2);padding:8px;font-size:12px;font-weight:600;${day.muted ? 'color:var(--line);' : ''}">
      ${day.isToday ? `<div style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:var(--ink);color:var(--yellow);border-radius:100px;font-size:12px;font-weight:800;">${day.d}</div>` : day.d}
      ${day.badge ? `<div style="margin-top:4px;font-size:10px;font-weight:700;border-radius:6px;padding:3px 6px;${BADGE_STYLES[day.badgeStyle] || ''}">${day.badge}</div>` : ''}
    </div>
  `).join('');
}

function initTopNav() {
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.web-nav-item[data-web-nav]');
    if (nav) switchWebPanel(nav.dataset.webNav);
  });
}

function initAudioModal() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-audio-modal"]')) document.getElementById('audio-modal-overlay').classList.add('active');
    if (e.target.closest('[data-action="close-audio-modal"]')) document.getElementById('audio-modal-overlay').classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(document);
  renderWebVerses();
  renderWebCommentary();
  renderWebGroupList();
  renderWebGroupSubtabs();
  renderWebGroupFeed();
  renderWebCalendar();
  hydrateIcons(document);
  initTopNav();
  initAudioModal();
  initWebGroupSubtabs();
  switchWebPanel('6a');
});
