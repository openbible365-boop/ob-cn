/* OpenBible admin dashboard prototype — sidebar nav + data tables (mocked). */

const ADMIN_CHROME = {
  '7a': { title: 'OpenBible 后台 · 数据看板', url: 'admin.openbible.live/dashboard' },
  '7b': { title: 'OpenBible 后台 · AI 模型', url: 'admin.openbible.live/ai' },
  '7c': { title: 'OpenBible 后台 · 内容审核', url: 'admin.openbible.live/moderation' },
  '7d': { title: 'OpenBible 后台 · 社群管理', url: 'admin.openbible.live/communities' },
  '7e': { title: 'OpenBible 后台 · 用户管理', url: 'admin.openbible.live/users' },
};

const COLOR_MAP = { pink: 'var(--pink)', orange: 'var(--orange)', purple: 'var(--purple)', body: 'var(--body)', muted: 'var(--surface-2)', yellow: 'var(--yellow)' };

function renderAdminSidebar() {
  const container = document.getElementById('admin-sidebar');
  if (!container) return;
  container.innerHTML = MOCK.adminSidebar.map((item) => `
    <div class="admin-nav-item${item.disabled ? ' disabled' : ''}" data-admin-nav="${item.id}">
      ${item.label}
      ${item.badge ? `<div style="margin-left:auto;display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;background:var(--pink);color:#fff;border-radius:100px;font-size:10px;font-weight:800;">${item.badge}</div>` : ''}
    </div>
  `).join('');
}

function switchAdminPanel(id) {
  document.querySelectorAll('.panel').forEach((el) => el.classList.remove('active'));
  const target = document.querySelector(`.panel[data-panel="${id}"]`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.admin-nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.adminNav === id);
  });

  const chrome = ADMIN_CHROME[id];
  if (chrome) {
    document.getElementById('chrome-tab-title').textContent = chrome.title;
    document.getElementById('chrome-url').textContent = chrome.url;
  }
  const label = document.getElementById('current-panel-label');
  if (label) label.textContent = id;
}

function initAdminSidebar() {
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.admin-nav-item');
    if (item && !item.classList.contains('disabled')) switchAdminPanel(item.dataset.adminNav);
  });
}

/* ---------- 7a: dashboard ---------- */
function renderDashboard() {
  const kpis = document.getElementById('admin-kpis');
  if (kpis) {
    kpis.innerHTML = MOCK.adminKpis.map((k) => `
      <div class="card" style="border-radius:16px;padding:14px 16px;">
        <div style="font-size:11px;font-weight:700;color:var(--body);margin-bottom:6px;">${k.label}</div>
        <div style="font-size:24px;font-weight:800;">${k.value}</div>
        <div style="font-size:11px;font-weight:700;color:${k.deltaColor || 'var(--body)'};">${k.delta}</div>
      </div>
    `).join('');
  }

  const modules = document.getElementById('admin-module-usage');
  if (modules) {
    modules.innerHTML = MOCK.adminModuleUsage.map((m) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px;"><span>${m.label}</span><span>${m.pct}%</span></div>
        <div style="height:10px;background:var(--surface-2);border-radius:100px;"><div style="width:${m.pct}%;height:100%;background:${m.color};border-radius:100px;"></div></div>
      </div>
    `).join('');
  }

  const aiUsage = document.getElementById('admin-ai-usage');
  if (aiUsage) {
    aiUsage.innerHTML = MOCK.adminAiUsage.map((u) => `<div><div style="font-size:16px;font-weight:800;color:var(--ink);">${u.value}</div>${u.label}</div>`).join('');
  }

  const ranking = document.getElementById('admin-community-ranking');
  if (ranking) {
    ranking.innerHTML = MOCK.adminCommunityRanking.map((r, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--surface-2);font-size:12px;">
        <div style="font-weight:800;color:${r.muted ? 'var(--body)' : 'var(--purple)'};width:16px;">${i + 1}</div>
        <div style="flex:1;font-weight:700;">${r.name}</div>
        <div style="font-weight:600;color:var(--body);">${r.stat}</div>
      </div>
    `).join('');
  }

  const topics = document.getElementById('admin-hot-topics');
  if (topics) {
    topics.innerHTML = MOCK.adminHotTopics.map((t) => `<div style="font-size:11px;font-weight:700;padding:4px 10px;background:rgba(191,120,246,.14);color:var(--purple);border-radius:100px;">${t}</div>`).join('');
  }
}

