/**
 * plugins.js - Sienna Plugin Manager v2
 *
 * Minimal #050505 UI — smaller buttons, draggable minimize-to-badge,
 * search filter, keyboard shortcuts, in-place toggle updates.
 */
(function () {
  'use strict';

  // ───────────────────── CONFIG ─────────────────────
  const STORAGE_KEY     = window.SiennaStorageKeys.pluginsEnabled;
  const HACK_STATES_KEY = window.SiennaStorageKeys.hackStates;

  const HACK_FILES = [
    'monkeymart.js',
    'driftboss.js',
  ];

  // ───────────────────── STATE ─────────────────────
  let enabled = {};
  try { enabled = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { enabled = {}; }

  let hackStates = {};
  try { hackStates = JSON.parse(localStorage.getItem(HACK_STATES_KEY) || '{}'); } catch (_) { hackStates = {}; }

  const registry = [];
  let menuContainer = null;
  let minimizedBtn  = null;
  let searchQuery   = '';

  // ───────────────────── CSS ─────────────────────
  const CSS = `
    /* ── Settings Panel ── */
    .sp-panel { width: 100%; }
    .sp-list  { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 10px; }

    .sp-card {
      display: grid; grid-template-columns: minmax(0,1fr) auto;
      align-items: start; gap: 12px; min-height: 72px; padding: 11px 12px;
      border: 1px solid rgba(255,255,255,0.07); border-radius: 8px;
      background: #0f0f0f; color: #f0f0f0;
      transition: border-color 140ms, background 140ms;
    }
    .sp-card:hover { border-color: rgba(255,255,255,0.12); background: #141414; }

    .sp-card-main       { min-width: 0; display: grid; gap: 5px; }
    .sp-card-title-wrap { min-width: 0; display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
    .sp-card-name    { min-width: 0; color: #e0e0e0; font-size: 0.83rem; font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
    .sp-card-version { color: rgba(255,255,255,0.25); font-size: 0.65rem; font-weight: 600; white-space: nowrap; }
    .sp-card-desc    { color: rgba(255,255,255,0.4); font-size: 0.74rem; line-height: 1.4; overflow-wrap: anywhere; }
    .sp-card-icon    { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.07); }
    .sp-card-actions { display: flex; align-items: center; gap: 6px; padding-top: 1px; }

    .sp-icon-btn { width: 22px; height: 22px; display: inline-grid; place-items: center; border: 0; border-radius: 5px; background: transparent; color: #444; cursor: pointer; transition: color 140ms, background 140ms; }
    .sp-icon-btn:hover { color: #bbb; background: rgba(255,255,255,0.06); }
    .sp-icon-btn svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .sp-open-btn { min-width: 50px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.09); border-radius: 5px; background: transparent; color: #999; font-size: 0.69rem; font-weight: 700; cursor: pointer; transition: border-color 140ms, background 140ms, color 140ms; }
    .sp-open-btn:hover { border-color: rgba(255,255,255,0.18); color: #ddd; }

    .sp-toggle { width: 36px; height: 20px; position: relative; flex: 0 0 auto; border: 0; border-radius: 999px; background: #1e1e1e; cursor: pointer; transition: background 160ms; }
    .sp-toggle-knob { position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; display: grid; place-items: center; border-radius: 50%; background: #3c3c3c; transition: transform 160ms, background 160ms; }
    .sp-toggle-knob svg { width: 8px; height: 8px; opacity: 0; fill: none; stroke: #000; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; transition: opacity 160ms; }
    .sp-toggle.on { background: #e0e0e0; }
    .sp-toggle.on .sp-toggle-knob { transform: translateX(16px); background: #050505; }
    .sp-toggle.on .sp-toggle-knob svg { opacity: 1; stroke: #e0e0e0; }

    .sp-empty { padding: 13px; border: 1px solid rgba(255,255,255,0.05); border-radius: 7px; background: #0a0a0a; color: rgba(255,255,255,0.2); font-size: 0.75rem; font-weight: 600; text-align: center; }

    /* ── Hack Menu ── */
    #sienna-menu {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 640px; max-width: 92vw; height: 480px; max-height: 88vh;
      background: #050505; border: 1px solid rgba(255,255,255,0.07);
      border-radius: 13px; z-index: 999998; display: none; flex-direction: column;
      box-shadow: 0 20px 70px rgba(0,0,0,0.97), 0 0 0 1px rgba(255,255,255,0.02);
      overflow: hidden;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #sienna-menu.open { display: flex; }

    .sienna-title-bar {
      height: 44px; display: flex; align-items: center; justify-content: center;
      padding: 0 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
      position: relative; background: #050505;
      cursor: move; user-select: none; flex-shrink: 0;
    }
    .sienna-title {
      color: rgba(255, 255, 255, 0.5); font-size: 11.5px; font-weight: 600;
      letter-spacing: 0.05em; text-transform: lowercase;
    }

    .sienna-top-actions {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      display: flex; gap: 1px;
    }

    .sienna-icon-btn {
      width: 26px; height: 26px; display: grid; place-items: center;
      background: transparent; border: 0; color: #333; cursor: pointer;
      transition: color 0.14s, background 0.14s; border-radius: 5px;
    }
    .sienna-icon-btn:hover { color: #999; background: rgba(255,255,255,0.05); }
    .sienna-icon-btn svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    /* Search */
    .sienna-search-wrap { padding: 10px 13px 0; flex-shrink: 0; }
    .sienna-search {
      width: 100%; height: 30px; background: #0b0b0b;
      border: 1px solid rgba(255,255,255,0.06); border-radius: 7px;
      color: #bbb; font-size: 12px; padding: 0 10px;
      outline: none; font-family: inherit; box-sizing: border-box;
      transition: border-color 0.14s; caret-color: #888;
    }
    .sienna-search::placeholder { color: #2a2a2a; }
    .sienna-search:focus { border-color: rgba(255,255,255,0.11); }

    .sienna-body { display: flex; flex: 1; overflow: hidden; min-height: 0; }

    .sienna-content {
      flex: 1; padding: 9px 13px 13px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 5px;
    }
    .sienna-content::-webkit-scrollbar       { width: 3px; }
    .sienna-content::-webkit-scrollbar-track { background: transparent; }
    .sienna-content::-webkit-scrollbar-thumb { background: #181818; border-radius: 2px; }
    .sienna-content::-webkit-scrollbar-thumb:hover { background: #222; }

    .sienna-hack-item {
      background: #0b0b0b; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;
      padding: 11px 13px; display: flex; justify-content: space-between; align-items: center; gap: 12px;
      transition: border-color 0.14s, background 0.14s;
    }
    .sienna-hack-item:hover   { border-color: rgba(255,255,255,0.09); background: #0e0e0e; }
    .sienna-hack-item.s-hide  { display: none; }

    .sienna-hack-info  { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .sienna-hack-title { color: #d0d0d0; font-size: 13px; font-weight: 600; line-height: 1.3; }
    .sienna-hack-desc  { color: #3a3a3a; font-size: 11px; font-weight: 400; line-height: 1.4; }

    .sienna-run-btn {
      min-width: 54px; height: 27px; display: flex; align-items: center; justify-content: center;
      background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
      color: #666; font-size: 11.5px; font-weight: 600; cursor: pointer; flex-shrink: 0;
      transition: background 0.14s, color 0.14s, border-color 0.14s;
    }
    .sienna-run-btn:hover        { color: #ccc; border-color: rgba(255,255,255,0.16); background: rgba(255,255,255,0.03); }
    .sienna-run-btn.active       { background: #e0e0e0; color: #050505; border-color: #e0e0e0; font-weight: 700; }
    .sienna-run-btn.active:hover { background: #c8c8c8; border-color: #c8c8c8; }

    /* ── Inline storage value controls (dropdown / number) ── */
    .sienna-value-wrap { position: relative; display: inline-flex; align-items: center; flex-shrink: 0; }

    .sienna-value-select,
    .sienna-value-input {
      height: 27px; box-sizing: border-box;
      background: #0b0b0b; color: #d0d0d0;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
      font-family: inherit; font-size: 11.5px; font-weight: 600;
      outline: none; cursor: pointer; text-align: center;
      transition: border-color 0.14s, color 0.14s, background 0.14s;
      -webkit-appearance: none; -moz-appearance: none; appearance: none;
    }
    .sienna-value-select { min-width: 74px; padding: 0 22px 0 10px; }
    .sienna-value-input  { width: 88px; padding: 0 8px; cursor: text; }
    .sienna-value-input::-webkit-outer-spin-button,
    .sienna-value-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    .sienna-value-select:hover,
    .sienna-value-input:hover { border-color: rgba(255,255,255,0.16); color: #eee; }
    .sienna-value-select:focus,
    .sienna-value-input:focus { border-color: rgba(255,255,255,0.28); color: #fff; background: #101010; }

    .sienna-value-select option { background: #0b0b0b; color: #d0d0d0; }

    .sienna-value-caret {
      position: absolute; right: 7px; width: 9px; height: 9px;
      pointer-events: none; fill: none; stroke: #555; stroke-width: 2;
      stroke-linecap: round; stroke-linejoin: round;
      transition: stroke 0.14s;
    }
    .sienna-value-wrap:hover .sienna-value-caret { stroke: #999; }

    .sienna-value-select.s-flash,
    .sienna-value-input.s-flash { border-color: #e0e0e0; color: #fff; background: #141414; }

    /* ── "Saved" toast ── */
    .sienna-saved-toast {
      position: absolute; bottom: 58px; left: 50%;
      transform: translateX(-50%) translateY(10px);
      background: #0f0f0f; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px; padding: 8px 14px 8px 11px;
      display: flex; align-items: center; gap: 8px;
      color: #e0e0e0; font-size: 11.5px; font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.02);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      z-index: 10; white-space: nowrap;
    }
    .sienna-saved-toast.s-show {
      opacity: 1; transform: translateX(-50%) translateY(0);
    }
    .sienna-saved-toast svg {
      width: 12px; height: 12px;
      fill: none; stroke: #e0e0e0; stroke-width: 2.6;
      stroke-linecap: round; stroke-linejoin: round;
    }

    .sienna-footer {
      padding: 8px 13px; border-top: 1px solid rgba(255,255,255,0.04); background: #050505;
      display: flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0;
    }
    .sienna-footer-text    { color: #1e1e1e; font-size: 10px; font-weight: 500; }
    .sienna-footer-links   { display: flex; gap: 8px; align-items: center; }
    .sienna-footer-links a { color: #1e1e1e; text-decoration: none; font-size: 10px; font-weight: 500; transition: color 0.14s; }
    .sienna-footer-links a:hover { color: #555; }
    .sienna-footer-dot { color: #191919; font-size: 10px; }

    .sienna-empty      { color: #2a2a2a; font-size: 12.5px; text-align: center; margin-top: 36px; font-weight: 500; }
    .sienna-no-results { color: #2a2a2a; font-size: 12px; text-align: center; padding: 28px 0; font-weight: 500; display: none; }
    .sienna-no-results.s-show { display: block; }

    /* ── Minimized Floating Button ── */
    #sienna-minimized {
      position: fixed; bottom: 20px; right: 20px;
      width: 40px; height: 40px;
      background: #050505; border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; display: none; align-items: center; justify-content: center;
      cursor: grab; z-index: 999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.9);
      transition: border-color 0.18s, background 0.18s;
      user-select: none;
    }
    #sienna-minimized:active   { cursor: grabbing; }
    #sienna-minimized.s-show   { display: flex; }
    #sienna-minimized:hover    { border-color: rgba(255,255,255,0.2); background: #0d0d0d; }

    #sienna-mini-star { width: 16px; height: 16px; pointer-events: none; transition: opacity 0.15s; opacity: 0.45; }
    #sienna-minimized:hover #sienna-mini-star { opacity: 0.8; }
    #sienna-mini-star polygon { fill: #fff; }

    #sienna-active-badge {
      position: absolute; top: -5px; right: -5px;
      min-width: 14px; height: 14px; padding: 0 3px; box-sizing: border-box;
      background: #e0e0e0; border-radius: 7px;
      display: none; align-items: center; justify-content: center;
      font-size: 8px; font-weight: 800; color: #050505;
      font-family: Inter, -apple-system, sans-serif;
    }
    #sienna-active-badge.s-show { display: flex; }
  `;

  // ───────────────────── HELPERS ─────────────────────
  function save()           { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled)); } catch (_) {} }
  function saveHackStates() { try { localStorage.setItem(HACK_STATES_KEY, JSON.stringify(hackStates)); } catch (_) {} }

  function escapeHtml(value) {
    const d = document.createElement('div');
    d.textContent = String(value ?? '');
    return d.innerHTML;
  }

  function slugId(value) {
    return String(value || 'id').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'id';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function runEnable(plugin)  { try { plugin.onEnable?.(); }  catch (e) { console.error(e); } }
  function runDisable(plugin) { try { plugin.onDisable?.(); } catch (e) { console.error(e); } }

  function showInfo(plugin) {
    window.alert(
      [plugin.name || plugin.id, plugin.version ? `Version: ${plugin.version}` : '', plugin.description || 'No description.']
        .filter(Boolean).join('\n\n')
    );
  }

  function getActiveHackCount() {
    let n = 0;
    for (const gid in hackStates)
      for (const hid in hackStates[gid])
        if (hackStates[gid][hid]) n++;
    return n;
  }

  function updateBadge() {
    if (!minimizedBtn) return;
    const badge = document.getElementById('sienna-active-badge');
    if (!badge) return;
    const n = getActiveHackCount();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.classList.toggle('s-show', n > 0);
  }

  // ── Raw storage read/write (localStorage + sessionStorage) ──
  function readStoredValue(key) {
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch (_) {}
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function writeStoredValue(key, value) {
    const v = String(value);
    let ok = false;
    try { localStorage.setItem(key, v); ok = true; } catch (e) { console.warn('[Sienna] localStorage write failed:', e); }
    try { sessionStorage.setItem(key, v); ok = true; } catch (_) {}
    return ok;
  }

  // ── "Saved setting" toast ──
  function showSavedToast(text) {
    if (!menuContainer) return;
    let toast = document.getElementById('sienna-saved-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'sienna-saved-toast';
      toast.className = 'sienna-saved-toast';
      toast.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg><span></span>`;
      menuContainer.appendChild(toast);
    }
    toast.querySelector('span').textContent = text || 'Setting saved';
    toast.classList.add('s-show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('s-show'), 1600);
  }

  // Normalize a game's hack list into flat items with a stable _id
  function getHackItems(game) {
    if (game.hacks && game.hacks.length > 0)
      return game.hacks.map(h => ({ ...h, _id: slugId(h.id || h.name) }));
    return [{
      _id:       'main',
      name:      game.name,
      desc:      game.description || 'Toggle to activate',
      onEnable:  game.onEnable,
      onDisable: game.onDisable
    }];
  }

  function openTool(plugin) {
    if (plugin.id === 'sienna-hack-ui') { openHackMenu(); return; }
    // FIX: only call onSettings / onConfigure — not onEnable — for settings button
    const fn = plugin.onSettings || plugin.onConfigure;
    if (fn) fn();
    else if (plugin.kind === 'hack') openHackMenu();
    else showInfo(plugin);
  }

  // ───────────────────── SETTINGS PANEL ─────────────────────
  function renderCards(kind = 'plugin') {
    const items = registry.filter(p => (p.kind || 'plugin') === kind);
    if (!items.length)
      return `<div class="sp-empty">No ${kind === 'hack' ? 'hacks' : 'plugins'} installed.</div>`;

    return `<div class="sp-list">${items.map(p => {
      const isHack      = kind === 'hack';
      const on          = !!enabled[p.id];
      const hasSettings = typeof p.onSettings === 'function' || typeof p.onConfigure === 'function';

      return `
        <div class="sp-card">
          <div class="sp-card-main">
            <div class="sp-card-title-wrap">
              ${p.icon ? `<img class="sp-card-icon" src="${escapeHtml(p.icon)}" alt="" onerror="this.style.display='none'">` : ''}
              <div class="sp-card-name">${escapeHtml(p.name || p.id)}</div>
              ${p.version ? `<div class="sp-card-version">v${escapeHtml(p.version)}</div>` : ''}
            </div>
            <div class="sp-card-desc">${escapeHtml(p.description || '')}</div>
          </div>
          <div class="sp-card-actions">
            ${isHack
              ? `<button class="sp-open-btn" type="button" data-plugin-open="${escapeHtml(p.id)}">Open</button>`
              : `
                ${hasSettings
                  ? `<button class="sp-icon-btn" type="button" data-plugin-settings="${escapeHtml(p.id)}" title="Settings">
                       <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 0 1 18.89 7.1l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.46.51.8.51H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.49z"/></svg>
                     </button>`
                  : `<button class="sp-icon-btn" type="button" data-plugin-info="${escapeHtml(p.id)}" title="Info">
                       <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                     </button>`
                }
                <button class="sp-toggle${on ? ' on' : ''}" type="button" data-pid="${escapeHtml(p.id)}" aria-pressed="${on}">
                  <span class="sp-toggle-knob" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                </button>`
            }
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderSettings() {
    const el     = document.getElementById('sp-panel');
    const hacksEl = document.getElementById('sp-hacks-panel');
    if (el)     { el.innerHTML     = renderCards('plugin'); bindPanel(el); }
    if (hacksEl) { hacksEl.innerHTML = renderCards('hack');   bindPanel(hacksEl); }
  }

  function bindPanel(el) {
    el.querySelectorAll('[data-pid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id     = btn.dataset.pid;
        const plugin = registry.find(p => p.id === id);
        if (!plugin) return;
        enabled[id] = !enabled[id]; save();
        if (enabled[id]) runEnable(plugin); else runDisable(plugin);
        renderSettings();
      });
    });
    el.querySelectorAll('[data-plugin-info]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plugin = registry.find(p => p.id === btn.dataset.pluginInfo);
        if (plugin) showInfo(plugin);
      });
    });
    el.querySelectorAll('[data-plugin-settings], [data-plugin-open]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id     = btn.dataset.pluginSettings || btn.dataset.pluginOpen;
        const plugin = registry.find(p => p.id === id);
        if (plugin) openTool(plugin);
      });
    });
  }

  // ───────────────────── MENU DOM ─────────────────────
  function initHackMenuDOM() {
    if (menuContainer) return;

    // ── Minimized floating button ──
    minimizedBtn = document.createElement('div');
    minimizedBtn.id = 'sienna-minimized';
    minimizedBtn.setAttribute('role', 'button');
    minimizedBtn.setAttribute('aria-label', 'Open Starfall Menu');
    minimizedBtn.innerHTML = `
      <svg id="sienna-mini-star" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>
      <div id="sienna-active-badge"></div>
    `;
    document.body.appendChild(minimizedBtn);
    makeMinimizedDraggable(minimizedBtn);

    // ── Main menu ──
    menuContainer = document.createElement('div');
    menuContainer.id = 'sienna-menu';
    menuContainer.setAttribute('role', 'dialog');
    menuContainer.setAttribute('aria-label', 'Starfall Menu');
    menuContainer.innerHTML = `
      <div class="sienna-title-bar" id="sienna-drag-handle">
        <span class="sienna-title">starfall menu</span>
        <div class="sienna-top-actions">
          <button class="sienna-icon-btn" id="sienna-minimize-btn" title="Minimize  [Insert]">
            <svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
          </button>
          <button class="sienna-icon-btn" id="sienna-close-btn" title="Close  [Esc]">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="sienna-search-wrap">
        <input class="sienna-search" id="sienna-search" type="text" placeholder="Search mods…" autocomplete="off" spellcheck="false">
      </div>
      <div class="sienna-body">
        <div class="sienna-content" id="sienna-content"></div>
      </div>
      <div class="sienna-footer">
        <span class="sienna-footer-text">made by yellowdevelopment</span>
        <span class="sienna-footer-dot">•</span>
        <div class="sienna-footer-links">
          <a href="https://yellowdevelopment.vercel.app" target="_blank" rel="noopener">yellowdevelopment.vercel.app</a>
          <span class="sienna-footer-dot">·</span>
          <a href="https://usesienna.vercel.app" target="_blank" rel="noopener">usesienna.vercel.app</a>
        </div>
      </div>
    `;
    document.body.appendChild(menuContainer);

    document.getElementById('sienna-close-btn').onclick    = closeHackMenu;
    document.getElementById('sienna-minimize-btn').onclick = minimizeHackMenu;

    document.getElementById('sienna-search').addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      filterHackItems();
    });

    makeDraggable(menuContainer, document.getElementById('sienna-drag-handle'));

    // Toggle hacks via event delegation — avoids re-rendering the whole list
    document.getElementById('sienna-content').addEventListener('click', e => {
      const btn = e.target.closest('.sienna-run-btn');
      if (!btn) return;

      const gid  = btn.dataset.gameId;
      const hid  = btn.dataset.hackToggle;
      const game = registry.find(g => g.id === gid);
      if (!game) return;

      const hack = getHackItems(game).find(h => h._id === hid);
      if (!hack) return;

      if (!hackStates[gid]) hackStates[gid] = {};
      hackStates[gid][hid] = !hackStates[gid][hid];
      saveHackStates();

      const on = hackStates[gid][hid];
      try { on ? hack.onEnable?.() : hack.onDisable?.(); } catch (err) { console.error(err); }

      // Update button in-place — no full re-render needed
      btn.textContent = on ? 'Active' : 'Run';
      btn.classList.toggle('active', on);
      updateBadge();
    });

    // ── Storage value editors (dropdown / number) ──
    // Delegated on the container so re-renders don't lose listeners.
    const contentEl = document.getElementById('sienna-content');

    function commitStorageValue(el) {
      const key = el?.dataset?.storageKey;
      if (!key) return;

      let value = el.value;

      if (el.type === 'number') {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n)) return;
        value = String(n);
        if (el.value !== value) el.value = value;
      }

      const ok = writeStoredValue(key, value);

      el.classList.add('s-flash');
      setTimeout(() => el.classList.remove('s-flash'), 420);

      if (ok) {
        const label = el.dataset.label || key;
        showSavedToast(`Saved ${label} = ${value}`);
      } else {
        showSavedToast('Could not save');
      }
    }

    // 'change' fires for both select + number input on commit
    contentEl.addEventListener('change', e => {
      const el = e.target.closest('[data-storage-key]');
      if (el) commitStorageValue(el);
    });

    // 'input' covers browsers that emit input before change for <select>,
    // and also gives live feedback while typing numbers.
    contentEl.addEventListener('input', e => {
      const el = e.target.closest('[data-storage-key]');
      if (!el) return;
      // Only auto-save on 'input' for selects (numbers wait for change/blur)
      if (el.tagName === 'SELECT') commitStorageValue(el);
    });

    // Also commit number inputs on blur so a typed value saves even if the
    // user clicks away without pressing Enter.
    contentEl.addEventListener('blur', e => {
      const el = e.target.closest?.('[data-storage-key]');
      if (el && el.type === 'number') commitStorageValue(el);
    }, true);
  }

  // ───────────────────── DRAG ─────────────────────
  function makeDraggable(el, handle) {
    let drag = false, sx = 0, sy = 0, il = 0, it = 0;

    handle.addEventListener('mousedown', e => {
      if (e.target.closest('a, button, input, select')) return;
      drag = true;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      il = r.left; it = r.top;
      el.style.left      = il + 'px';
      el.style.top       = it + 'px';
      el.style.transform = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!drag) return;
      el.style.left = clamp(il + e.clientX - sx, 0, window.innerWidth  - el.offsetWidth)  + 'px';
      el.style.top  = clamp(it + e.clientY - sy, 0, window.innerHeight - el.offsetHeight) + 'px';
    });

    document.addEventListener('mouseup', () => { drag = false; });
  }

  function makeMinimizedDraggable(el) {
    let drag = false, moved = false, sx = 0, sy = 0, il = 0, it = 0;

    el.addEventListener('mousedown', e => {
      drag = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      il = r.left; it = r.top;
      // Switch from bottom/right anchor to explicit left/top
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
      el.style.left   = il + 'px';
      el.style.top    = it + 'px';
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      el.style.left = clamp(il + dx, 0, window.innerWidth  - el.offsetWidth)  + 'px';
      el.style.top  = clamp(it + dy, 0, window.innerHeight - el.offsetHeight) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (drag && !moved) restoreHackMenu();  // click = restore
      drag = false;
    });
  }

  // ───────────────────── MENU CONTROLS ─────────────────────
  function openHackMenu() {
    initHackMenuDOM();
    if (minimizedBtn) minimizedBtn.classList.remove('s-show');
    renderHackMenu();
    menuContainer.classList.add('open');
    // Clear search on a fresh open
    const searchEl = document.getElementById('sienna-search');
    if (searchEl) { searchEl.value = ''; searchQuery = ''; }
  }

  function closeHackMenu() {
    if (!menuContainer) return;
    menuContainer.classList.remove('open');
    // Close does NOT show the minimized button — that's only for Minimize
  }

  function minimizeHackMenu() {
    if (!menuContainer) return;
    menuContainer.classList.remove('open');
    minimizedBtn.classList.add('s-show');
    updateBadge();
  }

  function restoreHackMenu() {
    if (!minimizedBtn || !menuContainer) return;
    minimizedBtn.classList.remove('s-show');
    menuContainer.classList.add('open');
  }

  // ───────────────────── MENU RENDER ─────────────────────
  // Builds the inline control for storage-editor hacks (dropdown / number input)
  function renderValueControl(h, game) {
    const c   = h.control || {};
    const key = c.key;
    if (!key) return '';

    const currentRaw = readStoredValue(key);
    const attrs =
      `data-storage-key="${escapeHtml(key)}" ` +
      `data-storage-game="${escapeHtml(game.id)}" ` +
      `data-storage-hack="${escapeHtml(h._id)}" ` +
      `data-label="${escapeHtml(c.label || key)}"`;

    if (c.type === 'select') {
      const min = Number.isFinite(c.min) ? c.min : 1;
      const max = Number.isFinite(c.max) ? c.max : 50;
      const cur = parseInt(currentRaw, 10);
      const hasCur = Number.isFinite(cur);

      let opts = '';
      // Keep an out-of-range saved value selectable instead of silently losing it
      if (hasCur && (cur < min || cur > max))
        opts += `<option value="${cur}" selected>${cur}</option>`;

      for (let i = min; i <= max; i++)
        opts += `<option value="${i}"${hasCur && i === cur ? ' selected' : ''}>${i}</option>`;

      return `<div class="sienna-value-wrap">
          <select class="sienna-value-select" ${attrs} title="${escapeHtml(c.label || 'Value')}">${opts}</select>
          <svg class="sienna-value-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
        </div>`;
    }

    const min = Number.isFinite(c.min) ? c.min : 0;
    const max = Number.isFinite(c.max) ? c.max : 999999;
    const val = currentRaw == null ? '' : escapeHtml(currentRaw);

    return `<input class="sienna-value-input" type="number" ${attrs}
              min="${min}" max="${max}" step="1" value="${val}"
              placeholder="${escapeHtml(c.placeholder || '—')}"
              title="${escapeHtml(c.label || 'Value')}">`;
  }

  function renderHackMenu() {
    if (!menuContainer) return;
    const content = document.getElementById('sienna-content');
    const hacks   = registry.filter(p => p.kind === 'hack' && p.id !== 'sienna-hack-ui');

    if (!hacks.length) {
      content.innerHTML = `<div class="sienna-empty">No mods installed.</div>`;
      return;
    }

    let html = '';
    hacks.forEach(game => {
      const states = hackStates[game.id] || {};
      getHackItems(game).forEach(h => {
        const on    = !!states[h._id];
        const title = h.name || game.name;
        const desc  = h.desc || game.description || 'Toggle to activate';

        const control = h.control
          ? renderValueControl(h, game)
          : `<button class="sienna-run-btn${on ? ' active' : ''}"
                     data-game-id="${escapeHtml(game.id)}"
                     data-hack-toggle="${escapeHtml(h._id)}">
               ${on ? 'Active' : 'Run'}
             </button>`;

        html += `
          <div class="sienna-hack-item" data-st="${escapeHtml(title.toLowerCase())}" data-sd="${escapeHtml(desc.toLowerCase())}">
            <div class="sienna-hack-info">
              <div class="sienna-hack-title">${escapeHtml(title)}</div>
              <div class="sienna-hack-desc">${escapeHtml(desc)}</div>
            </div>
            ${control}
          </div>`;
      });
    });

    html += `<div class="sienna-no-results" id="sienna-no-results">No results found.</div>`;
    content.innerHTML = html;

    if (searchQuery) filterHackItems();
  }

  function filterHackItems() {
    if (!menuContainer) return;
    const items     = document.querySelectorAll('#sienna-content .sienna-hack-item');
    const noResults = document.getElementById('sienna-no-results');
    let visible     = 0;

    items.forEach(item => {
      const show = !searchQuery
        || item.dataset.st?.includes(searchQuery)
        || item.dataset.sd?.includes(searchQuery);
      item.classList.toggle('s-hide', !show);
      if (show) visible++;
    });

    noResults?.classList.toggle('s-show', visible === 0 && !!searchQuery);
  }

  // ───────────────────── KEYBOARD SHORTCUTS ─────────────────────
  // Added at module level so Insert works even before the menu is first opened
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menuContainer?.classList.contains('open')) {
      closeHackMenu();
    } else if (e.key === 'Insert') {
      if (menuContainer?.classList.contains('open'))    minimizeHackMenu();
      else if (minimizedBtn?.classList.contains('s-show')) restoreHackMenu();
      else                                               openHackMenu();
    }
  });

  // ───────────────────── PUBLIC API ─────────────────────
  window.SiennaPlugins = {
    register(plugin) {
      if (!plugin || typeof plugin !== 'object') return;
      const scriptKind = document.currentScript?.dataset?.siennaPluginKind;
      const kind       = plugin.kind || scriptKind || 'plugin';
      const id         = slugId(plugin.id || plugin.name);

      const normalized = {
        ...plugin, id,
        kind:  kind === 'hack' ? 'hack' : 'plugin',
        hacks: Array.isArray(plugin.hacks) ? plugin.hacks : []
      };

      if (registry.find(p => p.id === normalized.id)) return;
      registry.push(normalized);
      if (normalized.kind === 'plugin' && enabled[normalized.id]) runEnable(normalized);
      renderSettings();
    },

    registerHack(config) { this.register({ ...config, kind: 'hack' }); },

    isEnabled(id) { return !!enabled[id]; },
    isHackEnabled(gameId, hackId) {
      // FIX: use optional chaining to avoid TypeError when gameId has no state yet
      return !!(hackStates[slugId(gameId)]?.[slugId(hackId)]);
    },

    renderPluginsPanel()     { return `<div id="sp-panel" class="sp-panel">${renderCards('plugin')}</div>`; },
    renderHacksPanel()       { return `<div id="sp-hacks-panel" class="sp-panel">${renderCards('hack')}</div>`; },
    renderSettingsSection(i = 0) {
      return `<section class="settings-section" data-section-name="Plugins" style="--section-index:${i}">
        <div class="settings-section-title">Plugins</div>
        <div class="settings-section-body">${this.renderPluginsPanel()}</div>
      </section>`;
    },
    getSettingsSectionNames() { return ['Plugins']; },
    hydrateSettingsPanel()    { renderSettings(); },

    // Programmatic menu controls
    openMenu()     { openHackMenu(); },
    closeMenu()    { closeHackMenu(); },
    minimizeMenu() { minimizeHackMenu(); },
  };

  // ───────────────────── INIT ─────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  if (!registry.find(p => p.id === 'sienna-hack-ui')) {
    registry.push({
      id:          'sienna-hack-ui',
      name:        'Mod Menu',
      description: 'All installed mods in one panel.',
      kind:        'hack'
    });
  }

  if (!registry.find(p => p.id === 'cubefield')) {
    registry.push({
      id:          'cubefield',
      name:        'Cubefield',
      description: 'Edit your saved cubefield score.',
      kind:        'hack',
      hacks: [{
        id:   'cubefield-score',
        name: 'Cubefield',
        desc: 'Change the saved cubefield score.',
        control: { type: 'number', key: 'cubefieldscore', min: 0, max: 999999, label: 'Score' }
      }]
    });
  }

  const MANAGER_SCRIPT_SRC = document.currentScript?.src || window.location.href;

  function loadManagedScript(file, kind) {
    if (!file) return;
    const src = new URL(file, MANAGER_SCRIPT_SRC).href;
    if (Array.from(document.scripts).some(s => s.src === src)) return;
    const script = document.createElement('script');
    script.src                         = src;
    script.async                       = false;
    script.dataset.siennaManagedScript = 'true';
    script.dataset.siennaPluginKind    = kind;
    script.onerror = () => console.error(`[Sienna] Failed to load ${kind}: ${file}`);
    document.body.appendChild(script);
  }

  function loadScripts() {
    HACK_FILES.forEach(f => loadManagedScript(f, 'hack'));
  }

  if (document.body) loadScripts();
  else document.addEventListener('DOMContentLoaded', loadScripts);

})();