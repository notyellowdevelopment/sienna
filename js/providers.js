/*

  night. renders every provider into its own grid, search, favorites, and game
  window. Providers only supply a list of games (name/url) and, for games that
  are raw HTML files on a CDN, the HTML so night.js can run them from a blob URL.

  Loaded before js/sienna.js; siennaSettings.applyGamesProvider() calls apply().
*/
(function () {
  'use strict';

  const NIGHT = {
    label: 'Night',
    base: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@main',
    magesJson: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@main/mages.json',
    appsJson: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@main/apps.json',
    mages: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@main/mages/',
    apps: 'https://cdn.jsdelivr.net/gh/yellowdevelopment/night@main/apps/',
  };

  const GN_MATH = {
    label: 'gn-math',
    zones: 'https://cdn.jsdelivr.net/gh/freebuisness/assets@latest/zones.json',
    covers: 'https://cdn.jsdelivr.net/gh/freebuisness/covers@main',
    html: 'https://cdn.jsdelivr.net/gh/freebuisness/html@main',
  };

  const UGS = {
    label: 'ugs',
    data: 'https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile@main/games.js',
    filesBase: 'https://cdn.jsdelivr.net/gh/bubbls/ugs-singlefile@main/UGS-Files/',
  };

  const LUMIN = {
    label: 'Lumin',
    script: 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js',
    pageSize: 999,
    maxPages: 999,
    imageConcurrency: 999,
  };

  const SERAPH = {
    label: 'Seraph',
    base: 'https://cdn.jsdelivr.net/gh/skibbsz/seraph@main',
    gamesJson: 'https://cdn.jsdelivr.net/gh/skibbsz/seraph@main/games.json',
    appsJson: 'https://cdn.jsdelivr.net/gh/skibbsz/seraph@main/apps.json',
  };

  const CKV = {
    label: 'ChickenKingsVault (ckv)',
    catalog: 'https://cdn.jsdelivr.net/gh/skibbsz/ChickenKingsVault@main/games.js',
    base: 'https://cdn.jsdelivr.net/gh/skibbsz/ChickenKingsVault@main',
    parse: parseCkvCatalog,
    cover: (game) => assetUrl(game?.img, CKV.base),
    unwrapFrames: true,
  };

  let activeProvider = 'night';
  const htmlCache = new Map();
  const libraries = { night: null, 'gn-math': null, ugs: null, Lumin: null, seraph: null, ckv: null };

  // Catalogs are fetched once per page load; a failure is not cached, so the next
  // provider switch retries it.
  async function loadLibrary(key, factory) {
    if (!libraries[key]) libraries[key] = await factory();
    return libraries[key];
  }

  // The same game can appear twice in a catalog (and a game can appear in more
  // than one of them).
  function dedupeByUrl(games) {
    const seen = new Set();
    return games.filter((game) => {
      if (!game?.url || seen.has(game.url)) return false;
      seen.add(game.url);
      return true;
    });
  }

  // '{HTML_URL}/game/index.html' → '<base>/game/index.html'
  function assetUrl(path, base) {
    const value = String(path || '').trim();
    if (!value) return '';
    const resolved = value.replace('{COVER_URL}', base).replace('{HTML_URL}', base);
    return /^[a-z][a-z\d+.-]*:/i.test(resolved)
      ? resolved
      : `${base.replace(/\/+$/, '')}/${resolved.replace(/^\/+/, '')}`;
  }

  // ugs slugs have no extension, so append ".html" (matching ugs' own loader).
  function normalizeUgsFileName(name) {
    const value = String(name || '');
    if (value.includes('.') && value.lastIndexOf('.') > 0) return value;
    return `${value}.html`;
  }

  async function fetchFirst(urls, type) {
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const value = await (type === 'json' ? response.json() : response.text());
        if (!value) continue;
        if (type === 'text' && /Couldn't find/i.test(value.slice(0, 200))) continue;
        return value;
      } catch (error) {
        // Unreachable source, try the next one.
      }
    }
    return null;
  }

  async function loadGnMathGames() {
    return loadLibrary('gn-math', async () => {
      const zones = await fetchFirst([GN_MATH.zones], 'json');
      if (!Array.isArray(zones)) throw new Error('gn-math library unavailable');

      return dedupeByUrl(zones.map((game, index) => ({
        name: String(game?.name || `gn-math ${index + 1}`).trim(),
        image: assetUrl(game?.cover, GN_MATH.covers),
        url: assetUrl(game?.url, GN_MATH.html),
        section: game?.special?.[0] || 'gn-math',
        author: game?.author || '',
        _provider: 'gn-math',
      })));
    });
  }

  async function loadUgsGames() {
    return loadLibrary('ugs', async () => {
      const text = await fetchFirst([UGS.data], 'text');
      if (!text) throw new Error('ugs library unavailable');

      // games.js is `let files = [ ... ];` — evaluate only that declaration so we
      // don't run ugs' own DOM loader.
      const start = text.indexOf('let files = ');
      const bracketStart = text.indexOf('[', start);
      const end = text.indexOf('];', bracketStart);
      if (start === -1 || bracketStart === -1 || end === -1) {
        throw new Error('ugs library has an unexpected format');
      }
      const files = new Function(`${text.slice(start, end + 1)}; return files;`)();
      if (!Array.isArray(files)) throw new Error('ugs library has no games');

      return dedupeByUrl(files
        .map((file) => String(file || '').trim())
        // Only "cl…" entries are games; the rest are dependencies (npm, esm, …).
        .filter((slug) => /^cl[a-z0-9]/i.test(slug))
        .map((slug) => ({
          name: slug.replace(/^cl/i, ''),
          image: '',
          url: `${UGS.filesBase}${encodeURIComponent(normalizeUgsFileName(slug))}`,
          section: 'ugs',
          author: '',
          _provider: 'ugs',
        })));
    });
  }

  // seraph catalog entries are { name, url, image } with repository-relative
  // paths ('/games/crossy/index.html').
  function mapSeraphGame(game, section) {
    const image = String(game?.image || '').trim().replace(/^\/?images\//, '/');
    return {
      name: String(game?.name || '').trim() || 'Untitled',
      image: image ? assetUrl(image, SERAPH.base) : '',
      url: assetUrl(game?.url, SERAPH.base),
      section,
      author: '',
      _provider: 'seraph',
      // Each page loads its own scripts and styles by relative path.
      _relativeAssets: true,
    };
  }

  async function loadSeraphGames() {
    return loadLibrary('seraph', async () => {
      const [games, apps] = await Promise.all([
        fetchFirst([SERAPH.gamesJson], 'json'),
        fetchFirst([SERAPH.appsJson], 'json'),
      ]);
      const asList = (value) => (Array.isArray(value) ? value : []);
      const toGames = (list, section) => dedupeByUrl(asList(list).map((game) => mapSeraphGame(game, section)));

      const categories = [
        { label: 'All Games', games: toGames(games, 'Games') },
        { label: 'All Apps', games: toGames(apps, 'Apps') },
      ];
      if (!categories.some((category) => category.games.length)) {
        throw new Error('seraph library unavailable');
      }
      return { categories };
    });
  }

  // ckv's games.js is the vault's markup, not JSON: one
  // `<a class="game-link" href="gamefiles/doom64.html"><img src="gameimages/doom64.jpg">…<div>Doom 64</div></a>`
  // card per game, so the href/img/<div> text are the game's url, cover and name
  // (names carry no entities, only raw '&', e.g. 'Command & Conquer').
  const CKV_CARD_RE = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  const CKV_IMAGE_RE = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/i;
  const CKV_NAME_RE = /<div\b[^>]*>([\s\S]*?)<\/div>/i;

  function parseCkvCatalog(text) {
    const source = String(text || '');
    const cards = [];
    CKV_CARD_RE.lastIndex = 0;
    let card;
    while ((card = CKV_CARD_RE.exec(source))) {
      const url = String(card[1] ?? card[2] ?? '').trim();
      if (!url) continue;
      const image = CKV_IMAGE_RE.exec(card[3]);
      const label = CKV_NAME_RE.exec(card[3]);
      cards.push({
        url,
        img: image ? String(image[1] ?? image[2] ?? '').trim() : '',
        name: label ? label[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '',
      });
    }
    // No cards means an error page, not a catalog.
    return cards.length ? cards : null;
  }

  // A flat catalog: one file listing every game, hosted on a CDN, each page
  // loading its siblings by relative path (ckv's shape).
  const FLAT_CATALOGS = { ckv: CKV };

  async function loadFlatCatalogGames(key) {
    const config = FLAT_CATALOGS[key];
    return loadLibrary(key, async () => {
      // ckv's games.js is HTML, not JSON, so it is fetched as text and turned
      // into the catalog shape by its `parse` hook.
      const catalog = config.parse
        ? config.parse(await fetchFirst([config.catalog], 'text'))
        : await fetchFirst([config.catalog], 'json');
      if (!Array.isArray(catalog)) throw new Error(`${config.label} library unavailable`);

      return dedupeByUrl(catalog.map((game, index) => ({
        name: String(game?.name || `${config.label} ${index + 1}`).trim(),
        image: config.cover(game),
        url: assetUrl(game?.url, config.base),
        section: config.label,
        author: '',
        _provider: config.label,
        // Every game is an HTML file that loads its siblings by relative path,
        // so gameHtml() pins a <base> at its folder on the CDN.
        _relativeAssets: true,
        // ckv's game files are the vault's toolbar pages framing the real game.
        _unwrapFrames: Boolean(config.unwrapFrames),
      })));
    });
  }

  let luminInstance = null;
  let luminReady = null;

  function ensureLumin() {
    if (luminInstance) return Promise.resolve(luminInstance);
    if (luminReady) return luminReady;

    luminReady = new Promise((resolve, reject) => {
      const boot = async () => {
        try {
          await window.Lumin.init({ headless: true });
          luminInstance = window.Lumin;
          resolve(luminInstance);
        } catch (error) {
          reject(error);
        }
      };

      if (window.Lumin?.init) {
        boot();
        return;
      }

      const script = document.createElement('script');
      script.src = LUMIN.script;
      script.async = true;
      script.dataset.siennaProvider = 'lumin';
      script.addEventListener('load', () => boot().catch(reject));
      script.addEventListener('error', () => reject(new Error('Lumin SDK failed to load')));
      document.head.appendChild(script);
    });
    // Allow a later retry if the SDK fails to load or init.
    luminReady.catch(() => { luminReady = null; });
    return luminReady;
  }

  async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    });
    await Promise.all(workers);
    return results;
  }

  function mapLuminGame(game) {
    const id = String(game?.id || '').trim();
    return {
      name: String(game?.name || '').trim() || 'Untitled',
      image: '',
      url: id ? `lumin:${id}` : '',
      section: game?.category || 'Lumin',
      author: '',
      _provider: 'lumin',
      _luminId: id,
      _luminImage: game?.image_token || '',
    };
  }

  async function loadLuminGames() {
    return loadLibrary('Lumin', async () => {
      const lumin = await ensureLumin();

      // Fetch the first page to learn the total page count, then the rest.
      const first = await lumin.getGames({ page: 1, limit: LUMIN.pageSize });
      const pages = Math.min(Math.max(1, first?.pages || 1), LUMIN.maxPages);
      const remaining = [];
      for (let p = 2; p <= pages; p++) {
        remaining.push(lumin.getGames({ page: p, limit: LUMIN.pageSize }));
      }
      const pageResults = [first, ...(await Promise.all(remaining))];

      const games = pageResults.flatMap((r) => (r && Array.isArray(r.games) ? r.games : []));
      const items = games.map(mapLuminGame).filter((g) => g.url);

      // Resolve cover images (blob URLs) in parallel.
      await mapLimit(items, LUMIN.imageConcurrency, async (item) => {
        try {
          if (item._luminImage) item.image = await lumin.getImageUrl(item._luminImage);
        } catch (error) {
          // Keep the fallback icon.
        }
        delete item._luminImage;
      });

      return { categories: [{ label: 'All Games', games: items }] };
    });
  }

  // Resolve a Lumin game's playable iframe URL (single-use token).
  async function gameUrl(game) {
    if (game?._provider !== 'lumin' || !game._luminId) return '';
    try {
      const lumin = await ensureLumin();
      const result = await lumin.getGameUrl(game._luminId);
      return result?.url || '';
    } catch (error) {
      return '';
    }
  }

  function mapNightGame(game, htmlBase) {
    const url = String(game?.url || '').trim();
    const image = String(game?.image || '').trim();
    return {
      name: String(game?.name || '').trim() || 'Untitled',
      image: image ? `${NIGHT.base}/${image.replace(/^\/+/, '')}` : '',
      url: url ? `${htmlBase}${url.replace(/^\/+/, '')}` : '',
      section: game?.section || '',
      author: game?.author || '',
      _provider: 'night',
    };
  }

  // night exposes two catalogs (Games + Apps); the other providers return one.
  async function loadNightGames() {
    return loadLibrary('night', async () => {
      const [mages, apps] = await Promise.all([
        fetchFirst([NIGHT.magesJson], 'json'),
        fetchFirst([NIGHT.appsJson], 'json'),
      ]);
      const asList = (value) => (Array.isArray(value) ? value : []);
      const toGames = (list, base) => dedupeByUrl(asList(list).map((game) => mapNightGame(game, base)));

      return {
        categories: [
          { label: 'All Games', games: toGames(mages, NIGHT.mages) },
          { label: 'All Apps', games: toGames(apps, NIGHT.apps) },
        ],
      };
    });
  }

  // Pins a <base> tag at the game's folder on the CDN so its relative asset
  // paths ('UnityProgress.js', 'slope_new.json') resolve. A blob URL has no
  // directory, so without this siblings would be requested from our own origin.
  function pinHtmlBase(html, url) {
    if (!html || /<base[\s>]/i.test(html)) return html;
    const source = String(url || '');
    const dir = source.slice(0, source.lastIndexOf('/') + 1);
    if (!/^https?:\/\//i.test(dir)) return html;
    const tag = `<base href="${dir}">`;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/<head[^>]*>/i, (match) => `${match}\n    ${tag}`);
    }
    if (/<html[^>]*>/i.test(html)) {
      return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${tag}</head>`);
    }
    return `${tag}${html}`;
  }

  // A toolbar page framing the real game cannot run from a blob URL: its nested
  // <iframe src> goes to the CDN, and jsDelivr serves .html as text/plain, so the
  // source is shown instead of the game (every file in ckv's gamefiles/). Follow
  // the frame while it stays inside the same CDN repository - a frame pointing
  // elsewhere, or a document that cannot be fetched, keeps the wrapper.
  const FRAME_SRC_RE = /<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
  const UNWRAP_MAX_HOPS = 3;

  // '…/gh/user/repo@ref/gamefiles/game.html' → '…/gh/user/repo@ref/'
  function repoRootOf(url) {
    try {
      const parsed = new URL(String(url || ''));
      const match = parsed.pathname.match(/^(\/gh\/[^/]+\/[^@/]+@[^/]+)\//);
      return `${parsed.origin}${match ? match[1] : ''}/`;
    } catch (error) {
      return '';
    }
  }

  // Returns the deepest playable document and the URL it came from, so the
  // caller can pin a <base> at the right folder.
  async function unwrapGameFrames(html, pageUrl) {
    let current = { html, url: String(pageUrl || '') };
    const root = repoRootOf(current.url);
    if (!root) return current;

    const seen = new Set([current.url]);
    for (let hop = 0; hop < UNWRAP_MAX_HOPS; hop++) {
      const frame = current.html.match(FRAME_SRC_RE);
      const src = frame ? String(frame[1] ?? frame[2] ?? frame[3] ?? '').trim() : '';
      if (!src) return current;

      let nested;
      try {
        nested = new URL(src, current.url).href;
      } catch (error) {
        return current;
      }
      if (!nested.startsWith(root) || !/\.html?($|[?#])/i.test(nested) || seen.has(nested)) {
        return current;
      }

      const nestedHtml = await fetchFirst([nested], 'text');
      // Keep the wrapper rather than swapping in a blank page.
      if (!nestedHtml) return current;

      seen.add(nested);
      current = { html: nestedHtml, url: nested };
    }
    return current;
  }

  // Games are written to be served from their own folder on the CDN, but night.js
  // plays them from a blob URL. A blob URL's path is opaque, so a relative
  // reference resolved against it throws - Unity's WebGL loader (2021.2+) runs
  // `new URL(streamingAssetsUrl, document.URL)`, which dies with 'StreamingAssets
  // is not a valid URL' and leaves the canvas blank. Only calls that would throw
  // are retried, against the document's own <base> and then the folder the HTML
  // came from, so pages that resolve their own URLs are untouched.
  const blobUrlCompatScript = (dir) => `<script>
  (function () {
    var Native = window.URL;
    if (!Native || !Native.createObjectURL) return;
    var ABSOLUTE = /^[a-z][a-z0-9+.-]*:/i;
    var OPAQUE = /^(?:blob|about|data|filesystem|javascript):/i;
    var fallback = ${JSON.stringify(dir)};
    function resolve(input, base) {
      if (typeof input !== 'string' || !input || ABSOLUTE.test(input) || input.slice(0, 2) === '//') return null;
      var bases = [document.baseURI, fallback];
      for (var i = 0; i < bases.length; i++) {
        if (!bases[i] || bases[i] === base || OPAQUE.test(bases[i])) continue;
        try { return new Native(input, bases[i]); } catch (error) { /* try the next base */ }
      }
      return null;
    }
    function Url(input, base) {
      if (!new.target) throw new TypeError("Failed to construct 'URL': Please use the 'new' operator.");
      try {
        return arguments.length > 1 ? new Native(input, base) : new Native(input);
      } catch (error) {
        var fixed = typeof base === 'string' && OPAQUE.test(base) ? resolve(input, base) : null;
        if (fixed) return fixed;
        throw error;
      }
    }
    Url.prototype = Native.prototype;
    Object.setPrototypeOf(Url, Native);
    window.URL = Url;
  })();
<\/script>`;

  // Injected at the same spots as the <base> tag, ahead of the page's own scripts.
  function pinBlobUrlCompat(html, url) {
    if (!html) return html;
    const source = String(url || '');
    const dir = source.slice(0, source.lastIndexOf('/') + 1);
    if (!/^https?:\/\//i.test(dir)) return html;
    const tag = blobUrlCompatScript(dir);
    if (/<base\b[^>]*>/i.test(html)) return html.replace(/<base\b[^>]*>/i, (match) => `${match}${tag}`);
    if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (match) => `${match}\n    ${tag}`);
    if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${tag}</head>`);
    return `${tag}${html}`;
  }

  // Game HTML (played from a blob URL by night.js). A provider marks the games
  // whose HTML loads sibling files with `_relativeAssets`, so they get a <base>
  // at the folder of the document that is actually played.
  async function gameHtml(game) {
    if (!game?._provider || !game.url || game._provider === 'lumin') return '';
    if (htmlCache.has(game.url)) return htmlCache.get(game.url);

    let html = await fetchFirst([game.url], 'text');
    let sourceUrl = game.url;
    if (html && game._unwrapFrames) {
      const unwrapped = await unwrapGameFrames(html, game.url);
      html = unwrapped.html;
      sourceUrl = unwrapped.url;
    }
    if (html && game._relativeAssets) html = pinHtmlBase(html, sourceUrl);
    // Every provider game runs from a blob URL, whatever it loads.
    if (html) html = pinBlobUrlCompat(html, sourceUrl);
    if (html) htmlCache.set(game.url, html);
    return html || '';
  }

  async function download(game) {
    const html = game?.html || (await gameHtml(game));
    if (!html) return false;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    link.download = `${String(game.name || 'game').replace(/[^\w-]+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  }

  // Bring night's own grid back after another provider's view was shown.
  function showNightView() {
    ['browseGrid', 'favoritesSection', 'featured', 'featuredDots'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    document.querySelectorAll('.browse-top, .grid-section-label').forEach((el) => {
      el.style.display = '';
    });
  }

  // Status line in the grid; also works before night.js has booted.
  function showGridMessage(text) {
    if (window.nightLibrary) {
      window.nightLibrary.showMessage(text);
      return;
    }
    const grid = document.getElementById('browseGrid');
    if (grid) grid.innerHTML = `<p class="browse-empty">${text}</p>`;
    const label = document.getElementById('titlesCount');
    if (label) label.textContent = text;
  }

  function waitForNight(callback) {
    if (window.nightLibrary) {
      callback();
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      if (window.nightLibrary) {
        clearInterval(timer);
        callback();
      } else if (++tries > 120) {
        clearInterval(timer);
      }
    }, 50);
  }

  // Providers that render onto the night. grid.
  const GRID_PROVIDERS = {
    night: { label: NIGHT.label, load: loadNightGames },
    Lumin: { label: LUMIN.label, load: loadLuminGames },
    'gn-math': { label: GN_MATH.label, load: loadGnMathGames },
    ugs: { label: UGS.label, load: loadUgsGames },
    seraph: { label: SERAPH.label, load: loadSeraphGames },
    ckv: { label: CKV.label, load: () => loadFlatCatalogGames('ckv') },
  };

  function apply(provider) {
    activeProvider = GRID_PROVIDERS[provider] ? provider : 'night';
    const request = activeProvider;

    showNightView();

    const config = GRID_PROVIDERS[request];
    showGridMessage(`Loading ${config.label} games…`);
    waitForNight(() => {
      if (activeProvider !== request) return; // switched away while waiting
      config.load()
        .then((result) => {
          if (activeProvider !== request) return;
          const categories = result && Array.isArray(result.categories)
            ? result.categories
            : [{ label: 'All Games', games: Array.isArray(result) ? result : [] }];
          window.nightLibrary.setLibrary(categories, { label: config.label });
        })
        .catch((error) => {
          console.error(`providers: failed to load ${config.label} games`, error);
          if (activeProvider === request) {
            window.nightLibrary.showMessage(`${config.label} games failed to load. Pick another provider in Settings.`);
          }
        });
    });
  }

  window.siennaProviders = {
    apply,
    // Game HTML to run from a blob URL (empty string when not a provider game).
    gameHtml,
    // Playable iframe URL for a Lumin game (empty otherwise).
    gameUrl,
    supportsDownload: (game) => Boolean(game?._provider && game._provider !== 'lumin') || typeof game?.html === 'string',
    download,
  };
})();
