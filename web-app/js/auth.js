'use strict';
// ── Auth module ──
// 与 App 端 LoginPage.tsx 同一套流程与布局：单屏「邮箱 + 验证码」，
// 首次使用同一邮箱登录自动注册。会话是同源 httpOnly Cookie，由 admin-app 签发，
// 在任一端登录，另一端刷新后即是同一个账号。

const Auth = (() => {
    const KEY_USER = 'ob_user';
    const MOBILE_API = '/api/mobile';   // 与 App 共用的登录接口
    const WEB_API = '/api/web';
    const RESEND_COOLDOWN = 60;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let cooldown = 0;
    let cooldownTimer = null;
    let busy = false;

    function getUser() {
        try { return JSON.parse(localStorage.getItem(KEY_USER)); } catch { return null; }
    }
    // 会话在 httpOnly Cookie 里，前端拿不到令牌；保留方法给历史调用点
    function getToken() { return null; }

    function saveUser(user) {
        localStorage.setItem(KEY_USER, JSON.stringify(user));
        if (typeof window._syncNotes === 'function') window._syncNotes();
    }

    function clearUser() {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem('ob_token');
        localStorage.removeItem('ob_profile');
        localStorage.removeItem('ob_notes');
        localStorage.removeItem('ob_highlights');
    }

    function normalizeUser(me) {
        return {
            username: me.username || me.email,
            email: me.email,
            avatar: me.avatar_url || (me.username || me.email || '?')[0].toUpperCase(),
            plan: me.plan || 'free',
        };
    }

    // --- 会话恢复：以服务端 Cookie 为准，本地缓存只是显示用 ---
    async function refreshSession() {
        try {
            const res = await fetch(`${WEB_API}/auth/me`, { credentials: 'same-origin' });
            if (res.ok) {
                saveUser(normalizeUser(await res.json()));
            } else if (res.status === 401 && getUser()) {
                clearUser();
            }
        } catch { /* 网络失败时保留本地缓存，不打扰用户 */ }
        updateTopBar();
    }

    // --- Modal control ---
    function showModal() {
        const modal = document.getElementById('auth-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        setError('');
        setNotice('');
        renderGoogleButton();
        syncAppleButton();
        document.getElementById('auth-email')?.focus();
    }

    function hideModal() {
        document.getElementById('auth-modal')?.classList.add('hidden');
        setError('');
        setNotice('');
    }

    function setError(msg) {
        const el = document.getElementById('auth-error');
        if (el) { el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
        if (msg) setNotice('');
    }

    function setNotice(msg) {
        const el = document.getElementById('auth-notice');
        if (el) { el.textContent = msg || ''; el.classList.toggle('hidden', !msg); }
    }

    function setBusy(value) {
        busy = value;
        const submit = document.getElementById('auth-verify');
        if (submit) {
            submit.disabled = value;
            submit.textContent = value
                ? (window.t ? window.t('auth.pleaseWait') : '请稍候…')
                : (window.t ? window.t('auth.loginRegister') : '登录 / 注册');
        }
        syncCodeButton();
    }

    // 获取验证码按钮：倒计时期间变灰并显示剩余秒数（与 App 一致）
    function syncCodeButton() {
        const btn = document.getElementById('auth-send-code');
        if (!btn) return;
        const disabled = busy || cooldown > 0;
        btn.disabled = disabled;
        btn.classList.toggle('is-cooling', cooldown > 0);
        btn.textContent = cooldown > 0
            ? `${cooldown}s`
            : (window.t ? window.t('auth.send-code') : '获取验证码');
    }

    function startCooldown(seconds) {
        cooldown = seconds;
        clearInterval(cooldownTimer);
        syncCodeButton();
        cooldownTimer = setInterval(() => {
            cooldown -= 1;
            if (cooldown <= 0) { cooldown = 0; clearInterval(cooldownTimer); }
            syncCodeButton();
        }, 1000);
    }

    // --- 获取验证码 ---
    async function sendCode() {
        const email = document.getElementById('auth-email')?.value.trim() ?? '';
        if (!EMAIL_RE.test(email)) {
            setError(window.t ? window.t('auth.emailInvalid') : '请输入有效的邮箱地址');
            return;
        }
        setError('');
        setNotice('');
        setBusy(true);
        try {
            const res = await fetch(`${MOBILE_API}/auth/send-code`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.message || '发送失败');
            setNotice(data.message);
            startCooldown(RESEND_COOLDOWN);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    // --- 登录 / 注册：校验验证码，服务端种下会话 Cookie ---
    async function submit() {
        const email = document.getElementById('auth-email')?.value.trim() ?? '';
        const code = document.getElementById('auth-code')?.value.trim() ?? '';
        if (!EMAIL_RE.test(email)) {
            setError(window.t ? window.t('auth.emailInvalid') : '请输入有效的邮箱地址');
            return;
        }
        if (!/^\d{6}$/.test(code)) {
            setError(window.t ? window.t('auth.code-invalid') : '请输入 6 位数字验证码');
            return;
        }
        setError('');
        setBusy(true);
        try {
            const res = await fetch(`${MOBILE_API}/auth/verify`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.message || '登录失败');
            await afterLogin();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    // --- Google 登录（回调来自 GSI 按钮）---
    async function handleCredentialResponse(response) {
        try {
            const res = await fetch(`${MOBILE_API}/auth/google`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: response.credential })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.message || 'Google 登录失败');
            await afterLogin();
        } catch (err) {
            setError(err.message);
        }
    }

    async function afterLogin() {
        await refreshSession();
        hideModal();
        if (typeof showToast === 'function') showToast(window.t ? window.t('toast.login-ok') : '登录成功');
        if (!localStorage.getItem('ob_onboarding_done') && typeof window.showOnboarding === 'function') {
            setTimeout(() => window.showOnboarding(), 500);
        }
    }

    // client ID 由服务端下发：它必须与服务端校验 token 时用的 audience 完全一致，
    // 否则 Google 签发的 token 会被服务端以 401 拒绝。
    // 之前前端硬编码的是另一个 client ID，网页版 Google 登录一直是坏的。
    let _authConfig = null;
    async function loadAuthConfig() {
        if (_authConfig) return _authConfig;
        try {
            const res = await fetch(`${WEB_API}/config/auth`, { credentials: 'same-origin' });
            _authConfig = res.ok ? await res.json() : {};
        } catch {
            _authConfig = {};
        }
        return _authConfig;
    }

    async function renderGoogleButton() {
        const container = document.getElementById('google-btn-container');
        if (!container || !window.google) return;
        const { googleClientId } = await loadAuthConfig();
        // 未配置时不渲染按钮，避免给出一个点了必然失败的入口
        if (!googleClientId) {
            container.innerHTML = '';
            return;
        }
        try {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleCredentialResponse
            });
            window.google.accounts.id.renderButton(
                container,
                { theme: 'outline', size: 'large', width: '100%' }
            );
        } catch (e) { console.warn('Google Auth not initialized', e); }
    }

    // Apple 同理：未配置时隐藏入口
    async function syncAppleButton() {
        const btn = document.getElementById('auth-apple');
        if (!btn) return;
        const { appleEnabled } = await loadAuthConfig();
        btn.classList.toggle('hidden', !appleEnabled);
    }

    // --- Logout ---
    async function logout() {
        try {
            await fetch(`${MOBILE_API}/auth/logout`, { method: 'POST', credentials: 'same-origin' });
        } catch { /* Cookie 清不掉也先清本地 */ }
        clearUser();
        updateTopBar();
        if (typeof showToast === 'function') showToast(window.t ? window.t('toast.logout-ok') : '已退出登录');
    }

    // --- Update topbar UI ---
    function updateTopBar() {
        const user = getUser();
        const loginBtn = document.getElementById('auth-login-btn');
        const userArea = document.getElementById('auth-user-area');
        const avatar = document.getElementById('auth-avatar');
        if (!loginBtn || !userArea) return;
        if (user) {
            loginBtn.classList.add('hidden');
            userArea.classList.remove('hidden');
            const localProfile = JSON.parse(localStorage.getItem('ob_profile') || '{}');
            const localAvatar = localProfile.avatar || (typeof user.avatar === 'string' && user.avatar.startsWith('/') ? user.avatar : null);
            if (avatar) {
                if (localAvatar && (localAvatar.startsWith('data:') || localAvatar.startsWith('http') || localAvatar.startsWith('/'))) {
                    avatar.innerHTML = `<img src="${localAvatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
                } else {
                    avatar.textContent = user.avatar ? user.avatar[0].toUpperCase() : '?';
                }
            }
        } else {
            loginBtn.classList.remove('hidden');
            userArea.classList.add('hidden');
        }
        document.dispatchEvent(new CustomEvent('authchange', { detail: user }));
    }

    // --- Init (wire up HTML events) ---
    function init() {
        document.getElementById('auth-login-btn')?.addEventListener('click', () => showModal());
        document.getElementById('auth-modal-backdrop')?.addEventListener('click', hideModal);
        document.getElementById('auth-modal-close')?.addEventListener('click', hideModal);

        document.getElementById('auth-send-code')?.addEventListener('click', sendCode);
        document.getElementById('auth-verify')?.addEventListener('click', submit);
        document.getElementById('auth-email')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('auth-code')?.focus();
        });
        document.getElementById('auth-code')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') submit();
        });

        // Apple 登录：网页端走服务端跳转，与 App 的非原生分支一致
        document.getElementById('auth-apple')?.addEventListener('click', () => {
            window.location.assign('/api/auth/apple/start');
        });

        // 用户协议 / 隐私政策
        document.querySelectorAll('.auth-term-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                hideModal();
                if (window.switchView) window.switchView(link.dataset.view);
            });
        });

        // 点击用户区进入个人页
        document.getElementById('auth-user-area')?.addEventListener('click', () => {
            if (window.switchView) window.switchView('profile');
            const app = document.getElementById('app');
            if (app && app.classList.contains('nav-hidden')) {
                app.classList.remove('nav-hidden');
                const collapseIcon = document.querySelector('#nav-collapse-btn i');
                if (collapseIcon) collapseIcon.className = 'fa-solid fa-angles-left';
            }
            if (window.innerWidth <= 768) {
                const nav = document.getElementById('left-nav');
                const overlay = document.getElementById('mobile-overlay');
                if (nav) nav.classList.add('mobile-open');
                if (overlay) overlay.classList.remove('hidden');
            }
        });

        updateTopBar();
        refreshSession();
    }

    return { init, showModal, hideModal, logout, getUser, getToken, updateTopBar, saveUser, refreshSession };
})();
