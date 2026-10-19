/* OpenBible mobile prototype — screen router + interactions (vanilla JS, mocked data). */

const MAIN_TABS = ['1a', '2b', '3a', '4a', '5a'];
let screenHistory = ['1a'];
let currentHighlightColor = '#FFD465';

const TAB_DEFS = [
  { id: '1a', label: '圣经', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>' },
  { id: '2b', label: '注释', icon: icon('message-square', 19) },
  { id: '3a', label: '慧读', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7z"></path><path d="M19 2v4"></path><path d="M17 4h4"></path></svg>' },
  { id: '4a', label: '社群', icon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>' },
  { id: '5a', label: '我的', icon: icon('user', 19) },
];

function tabBarHTML(activeId) {
  return TAB_DEFS.map((t) => {
    const isActive = t.id === activeId;
    return `
      <button class="tab${isActive ? ' active' : ''}" data-tab="${t.id}">
        <div class="tab-icon-wrap">${t.icon}</div>
        <div class="tab-label">${t.label}</div>
      </button>`;
  }).join('');
}

function renderAllTabBars() {
  document.querySelectorAll('nav.tab-bar[data-active]').forEach((nav) => {
    nav.innerHTML = tabBarHTML(nav.dataset.active);
  });
}

function renderScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const target = document.querySelector(`.screen[data-screen="${id}"]`);
  if (target) target.classList.add('active');

  const label = document.getElementById('current-screen-label');
  if (label) label.textContent = id;
}

function switchTab(id) {
  screenHistory = [id];
  renderScreen(id);
}

function pushScreen(id) {
  screenHistory.push(id);
  renderScreen(id);
}

function replaceTop(id) {
  screenHistory[screenHistory.length - 1] = id;
  renderScreen(id);
}

function goBack() {
  if (screenHistory.length > 1) {
    screenHistory.pop();
    renderScreen(screenHistory[screenHistory.length - 1]);
  }
}

/* ---------- 1a: render verses grouped into paragraphs ---------- */
function renderVerses() {
  const container = document.getElementById('verses-container');
  if (!container) return;
  const byPara = {};
  MOCK.verses.forEach((v) => {
    (byPara[v.para] = byPara[v.para] || []).push(v);
  });
  const paraKeys = Object.keys(byPara).sort((a, b) => a - b);
  container.innerHTML = paraKeys.map((k, i) => {
    const verses = byPara[k];
    const inner = verses.map((v) => {
      const sup = `<sup style="font-size:12px;font-weight:400;color:var(--body);margin:0 4px;">${v.n}</sup>`;
      const text = v.highlighted
        ? `<mark class="verse-text${v.selectable ? ' selectable' : ''}" data-vref="${v.id || ''}" style="background:${currentHighlightColor};color:var(--ink);padding:1px 2px;cursor:${v.selectable ? 'pointer' : 'default'};">${v.text}</mark>`
        : `<span>${v.text}</span>`;
      return sup + text;
    }).join('');
    const isLast = i === paraKeys.length - 1;
    return `<p style="margin:0 0 ${isLast ? '0' : '14px'};font-size:19px;font-weight:400;line-height:1.95;color:var(--ink);text-wrap:pretty;">${inner}</p>`;
  }).join('');

  container.querySelectorAll('.selectable').forEach((el) => {
    el.addEventListener('click', () => pushScreen('1b'));
  });
}

/* ---------- 1b: highlight color dots ---------- */
function renderColorDots() {
  const container = document.getElementById('color-dots');
  if (!container) return;
  container.innerHTML = MOCK.highlightColors.map((dot) => `
    <div class="color-dot" data-color="${dot.c}" style="position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px;background:${dot.c};border:1px solid var(--line);border-radius:50%;cursor:pointer;">
      ${dot.c === currentHighlightColor ? '<span data-icon="check" data-size="16" style="color:#18191F;"></span>' : ''}
    </div>
  `).join('');
  hydrateIcons(container);
  container.querySelectorAll('.color-dot').forEach((el) => {
    el.addEventListener('click', () => {
      currentHighlightColor = el.dataset.color;
      renderColorDots();
      renderVerses();
    });
  });
}

/* ---------- 1c: streamed AI answer ---------- */
function renderAiAnswer() {
  const container = document.getElementById('ai-answer-blocks');
  if (!container) return;
  container.innerHTML = MOCK.aiAnswer.map((block) => `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.06em;background:${block.color};color:${block.dark ? '#fff' : 'var(--ink)'};border:1px solid var(--line);border-radius:12px;padding:3px 8px;">${block.tag}</div>
      <div class="ai-block-text" style="font-size:13px;line-height:1.8;color:var(--body);font-weight:500;text-wrap:pretty;"></div>
    </div>
  `).join('') + `
    <div id="streaming-indicator" style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:10px;">
      <div style="display:flex;gap:3px;">
        <div style="width:5px;height:5px;background:var(--ink);border-radius:50%;animation:ob-dot 1.4s ease-in-out infinite;animation-delay:0s;"></div>
        <div style="width:5px;height:5px;background:var(--ink);border-radius:50%;animation:ob-dot 1.4s ease-in-out infinite;animation-delay:.2s;"></div>
        <div style="width:5px;height:5px;background:var(--ink);border-radius:50%;animation:ob-dot 1.4s ease-in-out infinite;animation-delay:.4s;"></div>
      </div>
      <div style="font-size:11px;font-weight:600;color:var(--body);">正在生成…</div>
    </div>
  `;

  const blocks = container.querySelectorAll('.ai-block-text');
  let i = 0;
  function typeNext() {
    if (i >= blocks.length) {
      const indicator = document.getElementById('streaming-indicator');
      if (indicator) indicator.remove();
      return;
    }
    blocks[i].textContent = MOCK.aiAnswer[i].text;
    i += 1;
    setTimeout(typeNext, 550);
  }
  setTimeout(typeNext, 400);
}

function initTabBars() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) switchTab(btn.dataset.tab);
  });
}

