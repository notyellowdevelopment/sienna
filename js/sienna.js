(function () {
  const SIENNA_VERSION = "1.2.0";
  const SIENNA_BUILD = "24";
  const CLASSIC_LOGO = String.raw`           /$$
          |__/
  /$$$$$$$ /$$  /$$$$$$  /$$$$$$$  /$$$$$$$   /$$$$$$
 /$$_____/| $$ /$$__  $$| $$__  $$| $$__  $$ |____  $$
|  $$$$$$ | $$| $$$$$$$$| $$  \ $$| $$  \ $$  /$$$$$$$
 \____  $$| $$| $$_____/| $$  | $$| $$  | $$ /$$__  $$
 /$$$$$$$/| $$|  $$$$$$$| $$  | $$| $$  | $$|  $$$$$$$ /$$
|_______/ |__/ \_______/|__/  |__/|__/  |__/ \_______/|__/`;
  // ── Single source of truth: storage keys + shared constants ──
  // Declared once; referenced everywhere else by name (save.js, night.js,
  // plugins.js). Rename or audit a key/constant here rather than across files.
  window.SiennaStorageKeys = Object.freeze({
    // Settings
    reduceMotion: 'sienna_reduce_motion',
    gridColumns: 'sienna_grid_columns',
    legacyLibrary: 'sienna_legacy_library',
    classicLogo: 'sienna_classic_logo',
    rememberTabs: 'sienna_remember_tabs',
    cloakMethod: 'sienna_cloak_method',
    autoOpen: 'sienna_auto_open',
    gamesProvider: 'sienna_games_provider',
    themeId: 'sienna_theme_id',
    bubblesEnabled: 'sienna_bubbles_enabled',
    tabCloak: 'sienna_tab_cloak',
    tabCloakCustomTitle: 'sienna_tab_cloak_custom_title',
    tabCloakCustomFavicon: 'sienna_tab_cloak_custom_favicon',
    updatesSeen: 'sienna_updates_seen_v1_01_02',
    tutorialSeen: 'sienna_tutorial_seen',
    // Games
    customGames: 'sienna_custom_games',
    favorites: 'sienna_favs',
    // Appearance
    customThemes: 'sienna_custom_themes',
    profilePicture: 'sienna_pfp',
    // Account
    token: 'sienna_token',
    username: 'sienna_username',
    lastSyncAt: 'sienna_last_sync_at',
    lastSyncHash: 'sienna_last_sync_hash',
    // Game window tabs
    gameVisorTabs: 'gameVisorTabs',
    gameVisorActiveTabId: 'gameVisorActiveTabId',
    // Plugins
    pluginsEnabled: 'plugins.enabled',
    hackStates: 'sienna.hackStates',
  });

  window.SiennaConstants = Object.freeze({
    PROVIDERS: Object.freeze(['night', 'Lumin', 'gn-math', 'ugs', 'seraph', 'ckv']),
    PROVIDER_OPTIONS: Object.freeze(['night', 'gn-math', 'ugs', 'seraph', 'ckv', 'Lumin']),
    CLOAK_METHODS: Object.freeze(['about:blank', 'blob:null']),
    GRID_COLUMN_OPTIONS: Object.freeze(['3', '4', '5', '6', '7']),
    DEFAULT_PROVIDER: 'night',
    DEFAULT_CLOAK_METHOD: 'about:blank',
    ICONS_BASE: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@latest/icons/',
  });

  const KEYS = window.SiennaStorageKeys;
  const CONST = window.SiennaConstants;

  // persistToggle() is shared by the boolean settings below: normalise the
  // value, persist it, then re-apply. `reRender` refreshes the settings panel
  // for options that visibly affect it (grid / legacy view).
  function persistToggle(stateProp, key, value, reRender) {
    const bool = Boolean(value);
    window.siennaSettings.state[stateProp] = bool;
    storage.set(key, String(bool));
    window.siennaSettings.apply();
    if (reRender) window.siennaSettings.renderPanel();
  }

  const storage = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (error) {
        return fallback;
      }
    },
    getBoolean(key, fallback) {
      const value = this.get(key, null);
      return value === null ? fallback : value === 'true';
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        // Storage can be unavailable in private or embedded contexts.
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Storage can be unavailable in private or embedded contexts.
      }
    },
  };

  window.siennaSettings = {
    tabCloakPresets:[
      { previewTitle:"Default", realTitle:"sienna.", favicon:"favicon.ico" },
      { previewTitle:"Google", realTitle:"Google", favicon: CONST.ICONS_BASE + "favicons/google.ico" },
      { previewTitle:"Schoology", realTitle:"Home | Schoology", favicon: CONST.ICONS_BASE + "favicons/schoology.ico" },
      { previewTitle:"Canvas", realTitle:"Dashboard", favicon: CONST.ICONS_BASE + "favicons/canvas.ico" },
      { previewTitle:"Khan Academy", realTitle:"Dashboard | Khan Academy", favicon: CONST.ICONS_BASE + "favicons/khan.ico" },
      { previewTitle:"CodeHS", realTitle:"Sections | CodeHS", favicon: CONST.ICONS_BASE + "favicons/codehs.ico" },
      { previewTitle:"CodeHS Sandbox", realTitle:"Sandbox | CodeHS", favicon: CONST.ICONS_BASE + "favicons/codehs.ico" },
      { previewTitle:"Classlink", realTitle:"My Apps", favicon: CONST.ICONS_BASE + "favicons/classlink.ico" },
      { previewTitle:"Gmail", realTitle:"Inbox", favicon: CONST.ICONS_BASE + "favicons/gmail.ico" },
      { previewTitle:"Google Classroom", realTitle:"Home - Classroom", favicon: CONST.ICONS_BASE + "favicons/googleclassroom.ico" },
      { previewTitle:"Google Drive", realTitle:"My Drive", favicon: CONST.ICONS_BASE + "favicons/googledrive.ico" },
      { previewTitle:"Google Docs", realTitle:"Google Docs", favicon: CONST.ICONS_BASE + "favicons/googledocs.ico" },
      { previewTitle:"Google Forms", realTitle:"Google Forms", favicon: CONST.ICONS_BASE + "favicons/googleforms.ico" },
      { previewTitle:"Google Forms Lock Down Mode", realTitle:"Start your quiz", favicon: CONST.ICONS_BASE + "favicons/googleforms.ico" },
      { previewTitle:"Google Slides", realTitle:"Google Slides", favicon: CONST.ICONS_BASE + "favicons/googleslides.ico" },
      { previewTitle:"Google Sites", realTitle:"Google Sites", favicon: CONST.ICONS_BASE + "favicons/googlesites.ico" },
      { previewTitle:"Home Access Center", realTitle:"Home View Summary", favicon: CONST.ICONS_BASE + "favicons/hac.ico" },
      { previewTitle:"IXL", realTitle:"IXL | Math, Language Arts, Social Studies, and Spanish", favicon: CONST.ICONS_BASE + "favicons/ixl.ico" },
      { previewTitle:"i-Ready Math", realTitle:"Math To Do, i-Ready", favicon: CONST.ICONS_BASE + "favicons/iready.ico" },
      { previewTitle:"i-Ready Reading", realTitle:"Reading To Do, i-Ready", favicon: CONST.ICONS_BASE + "favicons/iready.ico" },
      { previewTitle:"Eduphoria", realTitle:"Eduphoria! Login", favicon: CONST.ICONS_BASE + "favicons/eduphoria.ico" },
      { previewTitle:"McGraw Hill", realTitle:"McGraw Hill Professional | Textbooks | Interactive Learning Solutions", favicon: CONST.ICONS_BASE + "favicons/mcgrawhill.ico" },
    ],

    state: {
      reduceMotion: false,
      gridColumns: "5",
      legacyLibrary: false,
      classicLogo: false,
      rememberTabs: true,
      cloakMethod: CONST.DEFAULT_CLOAK_METHOD,
      autoOpen: "Disabled",
      gamesProvider: CONST.DEFAULT_PROVIDER,
      activeThemeId: "none",
      bubblesEnabled: true,
      tabCloakId: "Default",
      tabCloakCustomTitle: "",
      tabCloakCustomFavicon: "",
      settingsActiveSection: "",
    },

    // Add or edit update cards here. Change storageKey when you want everyone to
    // see the panel again after a new release.
    updates: {
      storageKey: KEYS.updatesSeen1,
      showOnFirstVisit: true,
      previousLogsUrl: "updatelogs.json",
      title: "What's new",
      version: "v1.2",
      sections: [
        {
          title: "Added 3 new providers",
          description: "Added ugs (Ultimate Game Stash), Seraph, and ChickenKingsVault (ckv) integrated into the original layout",
        },
        {
          title: "Note:",
          description: "Due to vercel's edge transfers limit, I'm now delivering night. through jsdelivr which could cause slower loading times",
        },
      ],
    },

    showingPreviousUpdateLogs: false,
    previousUpdateLogIndex: 0,
    updateLogHistory: {
      loaded: false,
      loading: false,
      error: "",
      entries: [],
    },

    themes:[
      { id: 'sienna-blue', label: 'Legacy Deep Sea Blue', variant: 'gradient' },
      { id: 'Astray', label: 'Astray', url: 'backgrounds/astray.webp' },
      { id: 'Invain', label: 'Invain', url: 'backgrounds/invain.webp' },
      { id: 'Isolated', label: 'Isolated', url: 'backgrounds/isolated.webp' },
      { id: 'backrooms', label: 'Backrooms', url: 'backgrounds/backrooms.webp' },
      { id: 'interstellar', label: 'Interstellar', url: 'backgrounds/interstellar.webp' },
      { id: 'projecthailmary', label: 'Project Hail Mary', url: 'backgrounds/projecthailmary.webp' },
      { id: 'tqq', label: 'The Quintessential Quintuplets', url: 'backgrounds/tqq.webp' },
      { id: 'terraria', label: 'Terraria', url: 'backgrounds/terraria.png' },
      { id: 'hollowknight', label: 'Hollow Knight', url: 'backgrounds/hollowknight.webp' },
      { id: 'hollowknightsilksong', label: 'Hollow Knight: Silksong', url: 'backgrounds/hollowknightsilksong.webp' },
      { id: 'meaning', label: 'Meaning', url: 'backgrounds/meaning.webp' },
      { id: 'underthestarrysky', label: 'Under the Starry Sky', url: 'backgrounds/underthestarrysky.webp' },
      { id: 'walkbythebeach', label: 'Walk by the Beach', url: 'backgrounds/walkbythebeach.webp' },
      { id: 'minecraftforest', label: 'Minecraft Forest', url: 'backgrounds/minecraftforest.webp' },
      { id: 'sakuracherrybiome', label: 'Sakura Biome', url: 'backgrounds/sakuracherrybiome.webp' },
      { id: 'cyberpunk', label: 'Cyberpunk', url: 'backgrounds/cyberpunk.gif' },
      { id: 'かえりみち', label: 'かえりみち', url: 'backgrounds/かえりみち.webp' },
      { id: '心流', label: '心流', url: 'backgrounds/心流.webp' },
    ],

    registry:[
      {
        id: "gridColumns",
        section: "Display",
        label: "Cards per row",
        desc: "Default is 5. Choose a calmer or denser game grid.",
        type: "choice",
        options: CONST.GRID_COLUMN_OPTIONS,
        get: () => window.siennaSettings.state.gridColumns,
        set: (value) => {
          const next = CONST.GRID_COLUMN_OPTIONS.includes(value) ? value : "5";
          window.siennaSettings.state.gridColumns = next;
          storage.set(KEYS.gridColumns, next);
          window.siennaSettings.apply();
          window.siennaSettings.renderPanel();
        },
      },
      {
        id: "legacyLibrary",
        section: "Display",
        label: "Legacy cards view",
        desc: "Show the site as a full-screen game card library.",
        type: "toggle",
        get: () => window.siennaSettings.state.legacyLibrary,
        set: (value) => {
          persistToggle("legacyLibrary", KEYS.legacyLibrary, value, true);
        },
      },
      {
        id: "classicLogo",
        section: "Display",
        label: "Classic logo",
        desc: "Use the original ASCII sienna logo on the home screen.",
        type: "toggle",
        get: () => window.siennaSettings.state.classicLogo,
        set: (value) => {
          persistToggle("classicLogo", KEYS.classicLogo, value);
        },
      },
      {
        id: "reduceMotion",
        section: "Performance",
        label: "Reduce motion",
        desc: "Limit transitions across the site.",
        type: "toggle",
        get: () => window.siennaSettings.state.reduceMotion,
        set: (value) => {
          persistToggle("reduceMotion", KEYS.reduceMotion, value);
        },
      },
      {
        id: "bubblesEnabled",
        section: "Performance",
        label: "Background bubbles",
        desc: "Show floating bubbles on the home screen.",
        type: "toggle",
        get: () => window.siennaSettings.state.bubblesEnabled,
        set: (value) => {
          persistToggle("bubblesEnabled", KEYS.bubblesEnabled, value);
        },
      },
      {
        id: "gamesProvider",
        section: "Games",
        label: "Games provider",
        desc: "Choose different providers for games",

        type: "choice",
        options: CONST.PROVIDER_OPTIONS,
        get: () => window.siennaSettings.state.gamesProvider,
        set: (value) => {
          window.siennaSettings.setGamesProvider(value);
          window.siennaSettings.renderPanel();
        },

      },
      {
        id: "cloakMethod",
        section: "Cloaking",
        label: "Cloak method",
        desc: "Choose how games open from the external-open button.",
        type: "choice",
        options: CONST.CLOAK_METHODS,
        get: () => window.siennaSettings.state.cloakMethod,
        set: (value) => {
          window.siennaSettings.state.cloakMethod = value === "blob:null" ? "blob:null" : CONST.DEFAULT_CLOAK_METHOD;
          storage.set(KEYS.cloakMethod, window.siennaSettings.state.cloakMethod);
          window.siennaSettings.renderPanel();
        },
      },
      {
        id: "autoOpen",
        section: "Cloaking",
        label: "Auto open",
        desc: "Automatically open the site in a cloaked tab on load.",
        type: "select",
        options: ["Disabled", ...CONST.CLOAK_METHODS],
        get: () => window.siennaSettings.state.autoOpen,
        set: (value) => {
          window.siennaSettings.state.autoOpen = CONST.CLOAK_METHODS.includes(value) ? value : "Disabled";
          storage.set(KEYS.autoOpen, window.siennaSettings.state.autoOpen);
        },
      },
      {
        id: "openInCloak",
        section: "Cloaking",
        label: "Open site cloaked",
        desc: "Open the current page with the selected cloak method.",
        type: "action",
        buttonLabel: "Open",
        onClick: () => window.siennaSettings.handleCloak(window.location.href),
      },
      {
        id: "tabCloak",
        section: "Cloaking",
        label: "Tab cloak",
        desc: "Change the browser tab's title and favicon to disguise the page.",
        type: "tab-cloak-grid",
      },
      {
        id: "rememberTabs",
        section: "Game window",
        label: "Remember tabs",
        desc: "Keep minimized game tabs available after refresh.",
        type: "toggle",
        get: () => window.siennaSettings.state.rememberTabs,
        set: (value) => {
          persistToggle("rememberTabs", KEYS.rememberTabs, value);
          if (!value) {
            storage.remove(KEYS.gameVisorTabs);
            storage.remove(KEYS.gameVisorActiveTabId);
          }
        },
      },
      {
        id: "clearTabs",
        section: "Game window",
        label: "Clear saved tabs",
        desc: "Remove remembered game window tabs.",
        type: "action",
        buttonLabel: "Clear",
        onClick: () => {
          storage.remove(KEYS.gameVisorTabs);
          storage.remove(KEYS.gameVisorActiveTabId);
          if (window.gameVisor) {
            window.gameVisor.tabs =[];
            window.gameVisor.activeTabId = null;
            window.gameVisor.renderDock?.();
            // If settings is open, close the game visor entirely
            if (window.gameVisor.container?.classList.contains('open')) {
              window.gameVisor.close();
            }
          }
        },
      },
      {
        id: "themePicker",
        section: "Display",
        label: "Background theme",
        desc: "Default is black. Pick the classic Sienna blue or a background image.",
        type: "theme-grid",
      },
      {
        id: "accountProfile",
        section: "Account",
        label: "Account",
        desc: "Manage your cloud saves and account.",
        type: "account-profile",
      },
      {
        id: "dataManagement",
        section: "Account",
        label: "Download / Upload",
        desc: "Save your settings, game progress, and themes to a file, with optional encryption during download.",
        type: "data-actions",
      },
      {
        id: "wipeConfig",
        section: "Account",
        label: "Wipe config",
        desc: "Reset the website to stock settings. This cannot be undone!",
        type: "action",
        buttonLabel: "Wipe config",
        onClick: () => window.siennaSettings.wipeConfig(),
      },
      {
        id: "vibeCodedNotice",
        section: "Info",
        label: "",
        desc: `<p class="settings-vibe-notice">If you care, sienna. and as of now most other things is vibe coded using ai</p>`,
        type: "info",
      },
      {
        id: "creditsSection",
        section: "Info",
        label: "Credits",
        desc: `
          <p>Thank you to everyone</p>
      
          <ul style="margin: 8px 0 0 20px;">
            <li><strong>selenite | games & inspiration</strong></li>
            <li><strong>gn-math | games & inspiration</strong></li>
            <li><strong>3kh0 | games</strong></li>
            <li><strong>freezenova | games</strong></li>
            <li><strong>wasm.rip | games</strong></li>
            <li><strong>UGS (Ultimate Game Stash) | games</strong></li>
            <li><strong>g+ | games</strong></li>
            <li><strong>truffled.lol | games</strong></li>
            <li><strong>interstellar | inspiration</strong></li>
            <li><strong>doge unblocker | inspiration</strong></li>
            <li><strong>waves | inspiration</strong></li>
            <li><strong>phantom games | inspiration (hacks)</strong></li>
            <li><strong>more to list</strong></li>
          </ul>
      
          <p style="margin-top: 8px;">
            sienna. by yellowdevelopment
          </p>
        `,
        type: "info",
      },
      {
        id: "ubghubSection",
        section: "Info",
        label: "As shown on UBGHub",
        desc: `
          <div class="ubghub-feature">
            <div class="ubghub-feature-main">
              <img src="${CONST.ICONS_BASE}ubghub.png" alt="UBGHub" class="ubghub-feature-logo">
              <div class="ubghub-feature-copy">
                <div class="ubghub-feature-title">UBGHub</div>
                <div class="ubghub-feature-desc">Sienna is listed in UBGHub's game site directory.</div>
              </div>
            </div>
            <a href="https://ubghub.org/?utm_source=usesienna.vercel.app&site=sienna." target="_blank" rel="noopener" class="ubghub-visit-btn">Visit UBGHub</a>
          </div>
        `,
        type: "info",
      },

    ],


    loadCustomThemes() {
      try {
        const saved = localStorage.getItem(KEYS.customThemes);
        if (saved) {
          const customThemes = JSON.parse(saved);
          if (Array.isArray(customThemes)) {
            // Remove any previously loaded custom themes from the array
            this.themes = this.themes.filter((t) => !t.id.startsWith("custom-"));
            // Add saved custom themes
            customThemes.forEach((t) => this.themes.push(t));
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    },

    // saveCustomThemes() patched by save.js

    init() {
      this.state.reduceMotion = storage.getBoolean(KEYS.reduceMotion, false);
      const gridColumns = storage.get(KEYS.gridColumns, "5");
      this.state.gridColumns = CONST.GRID_COLUMN_OPTIONS.includes(gridColumns) ? gridColumns : "5";
      this.state.legacyLibrary = storage.getBoolean(KEYS.legacyLibrary, false);
      this.state.classicLogo = storage.getBoolean(KEYS.classicLogo, false);
      this.state.rememberTabs = storage.get(KEYS.rememberTabs, "true") !== "false";
      this.state.cloakMethod = storage.get(KEYS.cloakMethod, CONST.DEFAULT_CLOAK_METHOD) === "blob:null" ? "blob:null" : CONST.DEFAULT_CLOAK_METHOD;
      const autoOpen = storage.get(KEYS.autoOpen, "Disabled");
      this.state.autoOpen = CONST.CLOAK_METHODS.includes(autoOpen) ? autoOpen : "Disabled";
      const savedProvider = storage.get(KEYS.gamesProvider, CONST.DEFAULT_PROVIDER);
      this.state.gamesProvider = CONST.PROVIDERS.includes(savedProvider) ? savedProvider : CONST.DEFAULT_PROVIDER;

      this.state.activeThemeId = storage.get(KEYS.themeId, "none");
      this.state.bubblesEnabled = storage.get(KEYS.bubblesEnabled, "true") !== "false";
      this.state.tabCloakId = storage.get(KEYS.tabCloak, "Default");
      this.state.tabCloakCustomTitle = storage.get(KEYS.tabCloakCustomTitle, "");
      this.state.tabCloakCustomFavicon = storage.get(KEYS.tabCloakCustomFavicon, "");

      this.loadCustomThemes();
      this.createToolbar();
      this.apply();
      this.applyTheme(this.state.activeThemeId);
      this.applyGamesProvider(this.state.gamesProvider);
      if (this.state.tabCloakId === "Custom") {
        this.applyTabCloak("Custom", this.state.tabCloakCustomTitle, this.state.tabCloakCustomFavicon);
      } else {
        this.applyTabCloak(this.state.tabCloakId);
      }
      this.maybeAutoOpen();
    },

    apply() {
      if (!this.state.legacyLibrary) {
        document.documentElement.style.setProperty("--grid-cols", this.state.gridColumns);
      }
      document.body.classList.toggle("reduce-motion", this.state.reduceMotion);
      document.body.classList.toggle("legacy-library", this.state.legacyLibrary);
      document.body.classList.toggle("classic-logo-enabled", this.state.classicLogo);
      this.applyClassicLogo();
      // Toggle bubbles
      const canvas = document.getElementById('bubbleCanvas');
      if (canvas) {
        canvas.style.display = this.state.bubblesEnabled ? 'block' : 'none';
      }
    },

    shouldRememberTabs() {
      return this.state.rememberTabs;
    },

    applyClassicLogo() {
      const title = document.querySelector(".title");
      if (!title) return;

      title.textContent = this.state.classicLogo ? CLASSIC_LOGO : "sienna.";
      title.setAttribute("aria-label", "sienna.");
    },

    clearBuiltinTheme() {
      document.body.classList.remove("theme-sienna-blue");
    },

    applyTheme(themeId) {
      const theme = this.themes.find((item) => item.id === themeId);
      if (!theme) {
        // Reset to black background (no theme)
        this.state.activeThemeId = "none";
        storage.set(KEYS.themeId, "none");
        document.documentElement.style.setProperty("--theme-image", "none");
        document.documentElement.classList.remove("has-theme");
        document.body.classList.remove("has-theme");
        this.clearBuiltinTheme();
        return;
      }
      this.state.activeThemeId = theme.id;
      storage.set(KEYS.themeId, theme.id);

      if (theme.variant === "gradient") {
        document.documentElement.style.setProperty("--theme-image", "none");
        document.documentElement.classList.remove("has-theme");
        document.body.classList.remove("has-theme");
        this.clearBuiltinTheme();
        if (theme.id === "sienna-blue") {
          document.body.classList.add("theme-sienna-blue");
        }
        return;
      }

      this.clearBuiltinTheme();

      // Convert data URLs to Blob URLs to avoid CSP issues with data: URIs in CSS
      let imageUrl = theme.url;
      // Fix relative paths: prepend / so they resolve from site root, not from css/
      if (imageUrl && !imageUrl.startsWith("data:") && !imageUrl.startsWith("http://") && !imageUrl.startsWith("https://") && !imageUrl.startsWith("//") && !imageUrl.startsWith("blob:")) {
        imageUrl = "/" + imageUrl.replace(/^\/+/, "");
      }
      if (imageUrl && imageUrl.startsWith("data:")) {
        try {
          const response = fetch(imageUrl);
          response.then(r => r.blob()).then(blob => {
            const blobUrl = URL.createObjectURL(blob);
            document.documentElement.style.setProperty("--theme-image", `url("${blobUrl}")`);
            document.documentElement.classList.add("has-theme");
            document.body.classList.add("has-theme");
          }).catch(() => {
            // Fallback to direct data URL if blob conversion fails
            document.documentElement.style.setProperty("--theme-image", imageUrl ? `url("${imageUrl}")` : "none");
            document.documentElement.classList.toggle("has-theme", Boolean(imageUrl));
            document.body.classList.toggle("has-theme", Boolean(imageUrl));
          });
          return;
        } catch (e) {
          // Fallback to direct data URL
        }
      }

      document.documentElement.style.setProperty("--theme-image", imageUrl ? `url("${imageUrl}")` : "none");
      document.documentElement.classList.toggle("has-theme", Boolean(imageUrl));
      document.body.classList.toggle("has-theme", Boolean(imageUrl));
    },

    setGamesProvider(provider) {
      this.state.gamesProvider = CONST.PROVIDERS.includes(provider) ? provider : CONST.DEFAULT_PROVIDER;
      storage.set(KEYS.gamesProvider, this.state.gamesProvider);
      this.applyGamesProvider(this.state.gamesProvider);
    },

    applyGamesProvider(provider) {
      // Providers live in js/providers.js; they all render into night.'s grid.
      if (window.siennaProviders?.apply) {
        window.siennaProviders.apply(provider);
        return;
      }

      // Fallback when js/providers.js is unavailable: keep night.'s own grid and
      // drop any provider containers left behind by an older build.
      document.getElementById("lumin-section")?.remove();
      const browseGrid = document.getElementById("browseGrid");
      if (browseGrid) browseGrid.style.display = "";
      document.querySelectorAll(".grid-section-label").forEach((label) => {
        label.style.display = "";
      });
    },

    applyTabCloak(cloakId, customTitle, customFavicon) {
      // If custom values are provided, use them directly
      if (cloakId === "Custom" && customTitle !== undefined && customFavicon !== undefined) {
        document.title = customTitle;
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = customFavicon;
        this.state.tabCloakId = "Custom";
        this.state.tabCloakCustomTitle = customTitle;
        this.state.tabCloakCustomFavicon = customFavicon;
        storage.set(KEYS.tabCloak, "Custom");
        storage.set(KEYS.tabCloakCustomTitle, customTitle);
        storage.set(KEYS.tabCloakCustomFavicon, customFavicon);
        return;
      }

      const preset = this.tabCloakPresets.find((p) => p.previewTitle === cloakId);
      if (!preset || cloakId === "Default") {
        // Reset to original
        document.title = "sienna.";
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = "favicon.ico";
        this.state.tabCloakId = "Default";
        storage.set(KEYS.tabCloak, "Default");
        return;
      }
      document.title = preset.realTitle;
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = preset.favicon;
      this.state.tabCloakId = cloakId;
      storage.set(KEYS.tabCloak, cloakId);
    },

    maybeAutoOpen() {
      if (this.state.autoOpen === "Disabled") return;
      if (window.self !== window.top || window.location.protocol === "blob:") return;
      if (sessionStorage.getItem("sienna_auto_open_attempted") === "true") return;
      sessionStorage.setItem("sienna_auto_open_attempted", "true");

      const method = this.state.autoOpen;
      const safeUrl = window.location.href;

      if (method === "blob:null") {
        // Store the original URL in sessionStorage so the blob page can read it
        sessionStorage.setItem("sienna_auto_open_url", safeUrl);
        const html =[
          "<!doctype html>",
          "<html><head><meta charset=\"utf-8\"><title>New Tab</title>",
          "<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0}</style>",
          "</head><body>",
          "<script>",
          "var url = sessionStorage.getItem('sienna_auto_open_url');",
          "if (url) {",
          "  var frame = document.createElement('iframe');",
          "  frame.src = url;",
          "  frame.allow = 'autoplay; picture-in-picture; fullscreen; clipboard-write';",
          "  frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0';",
          "  document.body.appendChild(frame);",
          "}",
          "</",
          "script>",
          "</body></html>",
        ].join("");
        const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        window.location.replace(blobUrl);
        return;
      }

      // about:blank - replace current page
      window.location.replace("about:blank");
    },

    handleCloak(url, preferredMethod = null) {
      const method = preferredMethod || this.state.cloakMethod;
      const safeUrl = String(url || window.location.href);

      if (method === "blob:null") {
        const html =[
          "<!doctype html>",
          "<html><head><meta charset=\"utf-8\"><title>New Tab</title>",
          "<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0}</style>",
          "</head><body></body></html>",
        ].join("");
        const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        const win = window.open(blobUrl, "_blank");
        if (win) {
          const attach = () => {
            const frame = win.document.createElement("iframe");
            frame.src = safeUrl;
            frame.allow = "autoplay; picture-in-picture; fullscreen; clipboard-write";
            win.document.body.appendChild(frame);
          };
          setTimeout(attach, 80);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
        return;
      }

      const win = window.open("about:blank", "_blank");
      if (!win) return;
      win.document.title = "New Tab";
      win.document.body.style.margin = "0";
      win.document.body.style.height = "100vh";
      win.document.body.style.overflow = "hidden";
      win.document.body.style.background = "#000";
      const frame = win.document.createElement("iframe");
      frame.src = safeUrl;
      frame.allow = "autoplay; picture-in-picture; fullscreen; clipboard-write";
      frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0";
      win.document.body.appendChild(frame);
    },

    createToolbar() {
      // Toolbar is now static HTML in the document.
      // This method sets up event listeners for the updates popup and account dropdown.

      // ── Updates popup ──
      const popup = document.getElementById("updatesPopup");
      const backdrop = document.getElementById("updatesPopupBackdrop");

      if (!popup) {
        // Create popup if not in DOM (backward compat)
        const p = document.createElement("div");
        p.id = "updatesPopup";
        p.className = "updates-popup";
        p.setAttribute("role", "dialog");
        p.setAttribute("aria-modal", "true");
        p.setAttribute("aria-label", "Updates");
        p.innerHTML = this.renderUpdatesPopupMarkup();
        document.body.appendChild(p);
      }

      if (!backdrop) {
        const b = document.createElement("div");
        b.id = "updatesPopupBackdrop";
        b.className = "updates-popup-backdrop";
        b.setAttribute("aria-hidden", "true");
        document.body.appendChild(b);
      }

      // Re-render popup content
      const existingPopup = document.getElementById("updatesPopup");
      if (existingPopup) {
        existingPopup.innerHTML = this.renderUpdatesPopupMarkup();
        this.bindUpdatesPopupControls(existingPopup);
      }

      document.getElementById("updatesBtn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleUpdatesPopup();
      });

      document.getElementById("updatesPopupBackdrop")?.addEventListener("click", () => this.closeUpdatesPopup());
      document.getElementById("updatesPopup")?.addEventListener("click", (event) => event.stopPropagation());
      document.addEventListener("click", () => this.closeUpdatesPopup());
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.closeUpdatesPopup();
      });

      // ── Settings button in top nav ──
      document.getElementById("topNavSettingsBtn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        window.gameVisor?.openSettings?.();
      });

      // ── Account dropdown ──
      this._setupAccountDropdown();
    },

    /** Render the account dropdown content based on login state */
    _renderAccountDropdown() {
      const dropdown = document.getElementById("accountDropdown");
      if (!dropdown) return;

      const account = window.siennaAccount;
      const isLoggedIn = account?.isLoggedIn?.();
      const pfpDataUrl = this._loadProfilePicture();
      const pfpAvatarImg = pfpDataUrl
        ? `<img src="${pfpDataUrl}" alt="" class="account-dropdown-profile-avatar-img">`
        : '';

      if (isLoggedIn) {
        const rawUsername = account.username || '';
        const avatarColor = account._avatarColor?.(rawUsername) || '#6366f1';
        const initial = rawUsername.charAt(0).toUpperCase() || '?';
        const syncStatus = account._formatSyncStatus?.() || 'Not synced yet';

        dropdown.innerHTML = `
          <div class="account-dropdown-header">
            <button class="account-dropdown-profile-btn" data-account-action="profile" type="button">
              <span class="account-dropdown-profile-avatar" style="background:${pfpDataUrl ? 'transparent' : avatarColor};">${pfpAvatarImg || initial}</span>
              <span>@${this.escapeHtml(rawUsername)}</span>
            </button>
          </div>
          <div class="account-dropdown-divider"></div>
          <div class="account-dropdown-sync-status">${this.escapeHtml(syncStatus)}</div>
          <button class="account-dropdown-item" data-account-action="save" type="button">Sync Now</button>
          <button class="account-dropdown-item" data-account-action="restore" type="button">Restore Last Sync</button>
          <div class="account-dropdown-divider"></div>
          <button class="account-dropdown-item danger" data-account-action="logout" type="button">Log Out</button>
        `;
      } else {
        dropdown.innerHTML = `
          <div class="account-dropdown-header">
            <button class="account-dropdown-profile-btn" data-account-action="profile" type="button">
              <span class="account-dropdown-profile-avatar" style="background:${pfpDataUrl ? 'transparent' : 'rgba(255,255,255,0.12)'};">${pfpAvatarImg || '?'}</span>
              <span>Guest</span>
            </button>
          </div>
          <div class="account-dropdown-divider"></div>
          <div class="account-dropdown-sync-status">Log in to access cloud saves!</div>
          <div class="account-dropdown-divider"></div>
          <button class="account-dropdown-item" data-account-action="login" type="button">Log In</button>
        `;
      }
    },

    /** Set up account dropdown event listeners */
    _setupAccountDropdown() {
      const accountBtn = document.getElementById("accountBtn");
      const dropdown = document.getElementById("accountDropdown");
      if (!accountBtn || !dropdown) return;

      // Remove old listeners by cloning
      const newBtn = accountBtn.cloneNode(true);
      accountBtn.parentNode.replaceChild(newBtn, accountBtn);

      newBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const account = window.siennaAccount;
        if (!account) return;

        // Re-apply profile picture if one exists (may have been reset by login/logout)
        const pfp = this._loadProfilePicture();
        if (pfp) this._updateTopNavAvatar(pfp);

        // Always render dropdown and toggle it, regardless of login state
        this._renderAccountDropdown();
        dropdown.classList.toggle("open");
      });

      // Dropdown action delegation
      dropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = e.target.closest("[data-account-action]");
        if (!item) return;

        const action = item.dataset.accountAction;
        const account = window.siennaAccount;
        if (!account) return;

        if (action === "login") {
          account.showLoginModal();
        } else if (action === "profile") {
          // Open Account tab in Settings
          window.siennaSettings.state.settingsActiveSection = "Account";
          window.gameVisor?.openSettings?.();
        } else if (action === "settings") {
          window.gameVisor?.openSettings?.();
        } else if (action === "save") {
          account.saveToCloud();
        } else if (action === "restore") {
          account.restoreFromCloud({ reload: true });
        } else if (action === "logout") {
          account.logout();
          this._renderAccountDropdown();
        }

        dropdown.classList.remove("open");
      });

      // Close dropdown when clicking outside
      document.addEventListener("click", () => {
        dropdown.classList.remove("open");
      });
    },

    renderUpdatesPopupMarkup() {
      if (this.showingPreviousUpdateLogs) {
        return this.renderPreviousUpdatesPopupMarkup();
      }

      const sections = Array.isArray(this.updates.sections) ? this.updates.sections : [];
      return `
        <div class="updates-popup-header">
          <div class="updates-popup-heading">
            <div class="updates-popup-sparkle" aria-hidden="true">
            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M567.938 243.908L462.25 85.374A48.003 48.003 0 0 0 422.311 64H153.689a48 48 0 0 0-39.938 21.374L8.062 243.908A47.994 47.994 0 0 0 0 270.533V400c0 26.51 21.49 48 48 48h480c26.51 0 48-21.49 48-48V270.533a47.994 47.994 0 0 0-8.062-26.625zM162.252 128h251.497l85.333 128H376l-32 64H232l-32-64H76.918l85.334-128z"></path></svg>
            </div>
            <div>
              <div class="updates-popup-title">${this.escapeHtml(this.updates.title)}</div>
              <div class="updates-popup-version">${this.escapeHtml(this.updates.version)}</div>
            </div>
          </div>
          <div class="updates-popup-actions">
            <button class="updates-popup-link" id="updatesPopupHistory" type="button">History</button>
            <button class="updates-popup-close" id="updatesPopupClose" type="button" aria-label="Close updates">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="updates-popup-body">
          ${this.renderUpdateSectionsMarkup(sections)}
        </div>
        <div class="updates-popup-footer">
          <button class="updates-popup-confirm" id="updatesPopupConfirm" type="button">Wow really?</button>
        </div>
      `;
    },

    renderPreviousUpdatesPopupMarkup() {
      const history = this.updateLogHistory;
      let body = "";
      let footer = `<button class="updates-popup-confirm" id="updatesPopupConfirm" type="button">Done</button>`;

      if (history.loading) {
        body = `<div class="updates-popup-status">Loading previous update logs...</div>`;
      } else if (history.error) {
        body = `<div class="updates-popup-status error">${this.escapeHtml(history.error)}</div>`;
      } else if (!history.entries.length) {
        body = `<div class="updates-popup-status">No previous update logs found.</div>`;
      } else {
        const logs = this.getPreviousUpdateLogsNewestFirst();
        const maxIndex = logs.length - 1;
        const activeIndex = Math.min(Math.max(this.previousUpdateLogIndex, 0), maxIndex);
        const log = logs[activeIndex];
        this.previousUpdateLogIndex = activeIndex;
        body = `
          <article class="updates-popup-log">
            <h3>${this.escapeHtml(log.title || "Update")}</h3>
            <div class="updates-popup-log-sections">
              ${this.renderUpdateSectionsMarkup(Array.isArray(log.sections) ? log.sections : [])}
            </div>
          </article>
        `;
        footer = `
          <button class="updates-popup-secondary" id="updatesPopupNewer" type="button"${activeIndex === 0 ? " disabled" : ""}>Newer</button>
          <span class="updates-popup-count">${activeIndex + 1} of ${logs.length}</span>
          <button class="updates-popup-secondary" id="updatesPopupOlder" type="button"${activeIndex === maxIndex ? " disabled" : ""}>Older</button>
        `;
      }

      return `
        <div class="updates-popup-header">
          <div class="updates-popup-heading">
            <div class="updates-popup-sparkle" aria-hidden="true">
            <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M567.938 243.908L462.25 85.374A48.003 48.003 0 0 0 422.311 64H153.689a48 48 0 0 0-39.938 21.374L8.062 243.908A47.994 47.994 0 0 0 0 270.533V400c0 26.51 21.49 48 48 48h480c26.51 0 48-21.49 48-48V270.533a47.994 47.994 0 0 0-8.062-26.625zM162.252 128h251.497l85.333 128H376l-32 64H232l-32-64H76.918l85.334-128z"></path></svg>
            </div>
            <div>
              <div class="updates-popup-title">Previous update logs</div>
              <div class="updates-popup-version">${this.escapeHtml(this.updates.version)}</div>
            </div>
          </div>
          <div class="updates-popup-actions">
            <button class="updates-popup-link" id="updatesPopupCurrent" type="button">Current</button>
            <button class="updates-popup-close" id="updatesPopupClose" type="button" aria-label="Close updates">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="updates-popup-body updates-popup-history">
          ${body}
        </div>
        <div class="updates-popup-footer">
          ${footer}
        </div>
      `;
    },

    getPreviousUpdateLogsNewestFirst() {
      return [...this.updateLogHistory.entries].reverse();
    },

    renderUpdateSectionsMarkup(sections) {
      return sections.map((section) => {
        const title = section.title || "";
        const description = section.description || "";
        return `
          <section class="updates-popup-section">
            ${title ? `<strong>${this.escapeHtml(title)}</strong>` : ""}
            ${description ? `<span>${this.escapeHtml(description)}</span>` : ""}
          </section>
        `;
      }).join("");
    },

    bindUpdatesPopupControls(popup) {
      popup.querySelector("#updatesPopupClose")?.addEventListener("click", () => this.closeUpdatesPopup());
      popup.querySelector("#updatesPopupConfirm")?.addEventListener("click", () => this.closeUpdatesPopup());
      popup.querySelector("#updatesPopupHistory")?.addEventListener("click", () => this.showPreviousUpdateLogs());
      popup.querySelector("#updatesPopupCurrent")?.addEventListener("click", () => this.showCurrentUpdateLog());
      popup.querySelector("#updatesPopupNewer")?.addEventListener("click", () => this.goToPreviousUpdateLog(-1));
      popup.querySelector("#updatesPopupOlder")?.addEventListener("click", () => this.goToPreviousUpdateLog(1));
    },

    renderUpdatesPopup() {
      const popup = document.getElementById("updatesPopup");
      if (!popup) return;
      popup.innerHTML = this.renderUpdatesPopupMarkup();
      this.bindUpdatesPopupControls(popup);
    },

    showCurrentUpdateLog() {
      this.showingPreviousUpdateLogs = false;
      this.renderUpdatesPopup();
    },

    showPreviousUpdateLogs() {
      this.showingPreviousUpdateLogs = true;
      this.previousUpdateLogIndex = 0;
      this.renderUpdatesPopup();
      this.loadPreviousUpdateLogs();
    },

    goToPreviousUpdateLog(direction) {
      const logs = this.getPreviousUpdateLogsNewestFirst();
      if (!logs.length) return;
      const maxIndex = logs.length - 1;
      this.previousUpdateLogIndex = Math.min(Math.max(this.previousUpdateLogIndex + direction, 0), maxIndex);
      this.renderUpdatesPopup();
    },

    async loadPreviousUpdateLogs() {
      const history = this.updateLogHistory;
      if (history.loaded || history.loading) return;

      history.loading = true;
      history.error = "";
      this.renderUpdatesPopup();

      try {
        const response = await fetch(this.updates.previousLogsUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Could not load ${this.updates.previousLogsUrl}`);
        const data = await response.json();
        const entries = Array.isArray(data) ? data : data.updates;
        history.entries = Array.isArray(entries) ? entries : [];
        history.loaded = true;
      } catch (error) {
        history.error = "Previous update logs could not be loaded.";
      } finally {
        history.loading = false;
        if (this.showingPreviousUpdateLogs) this.renderUpdatesPopup();
      }
    },

    toggleUpdatesPopup(forceState = null) {
      const popup = document.getElementById("updatesPopup");
      const button = document.getElementById("updatesBtn");
      if (!popup || !button) return;

      const shouldOpen = forceState ?? !popup.classList.contains("visible");
      if (shouldOpen && !popup.classList.contains("visible")) {
        this.showingPreviousUpdateLogs = false;
      }

      this.renderUpdatesPopup();
      popup.classList.toggle("visible", shouldOpen);
      document.getElementById("updatesPopupBackdrop")?.classList.toggle("visible", shouldOpen);
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      if (shouldOpen) {
        storage.set(this.updates.storageKey, "true");
        setTimeout(() => popup.querySelector("#updatesPopupConfirm")?.focus(), 0);
      }
    },

    closeUpdatesPopup() {
      document.getElementById("updatesPopup")?.classList.remove("visible");
      document.getElementById("updatesPopupBackdrop")?.classList.remove("visible");
      document.getElementById("updatesBtn")?.setAttribute("aria-expanded", "false");
    },

    maybeShowUpdatesOnFirstVisit() {
      if (!this.updates.showOnFirstVisit) return;
      if (storage.get(this.updates.storageKey, "false") === "true") return;
      window.requestAnimationFrame(() => this.toggleUpdatesPopup(true));
    },

    SETTINGS_SECTION_ORDER: [
      "Display",
      "Performance",
      "Games",
      "Plugins",
      "Cloaking",
      "Game window",
      "Account",
      "Info",
    ],



    getSettingsSectionIds(grouped) {
      const order = this.SETTINGS_SECTION_ORDER;
      const known = new Set(order);
      const extras = Object.keys(grouped).filter((section) => !known.has(section));
      return [
        ...order.filter((section) => (grouped[section]?.length > 0) || section === "Plugins"),
        ...extras,
      ];
    },

    settingsSectionExists(section, grouped) {
      if (section === "Plugins") return Boolean(window.SiennaPlugins);
      return Boolean(grouped[section]?.length);
    },

    renderSectionContent(section, grouped) {
      if (section === "Plugins" && window.SiennaPlugins?.renderPluginsPanel) {
        return window.SiennaPlugins.renderPluginsPanel();
      }

      const items = grouped[section] || [];
      let html = items.map((item) => this.renderItem(item)).join("");

      if (section === "Games" && window.SiennaPlugins?.renderHacksPanel) {
        html += `
          <div class="settings-subsection settings-subsection--hacks">
            <div class="settings-section-title">Hacks</div>
            ${window.SiennaPlugins.renderHacksPanel()}
          </div>
        `;
      }

      return html;
    },

    renderPanel() {
      const panel = document.getElementById("settingsPanel");
      if (!panel) return;

      const savedActiveSection = panel.querySelector(".settings-sidebar-btn.active")?.dataset?.section || null;

      const grouped = this.registry.reduce((sections, item) => {
        if (!sections[item.section]) sections[item.section] = [];
        sections[item.section].push(item);
        return sections;
      }, {});

      if (this.state.settingsActiveSection === "Themes") {
        this.state.settingsActiveSection = "Display";
      }
      if (this.state.settingsActiveSection === "Hacks") {
        this.state.settingsActiveSection = "Games";
      }

      const sectionIds = this.getSettingsSectionIds(grouped);
      const nextActiveSection =
        (this.state.settingsActiveSection && this.settingsSectionExists(this.state.settingsActiveSection, grouped) ? this.state.settingsActiveSection : "") ||
        (savedActiveSection && this.settingsSectionExists(savedActiveSection, grouped) ? savedActiveSection : "") ||
        sectionIds[0] ||
        "";
      this.state.settingsActiveSection = nextActiveSection;

      const sectionIcon = (section) => {
        const key = String(section || "").toLowerCase();
        const icons = {
          preferences: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M4 17h10M14 7l2-2 2 2-2 2-2-2Zm0 10l2-2 2 2-2 2-2-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          appearance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 3v9h9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          themes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0 2-1 3-3 3h-1a2 2 0 0 0-2 2c0 1 1 2 2 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10h.01M12 8h.01M16 10h.01M9 14h.01" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
          cloaking: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
          advanced: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
          display: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v12H3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
          performance: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14a8 8 0 1 1-16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 14l4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
          games: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h4M9 10v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 11h.01M18 13h.01" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M8 7h8a4 4 0 0 1 4 4v3a3 3 0 0 1-3 3h-1l-2-2H10l-2 2H7a3 3 0 0 1-3-3v-3a4 4 0 0 1 4-4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
          account: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          plugins: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
          credits: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
          about: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 7h.01" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
        };
        return icons[key] || '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 12h.01" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
      };

      const prevSection = this._settingsRenderedSection || "";
      const sectionChanged = prevSection !== nextActiveSection;
      let slideClass = "";
      if (sectionChanged && prevSection && !this.state.reduceMotion) {
        const prevIdx = sectionIds.indexOf(prevSection);
        const nextIdx = sectionIds.indexOf(nextActiveSection);
        slideClass = nextIdx >= prevIdx ? "settings-section--slide-forward" : "settings-section--slide-backward";
      } else if (sectionChanged && !this.state.reduceMotion) {
        slideClass = "settings-section--slide-forward";
      }
      this._settingsRenderedSection = nextActiveSection;

      panel.innerHTML = `
        <div class="settings-window" role="dialog" aria-label="Settings">
          <div class="settings-window-header">
            <div class="settings-window-title">settings</div>
          </div>
          <div class="settings-shell">
            <aside class="settings-sidebar" id="settingsSidebar" aria-label="Settings sections">
              ${sectionIds.map((section) => `
                <button class="settings-sidebar-btn" type="button" data-section="${this.escapeHtml(section)}">
                  <span class="settings-sidebar-icon" aria-hidden="true">${sectionIcon(section)}</span>
                  <span class="settings-sidebar-label">${this.escapeHtml(section)}</span>
                </button>
              `).join("")}
              <div class="settings-sidebar-spacer"></div>
              <div class="settings-sidebar-version">sienna v${this.escapeHtml(String(SIENNA_VERSION))} • ${this.escapeHtml(String(SIENNA_BUILD))}</div>
            </aside>
            <div class="settings-main" id="settingsMain">
              <div class="settings-section-viewport">
              ${nextActiveSection ? `
                <section class="settings-section settings-section--single ${slideClass}" data-section-name="${this.escapeHtml(nextActiveSection)}">
                  <div class="settings-section-title settings-section-title--big">${this.escapeHtml(nextActiveSection)}</div>
                  <div class="settings-section-body">
                    ${this.renderSectionContent(nextActiveSection, grouped)}
                  </div>
                </section>
              ` : ""}
              </div>
            </div>
          </div>
        </div>
      `;

      // ── Sidebar navigation (one section visible at a time) ──
      panel.querySelectorAll(".settings-sidebar-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.section === nextActiveSection);
        btn.addEventListener("click", () => {
          const sectionName = btn.dataset.section || "";
          if (!this.settingsSectionExists(sectionName, grouped) || sectionName === this.state.settingsActiveSection) return;
          this.state.settingsActiveSection = sectionName;
          this.renderPanel();
        });
      });

      window.SiennaPlugins?.hydrateSettingsPanel?.();

      if (sectionChanged) {
        document.getElementById("settingsMain")?.scrollTo(0, 0);
      }

      panel.querySelectorAll("input[data-setting-id]").forEach((input) => {
        input.addEventListener("change", () => {
          const setting = this.registry.find((item) => item.id === input.dataset.settingId);
          setting?.set(Boolean(input.checked));
        });
      });

      panel.querySelectorAll("select[data-setting-id]").forEach((select) => {
        select.addEventListener("change", () => {
          const setting = this.registry.find((item) => item.id === select.dataset.settingId);
          setting?.set(select.value);
        });
      });

      panel.querySelectorAll(".choice-btn").forEach((button) => {
        button.addEventListener("click", () => {
          const setting = this.registry.find((item) => item.id === button.dataset.settingId);
          setting?.set(button.dataset.value);
        });
      });

      panel.querySelectorAll(".action-btn[data-action-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const setting = this.registry.find((item) => item.id === button.dataset.actionId);
          setting?.onClick?.();
        });
      });

      panel.querySelectorAll("[data-theme-id]").forEach((button) => {
        button.addEventListener("click", () => {
          this.applyTheme(button.dataset.themeId);
          this.renderPanel();
        });
      });

      panel.querySelectorAll("[data-action='remove-theme']").forEach((button) => {
        button.addEventListener("click", () => {
          this.applyTheme("none");
          this.renderPanel();
        });
      });

      panel.querySelectorAll("[data-action='upload-theme']").forEach((button) => {
        button.addEventListener("click", () => {
          this.openUploadTheme();
        });
      });

      panel.querySelectorAll("[data-action='delete-custom-theme']").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const themeId = button.dataset.themeId;
          // Remove from themes array
          this.themes = this.themes.filter((t) => t.id !== themeId);
          // If the deleted theme was active, reset to black
          if (this.state.activeThemeId === themeId) {
            this.applyTheme("none");
          }
          // Save and re-render
          this.saveCustomThemes();
          this.renderPanel();
        });
      });

      // Tab cloak: dropdown selection
      const tabCloakSelect = document.getElementById("tabCloakSelect");
      if (tabCloakSelect) {
        tabCloakSelect.addEventListener("change", () => {
          const value = tabCloakSelect.value;
          if (value === "Custom") {
            this.state.tabCloakId = "Custom";
            storage.set(KEYS.tabCloak, "Custom");
            this.renderPanel();
          } else {
            this.applyTabCloak(value);
            this.renderPanel();
          }
        });
      }

      // Tab cloak: apply custom
      const applyCustomBtn = document.getElementById("tabCloakApplyCustom");
      if (applyCustomBtn) {
        applyCustomBtn.addEventListener("click", () => {
          const titleInput = document.getElementById("tabCloakCustomTitle");
          const faviconInput = document.getElementById("tabCloakCustomFavicon");
          if (!titleInput && !faviconInput) return;
          const title = titleInput?.value?.trim() || "";
          const favicon = faviconInput?.value?.trim() || "";
          if (!title && !favicon) return;
          this.applyTabCloak("Custom", title, favicon);
          this.renderPanel();
        });
      }

      // Tab cloak: reset button
      panel.querySelectorAll("[data-action='reset-tab-cloak']").forEach((button) => {
        button.addEventListener("click", () => {
          this.applyTabCloak("Default");
          this.renderPanel();
        });
      });

      // Data management: Download / Upload buttons
      panel.querySelectorAll("[data-action='download-data']").forEach((button) => {
        button.addEventListener("click", () => this.downloadData());
      });
      panel.querySelectorAll("[data-action='upload-data']").forEach((button) => {
        button.addEventListener("click", () => this.uploadData());
      });

      // Account profile: Sync / Restore / Logout / Login buttons
      panel.querySelectorAll("[data-account-action]").forEach((button) => {
        button.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = button.dataset.accountAction;
          const account = window.siennaAccount;
          if (action === "toggle-pfp-menu") {
            this._togglePfpDropdown(button);
            return;
          }
          if (action === "change-pfp") {
            this.openProfilePictureUpload();
            return;
          }
          if (action === "remove-pfp") {
            this._removeProfilePicture();
            return;
          }
          if (!account) return;
          if (action === "sync") {
            account.saveToCloud();
          } else if (action === "restore") {
            account.restoreFromCloud({ reload: true });
          } else if (action === "logout") {
            account.logout();
            this.renderPanel();
          } else if (action === "login") {
            account.showLoginModal();
          }
        });
      });
    },

    renderItem(item) {
      if (item.type === "theme-grid") return this.renderThemeGrid(item);
      if (item.type === "tab-cloak-grid") return this.renderTabCloakGrid(item);
      if (item.type === "info") {
        return `
          <div class="settings-item settings-item--info settings-item--${this.escapeHtml(item.id || "info")}">
            <div class="settings-info">
              <span class="settings-label">${this.escapeHtml(item.label)}</span>
              <span class="settings-desc">${item.desc}</span>
            </div>
          </div>
        `;
      }

      const isDisabled = item.id === "gridColumns" && this.state.legacyLibrary;

      return `
        <div class="settings-item settings-item--${this.escapeHtml(item.type)} ${isDisabled ? "settings-item--disabled" : ""}">
          <div class="settings-info">
            <span class="settings-label">${this.escapeHtml(item.label)}</span>
            <span class="settings-desc">${isDisabled ? "Disabled in legacy cards view." : this.escapeHtml(item.desc)}</span>
          </div>
          <div class="settings-control">
            ${this.renderControl(item, isDisabled)}
          </div>
        </div>
      `;
    },


    renderControl(item, isDisabled = false) {
      if (item.type === "toggle") {
        return `
          <label class="toggle-switch">
            <input type="checkbox" data-setting-id="${this.escapeHtml(item.id)}" ${item.get() ? "checked" : ""} ${isDisabled ? "disabled" : ""}>
            <span class="slider"></span>
          </label>
        `;
      }

      if (item.type === "choice") {
        return `
          <div class="choice-grp">
            ${item.options.map((option) => `
              <button class="choice-btn ${item.get() === option ? "active" : ""}" type="button" data-setting-id="${this.escapeHtml(item.id)}" data-value="${this.escapeHtml(option)}" ${isDisabled ? "disabled" : ""}>${this.escapeHtml(option)}</button>
            `).join("")}
          </div>
        `;
      }

      if (item.type === "select") {
        return `
          <select class="settings-select" data-setting-id="${this.escapeHtml(item.id)}" ${isDisabled ? "disabled" : ""}>
            ${item.options.map((option) => `<option value="${this.escapeHtml(option)}" ${item.get() === option ? "selected" : ""}>${this.escapeHtml(option)}</option>`).join("")}
          </select>
        `;
      }

      if (item.type === "action") {
        return `<button class="action-btn" type="button" data-action-id="${this.escapeHtml(item.id)}" ${isDisabled ? "disabled" : ""}>${this.escapeHtml(item.buttonLabel)}</button>`;
      }

      if (item.type === "data-actions") {
        return `
          <div class="data-actions-row">
            <button class="action-btn" type="button" data-action="download-data">Download</button>
            <button class="action-btn" type="button" data-action="upload-data">Upload</button>
          </div>
        `;
      }

      if (item.type === "info") {
        return `<span class="settings-info-text">${item.desc}</span>`;
      }


      if (item.type === "account-profile") {
        const account = window.siennaAccount;
        const isLoggedIn = account?.isLoggedIn?.();
        const pfpDataUrl = this._loadProfilePicture();
        const pfpAvatarContent = pfpDataUrl
          ? ('<img src="' + pfpDataUrl + '" alt="" class="settings-account-avatar-img">')
          : '';

        if (isLoggedIn) {
          const rawUsername = account.username || '';
          const username = this.escapeHtml(rawUsername);
          const syncStatus = account?._formatSyncStatus?.() || 'Not synced yet';
          const avatarColor = account?._avatarColor?.(rawUsername) || 'var(--accent)';
          const initial = rawUsername.charAt(0).toUpperCase() || '?';
          return `
            <div class="settings-account-profile">
              <div class="settings-account-header">
                <div class="settings-account-avatar-wrap">
                  <div class="settings-account-avatar" style="background:${pfpDataUrl ? 'transparent' : avatarColor};">${pfpAvatarContent || initial}</div>
                  <button class="settings-pfp-edit-btn" data-account-action="toggle-pfp-menu" type="button" aria-label="Edit profile picture">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                </div>
                <div class="settings-account-info">
                  <div class="settings-account-username">@${username}</div>
                  <div class="settings-account-syncstatus">${this.escapeHtml(syncStatus)}</div>
                </div>
              </div>
              <div class="settings-account-actions">
                <button class="action-btn" type="button" data-account-action="sync">Sync Now</button>
                <button class="action-btn" type="button" data-account-action="restore">Restore</button>
                <button class="action-btn danger" type="button" data-account-action="logout">Log Out</button>
              </div>
            </div>
          `;
        } else {
          return `
            <div class="settings-account-profile">
              <div class="settings-account-header">
                <div class="settings-account-avatar-wrap">
                  <div class="settings-account-avatar settings-account-avatar--guest" style="background:${pfpDataUrl ? 'transparent' : ''};">${pfpAvatarContent || '?'}</div>
                  <button class="settings-pfp-edit-btn" data-account-action="toggle-pfp-menu" type="button" aria-label="Edit profile picture">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                </div>
                <div class="settings-account-info">
                  <div class="settings-account-username">Guest</div>
                  <div class="settings-account-syncstatus" style="opacity:0.5;">Log in to access cloud saves</div>
                </div>
              </div>
              <div class="settings-account-actions">
                <button class="action-btn" type="button" style="opacity:0.4;cursor:not-allowed;" disabled>Sync Now</button>
                <button class="action-btn" type="button" style="opacity:0.4;cursor:not-allowed;" disabled>Restore</button>
                <button class="action-btn" type="button" data-account-action="login">Log In</button>
              </div>
            </div>
          `;
        }
      }

      return "";
    },

    renderThemeGrid(item) {
      const hasTheme = this.state.activeThemeId !== "none";
      return `
        <div class="settings-item theme-settings-item">
          <div class="settings-info">
            <span class="settings-label">${this.escapeHtml(item.label)}</span>
            <span class="settings-desc">${this.escapeHtml(item.desc)}</span>
          </div>
          <div class="settings-control" style="gap: 8px;">
            ${hasTheme ? `<button class="remove-theme-btn" type="button" data-action="remove-theme" title="Remove theme">Remove Theme</button>` : ""}
            <button class="action-btn" type="button" data-action="upload-theme">Upload Theme</button>
          </div>
        </div>
        <div class="settings-theme-grid">
          ${this.themes.map((theme) => {
            let previewStyle = "";
            let previewClass = "theme-preview";
            if (theme.variant === "gradient" && theme.id === "sienna-blue") {
              previewClass += " theme-preview-sienna-blue";
            } else {
              let previewUrl = theme.url;
              // Fix relative paths for preview
              if (previewUrl && !previewUrl.startsWith("data:") && !previewUrl.startsWith("http://") && !previewUrl.startsWith("https://") && !previewUrl.startsWith("//") && !previewUrl.startsWith("blob:")) {
                previewUrl = "/" + previewUrl.replace(/^\/+/, "");
              }
              previewStyle = ` style="background-image: url('${this.escapeHtml(previewUrl)}');"`;
            }
            return `
            <button class="theme-card ${this.state.activeThemeId === theme.id ? "selected" : ""}" type="button" data-theme-id="${this.escapeHtml(theme.id)}">
              <div class="${previewClass}"${previewStyle}></div>
              <div class="theme-label">${this.escapeHtml(theme.label)}</div>
              ${theme.id.startsWith("custom-") ? `<span class="theme-delete" data-action="delete-custom-theme" data-theme-id="${this.escapeHtml(theme.id)}" title="Delete theme">&times;</span>` : ""}
            </button>`;
          }).join("")}
        </div>
      `;
    },

    renderTabCloakGrid(item) {
      const isCustom = this.state.tabCloakId === "Custom";
      return `
        <div class="settings-item" style="display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;">
            <div class="settings-info">
              <span class="settings-label">${this.escapeHtml(item.label)}</span>
              <span class="settings-desc">${this.escapeHtml(item.desc)}</span>
            </div>
            <div class="settings-control" style="gap:8px;flex-shrink:0;">
              ${this.state.tabCloakId !== "Default" ? `<button class="remove-theme-btn" type="button" data-action="reset-tab-cloak" title="Reset to default">Reset</button>` : ""}
            </div>
          </div>
          <div class="tab-cloak-row">
            <select class="settings-select" id="tabCloakSelect">
              ${this.tabCloakPresets.map((preset) => `
                <option value="${this.escapeHtml(preset.previewTitle)}" ${this.state.tabCloakId === preset.previewTitle ? "selected" : ""}>${this.escapeHtml(preset.previewTitle)}</option>
              `).join("")}
              <option value="Custom" ${isCustom ? "selected" : ""}>Custom</option>
            </select>
            <input class="tab-cloak-input" type="text" id="tabCloakCustomTitle" value="${this.escapeHtml(this.state.tabCloakCustomTitle)}" placeholder="Tab name">
            <input class="tab-cloak-input" type="text" id="tabCloakCustomFavicon" value="${this.escapeHtml(this.state.tabCloakCustomFavicon)}" placeholder="Favicon URL">
            <button class="action-btn" type="button" id="tabCloakApplyCustom">Apply</button>
          </div>
        </div>
      `;
    },

    // FILE_SIZE_LIMIT, showFileSizeWarning, openUploadTheme patched by save.js

    // createDataBackup, getDataBackupPayload, applyDataBackup patched by save.js
    // downloadData, uploadData, wipeConfig patched by save.js

    _togglePfpDropdown(btn) {
      var existing = document.querySelector(".settings-pfp-dropdown");
      if (existing && existing.parentNode === btn.parentNode) {
        existing.remove();
        return;
      }
      if (existing) existing.remove();

      var pfpDataUrl = this._loadProfilePicture();

      var dropdown = document.createElement("div");
      dropdown.className = "settings-pfp-dropdown open";

      var changeLabel = pfpDataUrl ? "Change Picture" : "Add Picture";
      dropdown.innerHTML = '<button class="settings-pfp-dropdown-item" data-account-action="change-pfp" type="button">' + changeLabel + '</button>'
        + (pfpDataUrl ? '<button class="settings-pfp-dropdown-item danger" data-account-action="remove-pfp" type="button">Remove Picture</button>' : '');

      dropdown.querySelectorAll("[data-account-action]").forEach(function(item) {
        item.addEventListener("click", function(e) {
          e.stopPropagation();
          dropdown.remove();
          var action = item.dataset.accountAction;
          if (action === "change-pfp") {
            window.siennaSettings.openProfilePictureUpload();
          } else if (action === "remove-pfp") {
            window.siennaSettings._removeProfilePicture();
          }
        });
      });

      btn.parentNode.appendChild(dropdown);

      var closeDropdown = function(e) {
        if (!dropdown.contains(e.target) && e.target !== btn) {
          dropdown.remove();
          document.removeEventListener("click", closeDropdown);
        }
      };
      setTimeout(function() {
        document.addEventListener("click", closeDropdown);
      }, 0);
    },

    // _loadProfilePicture, _saveProfilePicture, _removeProfilePicture,
    // _updateTopNavAvatar, showInvalidImageWarning, openProfilePictureUpload
    // patched by save.js

    _openPfpCropper(imageDataUrl) {
      var that = this;
      var overlay = document.getElementById("pfpCropperOverlay");
      var img = document.getElementById("pfpCropperImage");
      var zoomSlider = document.getElementById("pfpCropperZoom");
      if (!overlay || !img || !zoomSlider) return;

      var workspace = document.getElementById("pfpCropperWorkspace");
      if (!workspace) return;

      var wsW = workspace.clientWidth;
      var wsH = workspace.clientHeight;
      var offsetX = 0;
      var offsetY = 0;

      function applyTransform(ox, oy, scale) {
        var iw = img.naturalWidth;
        var ih = img.naturalHeight;
        var tx = -(iw * scale) / 2 + ox;
        var ty = -(ih * scale) / 2 + oy;
        img.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
      }

      img.onload = function() {
        var natW = img.naturalWidth;
        var natH = img.naturalHeight;
        if (!natW || !natH) return;
        var cropSize = 200;
        var fitScale = Math.max(cropSize / Math.min(natW, natH), 0.5);
        offsetX = 0;
        offsetY = 0;
        zoomSlider.value = String(Math.round(fitScale * 100) / 100);
        applyTransform(0, 0, fitScale);
      };

      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      img.src = imageDataUrl;

      var isDragging = false;
      var startX, startY, startOx, startOy;

      function getCurrentScale() {
        return parseFloat(zoomSlider.value) || 1;
      }

      function onPointerDown(e) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startOx = offsetX;
        startOy = offsetY;
        workspace.setPointerCapture(e.pointerId);
        e.preventDefault();
      }

      function onPointerMove(e) {
        if (!isDragging) return;
        offsetX = startOx + (e.clientX - startX);
        offsetY = startOy + (e.clientY - startY);
        applyTransform(offsetX, offsetY, getCurrentScale());
      }

      function onPointerUp(e) {
        if (!isDragging) return;
        isDragging = false;
        workspace.releasePointerCapture(e.pointerId);
      }

      workspace.addEventListener("pointerdown", onPointerDown);
      workspace.addEventListener("pointermove", onPointerMove);
      workspace.addEventListener("pointerup", onPointerUp);
      workspace.addEventListener("pointercancel", onPointerUp);

      function onWheel(e) {
        e.preventDefault();
        var step = 0.05;
        var delta = e.deltaY > 0 ? -step : step;
        var newVal = Math.max(0.5, Math.min(3, getCurrentScale() + delta));
        zoomSlider.value = String(Math.round(newVal * 100) / 100);
        applyTransform(offsetX, offsetY, newVal);
      }
      workspace.addEventListener("wheel", onWheel, { passive: false });

      zoomSlider.oninput = function() {
        applyTransform(offsetX, offsetY, getCurrentScale());
      };

      that._pfpCropperCleanup = function() {
        workspace.removeEventListener("pointerdown", onPointerDown);
        workspace.removeEventListener("pointermove", onPointerMove);
        workspace.removeEventListener("pointerup", onPointerUp);
        workspace.removeEventListener("pointercancel", onPointerUp);
        workspace.removeEventListener("wheel", onWheel);
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        img.src = "";
      };
    },

    _doPfpCrop() {
      var img = document.getElementById("pfpCropperImage");
      var workspace = document.getElementById("pfpCropperWorkspace");
      if (!img || !workspace || !img.complete) return;

      var wsW = workspace.clientWidth;
      var wsH = workspace.clientHeight;
      var cropRadius = 100;
      var outputSize = 256;

      var style = img.style.transform || "translate(0px, 0px) scale(1)";
      var txMatch = style.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      var scMatch = style.match(/scale\(([^)]+)\)/);
      var tx = txMatch ? parseFloat(txMatch[1]) : 0;
      var ty = txMatch ? parseFloat(txMatch[2]) : 0;
      var scale = scMatch ? parseFloat(scMatch[1]) : 1;

      var imgW = img.naturalWidth;
      var imgH = img.naturalHeight;
      if (!imgW || !imgH) return;

      var srcX = -(tx + cropRadius) / scale;
      var srcY = -(ty + cropRadius) / scale;
      var srcSize = (cropRadius * 2) / scale;

      var canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      var ctx = canvas.getContext("2d");

      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, outputSize, outputSize);

      var dataUrl = canvas.toDataURL("image/png");
      this._saveProfilePicture(dataUrl);
      if (this._pfpCropperCleanup) this._pfpCropperCleanup();
    },

    escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },
  };


  // Expose version and build globally
  window.SIENNA_VERSION = SIENNA_VERSION;
  window.SIENNA_BUILD = SIENNA_BUILD;


  window.siennaSettings.init();

  // ── Profile Picture Cropper + File Size Warning init ──
  (function initPfpModals() {
    var settings = window.siennaSettings;

    function setupWarningOverlay(overlayId, okBtnId) {
      var okBtn = document.getElementById(okBtnId);
      var overlay = document.getElementById(overlayId);
      if (!okBtn || !overlay) return;
      okBtn.addEventListener("click", function() {
        overlay.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
      });
      overlay.addEventListener("click", function(e) {
        if (e.target === overlay) {
          overlay.classList.remove("open");
          overlay.setAttribute("aria-hidden", "true");
        }
      });
    }

    setupWarningOverlay("fileSizeWarningOverlay", "fileSizeWarningOk");
    setupWarningOverlay("invalidImageOverlay", "invalidImageOk");

    // Profile picture cropper: Cancel button
    var cropperCancel = document.getElementById("pfpCropperCancel");
    var cropperOverlay = document.getElementById("pfpCropperOverlay");
    if (cropperCancel && cropperOverlay) {
      cropperCancel.addEventListener("click", function() {
        if (settings._pfpCropperCleanup) settings._pfpCropperCleanup();
      });
      cropperOverlay.addEventListener("click", function(e) {
        if (e.target === cropperOverlay) {
          if (settings._pfpCropperCleanup) settings._pfpCropperCleanup();
        }
      });
    }

    // Profile picture cropper: Save button
    var cropperConfirm = document.getElementById("pfpCropperConfirm");
    if (cropperConfirm) {
      cropperConfirm.addEventListener("click", function() {
        settings._doPfpCrop();
      });
    }

    // Close modals on Escape
    document.addEventListener("keydown", function(e) {
      if (e.key !== "Escape") return;
      if (cropperOverlay && cropperOverlay.classList.contains("open")) {
        if (settings._pfpCropperCleanup) settings._pfpCropperCleanup();
      }
      [].forEach.call(document.querySelectorAll(".file-size-warning-overlay.open"), function(el) {
        el.classList.remove("open");
        el.setAttribute("aria-hidden", "true");
      });
    });

    // Apply saved PFP to top nav avatar (runs after account inits)
    function applySavedPfp() {
      var pfp = settings._loadProfilePicture();
      if (pfp) {
        settings._updateTopNavAvatar(pfp);
      }
    }
    if (document.readyState === "complete") {
      setTimeout(applySavedPfp, 200);
    } else {
      window.addEventListener("load", function() { setTimeout(applySavedPfp, 200); });
    }
  })();

  // ── ?savemydata query param: auto-download user data ──
  // Uses a query parameter so it works with static hosting (no server-side routing needed)
  (function checkSaveMyDataRoute() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("clear")) {
      const tryClear = () => {
        if (window.siennaSettings?.wipeConfig) {
          window.siennaSettings.wipeConfig({ skipConfirm: true, cleanUrl: true });
        } else {
          setTimeout(tryClear, 100);
        }
      };
      tryClear();
      return;
    }

    if (params.has("savemydata")) {
      // Wait for settings to be ready, then download
      const tryDownload = () => {
        if (window.siennaSettings?.downloadData) {
          window.siennaSettings.downloadData();
          // After download, clean up the URL by removing the query param
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        } else {
          setTimeout(tryDownload, 100);
        }
      };
      tryDownload();
    }
  })();

  // ── Floating bubbles on the landing canvas ──
  (function initBubbles() {
    const canvas = document.getElementById('bubbleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let bubbles = [];
    let animId = null;
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function isEnabled() {
      return window.siennaSettings?.state?.bubblesEnabled !== false;
    }

    const count = Math.min(Math.floor((w * h) / 40000), 30);

    for (let i = 0; i < count; i++) {
      bubbles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 6 + Math.random() * 24,
        speed: 0.12 + Math.random() * 0.28,
        drift: (Math.random() - 0.5) * 0.2,
        opacity: 0.16 + Math.random() * 0.20,
        popped: false,
        popTimer: 0,
        hue: 190 + Math.random() * 40
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      if (!isEnabled()) {
        animId = requestAnimationFrame(draw);
        return;
      }

      for (const b of bubbles) {
        if (b.popped) {
          b.popTimer--;
          if (b.popTimer <= 0) {
            b.popped = false;
            b.x = Math.random() * w;
            b.y = h + b.r;
            b.r = 6 + Math.random() * 24;
            b.opacity = 0.16 + Math.random() * 0.20;
            b.hue = 190 + Math.random() * 40;
          }
          continue;
        }

        b.y -= b.speed;
        b.x += b.drift;

        if (b.y + b.r < 0) {
          b.y = h + b.r;
          b.x = Math.random() * w;
        }

        const grad = ctx.createRadialGradient(
          b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1,
          b.x, b.y, b.r
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${b.opacity * 0.9})`);
        grad.addColorStop(0.4, `rgba(200, 230, 255, ${b.opacity * 0.3})`);
        grad.addColorStop(0.7, `rgba(180, 220, 255, ${b.opacity * 0.15})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${b.opacity * 0.05})`);

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 255, ${b.opacity * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.7})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.15, b.y - b.r * 0.45, b.r * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.5})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    canvas.addEventListener('click', (e) => {
      if (!isEnabled()) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      for (const b of bubbles) {
        if (b.popped) continue;
        const dx = mx - b.x;
        const dy = my - b.y;
        if (dx * dx + dy * dy < b.r * b.r) {
          b.popped = true;
          b.popTimer = 30;
          break;
        }
      }
    });

    draw();
  })();

  // ── Tutorial Overlay ──
  (function initTutorial() {
    const slides = [
      {
        logo: true,
        title: "Welcome to sienna.",
        desc: "This is a minimal tutorial to show you a few core features of sienna.",
      },
      {
        image: "tutorial/customization.png",
        title: "Customization",
        desc: 'Pick a variety of themes to customize you\'re experience while using sienna.',
      },
          {
        image: "tutorial/games.png",
        title: "500+ Games",
        desc: 'We offer over 500 hand tested working games. (99%)',
      },
      {
        image: "tutorial/providers.png",
        title: "Not the games you want?",
        desc: 'You can use other providers such as <strong>gn-math</strong>, <strong>seraph</strong>, <strong>ckv</strong> and <strong>Lumin</strong> if we don\'t have the games you want.',
      },
      {
        image: "tutorial/account.png",
        title: "Cloud Saves! (new)",
        desc: 'Last but not least, you can create an account to save your data across all your devices <strong>(beta)</strong>.',
      },
            {
        logo: true,
        title: "Where do I find these?",
        desc: 'You can find everything mentioned + more in the settings button (top right) | thanks',
      },
    ];

    const overlay = document.getElementById("tutorialOverlay");
    const titleEl = document.getElementById("tutorialTitle");
    const descEl = document.getElementById("tutorialDesc");
    const logoEl = document.getElementById("tutorialLogo");
    const dotsEl = document.getElementById("tutorialDots");
    const prevBtn = document.getElementById("tutorialPrevBtn");
    const nextBtn = document.getElementById("tutorialNextBtn");
    const skipBtn = document.getElementById("tutorialSkipBtn");

    if (!overlay || !titleEl || !descEl || !logoEl || !dotsEl || !prevBtn || !nextBtn || !skipBtn) return;

    let currentSlide = 0;
    let imageEl = null;

    function hasSeenTutorial() {
      return storage.get(KEYS.tutorialSeen, "false") === "true";
    }

    function markSeen() {
      storage.set(KEYS.tutorialSeen, "true");
    }

    function renderDots() {
      dotsEl.innerHTML = slides.map((_, i) =>
        `<button class="tutorial-dot ${i === currentSlide ? "active" : ""}" data-index="${i}" type="button" aria-label="Slide ${i + 1}"></button>`
      ).join("");
      dotsEl.querySelectorAll(".tutorial-dot").forEach((dot) => {
        dot.addEventListener("click", () => {
          currentSlide = parseInt(dot.dataset.index, 10);
          renderSlide();
        });
      });
    }

    function renderSlide() {
      const slide = slides[currentSlide];

      titleEl.textContent = slide.title;
      descEl.innerHTML = slide.desc;

      // Remove previous image if exists
      if (imageEl) {
        imageEl.remove();
        imageEl = null;
      }

      if (slide.logo) {
        logoEl.style.display = "block";
      } else {
        logoEl.style.display = "none";
      }

      if (slide.image) {
        imageEl = document.createElement("img");
        imageEl.className = "tutorial-image";
        imageEl.src = slide.image;
        imageEl.alt = slide.title;
        // Insert after the logo
        if (logoEl.style.display !== "none") {
          logoEl.parentNode.insertBefore(imageEl, logoEl.nextSibling);
        } else {
          // Insert after the logo element (which is hidden)
          logoEl.parentNode.insertBefore(imageEl, logoEl.nextSibling);
        }
      }

      // Update dots
      dotsEl.querySelectorAll(".tutorial-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i === currentSlide);
      });

      // Update buttons
      prevBtn.style.visibility = currentSlide === 0 ? "hidden" : "visible";
      if (currentSlide === slides.length - 1) {
        nextBtn.textContent = "Done";
        nextBtn.classList.add("primary");
      } else {
        nextBtn.textContent = "Next";
        nextBtn.classList.add("primary");
      }
    }

    function show() {
      currentSlide = 0;
      renderDots();
      renderSlide();
      overlay.classList.add("visible");
      overlay.setAttribute("aria-hidden", "false");
    }

    function hide() {
      overlay.classList.remove("visible");
      overlay.setAttribute("aria-hidden", "true");
      markSeen();
      setTimeout(() => window.siennaSettings?.maybeShowUpdatesOnFirstVisit(), 350);
    }

    function goNext() {
      if (currentSlide < slides.length - 1) {
        currentSlide++;
        renderSlide();
      } else {
        hide();
      }
    }

    function goPrev() {
      if (currentSlide > 0) {
        currentSlide--;
        renderSlide();
      }
    }

    // Event listeners
    nextBtn.addEventListener("click", goNext);
    prevBtn.addEventListener("click", goPrev);
    skipBtn.addEventListener("click", hide);

    // Keyboard navigation
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hide();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    });

    // Show on first visit
    if (!hasSeenTutorial()) {
      // Show tutorial as soon as possible
      if (document.readyState === "complete") {
        setTimeout(show, 100);
      } else {
        window.addEventListener("DOMContentLoaded", () => setTimeout(show, 100));
      }
    } else {
      window.siennaSettings?.maybeShowUpdatesOnFirstVisit();
    }
  })();
})();