/* ---------- 7b: AI models & prompts ---------- */
function renderAiAdmin() {
  const models = document.getElementById('admin-models');
  if (models) {
    models.innerHTML = MOCK.adminModels.map((m) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border-radius:12px;margin-bottom:8px;">
        <div style="width:8px;height:8px;background:${m.dot};border-radius:100px;"></div>
        <div style="flex:1;font-size:13px;font-weight:700;">${m.name}</div>
        <div style="font-size:11px;font-weight:600;color:var(--body);">${m.status}</div>
      </div>
    `).join('');
  }

  const tokenTop = document.getElementById('admin-token-top');
  if (tokenTop) {
    tokenTop.innerHTML = MOCK.adminTokenTop.map((t) => `
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;">
        <div style="flex:1;font-weight:700;">${t.name}</div>
        <div style="color:var(--body);font-weight:600;">${t.value}</div>
        <div style="font-size:11px;font-weight:700;color:var(--purple);cursor:pointer;">改限额</div>
      </div>
    `).join('');
  }

  const versions = document.getElementById('admin-prompt-versions');
  if (versions) {
    const STATUS_STYLES = { purple: 'background:rgba(191,120,246,.16);color:var(--purple);', yellow: 'background:var(--yellow);color:var(--ink);', muted: 'background:var(--surface-2);color:var(--body);' };
    versions.innerHTML = MOCK.adminPromptVersions.map((v, i, arr) => `
      <div class="admin-table-row" style="grid-template-columns:90px 1fr 130px 110px 110px 130px;${i === arr.length - 1 ? 'border-bottom:none;' : ''}${v.faded ? 'color:var(--body);' : ''}">
        <div style="font-weight:800;${v.faded ? 'color:var(--body);' : ''}">${v.version}</div>
        <div style="font-weight:600;color:var(--body);">${v.desc}</div>
        <div><span style="font-size:11px;font-weight:800;border-radius:6px;padding:3px 8px;${STATUS_STYLES[v.statusStyle] || ''}">${v.status}</span></div>
        <div style="font-weight:700;${v.faded ? 'color:var(--body);' : ''}">${v.like}</div>
        <div style="font-weight:700;${v.faded ? 'color:var(--body);' : ''}">${v.dislike}</div>
        <div style="display:flex;gap:8px;font-size:11px;font-weight:700;color:var(--purple);">${v.actions.map((a) => `<span style="cursor:pointer;">${a}</span>`).join('')}</div>
      </div>
    `).join('');
  }
}

/* ---------- 7c: moderation ---------- */
function renderModeration() {
  const tiers = document.getElementById('admin-word-tiers');
  if (tiers) {
    tiers.innerHTML = MOCK.adminWordTiers.map((t) => `
      <div class="card" style="border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:12px;">
        <div style="width:10px;height:10px;background:${t.dot};border-radius:100px;"></div>
        <div style="flex:1;font-size:13px;font-weight:700;">${t.label}</div>
        <div style="font-size:18px;font-weight:800;">${t.count}</div>
      </div>
    `).join('');
  }

  const queue = document.getElementById('admin-report-queue');
  if (queue) {
    const LEVEL_STYLES = { pink: 'background:rgba(225,49,125,.12);color:var(--pink);', orange: 'background:rgba(233,130,100,.18);color:#D15B46;' };
    queue.innerHTML = MOCK.adminReportQueue.map((r, i, arr) => `
      <div class="admin-table-row" style="grid-template-columns:1.6fr 130px 130px 110px 220px;${i === arr.length - 1 ? 'border-bottom:none;' : ''}">
        <div style="font-weight:600;color:var(--body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.content}</div>
        <div style="font-weight:700;">${r.group}</div>
        <div style="font-weight:600;color:var(--body);">${r.reason}</div>
        <div><span style="font-size:11px;font-weight:800;border-radius:6px;padding:3px 8px;${LEVEL_STYLES[r.levelStyle] || ''}">${r.level}</span></div>
        <div style="display:flex;gap:8px;font-size:11px;font-weight:700;">${r.actions.map((a) => `<span style="color:${COLOR_MAP[a.c]};cursor:pointer;">${a.t}</span>`).join('')}</div>
      </div>
    `).join('');
  }
}

/* ---------- 7d: communities ---------- */
function renderCommunitiesAdmin() {
  const container = document.getElementById('admin-communities');
  if (!container) return;
  const TIER_STYLES = { purple: 'background:rgba(191,120,246,.16);color:var(--purple);', pink: 'background:rgba(225,49,125,.12);color:var(--pink);', muted: 'background:var(--surface-2);color:var(--body);' };
  container.innerHTML = MOCK.adminCommunities.map((c, i, arr) => `
    <div class="admin-table-row" style="grid-template-columns:1.4fr 100px 90px 100px 110px 110px 210px;${i === arr.length - 1 ? 'border-bottom:none;' : ''}">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:${c.color};border-radius:8px;font-size:11px;font-weight:800;">${c.letter}</div>
        <div style="font-weight:700;">${c.name}</div>
        ${c.badge ? `<span style="font-size:10px;font-weight:800;border-radius:5px;padding:2px 5px;${c.badgeStyle === 'orange' ? 'background:rgba(233,130,100,.18);color:#D15B46;' : 'background:var(--yellow);'}">${c.badge}</span>` : ''}
      </div>
      <div style="font-weight:600;color:var(--body);">${c.owner}</div>
      <div style="font-weight:700;">${c.members}</div>
      <div style="font-weight:700;">${c.activity}</div>
      <div style="font-weight:600;color:var(--body);">${c.created}</div>
      <div><span style="font-size:11px;font-weight:800;border-radius:6px;padding:3px 8px;${TIER_STYLES[c.tierStyle] || ''}">${c.tier}</span></div>
      <div style="display:flex;gap:10px;font-size:11px;font-weight:700;">${c.actions.map((a) => `<span style="color:${a === '查看' ? 'var(--body)' : a === '警告' ? 'var(--orange)' : 'var(--pink)'};cursor:pointer;">${a}</span>`).join('')}</div>
    </div>
  `).join('');
}

/* ---------- 7e: users ---------- */
function renderUsersAdmin() {
  const container = document.getElementById('admin-users');
  if (!container) return;
  container.innerHTML = MOCK.adminUsers.map((u, i, arr) => `
    <div class="admin-table-row" style="grid-template-columns:1.2fr 150px 120px 110px 110px 200px;${i === arr.length - 1 ? 'border-bottom:none;' : ''}">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;background:${u.color};border-radius:100px;font-size:11px;font-weight:800;">${u.letter}</div>
        <div style="font-weight:700;">${u.name} <span style="font-weight:600;color:var(--body);">· UID ${u.uid}</span></div>
      </div>
      <div style="font-weight:600;color:var(--body);">${u.login}</div>
      <div style="font-weight:600;color:var(--body);">${u.groups}</div>
      <div><span style="font-size:11px;font-weight:800;background:rgba(191,120,246,.16);color:var(--purple);border-radius:6px;padding:3px 8px;">${u.level}</span></div>
      <div><span style="font-size:11px;font-weight:800;border-radius:6px;padding:3px 8px;${u.statusStyle === 'pink' ? 'background:rgba(225,49,125,.12);color:var(--pink);' : 'background:var(--surface-2);color:var(--body);'}">${u.status}</span></div>
      <div style="display:flex;gap:10px;font-size:11px;font-weight:700;">${u.actions.map((a) => `<span style="color:${COLOR_MAP[a.c]};cursor:pointer;">${a.t}</span>`).join('')}</div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons(document);
  renderAdminSidebar();
  renderDashboard();
  renderAiAdmin();
  renderModeration();
  renderCommunitiesAdmin();
  renderUsersAdmin();
  initAdminSidebar();
  switchAdminPanel('7a');
});