function initScreen1b() {
  const dismiss = document.getElementById('sheet-dismiss');
  if (dismiss) dismiss.addEventListener('click', goBack);
  const huidu = document.querySelector('[data-action="go-huidu"]');
  if (huidu) huidu.addEventListener('click', () => { replaceTop('1c'); renderAiAnswer(); });
}

/* generic delegate: any element with data-action="back" anywhere pops the history stack */
function initBackButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="back"]');
    if (btn) goBack();
  });
}

/* ---------- 2b: full-chapter commentary ---------- */
function renderCommentary() {
  const container = document.getElementById('commentary-list');
  if (!container) return;
  container.innerHTML = MOCK.commentary.map((c) => `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="align-self:flex-start;font-size:12px;font-weight:800;${c.highlight ? 'background:var(--yellow);border-radius:6px;padding:2px 8px;' : 'color:var(--purple);'}">${c.range}</div>
      <p style="margin:0;font-size:15px;font-weight:400;line-height:1.85;color:var(--ink);text-wrap:pretty;">${c.text}</p>
    </div>
  `).join('');
}

/* ---------- 3a: 慧读 home history list ---------- */
function renderHuiduHome() {
  const today = document.getElementById('huidu-today');
  const yesterday = document.getElementById('huidu-yesterday');
  if (today) {
    today.innerHTML = MOCK.huiduHistory.today.map((h) => `
      <div class="huidu-history-item" style="display:flex;align-items:center;gap:12px;background:var(--white);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow-card);padding:14px 16px;cursor:pointer;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
            <div style="font-size:11px;font-weight:800;background:${h.highlight ? 'var(--yellow)' : 'var(--surface-2)'};border-radius:6px;padding:2px 8px;">${h.ref}</div>
            <div style="font-size:11px;font-weight:600;color:var(--body);">${h.rounds}</div>
          </div>
          <div style="font-size:14px;font-weight:600;line-height:1.5;">${h.title}</div>
        </div>
        <div style="color:var(--body);" data-icon="chevron-right" data-size="16"></div>
      </div>
    `).join('');
  }
  if (yesterday) {
    yesterday.innerHTML = MOCK.huiduHistory.yesterday.map((h) => `
      <div class="huidu-history-item" style="display:flex;align-items:center;gap:12px;background:var(--white);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow-card);padding:14px 16px;cursor:pointer;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
            <div style="font-size:11px;font-weight:800;background:var(--surface-2);border-radius:6px;padding:2px 8px;">${h.ref}</div>
            <div style="font-size:11px;font-weight:600;color:var(--body);">${h.rounds}</div>
          </div>
          <div style="font-size:14px;font-weight:600;line-height:1.5;">${h.title}</div>
        </div>
        <div style="color:var(--body);" data-icon="chevron-right" data-size="16"></div>
      </div>
    `).join('');
  }
  hydrateIcons(document.getElementById('screen-3a'));
}

