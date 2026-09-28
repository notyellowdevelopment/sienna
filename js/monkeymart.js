(function () {
  'use strict';

  const CONFIG_KEY = 'monkeymart_config';
  const COINS_KEY = 'coins';
  let panelElement = null;
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;

  function waitForSienna() {
    if (!window.SiennaPlugins) {
      setTimeout(waitForSienna, 100);
      return;
    }
    registerPlugin();
  }
  waitForSienna();

  // ---------- Storage ----------
  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (raw && raw !== 'undefined') return JSON.parse(raw);
    } catch {}
    return { coins: 0 };
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  }

  function getCoins() {
    const config = getConfig();
    return typeof config[COINS_KEY] === 'number' ? config[COINS_KEY] : 0;
  }

  function setCoins(amount) {
    if (!Number.isFinite(amount) || amount < 0) return false;
    const config = getConfig();
    config[COINS_KEY] = Math.floor(amount);
    return saveConfig(config);
  }

  // ---------- Draggable floating panel ----------
  function createPanel() {
    removePanel();

    const panel = document.createElement('div');
    panel.id = 'mm-coin-panel';
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '340px',                                                          // unchanged
      maxWidth: 'calc(100vw - 40px)',                                          // unchanged
      background: '#050505',                                                   // CHANGED: #000000 → #050505 (slight warmth for depth)
      borderRadius: '10px',                                                    // CHANGED: 12px → 10px (crisper)
      border: '1px solid #1c1c1c',                                             // CHANGED: #2a2a2a → #1c1c1c (subtler border)
      boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(255,255,255,0.04)', // CHANGED: more depth + a hairline inner glow
      zIndex: '10000',
      fontFamily: "'Inter', system-ui, sans-serif",                            // unchanged
      cursor: 'grab',
      overflow: 'hidden'
    });

    // Header (draggable)
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '11px 16px',          // CHANGED: 12px 16px → 11px 16px (tighter top/bottom)
      background: '#000000',         // CHANGED: #0a0a0a → #000000 (pure black header)
      borderBottom: '1px solid #161616', // CHANGED: #1f1f1f → #161616 (more recessive)
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'grab'
    });

    const headerLeft = document.createElement('div');
    headerLeft.className = 'mm-header-left';
    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.gap = '8px';
    headerLeft.innerHTML = `<span style="font-weight: 500; font-size: 13px; letter-spacing: 0.02em; color: #ffffff;">Monkey Mart Coin Editor</span>`;
    // CHANGED: #d0d0d0 → #ffffff (full white — visible against black header)

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'transparent',     // unchanged
      border: 'none',                // unchanged
      color: '#777777',              // CHANGED: #3f3f3f → #777777 (visible, not invisible)
      fontSize: '15px',              // CHANGED: 18px → 15px (proportional to smaller panel text)
      cursor: 'pointer',
      width: '26px',                 // CHANGED: 28px → 26px (tighter)
      height: '26px',                // CHANGED: 28px → 26px
      borderRadius: '4px',           // CHANGED: 6px → 4px (squarer)
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Content area
    const content = document.createElement('div');
    Object.assign(content.style, {
      padding: '16px',               // unchanged
      cursor: 'auto'
    });

    const current = getCoins();

    // Current balance
    const balanceDiv = document.createElement('div');
    Object.assign(balanceDiv.style, {
      marginBottom: '14px',          // CHANGED: 16px → 14px (tighter)
      padding: '14px 0',             // CHANGED: 12px 0 → 14px 0 (slightly more breathing room)
      borderBottom: '1px solid #161616' // CHANGED: #1f1f1f → #161616
    });
    balanceDiv.innerHTML = `
      <div style="font-size: 10px; color: #666666; letter-spacing: 0.8px; margin-bottom: 8px; font-weight: 500; text-transform: uppercase;">Balance</div>
      <div id="mm-balance" style="font-size: 36px; font-weight: 300; color: #ffffff; line-height: 1; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace; letter-spacing: -0.5px;">${current}</div>
    `;
    // CHANGED label: "CURRENT" → "Balance", size 11px→10px, color #666→#3a3a3a, letter-spacing 0.5px→0.8px, marginBottom 6px→8px, added font-weight+text-transform
    // CHANGED number: size 32px→36px, weight 500→300 (lighter/more elegant), ADDED monospace font family (signature design choice — data/terminal feel), letter-spacing -0.5px
    content.appendChild(balanceDiv);

    // Input row
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
      marginBottom: '10px',          // CHANGED: 16px → 10px (tighter rhythm)
      display: 'flex',
      gap: '8px'                     // CHANGED: 10px → 8px
    });
    inputRow.innerHTML = `
      <input id="mm-input" type="number" min="0" value="${current}" style="
        flex: 1;
        background: #000000;
        border: 1px solid #1c1c1c;
        border-radius: 6px;
        padding: 10px 12px;
        color: #fff;
        font-size: 14px;
        outline: none;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
      ">
      <button id="mm-set" style="
        background: #ffffff;
        border: 1px solid #ffffff;
        border-radius: 6px;
        padding: 0 20px;
        color: #000000;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        letter-spacing: 0.02em;
      ">Set</button>
    `;
    // CHANGED input: bg #0a0a0a→#000000, border #2a2a2a→#1c1c1c, radius 8px→6px, ADDED monospace font
    // CHANGED Set button: bg #2a2a2a→#ffffff (INVERTED — primary action pops white), border match, color #fff→#000, radius 8px→6px, ADDED font-size + letter-spacing
    content.appendChild(inputRow);

    // Quick buttons row
    const quickRow = document.createElement('div');
    Object.assign(quickRow.style, {
      marginBottom: '10px',          // CHANGED: 16px → 10px
      display: 'flex',
      gap: '6px'                     // CHANGED: 10px → 6px (tighter grid)
    });
    const increments = [1000, 5000, 10000, 50000];
    quickRow.innerHTML = increments.map(v => `
      <button class="mm-quick" data-val="${v}" style="
        flex: 1;
        background: #000000;
        border: 1px solid #1c1c1c;
        border-radius: 6px;
        padding: 9px 0;
        color: #cccccc;
        font-size: 11px;
        cursor: pointer;
        font-weight: 500;
        letter-spacing: 0.03em;
      ">+${v >= 10000 ? (v/1000)+'k' : v}</button>
    `).join('');
    // CHANGED: bg #0a0a0a→#000000, border #2a2a2a→#1c1c1c, radius 8px→6px, color #ddd→#555555 (quieter), padding 8px→9px, ADDED font-weight + letter-spacing
    content.appendChild(quickRow);

    // Reset button
    const resetRow = document.createElement('div');
    resetRow.style.marginBottom = '14px'; // CHANGED: 12px → 14px (more space before footer)
    resetRow.innerHTML = `
      <button id="mm-reset" style="
        width: 100%;
        background: transparent;
        border: 1px solid #3d2020;
        border-radius: 6px;
        padding: 9px 0;
        color: #cc5555;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        letter-spacing: 0.03em;
      ">Reset to 0</button>
    `;
    // CHANGED: bg #1a0f0f→transparent (no fill, just a faint danger border), border #3a2020→#2a1515, color #ffaaaa→#4a2020 (darker, less alarming), radius 8px→6px, label "Reset balance (0)"→"Reset to 0", ADDED letter-spacing
    content.appendChild(resetRow);

    // Footer
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      padding: '10px 0 0 0',         // CHANGED: 8px → 10px (more separation)
      fontSize: '9px',               // unchanged
      color: '#555555',              // CHANGED: #2a2a2a → #555555 (actually readable)
      borderTop: '1px solid #161616', // CHANGED: #1f1f1f → #161616
      textAlign: 'center',
      letterSpacing: '0.4px'         // ADDED: a touch of tracking on the micro text
    });
    footer.textContent = 'Monkey Mart Hack provided by yellowdevelopment';
    content.appendChild(footer);

    panel.appendChild(content);
    document.body.appendChild(panel);
    panelElement = panel;

    // DOM references
    const setBtn = panel.querySelector('#mm-set');
    const resetBtn = panel.querySelector('#mm-reset');
    const input = panel.querySelector('#mm-input');
    const balanceSpan = panel.querySelector('#mm-balance');
    const quickBtns = panel.querySelectorAll('.mm-quick');

    // Update coins and notify with toast
    function updateCoinsAndNotify(newVal) {
      if (setCoins(newVal)) {
        balanceSpan.textContent = newVal;
        input.value = newVal;
        // Badge replaced by inline toast message
        const t = document.createElement('div');
        t.textContent = `✓ Changes should be applied`; // CHANGED: was "✓ Coins set to ${newVal}"
        Object.assign(t.style, {
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#050505',         // CHANGED: #111 → #050505
          border: '1px solid #1c1c1c',   // CHANGED: #2a2a2a → #1c1c1c
          borderRadius: '20px',          // unchanged
          padding: '7px 16px',           // CHANGED: 6px 14px → 7px 16px (slightly more generous)
          fontSize: '12px',
          color: '#4ade80',              // CHANGED: #aaffaa → #4ade80 (proper green, not washed out)
          zIndex: '10001',
          fontFamily: "'Inter', system-ui, sans-serif", // ADDED: explicit font match
          letterSpacing: '0.02em'        // ADDED
        });
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
      } else {
        const t = document.createElement('div');
        t.textContent = '✗ Save failed';
        Object.assign(t.style, {
          position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#050505',         // CHANGED: #111 → #050505
          border: '1px solid #2a1515',   // CHANGED: #3a2020 → #2a1515
          borderRadius: '20px',          // unchanged
          padding: '7px 16px',           // CHANGED: 6px 14px → 7px 16px
          fontSize: '12px',
          color: '#f87171',              // CHANGED: #ff8888 → #f87171 (proper red, less neon)
          zIndex: '10001',
          fontFamily: "'Inter', system-ui, sans-serif", // ADDED
          letterSpacing: '0.02em'        // ADDED
        });
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 2000);
      }
    }

    // Event handlers
    setBtn.onclick = () => {
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 0) val = 0;
      updateCoinsAndNotify(val);
    };
    resetBtn.onclick = () => {
      updateCoinsAndNotify(0);
    };
    input.onkeypress = (e) => { if (e.key === 'Enter') setBtn.click(); };
    quickBtns.forEach(btn => {
      btn.onclick = () => {
        const add = parseInt(btn.dataset.val, 10);
        updateCoinsAndNotify(getCoins() + add);
      };
    });
    closeBtn.onclick = removePanel;

    // Dragging functionality
    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn) return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      let left = e.clientX - dragOffsetX;
      let top = e.clientY - dragOffsetY;
      left = Math.min(window.innerWidth - panel.offsetWidth - 10, Math.max(10, left));
      top = Math.min(window.innerHeight - panel.offsetHeight - 10, Math.max(10, top));
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        panel.style.cursor = 'grab';
      }
    });
  }

  function removePanel() {
    if (panelElement) {
      panelElement.remove();
      panelElement = null;
    }
  }

  function registerPlugin() {
    window.SiennaPlugins.register({
      name: 'Monkey Mart Coin Editor',
      id: 'monkeymart-coin-editor',
      description: 'Easy Monkey Mart coin editor hack menu',
      version: '1',
      onEnable() { createPanel(); },
      onDisable() { removePanel(); },
      onSettings() { if (!panelElement) createPanel(); }
    });
  }
})();