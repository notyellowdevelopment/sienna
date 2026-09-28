/**
 * save.js — Consolidated Save / Backup / Cloud Sync System
 *
 * Brings together save functions previously spread across:
 *   - sienna.js  (data backup, download/upload, wipe, themes, profile picture)
 *   - siennadb.js (cloud save/restore, auto-sync, IndexedDB helpers)
 *   - night.js   (custom games save/load, game visor tabs save/load)
 *
 * Load order: after sienna.js, before siennadb.js
 * Depends on: window.siennaSettings (created by sienna.js)
 * Adds functions to: window.siennaSave, window.siennaSettings.*, window.siennaAccount.*
 *
 * ─── Backup format v4 — structured sections ───────────────────────────────
 *
 *  {
 *    "_sienna":   "sienna-backup-v4",
 *    "_savedAt":  "<ISO timestamp>",
 *
 *    "siennaData": {                  ← all Sienna-owned localStorage keys
 *      "settings":   { … },          ← UI / behaviour toggles
 *      "games":      { … },          ← custom games & favourites
 *      "appearance": { … },          ← custom themes & profile picture
 *      "account":    { … },          ← auth token, username, sync timestamp
 *      "tabs":       { … }           ← saved Game Visor tabs
 *    },
 *
 *    "storage": {                     ← everything else
 *      "localStorage":  { … },       ← non-sienna localStorage keys
 *      "sessionStorage":{ … },       ← sessionStorage keys
 *      "cookies":        "…",        ← raw cookie string
 *      "indexedDB":     { … }        ← IndexedDB databases (cloud save only)
 *    }
 *  }
 *
 *  Older v1 / v2 / v3 files are still read and restored without issue.
 * ──────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // Storage keys are declared once in sienna.js (window.SiennaStorageKeys).
  var KEYS = window.SiennaStorageKeys;

  // ── Shared constants ──────────────────────────────────────────────────────
  var API_BASE        = 'https://sienna-db.vercel.app/api';
  var TOKEN_KEY       = KEYS.token;
  var USERNAME_KEY    = KEYS.username;
  var LAST_SYNC_KEY   = KEYS.lastSyncAt;
  // Hash of the last payload actually sent to the server — lets a manual
  // backup skip the network request entirely when nothing has changed.
  var LAST_SYNC_HASH_KEY = KEYS.lastSyncHash;

  // ── v4 key categorisation ─────────────────────────────────────────────────
  //  Maps each siennaData section to the localStorage keys that belong there.
  //  Any key NOT listed ends up in storage.localStorage ("other" bucket).
  var SIENNA_KEY_CATEGORIES = {
    settings: [
      KEYS.reduceMotion,
      KEYS.gridColumns,
      KEYS.legacyLibrary,
      KEYS.classicLogo,
      KEYS.rememberTabs,
      KEYS.cloakMethod,
      KEYS.autoOpen,
      KEYS.gamesProvider,
      KEYS.themeId,
      KEYS.bubblesEnabled,
      KEYS.tabCloak,
      KEYS.tabCloakCustomTitle,
      KEYS.tabCloakCustomFavicon,
      KEYS.updatesSeen,
    ],
    games: [
      KEYS.customGames,
      KEYS.favorites,
    ],
    appearance: [
      KEYS.customThemes,
      KEYS.profilePicture,
    ],
    account: [
      TOKEN_KEY,
      USERNAME_KEY,
      LAST_SYNC_KEY,
      LAST_SYNC_HASH_KEY,
    ],
    tabs: [
      KEYS.gameVisorTabs,
      KEYS.gameVisorActiveTabId,
    ],
  };

  // Flat lookup: localStorage key → category name.  Built once at startup.
  var SIENNA_KEY_TO_CATEGORY = (function () {
    var map = {};
    for (var cat in SIENNA_KEY_CATEGORIES) {
      if (!SIENNA_KEY_CATEGORIES.hasOwnProperty(cat)) continue;
      var keys = SIENNA_KEY_CATEGORIES[cat];
      for (var i = 0; i < keys.length; i++) {
        map[keys[i]] = cat;
      }
    }
    return map;
  })();

  // ═══════════════════════════════════════════════════════════
  //  ENCRYPTION (Web Crypto: AES-GCM + PBKDF2)
  //
  //  Encrypted save files use the envelope format:
  //    {
  //      "_sienna":    "sienna-encrypted-v1",
  //      "kdf":        { algorithm, hash, iterations },
  //      "salt":       "<base64>",   // 16 bytes
  //      "iv":         "<base64>",   // 12 bytes (AES-GCM nonce)
  //      "ciphertext": "<base64>",   // includes AES-GCM auth tag
  //      "savedAt":    "<ISO timestamp>"
  //    }
  //
  //  AES-GCM verifies an authentication tag on decrypt — a wrong key fails
  //  verification and throws, which we surface as "wrong key".
  // ═══════════════════════════════════════════════════════════

  var ENCRYPT_ITERATIONS = 150000;
  var ENCRYPTED_MAGIC    = 'sienna-encrypted-v1';

  function _cryptoAvailable() {
    return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);
  }

  function _bytesToBase64(bytes) {
    var bin = '';
    var len = bytes.length;
    // Process in chunks to avoid call-stack limits on large saves
    for (var i = 0; i < len; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function _base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function _randomBytes(n) {
    var arr = new Uint8Array(n);
    window.crypto.getRandomValues(arr);
    return arr;
  }

  function _utf8Encode(str) {
    return new TextEncoder().encode(str);
  }

  async function _deriveAesKey(passphrase, saltBytes, iterations) {
    var baseKey = await window.crypto.subtle.importKey(
      'raw', _utf8Encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * encryptJsonData
   * Encrypt any JSON-serialisable object into an encrypted-save envelope.
   * @returns {Promise<Object>}  envelope (safe to JSON.stringify to a .data file)
   */
  async function encryptJsonData(obj, passphrase) {
    var salt = _randomBytes(16);
    var iv   = _randomBytes(12);
    var key  = await _deriveAesKey(passphrase, salt, ENCRYPT_ITERATIONS);
    var plaintext = _utf8Encode(JSON.stringify(obj));
    var ctBuffer  = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plaintext);
    var ct = new Uint8Array(ctBuffer);
    return {
      _sienna:    ENCRYPTED_MAGIC,
      kdf:        { algorithm: 'PBKDF2', hash: 'SHA-256', iterations: ENCRYPT_ITERATIONS },
      salt:       _bytesToBase64(salt),
      iv:         _bytesToBase64(iv),
      ciphertext: _bytesToBase64(ct),
      savedAt:    new Date().toISOString(),
    };
  }

  /**
   * decryptJsonData
   * Decrypt an envelope back into its original object.
   * Throws Error with message 'WRONG_KEY' if the passphrase is wrong (or the
   * data was tampered with).  Throws on any other failure.
   */
  async function decryptJsonData(envelope, passphrase) {
    if (!envelope || envelope._sienna !== ENCRYPTED_MAGIC) {
      throw new Error('Not an encrypted sienna save file.');
    }
    var iterations = (envelope.kdf && envelope.kdf.iterations) || ENCRYPT_ITERATIONS;
    var salt = _base64ToBytes(envelope.salt);
    var iv   = _base64ToBytes(envelope.iv);
    var key  = await _deriveAesKey(passphrase, salt, iterations);
    var ct   = _base64ToBytes(envelope.ciphertext);
    var ptBuffer;
    try {
      ptBuffer = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
    } catch (e) {
      throw new Error('WRONG_KEY');
    }
    var text = new TextDecoder().decode(ptBuffer);
    return JSON.parse(text);
  }

  function isEncryptedBackup(value) {
    return !!(value && typeof value === 'object' && value._sienna === ENCRYPTED_MAGIC);
  }

  // ── Encryption modal (shared by encrypt + decrypt flows) ──────────────────
  //
  //  One modal in index.html, two modes toggled by JS:
  //    'encrypt' — shows key + confirm-key fields and the "I'll lose everything"
  //                acknowledgement checkbox.
  //    'decrypt' — shows only the key field.
  //
  //  openEncryptionModal(mode) returns a Promise that resolves to the
  //  passphrase string, or null if the user cancels.

  var _encModalBound = false;
  var _encModalMode  = null;
  var _encModalResolve = null;

  function _encEl(id) { return document.getElementById(id); }

  function _bindEncryptionModal() {
    if (_encModalBound) return;
    var overlay = _encEl('encryptionModalOverlay');
    if (!overlay) return; // modal markup not present — caller guards this

    var cancel = _encEl('encryptionModalCancel');
    var submit = _encEl('encryptionModalSubmit');
    var keyInput     = _encEl('encryptionModalKey');
    var keyConfirm   = _encEl('encryptionModalKeyConfirm');

    function close() {
      _clearEncryptionError();
      keyInput.value = '';
      if (keyConfirm) keyConfirm.value = '';
      var ack = _encEl('encryptionModalAck');
      if (ack) ack.checked = false;
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      if (_encModalResolve) { _encModalResolve(null); _encModalResolve = null; }
      _encModalMode = null;
    }

    cancel?.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    submit?.addEventListener('click', _submitEncryptionModal);

    keyInput?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        if (_encModalMode === 'decrypt') { _submitEncryptionModal(); }
        else if (keyConfirm) { keyConfirm.focus(); }
      }
    });
    keyConfirm?.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') _submitEncryptionModal();
    });

    // Re-run validation live in encrypt mode so the error clears as the user fixes it
    keyInput?.addEventListener('input', _clearEncryptionError);
    keyConfirm?.addEventListener('input', _clearEncryptionError);
    var ack = _encEl('encryptionModalAck');
    ack?.addEventListener('change', _clearEncryptionError);

    _encModalBound = true;
    // Stash close fn for openEncryptionModal / submit
    _closeEncryptionModal = close;
  }

  var _closeEncryptionModal = null;

  function _showEncryptionError(msg) {
    var err = _encEl('encryptionModalError');
    if (!err) return;
    err.textContent = msg;
    err.classList.add('visible');
  }

  function _clearEncryptionError() {
    var err = _encEl('encryptionModalError');
    if (!err) return;
    if (err.textContent) { err.textContent = ''; }
    err.classList.remove('visible');
  }

  function _setEncryptionMode(mode) {
    _encModalMode = mode;
    var title       = _encEl('encryptionModalTitle');
    var intro       = _encEl('encryptionModalIntro');
    var confirmWrap = _encEl('encryptionModalConfirmField');
    var ackWrap     = _encEl('encryptionModalAckField');
    var submit      = _encEl('encryptionModalSubmit');
    var keyInput    = _encEl('encryptionModalKey');
    var keyConfirm  = _encEl('encryptionModalKeyConfirm');

    if (mode === 'encrypt') {
      if (title)       title.textContent = 'Encrypt Save File';
      if (intro)       intro.textContent = 'Protect your save file with a key. Use any characters — letters, numbers, and symbols. Save this key somewhere safe; you will need it to restore your file.';
      if (confirmWrap) confirmWrap.classList.remove('hidden');
      if (ackWrap)     ackWrap.classList.remove('hidden');
      if (submit)      submit.textContent = 'Encrypt';
      if (keyInput)    keyInput.placeholder = 'create a key';
      if (keyConfirm)  keyConfirm.placeholder = 're-enter your key';
    } else {
      if (title)       title.textContent = 'Enter Your Key';
      if (intro)       intro.textContent = 'This save file is encrypted. Enter the key you used to decrypt it.';
      if (confirmWrap) confirmWrap.classList.add('hidden');
      if (ackWrap)     ackWrap.classList.add('hidden');
      if (submit)      submit.textContent = 'Decrypt';
      if (keyInput)    keyInput.placeholder = 'enter your key';
      if (keyConfirm)  keyConfirm.placeholder = '';
    }
  }

  function openEncryptionModal(mode) {
    return new Promise(function (resolve) {
      var overlay = _encEl('encryptionModalOverlay');
      if (!overlay) { resolve(null); return; }
      _bindEncryptionModal();
      _encModalResolve = resolve;
      _setEncryptionMode(mode);
      _clearEncryptionError();
      var keyInput   = _encEl('encryptionModalKey');
      var keyConfirm = _encEl('encryptionModalKeyConfirm');
      if (keyInput)   keyInput.value = '';
      if (keyConfirm) keyConfirm.value = '';
      var ack = _encEl('encryptionModalAck');
      if (ack) ack.checked = false;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(function () { keyInput && keyInput.focus(); }, 80);
    });
  }

  function _submitEncryptionModal() {
    var keyInput   = _encEl('encryptionModalKey');
    var keyConfirm = _encEl('encryptionModalKeyConfirm');
    var ack        = _encEl('encryptionModalAck');
    var key = keyInput ? keyInput.value : '';

    if (!key) {
      _showEncryptionError('Please enter a key.');
      keyInput && keyInput.focus();
      return;
    }

    if (_encModalMode === 'encrypt') {
      var confirmVal = keyConfirm ? keyConfirm.value : '';
      if (key.length < 4) {
        _showEncryptionError('Key is too short — use at least 4 characters for your own safety.');
        keyInput.focus();
        return;
      }
      if (key !== confirmVal) {
        _showEncryptionError('Keys do not match.');
        keyConfirm && keyConfirm.focus();
        return;
      }
      if (ack && !ack.checked) {
        _showEncryptionError('Please confirm you understand the key cannot be recovered.');
        ack.focus();
        return;
      }
    }

    var resolve = _encModalResolve;
    var value   = key;
    // Reset modal state without calling the full close() resolve(null) path
    var overlay = _encEl('encryptionModalOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    if (keyInput)   keyInput.value = '';
    if (keyConfirm) keyConfirm.value = '';
    if (ack)        ack.checked = false;
    _clearEncryptionError();
    _encModalResolve = null;
    _encModalMode    = null;
    if (resolve) resolve(value);
  }

  /**
   * categorizeLocalStorage
   * Split a flat { key: value } localStorage snapshot into the v4 section
   * structure.
   *
   * @param   {Object} raw  Flat key → value map from localStorage.
   * @returns {{ siennaData: Object, other: Object }}
   */
  function categorizeLocalStorage(raw) {
    var siennaData = {
      settings:   {},
      games:      {},
      appearance: {},
      account:    {},
      tabs:       {},
    };
    var other = {};

    for (var key in raw) {
      if (!raw.hasOwnProperty(key)) continue;
      var cat = SIENNA_KEY_TO_CATEGORY[key];
      if (cat) {
        siennaData[cat][key] = raw[key];
      } else {
        other[key] = raw[key];
      }
    }

    return { siennaData: siennaData, other: other };
  }

  // ═══════════════════════════════════════════════════════════
  //  LOCAL STORAGE HELPERS (from night.js customGames)
  // ═══════════════════════════════════════════════════════════

  function loadCustomGames(storageKey) {
    try {
      var stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomGames(storageKey, items) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════
  //  GAME VISOR TABS (from night.js gameVisor)
  // ═══════════════════════════════════════════════════════════

  function saveTabsToStorage(tabs, activeTabId) {
    if (!window.siennaSettings || !window.siennaSettings.shouldRememberTabs || !window.siennaSettings.shouldRememberTabs()) return;
    try {
      localStorage.setItem(KEYS.gameVisorTabs, JSON.stringify(tabs.map(function (t) {
        return { id: t.id, url: t.url, name: t.name, loaded: false, gameData: t.gameData };
      })));
      localStorage.setItem(KEYS.gameVisorActiveTabId, activeTabId || '');
    } catch (e) { /* ignore */ }
  }

  function loadTabsFromStorage() {
    if (!window.siennaSettings || !window.siennaSettings.shouldRememberTabs || !window.siennaSettings.shouldRememberTabs()) {
      return { tabs: [], activeTabId: null };
    }
    try {
      var saved    = localStorage.getItem(KEYS.gameVisorTabs);
      var activeId = localStorage.getItem(KEYS.gameVisorActiveTabId);
      var tabs     = saved ? JSON.parse(saved) || [] : [];
      tabs = tabs.map(function (t) { t.loaded = false; return t; });
      var activeTabId = activeId || (tabs.length ? tabs[tabs.length - 1].id : null);
      return { tabs: tabs, activeTabId: activeTabId };
    } catch (e) {
      return { tabs: [], activeTabId: null };
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  CUSTOM THEMES (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  function saveCustomThemes() {
    try {
      var settings = window.siennaSettings;
      if (!settings || !settings.themes) return;
      var customThemes = settings.themes.filter(function (t) { return t.id.indexOf('custom-') === 0; });
      localStorage.setItem(KEYS.customThemes, JSON.stringify(customThemes));
    } catch (e) { /* ignore */ }
  }

  // ═══════════════════════════════════════════════════════════
  //  PROFILE PICTURE (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  function loadProfilePicture() {
    try {
      return localStorage.getItem(KEYS.profilePicture) || null;
    } catch (e) {
      return null;
    }
  }

  function saveProfilePicture(dataUrl) {
    try {
      localStorage.setItem(KEYS.profilePicture, dataUrl);
      updateTopNavAvatar(dataUrl);
      if (window.siennaSettings && window.siennaSettings.renderPanel) {
        window.siennaSettings.renderPanel();
      }
    } catch (e) { /* ignore */ }
  }

  function removeProfilePicture() {
    try {
      localStorage.removeItem(KEYS.profilePicture);
      updateTopNavAvatar(null);
      if (window.siennaAccount && window.siennaAccount.updateUI) {
        window.siennaAccount.updateUI();
      }
      if (window.siennaSettings && window.siennaSettings.renderPanel) {
        window.siennaSettings.renderPanel();
      }
    } catch (e) { /* ignore */ }
  }

  function updateTopNavAvatar(pfpDataUrl) {
    var avatarImg    = document.getElementById('accountAvatarImg');
    var avatarLetter = document.getElementById('accountAvatarLetter');
    if (!avatarImg || !avatarLetter) return;
    if (pfpDataUrl) {
      avatarImg.style.display    = 'block';
      avatarImg.src              = pfpDataUrl;
      avatarLetter.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  FILE SIZE / IMAGE WARNINGS (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  var FILE_SIZE_LIMIT = 2 * 1024 * 1024;

  function showFileSizeWarning() {
    var overlay = document.getElementById('fileSizeWarningOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function showInvalidImageWarning() {
    var overlay = document.getElementById('invalidImageOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function openUploadTheme() {
    var that = window.siennaSettings;
    if (!that) return;
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > FILE_SIZE_LIMIT) { showFileSizeWarning(); return; }
      var reader = new FileReader();
      reader.addEventListener('load', function (ev) {
        var dataUrl = ev.target && ev.target.result;
        if (typeof dataUrl !== 'string') return;
        var id    = 'custom-' + Date.now();
        var label = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        that.themes.push({ id: id, label: label, url: dataUrl });
        saveCustomThemes();
        if (that.applyTheme)  that.applyTheme(id);
        if (that.renderPanel) that.renderPanel();
      });
      reader.readAsDataURL(file);
    });
    input.click();
  }

  function openProfilePictureUpload() {
    var that = window.siennaSettings;
    if (!that) return;
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type || file.type.indexOf('image/') !== 0) { showInvalidImageWarning(); return; }
      if (file.size > FILE_SIZE_LIMIT) { showFileSizeWarning(); return; }
      var reader = new FileReader();
      reader.addEventListener('load', function (ev) {
        var dataUrl = ev.target && ev.target.result;
        if (typeof dataUrl !== 'string') return;
        if (that._openPfpCropper) that._openPfpCropper(dataUrl);
      });
      reader.readAsDataURL(file);
    });
    input.click();
  }

  // ═══════════════════════════════════════════════════════════
  //  SHARED APPLY HELPERS (used by applyDataBackup + restoreFromCloud)
  // ═══════════════════════════════════════════════════════════

  function _applyFlatLocalStorage(map) {
    if (!map || typeof map !== 'object') return;
    for (var key in map) {
      if (map.hasOwnProperty(key)) {
        try { localStorage.setItem(key, map[key]); } catch (e) { /* skip */ }
      }
    }
  }

  function _applyFlatSessionStorage(map) {
    if (!map || typeof map !== 'object') return;
    for (var key in map) {
      if (map.hasOwnProperty(key)) {
        try { sessionStorage.setItem(key, map[key]); } catch (e) { /* skip */ }
      }
    }
  }

  function _applyCookies(cookieStr) {
    if (!cookieStr || typeof cookieStr !== 'string') return;
    cookieStr.split(';').forEach(function (cookie) {
      if (cookie.trim()) document.cookie = cookie.trim();
    });
  }

  /** Apply every section of a v4 siennaData object back to localStorage. */
  function _applySiennaDataSections(siennaData) {
    if (!siennaData || typeof siennaData !== 'object') return;
    for (var cat in siennaData) {
      if (siennaData.hasOwnProperty(cat)) {
        _applyFlatLocalStorage(siennaData[cat]);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  DATA BACKUP PIPELINE (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  /**
   * createDataBackup
   * Gathers localStorage + sessionStorage + cookies and returns a structured
   * v4 backup object.  This is the "light" path used for manual file downloads
   * (no IndexedDB, so it stays fast).  Cloud sync uses gatherFullSaveData
   * instead, which adds storage.indexedDB.
   */
  async function createDataBackup() {
    var settings = window.siennaSettings;
    var rawLS    = {};
    var rawSS    = {};

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      try { rawLS[key] = localStorage.getItem(key); } catch (e) { /* skip */ }
    }
    for (var j = 0; j < sessionStorage.length; j++) {
      var skey = sessionStorage.key(j);
      try { rawSS[skey] = sessionStorage.getItem(skey); } catch (e) { /* skip */ }
    }

    var categorized = categorizeLocalStorage(rawLS);

    return {
      _sienna:  'sienna-backup-v4',
      _savedAt: new Date().toISOString(),
      _state:   settings && settings.state ? JSON.parse(JSON.stringify(settings.state)) : {},

      // ── Sienna-owned data, cleanly sectioned ──
      siennaData: categorized.siennaData,

      // ── Everything else ──
      storage: {
        localStorage:  categorized.other,
        sessionStorage: rawSS,
        cookies:        document.cookie || '',
        // indexedDB is omitted here; gatherFullSaveData adds it for cloud sync
      },
    };
  }

  /**
   * getDataBackupPayload
   * Unwrap the backup object from however it arrived (direct, or inside a
   * wrapper key).  Works for v1 through v4.
   */
  function getDataBackupPayload(value) {
    if (!value || typeof value !== 'object') return null;
    if (value._sienna) return value;

    var wrappers = ['backupData', 'data', 'backup', 'payload', 'save', 'saveData'];
    for (var i = 0; i < wrappers.length; i++) {
      var wkey   = wrappers[i];
      var nested = value[wkey];
      if (nested && typeof nested === 'object' && nested._sienna) return nested;
      if (typeof nested === 'string') {
        try {
          var parsed = JSON.parse(nested);
          if (parsed && typeof parsed === 'object' && parsed._sienna) return parsed;
        } catch (e) { /* skip */ }
      }
    }

    return null;
  }

  /**
   * applyDataBackup
   * Restores a backup object (any version) into the current browser storage.
   * Backward-compatible with v1, v2, and v3.
   */
  function applyDataBackup(value, options) {
    options = options || {};
    var data = getDataBackupPayload(value);
    if (!data) throw new Error('Invalid or corrupted backup file.');

    if (data._sienna === 'sienna-backup-v1') {
      // v1 — flat key/value pairs at top level (legacy)
      for (var key in data) {
        if (key !== '_sienna' && key !== '_state') {
          try { localStorage.setItem(key, data[key]); } catch (e) { /* skip */ }
        }
      }

    } else if (data._sienna === 'sienna-backup-v2' || data._sienna === 'sienna-backup-v3') {
      // v2/v3 — flat localStorage / sessionStorage / cookies
      _applyFlatLocalStorage(data.localStorage);
      _applyFlatSessionStorage(data.sessionStorage);
      _applyCookies(data.cookies);
      // v3 may include indexedDB
      if (data.indexedDB && typeof data.indexedDB === 'object') {
        restoreIndexedDB(data.indexedDB);
      }

    } else if (data._sienna === 'sienna-backup-v4') {
      // v4 — structured siennaData sections + storage bucket
      _applySiennaDataSections(data.siennaData);
      var stor = data.storage || {};
      _applyFlatLocalStorage(stor.localStorage);
      _applyFlatSessionStorage(stor.sessionStorage);
      _applyCookies(stor.cookies);
      if (stor.indexedDB && typeof stor.indexedDB === 'object') {
        restoreIndexedDB(stor.indexedDB);
      }

    } else {
      throw new Error('Unsupported backup version: ' + data._sienna);
    }

    if (options.reload !== false) window.location.reload();
  }

  // ═══════════════════════════════════════════════════════════
  //  MANUAL DATA DOWNLOAD (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  // Shared spinner overlay helper. Returns { el, text } so callers can update
  // the status text without rebuilding the whole loader.
  function _showDataLoader(initialText) {
    var loader  = document.createElement('div');
    loader.id   = 'sienna-data-loader';
    loader.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;backdrop-filter:blur(4px);';
    var spinner = document.createElement('div');
    spinner.style.cssText = 'width:40px;height:40px;border:4px solid rgba(255,255,255,0.3);border-top:4px solid #fff;border-radius:50%;animation:sienna-spin 1s linear infinite;margin-bottom:16px;';
    if (!document.getElementById('sienna-spin-style')) {
      var style = document.createElement('style');
      style.id = 'sienna-spin-style';
      style.textContent = '@keyframes sienna-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    var text = document.createElement('div');
    text.textContent  = initialText || 'Working...';
    text.style.fontSize = '16px';
    loader.appendChild(spinner);
    loader.appendChild(text);
    document.body.appendChild(loader);
    return { el: loader, text: text };
  }

  function _removeDataLoader(loader, delay) {
    setTimeout(function () {
      if (loader && document.body.contains(loader)) document.body.removeChild(loader);
    }, delay || 0);
  }

  var _downloadChoiceBound = false;
  var _downloadChoiceResolve = null;

  function _downloadChoiceEl(id) { return document.getElementById(id); }

  function _closeDownloadEncryptionChoice(value) {
    var overlay = _downloadChoiceEl('downloadEncryptionChoiceOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    var resolve = _downloadChoiceResolve;
    _downloadChoiceResolve = null;
    if (resolve) resolve(value);
  }

  function _bindDownloadEncryptionChoiceModal() {
    if (_downloadChoiceBound) return;
    var overlay = _downloadChoiceEl('downloadEncryptionChoiceOverlay');
    if (!overlay) return;

    _downloadChoiceEl('downloadEncryptionChoiceEncrypt')?.addEventListener('click', function () {
      _closeDownloadEncryptionChoice('encrypt');
    });
    _downloadChoiceEl('downloadEncryptionChoicePlain')?.addEventListener('click', function () {
      _closeDownloadEncryptionChoice('plain');
    });
    _downloadChoiceEl('downloadEncryptionChoiceCancel')?.addEventListener('click', function () {
      _closeDownloadEncryptionChoice(null);
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) _closeDownloadEncryptionChoice(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        _closeDownloadEncryptionChoice(null);
      }
    });

    _downloadChoiceBound = true;
  }

  function openDownloadEncryptionChoiceModal() {
    return new Promise(function (resolve) {
      var overlay = _downloadChoiceEl('downloadEncryptionChoiceOverlay');
      if (!overlay) { resolve('plain'); return; }
      _bindDownloadEncryptionChoiceModal();
      _downloadChoiceResolve = resolve;
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      setTimeout(function () {
        _downloadChoiceEl('downloadEncryptionChoiceEncrypt')?.focus();
      }, 80);
    });
  }

  function downloadData(options) {
    options = options || {};

    if (!options.encrypt && !options.skipEncryptPrompt && _cryptoAvailable()) {
      openDownloadEncryptionChoiceModal().then(function (choice) {
        if (choice === 'encrypt') {
          downloadData({ encrypt: true });
        } else if (choice === 'plain') {
          downloadData({ skipEncryptPrompt: true });
        }
      });
      return;
    }

    // ── Encrypted path ──────────────────────────────────────────────────
    if (options.encrypt) {
      if (!_cryptoAvailable()) {
        alert("Your browser doesn't support the Web Crypto API, which is required for encryption. Try a modern browser like Chrome or Firefox.");
        return;
      }
      openEncryptionModal('encrypt').then(function (passphrase) {
        if (!passphrase) return; // cancelled
        var loader = _showDataLoader('Gathering info, this may take a while...');
        setTimeout(function () {
          createDataBackup().then(function (data) {
            loader.text.textContent = 'Encrypting...';
            return encryptJsonData(data, passphrase);
          }).then(function (envelope) {
            var json = JSON.stringify(envelope, null, 2);
            var blob = new Blob([json], { type: 'application/octet-stream' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href     = url;
            a.download = 'your-sienna.data';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            loader.text.textContent = 'Encrypted download sent!';
            _removeDataLoader(loader.el, 1000);
          }).catch(function (e) {
            console.error('Failed to encrypt/download data:', e);
            loader.text.textContent = 'Error encrypting data!';
            _removeDataLoader(loader.el, 2000);
          });
        }, 600);
      });
      return;
    }

    // ── Plain (unencrypted) path ────────────────────────────────────────
    var loader  = _showDataLoader('Gathering info, this may take a while...');
    setTimeout(function () {
      createDataBackup().then(function (data) {
        loader.text.textContent = 'Preparing download...';
        setTimeout(function () {
          var json = JSON.stringify(data, null, 2);
          var blob = new Blob([json], { type: 'application/octet-stream' });
          var url  = URL.createObjectURL(blob);
          var a    = document.createElement('a');
          a.href     = url;
          a.download = 'your-sienna.data';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          loader.text.textContent = 'Download sent!';
          _removeDataLoader(loader.el, 800);
        }, 600);
      }).catch(function (e) {
        console.error('Failed to download data:', e);
        loader.text.textContent = 'Error gathering data!';
        _removeDataLoader(loader.el, 2000);
      });
    }, 600);
  }

  // ═══════════════════════════════════════════════════════════
  //  MANUAL DATA UPLOAD / RESTORE (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  function uploadData() {
    var input    = document.createElement('input');
    input.type   = 'file';
    input.accept = '.data,.json';
    input.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.addEventListener('load', function (ev) {
        var json = ev.target && ev.target.result;
        if (typeof json !== 'string') {
          alert('Failed to read the file. It may be corrupted.');
          return;
        }
        var parsed;
        try {
          parsed = JSON.parse(json);
        } catch (err) {
          alert(
            'Failed to restore data.\n\n' +
            'The file could not be read. It may be corrupted or not a valid Sienna backup file.'
          );
          return;
        }

        // ── Encrypted file → ask for key, decrypt, then restore ──────────
        if (isEncryptedBackup(parsed)) {
          if (!_cryptoAvailable()) {
            alert("This save file is encrypted, but your browser doesn't support the Web Crypto API. Try a modern browser like Chrome or Firefox.");
            return;
          }
          openEncryptionModal('decrypt').then(function (passphrase) {
            if (!passphrase) return; // cancelled
            var loader = _showDataLoader('Decrypting...');
            setTimeout(function () {
              decryptJsonData(parsed, passphrase).then(function (decrypted) {
                if (!getDataBackupPayload(decrypted)) {
                  throw new Error('Decrypted file is not a valid Sienna backup.');
                }
                loader.text.textContent = 'Done! Reloading...';
                setTimeout(function () { applyDataBackup(decrypted); }, 500);
              }).catch(function (err) {
                console.error('Failed to decrypt data:', err);
                _removeDataLoader(loader.el, 0);
                if (err && err.message === 'WRONG_KEY') {
                  alert('Wrong key. Double-check the key you used to encrypt this save file — there is no way to recover it if you lose it.');
                } else {
                  alert('Failed to decrypt this save file. It may be corrupted.');
                }
              });
            }, 400);
          });
          return;
        }

        // ── Plain (unencrypted) file → restore directly ──────────────────
        var loader = _showDataLoader('Restoring data...');
        setTimeout(function () {
          try {
            if (!getDataBackupPayload(parsed)) throw new Error('Invalid or corrupted backup file.');
            loader.text.textContent = 'Done! Reloading...';
            setTimeout(function () { applyDataBackup(parsed); }, 500);
          } catch (err) {
            console.error('Failed to upload data:', err);
            loader.text.textContent = 'Failed to restore data!';
            alert(
              'Failed to restore data.\n\n' +
              'The file could not be read. It may be corrupted or not a valid Sienna backup file.'
            );
            _removeDataLoader(loader.el, 1000);
          }
        }, 600);
      });
      reader.readAsText(file);
    });
    input.click();
  }

  // ═══════════════════════════════════════════════════════════
  //  WIPE CONFIG (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  function wipeConfig(options) {
    options = options || {};
    if (!options.skipConfirm) {
      var confirmed = confirm(
        '\u26a0\ufe0f Wipe all data?\n\n' +
        'This will reset ALL settings, custom games, favorites, themes, and saved tabs ' +
        'back to their defaults. This cannot be undone!\n\nAre you sure you want to continue?'
      );
      if (!confirmed) return;
      var reallySure = confirm(
        'Final confirmation:\n\nAll your data will be permanently deleted. There is no undo.\n\nProceed?'
      );
      if (!reallySure) return;
    }

    // Wipe every known sienna key EXCEPT account credentials and profile picture.
    // Account keys (token, username, sync timestamp) and sienna_pfp survive a wipe.
    var wipeKeys = []
      .concat(SIENNA_KEY_CATEGORIES.settings)
      .concat(SIENNA_KEY_CATEGORIES.games)
      .concat([KEYS.customThemes])   // appearance minus sienna_pfp
      .concat(SIENNA_KEY_CATEGORIES.tabs);

    for (var i = 0; i < wipeKeys.length; i++) {
      try { localStorage.removeItem(wipeKeys[i]); } catch (e) { /* skip */ }
    }

    if (options.cleanUrl) {
      window.location.replace(window.location.origin + window.location.pathname);
    } else {
      window.location.reload();
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  INDEXED DB HELPERS (from siennadb.js)
  // ═══════════════════════════════════════════════════════════

  function dumpIndexedDB(dbName) {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(dbName);
      req.onsuccess = function () {
        var db         = req.result;
        var storeNames = Array.from(db.objectStoreNames);
        if (storeNames.length === 0) { db.close(); resolve({}); return; }

        var result    = {};
        var completed = 0;
        var hasError  = false;

        storeNames.forEach(function (storeName) {
          try {
            var tx          = db.transaction(storeName, 'readonly');
            var store       = tx.objectStore(storeName);
            var getAllReq   = store.getAll();
            var getKeysReq = store.getAllKeys();

            getAllReq.onsuccess = function () {
              getKeysReq.onsuccess = function () {
                var values = getAllReq.result;
                var keys   = getKeysReq.result;
                var pairs  = {};
                for (var i = 0; i < keys.length; i++) {
                  var k = keys[i];
                  var v = values[i];
                  try {
                    JSON.stringify(v);
                    pairs[k instanceof Date ? k.toISOString() : String(k)] = v;
                  } catch (e2) {
                    pairs[k instanceof Date ? k.toISOString() : String(k)] = null;
                  }
                }
                result[storeName] = pairs;
                completed++;
                if (completed === storeNames.length && !hasError) { db.close(); resolve(result); }
              };
              getKeysReq.onerror = function () {
                completed++;
                if (completed === storeNames.length && !hasError) { db.close(); resolve(result); }
              };
            };
            getAllReq.onerror = function () {
              completed++;
              if (completed === storeNames.length && !hasError) { db.close(); resolve(result); }
            };
          } catch (e) {
            completed++;
            if (completed === storeNames.length && !hasError) { db.close(); resolve(result); }
          }
        });

        setTimeout(function () {
          if (!hasError) { hasError = true; db.close(); resolve(result); }
        }, 5000);
      };
      req.onerror   = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Database blocked')); };
    });
  }

  function gatherIndexedDBFallback(data) {
    var commonNames = [
      'keyval-store', 'games', 'game-data', 'save-data',
      'app-data', 'user-data', 'cache', 'sienna', 'sienna-cache',
    ];
    var promises = commonNames.map(function (name) {
      return dumpIndexedDB(name).then(function (dbData) {
        if (dbData && Object.keys(dbData).length > 0) data.indexedDB[name] = dbData;
      }).catch(function () { /* skip */ });
    });
    return Promise.all(promises);
  }

  function restoreIndexedDB(dbs) {
    for (var dbName in dbs) {
      if (!dbs.hasOwnProperty(dbName)) continue;
      var stores = dbs[dbName];
      if (!stores || typeof stores !== 'object') continue;
      try {
        var delReq = indexedDB.deleteDatabase(dbName);
        delReq.onsuccess = function (name, st) { return function () { populateIndexedDB(name, st); }; }(dbName, stores);
        delReq.onerror   = function (name, st) { return function () { populateIndexedDB(name, st); }; }(dbName, stores);
      } catch (e) {
        populateIndexedDB(dbName, stores);
      }
    }
  }

  function populateIndexedDB(dbName, stores) {
    var openReq = indexedDB.open(dbName);
    openReq.onupgradeneeded = function () {
      var db = openReq.result;
      for (var storeName in stores) {
        if (stores.hasOwnProperty(storeName) && !db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      }
    };
    openReq.onsuccess = function () {
      var db = openReq.result;
      for (var storeName in stores) {
        if (!stores.hasOwnProperty(storeName)) continue;
        var pairs = stores[storeName];
        if (!pairs || typeof pairs !== 'object') continue;
        try {
          var tx       = db.transaction(storeName, 'readwrite');
          var store    = tx.objectStore(storeName);
          var clearReq = store.clear();
          clearReq.onsuccess = function (p) {
            return function () {
              for (var key in p) {
                if (p.hasOwnProperty(key) && p[key] !== null) {
                  try { store.put(p[key], key); } catch (e) { /* skip */ }
                }
              }
            };
          }(pairs);
        } catch (e) { /* skip */ }
      }
      db.close();
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  FULL DATA GATHERING for cloud save (from siennadb.js)
  // ═══════════════════════════════════════════════════════════

  /**
   * gatherFullSaveData
   * The "heavy" path used for cloud sync.  Produces a v4 backup that includes
   * storage.indexedDB in addition to everything createDataBackup captures.
   */
  async function gatherFullSaveData() {
    var rawLS = {};
    var rawSS = {};

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      try { rawLS[key] = localStorage.getItem(key); } catch (e) { /* skip */ }
    }
    for (var j = 0; j < sessionStorage.length; j++) {
      var skey = sessionStorage.key(j);
      try { rawSS[skey] = sessionStorage.getItem(skey); } catch (e) { /* skip */ }
    }

    var categorized    = categorizeLocalStorage(rawLS);
    var indexedDBData  = {};

    try {
      if (typeof indexedDB === 'undefined' || !indexedDB.databases) {
        // Fallback: probe a known list of DB names
        var tempData = { indexedDB: {} };
        await gatherIndexedDBFallback(tempData);
        indexedDBData = tempData.indexedDB;
      } else {
        var dbs = await indexedDB.databases();
        for (var k = 0; k < dbs.length; k++) {
          var dbInfo = dbs[k];
          if (!dbInfo.name) continue;
          try {
            var dbData = await dumpIndexedDB(dbInfo.name);
            if (dbData && Object.keys(dbData).length > 0) {
              indexedDBData[dbInfo.name] = dbData;
            }
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) { /* IndexedDB gathering failed silently */ }

    return {
      _sienna:  'sienna-backup-v4',
      _savedAt: new Date().toISOString(),

      // ── Sienna-owned data, cleanly sectioned ──
      siennaData: categorized.siennaData,

      // ── Everything else ──
      storage: {
        localStorage:   categorized.other,
        sessionStorage: rawSS,
        cookies:        document.cookie || '',
        indexedDB:      indexedDBData,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  CHANGE DETECTION (new)
  //
  //  Hashes a save payload so a manual backup can skip the network call
  //  entirely when nothing meaningful has changed since the last successful
  //  sync. Volatile fields that change on *every* gather regardless of real
  //  data changes (_savedAt timestamp, and the account bookkeeping section
  //  which holds the token/username/last-sync-time/last-sync-hash) are
  //  stripped first, or the hash would never match twice in a row.
  // ═══════════════════════════════════════════════════════════

  async function _computeSaveHash(payload) {
    var copy;
    try {
      copy = JSON.parse(JSON.stringify(payload));
    } catch (e) {
      return null; // payload wasn't serialisable — skip change detection this time
    }
    delete copy._savedAt;
    if (copy.siennaData && copy.siennaData.account) copy.siennaData.account = {};
    var json = JSON.stringify(copy);

    if (_cryptoAvailable()) {
      try {
        var digest = await window.crypto.subtle.digest('SHA-256', _utf8Encode(json));
        var bytes  = new Uint8Array(digest);
        var hex    = '';
        for (var i = 0; i < bytes.length; i++) {
          var h = bytes[i].toString(16);
          hex += h.length === 1 ? '0' + h : h;
        }
        return 'sha256:' + hex;
      } catch (e) { /* fall through to non-crypto hash below */ }
    }

    // Fallback (older browsers / non-secure context): a fast, non-cryptographic
    // hash. It's only used to detect "did anything change", never for security.
    var hash = 0;
    for (var j = 0; j < json.length; j++) {
      hash = (hash << 5) - hash + json.charCodeAt(j);
      hash |= 0;
    }
    return 'fnv:' + hash + ':' + json.length;
  }

  // ═══════════════════════════════════════════════════════════
  //  CLOUD API (from siennadb.js)
  // ═══════════════════════════════════════════════════════════

  function extractBackupPayload(value) {
    if (window.siennaSettings && window.siennaSettings.getDataBackupPayload) {
      return window.siennaSettings.getDataBackupPayload(value);
    }
    if (value && typeof value === 'object' && value._sienna) return value;
    return value && (
      value.backupData || value.data || value.backup ||
      value.payload    || value.save || value.saveData || null
    );
  }

  function handleAuthFailure() {
    var account = window.siennaAccount;
    if (!account) return;
    if (account._stopAutoSync) account._stopAutoSync();
    if (account.clearSession)  account.clearSession();
    if (account.updateUI)      account.updateUI();
  }

  function formatSyncStatus() {
    var account = window.siennaAccount;
    if (!account || !account.isLoggedIn || !account.isLoggedIn()) return 'Not logged in';
    if (!account._lastSyncAt) return 'Not synced yet';
    var seconds = Math.max(0, Math.floor((Date.now() - account._lastSyncAt) / 1000));
    var prefix  = account._lastSyncWasManual ? 'Manually synced' : 'Auto synced';
    if (seconds < 2)  return prefix + ' Just Now';
    if (seconds < 60) return prefix + ' ' + seconds + 's ago';
    return prefix + ' ' + Math.floor(seconds / 60) + 'm ago';
  }

  function updateSyncStatus() {
    var status = document.getElementById('accountSyncStatus');
    if (status) status.textContent = formatSyncStatus();
    var dropdownStatus = document.querySelector('.account-dropdown-sync-status');
    if (dropdownStatus) dropdownStatus.textContent = formatSyncStatus();
  }

  function markSynced() {
    var account = window.siennaAccount;
    if (!account) return;
    account._lastSyncAt = Date.now();
    try { localStorage.setItem(LAST_SYNC_KEY, String(account._lastSyncAt)); } catch (e) { /* ignore */ }
    updateSyncStatus();
    if (!account._syncStatusInterval) {
      account._syncStatusInterval = setInterval(function () { updateSyncStatus(); }, 1000);
    }
  }

  function restoreMarker() {
    var account = window.siennaAccount;
    return 'sienna_cloud_restored_' + (account ? (account.token || 'none') : 'none');
  }

  function hasAutoRestored() {
    try   { return sessionStorage.getItem(restoreMarker()) === '1'; }
    catch (e) { return false; }
  }

  function markAutoRestored() {
    try { sessionStorage.setItem(restoreMarker(), '1'); } catch (e) { /* ignore */ }
  }

  async function sendCloudBackup(payload) {
    var account = window.siennaAccount;
    if (!account || !account.token) return null;

    var bodies = [
      { backupData: payload },
      payload,
      { data: payload },
      { backup: payload },
    ];
    var lastResponse = null;

    for (var i = 0; i < bodies.length; i++) {
      var res = await fetch(API_BASE + '/data/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + account.token,
        },
        body: JSON.stringify(bodies[i]),
      });
      if (res.ok)                                             return res;
      if (res.status === 401 || res.status === 403 || res.status === 413) return res;
      lastResponse = res;
    }

    return lastResponse;
  }

  // ═══════════════════════════════════════════════════════════
  //  AUTO SYNC (from siennadb.js)
  // ═══════════════════════════════════════════════════════════

  // Auto-sync (periodic setInterval-based background sync) has been removed.
  // Syncing is now manual-only, triggered by the user via saveToCloud(), which
  // also skips the network request entirely when nothing has changed
  // (see _computeSaveHash above). stopAutoSync remains so existing call sites
  // (e.g. siennadb.js logout()) can still clear the sync-status ticker.

  function stopAutoSync() {
    var account = window.siennaAccount;
    if (!account) return;
    // Still clear the cosmetic 1s UI ticker (started by markSynced) if running.
    if (account._syncStatusInterval) { clearInterval(account._syncStatusInterval); account._syncStatusInterval = null; }
    account._autoSyncEnabled = false;
  }

  // ═══════════════════════════════════════════════════════════
  //  CLOUD SAVE / RESTORE (from siennadb.js)
  // ═══════════════════════════════════════════════════════════

  async function saveToCloud() {
    var account = window.siennaAccount;
    if (!account || !account.isLoggedIn || !account.isLoggedIn()) {
      if (account && account.showLoginModal) account.showLoginModal();
      return;
    }

    var dropdown = document.getElementById('accountDropdown');
    if (dropdown) dropdown.classList.remove('open');

    var payload = await gatherFullSaveData();

    try {
      var hash = await _computeSaveHash(payload);
      var lastHash = null;
      try { lastHash = localStorage.getItem(LAST_SYNC_HASH_KEY); } catch (e) { /* ignore */ }

      if (hash && lastHash && hash === lastHash) {
        // Nothing changed since the last successful sync — confirm as synced
        // without spending a network request / bandwidth on an identical upload.
        account._lastSyncWasManual = true;
        markSynced();
        return;
      }

      var res = await sendCloudBackup(payload);
      if (res && !res.ok) {
        if (res.status === 401 || res.status === 403) handleAuthFailure();
        return;
      }

      if (hash) {
        try { localStorage.setItem(LAST_SYNC_HASH_KEY, hash); } catch (e) { /* ignore */ }
      }
      account._lastSyncWasManual = true;
      markSynced();
    } catch (e) { /* silently fail */ }
  }

  async function restoreFromCloud(options) {
    options = options || {};
    var account = window.siennaAccount;
    if (!account || !account.isLoggedIn || !account.isLoggedIn()) {
      if (!options.silent && account && account.showLoginModal) account.showLoginModal();
      return false;
    }

    var dropdown = document.getElementById('accountDropdown');
    if (dropdown) dropdown.classList.remove('open');

    try {
      var res = await fetch(API_BASE + '/data/backup', {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + account.token },
      });

      if (res.status === 401 || res.status === 403) { handleAuthFailure(); return false; }
      if (!res.ok) return false;

      var responseData = await res.json();
      var data         = extractBackupPayload(responseData);
      if (!data) return false;

      // ── Preserve current session credentials in the restored payload ──────
      if (data._sienna === 'sienna-backup-v4') {
        // v4: credentials live in siennaData.account
        if (data.siennaData && data.siennaData.account) {
          data.siennaData.account[TOKEN_KEY]    = account.token;
          data.siennaData.account[USERNAME_KEY] = account.username;
        }
      } else {
        // v2/v3: credentials live in the flat localStorage map
        if (data.localStorage && typeof data.localStorage === 'object') {
          data.localStorage[TOKEN_KEY]    = account.token;
          data.localStorage[USERNAME_KEY] = account.username;
        }
      }

      if (options.mark) markAutoRestored();

      if (window.siennaSettings && window.siennaSettings.applyDataBackup) {
        // Delegate to the patched applyDataBackup (handles all versions)
        window.siennaSettings.applyDataBackup(data, { reload: options.reload !== false });
      } else {
        // Inline restore (fallback when siennaSettings isn't ready)
        if (data._sienna === 'sienna-backup-v4') {
          _applySiennaDataSections(data.siennaData);
          var stor = data.storage || {};
          _applyFlatLocalStorage(stor.localStorage);
          _applyFlatSessionStorage(stor.sessionStorage);
          _applyCookies(stor.cookies);
          if (stor.indexedDB && typeof stor.indexedDB === 'object') restoreIndexedDB(stor.indexedDB);
        } else {
          // v2 / v3 legacy
          _applyFlatLocalStorage(data.localStorage);
          _applyFlatSessionStorage(data.sessionStorage);
          _applyCookies(data.cookies);
          if (data.indexedDB && typeof data.indexedDB === 'object') restoreIndexedDB(data.indexedDB);
        }
        if (options.reload !== false) location.reload();
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  async function autoRestore(options) {
    options = options || {};
    if (!options.force && hasAutoRestored()) return false;
    return restoreFromCloud({ silent: true, mark: true, reload: true });
  }

  // ═══════════════════════════════════════════════════════════
  //  EXPOSE PUBLIC API
  // ═══════════════════════════════════════════════════════════

  var save = {
    // constants
    API_BASE:          API_BASE,
    TOKEN_KEY:         TOKEN_KEY,
    USERNAME_KEY:      USERNAME_KEY,
    LAST_SYNC_KEY:     LAST_SYNC_KEY,
    LAST_SYNC_HASH_KEY: LAST_SYNC_HASH_KEY,
    computeSaveHash:    _computeSaveHash,

    // key categorisation
    SIENNA_KEY_CATEGORIES:  SIENNA_KEY_CATEGORIES,
    SIENNA_KEY_TO_CATEGORY: SIENNA_KEY_TO_CATEGORY,
    categorizeLocalStorage: categorizeLocalStorage,

    // local storage helpers (from night.js)
    loadCustomGames:    loadCustomGames,
    saveCustomGames:    saveCustomGames,
    saveTabsToStorage:  saveTabsToStorage,
    loadTabsFromStorage: loadTabsFromStorage,

    // custom themes (from sienna.js)
    saveCustomThemes: saveCustomThemes,

    // profile picture (from sienna.js)
    loadProfilePicture:       loadProfilePicture,
    saveProfilePicture:       saveProfilePicture,
    removeProfilePicture:     removeProfilePicture,
    updateTopNavAvatar:       updateTopNavAvatar,
    openProfilePictureUpload: openProfilePictureUpload,

    // file upload helpers (from sienna.js)
    FILE_SIZE_LIMIT:         FILE_SIZE_LIMIT,
    showFileSizeWarning:     showFileSizeWarning,
    showInvalidImageWarning: showInvalidImageWarning,
    openUploadTheme:         openUploadTheme,

    // data backup pipeline (from sienna.js)
    createDataBackup:    createDataBackup,
    getDataBackupPayload: getDataBackupPayload,
    applyDataBackup:     applyDataBackup,
    downloadData:        downloadData,
    uploadData:          uploadData,
    wipeConfig:          wipeConfig,

    // encryption (Web Crypto: AES-GCM + PBKDF2)
    encryptJsonData:     encryptJsonData,
    decryptJsonData:     decryptJsonData,
    isEncryptedBackup:   isEncryptedBackup,
    openEncryptionModal: openEncryptionModal,
    ENCRYPTED_MAGIC:     ENCRYPTED_MAGIC,
    encryptDownload: function () { downloadData({ encrypt: true }); },

    // IndexedDB helpers (from siennadb.js)
    dumpIndexedDB:            dumpIndexedDB,
    gatherIndexedDBFallback:  gatherIndexedDBFallback,
    restoreIndexedDB:         restoreIndexedDB,
    populateIndexedDB:        populateIndexedDB,
    gatherFullSaveData:       gatherFullSaveData,

    // cloud API (from siennadb.js)
    extractBackupPayload: extractBackupPayload,
    handleAuthFailure:    handleAuthFailure,
    sendCloudBackup:      sendCloudBackup,

    // sync status (from siennadb.js)
    formatSyncStatus:  formatSyncStatus,
    updateSyncStatus:  updateSyncStatus,
    markSynced:        markSynced,
    restoreMarker:     restoreMarker,
    hasAutoRestored:   hasAutoRestored,
    markAutoRestored:  markAutoRestored,

    // auto sync (from siennadb.js)
    stopAutoSync:  stopAutoSync,

    // cloud save/restore (from siennadb.js)
    saveToCloud:       saveToCloud,
    restoreFromCloud:  restoreFromCloud,
    autoRestore:       autoRestore,
  };

  window.siennaSave = save;

  // ═══════════════════════════════════════════════════════════
  //  BACK-PATCH siennaSettings (from sienna.js)
  // ═══════════════════════════════════════════════════════════

  if (window.siennaSettings) {
    window.siennaSettings.createDataBackup      = createDataBackup;
    window.siennaSettings.getDataBackupPayload  = getDataBackupPayload;
    window.siennaSettings.applyDataBackup       = applyDataBackup;
    window.siennaSettings.downloadData          = downloadData;
    window.siennaSettings.encryptDownload       = function () { downloadData({ encrypt: true }); };
    window.siennaSettings.uploadData            = uploadData;
    window.siennaSettings.wipeConfig            = wipeConfig;
    window.siennaSettings.saveCustomThemes      = saveCustomThemes;
    window.siennaSettings._loadProfilePicture   = loadProfilePicture;
    window.siennaSettings._saveProfilePicture   = saveProfilePicture;
    window.siennaSettings._removeProfilePicture = removeProfilePicture;
    window.siennaSettings._updateTopNavAvatar   = updateTopNavAvatar;
    window.siennaSettings.FILE_SIZE_LIMIT       = FILE_SIZE_LIMIT;
    window.siennaSettings.showFileSizeWarning   = showFileSizeWarning;
    window.siennaSettings.showInvalidImageWarning = showInvalidImageWarning;
    window.siennaSettings.openUploadTheme         = openUploadTheme;
    window.siennaSettings.openProfilePictureUpload = openProfilePictureUpload;
  }

})();
