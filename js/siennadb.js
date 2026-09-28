/**
 * siennadb.js — Account / Login / Cloud Sync System
 *
 * Extracted from night.js and sienna.js for better organization.
 * Provides the account object (window.siennaAccount) and the login modal logic.
 *
 * Dependencies:
 *   - window.siennaSettings (for createDataBackup, getDataBackupPayload, applyDataBackup)
 *   - window.gameVisor (optional, for settings panel)
 *
 * Changes in this revision:
 *   - fetch() calls now use an AbortController timeout so the UI never hangs
 *     forever if the API is unreachable.
 *   - res.json() parsing is now guarded so a non-JSON response (e.g. a 502
 *     from a proxy, an HTML error page) doesn't get misreported as "network error".
 *   - Failed login/register attempts are tracked client-side with an
 *     increasing cooldown, to avoid hammering the auth endpoint.
 *   - Submit is now re-entrancy safe (a stray double-click can't fire twice).
 */

(function () {
  'use strict';

  // How long to wait before giving up on a request to the API.
  const FETCH_TIMEOUT_MS = 10000;

  // Client-side login attempt backoff. Purely a UX/abuse-reduction measure —
  // does not replace server-side rate limiting, which should also exist.
  const MAX_FREE_ATTEMPTS = 5; // this many attempts before any cooldown kicks in
  const BASE_COOLDOWN_MS = 2000; // cooldown grows from here, doubling each extra attempt

  const account = {
    token: null,
    username: null,
    activeLoginTab: 'login',
    _autoSyncInterval: null,
    _autoSyncEnabled: false,
    _lastSyncAt: 0,
    _lastSyncWasManual: false,
    _syncStatusInterval: null,

    // Internal state for this revision's fixes
    _submitting: false,
    _failedAttempts: 0,
    _lockoutUntil: 0,

    // ── Sync status ──

    _updateSyncStatus() {
      return window.siennaSave.updateSyncStatus();
    },

    _formatSyncStatus() {
      return window.siennaSave.formatSyncStatus();
    },

    _stopAutoSync() {
      return window.siennaSave.stopAutoSync();
    },

    // ── Networking helpers (new) ──

    /**
     * fetch() wrapped with a timeout so a dead/unreachable API can't hang
     * the UI indefinitely. Rejects with an Error whose `.code` is 'timeout',
     * 'network', or left unset for other failures.
     */
    async _fetchWithTimeout(url, options, timeoutMs) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } catch (e) {
        if (e && e.name === 'AbortError') {
          const err = new Error('Request timed out.');
          err.code = 'timeout';
          throw err;
        }
        const err = new Error('Network error.');
        err.code = 'network';
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },

    /**
     * Safely parse a Response as JSON. Returns null (not a throw) if the
     * body isn't valid JSON, so callers can distinguish "server responded
     * with something we can't parse" from "request outright failed".
     */
    async _safeParseJSON(res) {
      try {
        return await res.json();
      } catch (e) {
        return null;
      }
    },

    /** Is a login/register attempt currently locked out? Returns ms remaining, or 0. */
    _lockoutRemaining() {
      const remaining = this._lockoutUntil - Date.now();
      return remaining > 0 ? remaining : 0;
    },

    /** Record a failed attempt and set/extend the cooldown if needed. */
    _registerFailedAttempt() {
      this._failedAttempts += 1;
      if (this._failedAttempts > MAX_FREE_ATTEMPTS) {
        const extra = this._failedAttempts - MAX_FREE_ATTEMPTS;
        const cooldown = Math.min(BASE_COOLDOWN_MS * Math.pow(2, extra - 1), 60000);
        this._lockoutUntil = Date.now() + cooldown;
      }
    },

    /** Reset attempt tracking after a success. */
    _resetAttempts() {
      this._failedAttempts = 0;
      this._lockoutUntil = 0;
    },

    // ── Session management ──

    /** Load saved session from localStorage */
    loadSession() {
      try {
        this.token = localStorage.getItem(window.siennaSave.TOKEN_KEY);
        this.username = localStorage.getItem(window.siennaSave.USERNAME_KEY);
        this._lastSyncAt = Number(localStorage.getItem(window.siennaSave.LAST_SYNC_KEY) || 0) || 0;
      } catch (e) {
        this.token = null;
        this.username = null;
        this._lastSyncAt = 0;
      }
    },

    /** Save session to localStorage */
    saveSession(token, username) {
      this.token = token;
      this.username = username;
      try {
        localStorage.setItem(window.siennaSave.USERNAME_KEY, username);
        localStorage.setItem(window.siennaSave.TOKEN_KEY, token);
      } catch (e) { /* ignore */ }
    },

    /** Clear session */
    clearSession() {
      this.token = null;
      this.username = null;
      try {
        localStorage.removeItem(window.siennaSave.TOKEN_KEY);
        localStorage.removeItem(window.siennaSave.USERNAME_KEY);
        localStorage.removeItem(window.siennaSave.LAST_SYNC_KEY);
        localStorage.removeItem(window.siennaSave.LAST_SYNC_HASH_KEY);
      } catch (e) { /* ignore */ }
      this._lastSyncAt = 0;
    },

    /** Check if user is logged in */
    isLoggedIn() {
      return !!this.token && !!this.username;
    },

    // ── Avatar ──

    _avatarPalette: [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
      '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    ],

    /** Deterministic color for a given username — same user always gets the same color */
    _avatarColor(name) {
      const str = String(name || '');
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this._avatarPalette.length;
      return this._avatarPalette[idx];
    },

    // ── UI updates ──

    /** Update the account button UI (avatar-based) */
    updateUI() {
      const avatarImg = document.getElementById('accountAvatarImg');
      const avatarLetter = document.getElementById('accountAvatarLetter');
      const dropdown = document.getElementById('accountDropdown');
      if (!avatarImg || !avatarLetter) return;

      if (this.isLoggedIn()) {
        // Show generated avatar (first letter + pastel color)
        const initial = (this.username || '?').charAt(0).toUpperCase();
        const color = this._avatarColor(this.username || '');
        avatarImg.style.display = 'none';
        avatarLetter.style.display = 'flex';
        avatarLetter.textContent = initial;
        avatarLetter.style.background = color;
        if (dropdown) dropdown.classList.remove('open');
      } else {
        // Show logo.webp
        avatarImg.style.display = 'block';
        avatarImg.src = 'logo.webp';
        avatarLetter.style.display = 'none';
        if (dropdown) dropdown.classList.remove('open');
      }
      this._updateSyncStatus();
    },

    // ── Login modal ──

    _bindCloudSaveNotice() {
      if (this._cloudSaveNoticeBound) return;
      const overlay = document.getElementById('cloudSaveNoticeOverlay');
      if (!overlay) return;
      const close = () => this.hideLoginModal();
      document.getElementById('cloudSaveNoticeOk')?.addEventListener('click', close);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) close();
      });
      this._cloudSaveNoticeBound = true;
    },

    _showCloudSaveNotice() {
      const overlay = document.getElementById('cloudSaveNoticeOverlay');
      if (!overlay) return;
      this._bindCloudSaveNotice();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(() => document.getElementById('cloudSaveNoticeOk')?.focus(), 80);
    },

    _hideCloudSaveNotice() {
      const overlay = document.getElementById('cloudSaveNoticeOverlay');
      if (!overlay) return;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    },

    /** Show the login modal */
    showLoginModal() {
      const overlay = document.getElementById('loginModalOverlay');
      if (!overlay) return;
      overlay.classList.add('open');
      document.getElementById('loginModalUsername').value = '';
      document.getElementById('loginModalPassword').value = '';
      document.getElementById('loginModalError').classList.remove('visible');
      document.getElementById('loginModalError').textContent = '';
      this.activeLoginTab = 'login';
      this._switchTab('login');
      document.getElementById('loginModalUsername').focus();
      this._showCloudSaveNotice();
    },

    /** Hide the login modal */
    hideLoginModal() {
      const overlay = document.getElementById('loginModalOverlay');
      if (overlay) overlay.classList.remove('open');
      this._hideCloudSaveNotice();
    },

    /** Switch between login/register tabs */
    _switchTab(tab) {
      const title = document.getElementById('loginModalTitle');
      const submit = document.getElementById('loginModalSubmit');
      const switchText = document.getElementById('loginModalSwitchText');
      const switchBtn = document.getElementById('loginModalSwitchBtn');
      const usernameCriteria = document.getElementById('loginModalUsernameCriteria');
      const passwordCriteria = document.getElementById('loginModalPasswordCriteria');
      if (tab === 'login') {
        title.textContent = 'Log In';
        submit.textContent = 'Log In';
        if (switchText) switchText.textContent = "Don't have an account?";
        if (usernameCriteria) usernameCriteria.classList.add('hidden');
        if (passwordCriteria) passwordCriteria.classList.add('hidden');
        if (switchBtn) {
          switchBtn.textContent = 'Sign up';
          switchBtn.dataset.loginTab = 'register';
        }
        const usernameInput = document.getElementById('loginModalUsername');
        const passwordInput = document.getElementById('loginModalPassword');
        if (usernameInput) usernameInput.placeholder = 'enter username';
        if (passwordInput) passwordInput.placeholder = 'enter password';
      } else {
        title.textContent = 'Sign up';
        submit.textContent = 'Sign up';
        if (switchText) switchText.textContent = 'Already have an account?';
        if (usernameCriteria) usernameCriteria.classList.remove('hidden');
        if (passwordCriteria) passwordCriteria.classList.remove('hidden');
        if (switchBtn) {
          switchBtn.textContent = 'Log in!';
          switchBtn.dataset.loginTab = 'login';
        }
        const usernameInput = document.getElementById('loginModalUsername');
        const passwordInput = document.getElementById('loginModalPassword');
        if (usernameInput) usernameInput.placeholder = 'create username';
        if (passwordInput) passwordInput.placeholder = 'create password';
      }
      this.activeLoginTab = tab;
      this._updateRegisterCriteria();
    },

    /** Get the active login mode ('login' or 'register') */
    _getActiveTab() {
      return this.activeLoginTab || 'login';
    },

    /** Update register criteria display and submit state */
    _updateRegisterCriteria() {
      const username = document.getElementById('loginModalUsername')?.value.trim() || '';
      const password = document.getElementById('loginModalPassword')?.value || '';
      const criteria = {
        usernameLength: username.length >= 3 && username.length <= 20,
        usernamePattern: /^[a-zA-Z0-9]+$/.test(username),
        passwordLength: password.length >= 8,
      };

      Object.entries(criteria).forEach(([key, valid]) => {
        const item = document.querySelector(`[data-criteria-key="${key}"]`);
        if (!item) return;
        item.classList.toggle('valid', valid);
        item.classList.toggle('invalid', !valid);
      });

      const submitBtn = document.getElementById('loginModalSubmit');
      if (!submitBtn) return;
      if (this._getActiveTab() === 'register') {
        submitBtn.disabled = !Object.values(criteria).every(Boolean);
      } else {
        submitBtn.disabled = !username || !password;
      }
    },

    /** Show error in login modal */
    _shakeModal() {
      const modal = document.querySelector('.login-modal');
      if (!modal) return;
      modal.classList.add('shake');
      setTimeout(() => modal.classList.remove('shake'), 500);
    },

    _showError(msg) {
      const el = document.getElementById('loginModalError');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('visible');
      this._shakeModal();
    },

    /** Attempt login or register */
    async submit() {
      // Guard against double-submission (double-click, double Enter, etc.)
      if (this._submitting) return;

      const lockoutMs = this._lockoutRemaining();
      if (lockoutMs > 0) {
        const seconds = Math.ceil(lockoutMs / 1000);
        this._showError(`Too many attempts. Try again in ${seconds}s.`);
        return;
      }

      const username = document.getElementById('loginModalUsername').value.trim();
      const password = document.getElementById('loginModalPassword').value.trim();
      const mode = this._getActiveTab();

      if (!username || !password) {
        this._showError('Please fill in all fields.');
        return;
      }
      if (mode === 'login') {
        if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
          this._showError('Wrong Password/Username');
          return;
        }
        if (password.length < 8) {
          this._showError('Wrong Password/Username');
          return;
        }
      } else {
        if (username.length < 3) {
          this._showError('Username must be at least 3 characters.');
          return;
        }
        if (username.length > 20 || !/^[a-zA-Z0-9]+$/.test(username)) {
          this._showError('Username must be 3-20 letters or numbers only.');
          return;
        }
        if (password.length < 8) {
          this._showError('Password must be at least 8 characters.');
          return;
        }
      }

      const submitBtn = document.getElementById('loginModalSubmit');
      this._submitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = mode === 'login' ? 'Logging in...' : 'Registering...';

      const resetButton = () => {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === 'login' ? 'Log In' : 'Sign up';
        this._submitting = false;
      };

      try {
        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
        if (mode === 'register') {
          const usernameValid = username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9]+$/.test(username);
          const passwordValid = password.length >= 8;
          if (!usernameValid || !passwordValid) {
            if (!usernameValid) {
              this._showError('Username must be 3-20 letters or numbers only.');
            } else {
              this._showError('Password must be at least 8 characters.');
            }
            resetButton();
            return;
          }
        }

        let res;
        try {
          res = await this._fetchWithTimeout(
            window.siennaSave.API_BASE + endpoint,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
            }
          );
        } catch (fetchErr) {
          if (fetchErr && fetchErr.code === 'timeout') {
            this._showError('Server took too long to respond. Please try again.');
          } else {
            this._showError('Network error. Server down or unreachable. Please try again later.');
          }
          this._registerFailedAttempt();
          resetButton();
          return;
        }

        const data = await this._safeParseJSON(res);

        if (data === null) {
          // Server responded, but not with valid JSON (proxy error page, etc.)
          this._showError(`Unexpected response from server (status ${res.status}). Please try again.`);
          this._registerFailedAttempt();
          resetButton();
          return;
        }

        if (!res.ok) {
          const errorMessage = mode === 'login'
            ? 'Wrong Password/Username'
            : data.error || data.message || 'Something went wrong.';
          this._showError(errorMessage);
          this._registerFailedAttempt();
          resetButton();
          return;
        }

        const token = data.token || data.access_token;
        if (token) {
          this._resetAttempts();
          this.saveSession(token, username);
          this.updateUI();
          this.hideLoginModal();
          try {
            await window.siennaSave.autoRestore({ force: true });
          } catch (restoreErr) {
            // Login succeeded even if restore failed — don't block the user,
            // but don't hide the problem either.
            console.error('siennaAccount: autoRestore failed after login', restoreErr);
          }
          window.location.reload();
          return;
        } else {
          this._showError('No token received from server.');
          this._registerFailedAttempt();
        }
      } catch (e) {
        // Catch-all for anything unexpected above (shouldn't normally hit this
        // since fetch and JSON parsing are already guarded).
        console.error('siennaAccount: unexpected error during submit', e);
        this._showError('Something went wrong. Please try again.');
        this._registerFailedAttempt();
      }

      resetButton();
    },

    /** Log out */
    logout() {
      window.siennaSave.stopAutoSync();
      this.clearSession();
      this.updateUI();
      const dropdown = document.getElementById('accountDropdown');
      if (dropdown) dropdown.classList.remove('open');
    },

    // ── Cloud save / restore (delegated to siennaSave) ──

    async saveToCloud() {
      return window.siennaSave.saveToCloud();
    },

    async restoreFromCloud(options) {
      return window.siennaSave.restoreFromCloud(options);
    },

    async _autoRestore(options) {
      return window.siennaSave.autoRestore(options);
    },

    // ── Initialization ──

    /** Initialize the account system */
    init() {
      this.loadSession();
      this.updateUI();

      // If already logged in (session restored), auto-restore from the cloud.
      // (Auto-sync has been removed — syncing is manual-only now, see
      // window.siennaSave.saveToCloud().)
      if (this.isLoggedIn()) {
        window.siennaSave.autoRestore();
      }

      // Account button and dropdown are now handled by sienna.js's _setupAccountDropdown()

      // Login modal
      const modalOverlay = document.getElementById('loginModalOverlay');
      const cancelBtn = document.getElementById('loginModalCancel');
      const submitBtn = document.getElementById('loginModalSubmit');
      const usernameInput = document.getElementById('loginModalUsername');
      const passwordInput = document.getElementById('loginModalPassword');
      const switchBtn = document.getElementById('loginModalSwitchBtn');

      cancelBtn?.addEventListener('click', () => this.hideLoginModal());
      submitBtn?.addEventListener('click', () => this.submit());
      modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.hideLoginModal();
      });

      switchBtn?.addEventListener('click', () => {
        const target = switchBtn.dataset.loginTab || 'register';
        this._switchTab(target);
      });

      usernameInput?.addEventListener('input', () => this._updateRegisterCriteria());
      passwordInput?.addEventListener('input', () => this._updateRegisterCriteria());

      usernameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') passwordInput?.focus();
      });
      passwordInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.submit();
      });
    },
  };

  // Expose globally
  window.siennaAccount = account;
})();