function initScreen3a() {
  const root = document.getElementById('screen-3a');
  if (!root) return;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="new-conversation"]') || e.target.closest('.huidu-history-item')) {
      pushScreen('3b');
      renderThread();
    }
  });
}

/* ---------- 3b: continuous dialogue thread ---------- */
function renderThread() {
  const container = document.getElementById('thread-followup-answer');
  if (!container) return;
  container.innerHTML = MOCK.followupAnswer.map((p) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.8;color:var(--body);font-weight:500;text-wrap:pretty;">${p}</p>`).join('');
}

/* ---------- 4a: community console group list ---------- */
const BADGE_STYLES = {
  official: 'background:var(--yellow);color:var(--ink);',
  owner: 'background:rgba(191,120,246,.16);color:var(--purple);',
  muted: 'background:var(--surface-2);color:var(--body);font-weight:700;',
};

function renderGroupList() {
  const container = document.getElementById('group-list');
  if (!container) return;
  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">` + MOCK.groups.map((g, i) => `
    ${i === 1 ? '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--body);">我加入的群组</div>' : ''}
    <div class="group-row" data-group="${g.id}" style="display:flex;align-items:center;gap:14px;background:var(--white);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow-card);padding:16px;cursor:pointer;">
      <div style="flex:none;display:flex;align-items:center;justify-content:center;width:52px;height:52px;background:${g.color};border-radius:14px;font-size:20px;font-weight:800;">${g.letter}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <div style="font-size:16px;font-weight:800;">${g.name}</div>
          ${g.badge ? `<div style="font-size:10px;font-weight:800;border-radius:6px;padding:2px 6px;${BADGE_STYLES[g.badgeStyle] || ''}">${g.badge}</div>` : ''}
        </div>
        <div style="font-size:12px;font-weight:500;color:var(--body);">${g.desc}</div>
      </div>
      <div style="color:var(--body);"><span data-icon="chevron-right" data-size="18"></span></div>
    </div>
  `).join('') + `</div>`;
  hydrateIcons(container);
}

function initScreen4a() {
  const root = document.getElementById('screen-4a');
  if (!root) return;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="create-group"]')) {
      pushScreen('4e');
    } else if (e.target.closest('.group-row')) {
      pushScreen('4b');
      switchGroupPanel('info');
    }
  });
}

/* ---------- 4e: create group ---------- */
function initScreen4e() {
  const input = document.getElementById('new-group-name');
  const count = document.getElementById('new-group-count');
  if (input && count) {
    input.addEventListener('input', () => { count.textContent = `${input.value.length} / 20`; });
  }
  const submit = document.querySelector('[data-action="submit-create-group"]');
  if (submit) submit.addEventListener('click', () => { switchTab('4a'); });
}

/* ---------- 4b/4c/4d: group detail with 交流/信息/活动 subtabs ---------- */
const GROUP_TABS = [
  { id: 'chat', label: '交流' },
  { id: 'info', label: '信息' },
  { id: 'events', label: '活动' },
];

function renderGroupSubtabs(activeId) {
  const container = document.getElementById('group-subtabs');
  if (!container) return;
  container.innerHTML = GROUP_TABS.map((t) => `
    <div class="group-subtab" data-subtab="${t.id}" style="position:relative;display:flex;align-items:center;justify-content:center;height:42px;font-size:14px;font-weight:${t.id === activeId ? '800' : '600'};color:${t.id === activeId ? 'var(--ink)' : 'var(--body)'};cursor:pointer;">
      ${t.label}
      ${t.id === activeId ? '<div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:28px;height:3px;background:var(--purple);border-radius:100px;"></div>' : ''}
    </div>
  `).join('');
}

function switchGroupPanel(id) {
  renderGroupSubtabs(id);
  document.querySelectorAll('.group-panel').forEach((el) => {
    el.style.display = el.dataset.panel === id ? 'flex' : 'none';
  });
  document.querySelectorAll('.group-panel-footer').forEach((el) => {
    el.style.display = el.dataset.panelFooter === id ? (el.dataset.show || 'block') : 'none';
  });
}

function renderGroupDetail() {
  const d = MOCK.groupDetail;
  const ann = document.getElementById('group-announcement');
  if (ann) ann.textContent = d.announcement;

  const posts = document.getElementById('group-posts');
  if (posts) {
    posts.innerHTML = d.posts.map((p) => `
      <div class="card" style="padding:14px 16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:${p.color};border-radius:100px;font-size:13px;font-weight:800;">${p.avatar}</div>
          <div style="flex:1;"><div style="font-size:13px;font-weight:800;">${p.name}</div><div style="font-size:11px;font-weight:600;color:var(--body);">${p.time}</div></div>
        </div>
        <div style="font-size:14px;font-weight:500;line-height:1.75;margin-bottom:10px;">${p.text}</div>
        ${p.verseRef ? `
          <div style="display:flex;align-items:center;gap:10px;background:rgba(191,120,246,.10);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:10px;cursor:pointer;">
            <div style="flex:1;"><div style="font-size:11px;font-weight:800;color:var(--purple);margin-bottom:3px;">${p.verseRef}</div><div style="font-size:12px;font-weight:500;color:var(--body);line-height:1.6;">${p.verseText}</div></div>
            <div style="color:var(--purple);"><span data-icon="chevron-right" data-size="16"></span></div>
          </div>` : ''}
        <div style="display:flex;align-items:center;gap:16px;color:var(--body);">
          <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;"><span data-icon="heart" data-size="14"></span> ${p.likes}</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;cursor:pointer;"><span data-icon="message-square" data-size="14"></span> ${p.comments}</div>
        </div>
      </div>
    `).join('');
  }

  const an = document.getElementById('group-assistant-name');
  if (an) an.textContent = d.assistantName;
  const ai = document.getElementById('group-assistant-intro');
  if (ai) ai.textContent = d.assistantIntro;
  const aw = document.getElementById('group-assistant-welcome');
  if (aw) aw.textContent = d.assistantWelcome;
  const mq = document.getElementById('group-member-question');
  if (mq) mq.textContent = d.memberQuestion;
  const aa = document.getElementById('group-assistant-answer');
  if (aa) aa.innerHTML = d.assistantAnswer.map((p, i) => `<p style="margin:0 0 ${i === d.assistantAnswer.length - 1 ? '0' : '10px'};font-size:13px;line-height:1.8;color:var(--body);font-weight:500;text-wrap:pretty;">${p}</p>`).join('');

  const TAG_STYLES = { purple: 'background:rgba(191,120,246,.16);color:var(--purple);', orange: 'background:rgba(233,130,100,.2);color:#D15B46;' };
  const events = document.getElementById('group-events');
  if (events) {
    events.innerHTML = d.events.map((e) => `
      <div class="card" style="padding:16px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="font-size:10px;font-weight:800;border-radius:6px;padding:3px 8px;${TAG_STYLES[e.tagStyle] || ''}">${e.tag}</div>
          <div style="font-size:11px;font-weight:600;color:var(--body);">${e.status}</div>
        </div>
        <div style="font-size:16px;font-weight:800;margin-bottom:8px;">${e.title}</div>
        ${e.when ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--body);margin-bottom:4px;"><span data-icon="calendar" data-size="13"></span> ${e.when}</div>` : ''}
        ${e.where ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--body);margin-bottom:12px;"><span data-icon="map-pin" data-size="13"></span> ${e.where}</div>` : ''}
        ${e.note ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--body);margin-bottom:12px;"><span data-icon="check" data-size="13"></span> ${e.note}</div>` : ''}
        <div style="display:flex;align-items:center;gap:12px;">
          ${e.progress != null ? `
            <div style="flex:1;">
              <div style="height:6px;background:var(--surface-2);border-radius:100px;margin-bottom:5px;"><div style="width:${e.progress}%;height:100%;background:var(--purple);border-radius:100px;"></div></div>
              <div style="font-size:11px;font-weight:600;color:var(--body);">${e.progressLabel}</div>
            </div>` : `<div style="flex:1;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--body);"><span data-icon="bell" data-size="13"></span> ${e.reminder}</div>`}
          <button style="display:flex;align-items:center;justify-content:center;height:40px;padding:0 18px;${e.ctaStyle === 'outline' ? 'background:var(--white);border:1px solid var(--line);color:var(--ink);' : 'background:var(--purple);border:none;color:#fff;'}border-radius:100px;font-family:inherit;font-size:13px;font-weight:700;box-shadow:var(--shadow-card);cursor:pointer;">${e.cta}</button>
        </div>
      </div>
    `).join('');
  }
  const sc = document.getElementById('group-signup-confirm');
  if (sc) sc.textContent = d.signupConfirmation;

  const tiers = document.getElementById('group-tiers');
  if (tiers) {
    tiers.innerHTML = MOCK.groupTiers.map((t) => `
      <div style="position:relative;background:var(--white);border:${t.selected ? '2px solid var(--purple)' : '1px solid var(--line)'};border-radius:16px;box-shadow:var(--shadow-card);padding:14px 16px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="font-size:15px;font-weight:800;">${t.name}</div>
          ${t.selected ? '<div style="font-size:10px;font-weight:800;background:rgba(191,120,246,.16);color:var(--purple);border-radius:6px;padding:2px 6px;">已选择</div>' : ''}
          <div style="flex:1;"></div>
          <div style="font-size:15px;font-weight:800;${t.selected ? 'color:var(--purple);' : ''}">${t.price}<span style="font-size:11px;font-weight:600;color:var(--body);"> ${t.priceNote}</span></div>
        </div>
        <div style="font-size:12px;font-weight:500;color:var(--body);">${t.desc}</div>
      </div>
    `).join('');
  }

  hydrateIcons(document.getElementById('screen-group-detail'));
  hydrateIcons(document.querySelector('[data-screen="4f"]'));
}

function initScreenGroupDetail() {
  const root = document.getElementById('screen-group-detail');
  if (!root) return;
  root.addEventListener('click', (e) => {
    const subtab = e.target.closest('.group-subtab');
    if (subtab) switchGroupPanel(subtab.dataset.subtab);
    if (e.target.closest('[data-action="open-settings"]')) pushScreen('4f');
  });
}

/* ---------- 5a: personal center settings list ---------- */
function renderSettingsList() {
  const container = document.getElementById('settings-list');
  if (!container) return;
  container.innerHTML = MOCK.settingsList.map((item, i) => `
    <div class="settings-row" data-action="${item.action || ''}" style="display:flex;align-items:center;gap:12px;padding:14px 16px;${i < MOCK.settingsList.length - 1 ? 'border-bottom:1px solid var(--surface-2);' : ''}cursor:pointer;">
      <div style="color:${item.danger ? '#D15B46' : 'var(--body)'};"><span data-icon="${item.icon}" data-size="17"></span></div>
      <div style="flex:1;font-size:14px;font-weight:700;color:${item.danger ? '#D15B46' : 'var(--ink)'};">${item.label}</div>
      ${item.value ? `<div style="font-size:12px;font-weight:600;color:var(--body);">${item.value}</div>` : ''}
      ${!item.danger ? '<div style="color:var(--body);"><span data-icon="chevron-right" data-size="16"></span></div>' : ''}
    </div>
  `).join('');
  hydrateIcons(container);
}

function initScreen5a() {
  const root = document.getElementById('screen-5a');
  if (!root) return;
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="open-my-content"]')) { pushScreen('5b'); renderMyNotes(); }
    if (e.target.closest('[data-action="open-notifications"]')) { pushScreen('5c'); renderNotificationList(); }
    if (e.target.closest('[data-action="logout"]')) pushScreen('5d');
  });
}

/* ---------- 5b: my content list ---------- */
function renderMyNotes() {
  const container = document.getElementById('my-notes-list');
  if (!container) return;
  container.innerHTML = MOCK.myNotes.map((n) => `
    <div class="card" style="padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="font-size:11px;font-weight:800;background:${n.highlight ? 'var(--yellow)' : 'var(--surface-2)'};border-radius:6px;padding:2px 8px;">${n.ref}</div>
        <div style="font-size:11px;font-weight:600;color:var(--body);">${n.time}</div>
      </div>
      <div style="font-size:14px;font-weight:500;line-height:1.7;">${n.text}</div>
    </div>
  `).join('');
}

/* ---------- 5c: notification toggles ---------- */
function renderNotificationList() {
  const container = document.getElementById('notification-list');
  if (!container) return;
  container.innerHTML = MOCK.notificationSettings.map((n, i) => `
    <div class="notif-row" data-index="${i}" style="display:flex;align-items:center;gap:12px;padding:15px 16px;${i < MOCK.notificationSettings.length - 1 ? 'border-bottom:1px solid var(--surface-2);' : ''}">
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;margin-bottom:2px;">${n.title}</div>
        <div style="font-size:11px;font-weight:600;color:var(--body);">${n.desc}</div>
      </div>
      <div class="notif-toggle" data-index="${i}" style="flex:none;display:flex;justify-content:${n.on ? 'flex-end' : 'flex-start'};width:46px;height:28px;background:${n.on ? 'var(--purple)' : 'var(--surface-2)'};border-radius:100px;padding:3px;cursor:pointer;">
        <div style="width:22px;height:22px;background:var(--white);border-radius:100px;box-shadow:var(--shadow-card);${n.on ? '' : 'border:1px solid var(--line);'}"></div>
      </div>
    </div>
  `).join('');
}

function initScreen5c() {
  const root = document.querySelector('[data-screen="5c"]');
  if (!root) return;
  root.addEventListener('click', (e) => {
    const toggle = e.target.closest('.notif-toggle');
    if (toggle) {
      const i = Number(toggle.dataset.index);
      MOCK.notificationSettings[i].on = !MOCK.notificationSettings[i].on;
      renderNotificationList();
    }
  });
}

/* ---------- 5d: login ---------- */
function initScreen5d() {
  const submit = document.querySelector('[data-action="submit-login"]');
  if (submit) submit.addEventListener('click', () => switchTab('5a'));
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(document);
  renderAllTabBars();
  renderVerses();
  renderColorDots();
  renderCommentary();
  renderHuiduHome();
  renderThread();
  renderGroupList();
  renderGroupDetail();
  switchGroupPanel('info');
  renderSettingsList();
  initTabBars();
  initScreen1b();
  initScreen3a();
  initScreen4a();
  initScreen4e();
  initScreenGroupDetail();
  initScreen5a();
  initScreen5c();
  initScreen5d();
  initBackButtons();
  renderScreen('1a');
});
