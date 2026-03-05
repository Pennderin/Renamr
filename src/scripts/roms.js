// ── ROM Renamer Module ────────────────────────────────────────────

const ROM_PLATFORM_MAP = {
  // Nintendo
  nes:   { name: 'Nintendo Entertainment System',          short: 'NES',    igdbId: 18  },
  snes:  { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  sfc:   { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  smc:   { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  fig:   { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  bs:    { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  st:    { name: 'Super Nintendo Entertainment System',    short: 'SNES',   igdbId: 19  },
  n64:   { name: 'Nintendo 64',                            short: 'N64',    igdbId: 4   },
  z64:   { name: 'Nintendo 64',                            short: 'N64',    igdbId: 4   },
  v64:   { name: 'Nintendo 64',                            short: 'N64',    igdbId: 4   },
  gb:    { name: 'Game Boy',                               short: 'GB',     igdbId: 33  },
  gbc:   { name: 'Game Boy Color',                         short: 'GBC',    igdbId: 22  },
  gba:   { name: 'Game Boy Advance',                       short: 'GBA',    igdbId: 24  },
  nds:   { name: 'Nintendo DS',                            short: 'NDS',    igdbId: 20  },
  '3ds': { name: 'Nintendo 3DS',                           short: '3DS',    igdbId: 37  },
  cia:   { name: 'Nintendo 3DS',                           short: '3DS',    igdbId: 37  },
  cci:   { name: 'Nintendo 3DS',                           short: '3DS',    igdbId: 37  },
  wad:   { name: 'Wii',                                    short: 'Wii',    igdbId: 5   },
  wbfs:  { name: 'Wii',                                    short: 'Wii',    igdbId: 5   },
  gcz:   { name: 'Nintendo GameCube',                      short: 'GC',     igdbId: 21  },
  rvz:   { name: 'Nintendo GameCube',                      short: 'GC',     igdbId: 21  },
  xci:   { name: 'Nintendo Switch',                        short: 'Switch', igdbId: 130 },
  nsp:   { name: 'Nintendo Switch',                        short: 'Switch', igdbId: 130 },
  nsz:   { name: 'Nintendo Switch',                        short: 'Switch', igdbId: 130 },
  // Sony
  psx:   { name: 'PlayStation',                            short: 'PS1',    igdbId: 7   },
  pbp:   { name: 'PlayStation',                            short: 'PS1',    igdbId: 7   },
  cso:   { name: 'PlayStation Portable',                   short: 'PSP',    igdbId: 38  },
  // Sega
  md:    { name: 'Sega Mega Drive/Genesis',                short: 'Genesis',igdbId: 29  },
  smd:   { name: 'Sega Mega Drive/Genesis',                short: 'Genesis',igdbId: 29  },
  gen:   { name: 'Sega Mega Drive/Genesis',                short: 'Genesis',igdbId: 29  },
  gg:    { name: 'Game Gear',                              short: 'GG',     igdbId: 35  },
  '32x': { name: 'Sega 32X',                               short: '32X',    igdbId: 30  },
  pce:   { name: 'PC Engine TurboGrafx-16',                short: 'PCE',    igdbId: 86  },
  // Atari
  a26:   { name: 'Atari 2600',                             short: 'A2600',  igdbId: 59  },
  a52:   { name: 'Atari 5200',                             short: 'A5200',  igdbId: 66  },
  a78:   { name: 'Atari 7800',                             short: 'A7800',  igdbId: 60  },
  lnx:   { name: 'Atari Lynx',                             short: 'Lynx',   igdbId: 61  },
  // SNK
  ngp:   { name: 'Neo Geo Pocket',                         short: 'NGP',    igdbId: 119 },
  ngc:   { name: 'Neo Geo Pocket Color',                   short: 'NGPC',   igdbId: 120 },
  // Bandai
  ws:    { name: 'WonderSwan',                             short: 'WS',     igdbId: 57  },
  wsc:   { name: 'WonderSwan Color',                       short: 'WSC',    igdbId: 123 },
  // Multi-format disc images (best-guess defaults)
  iso:   { name: 'PlayStation 2',                          short: 'PS2',    igdbId: 8   },
  chd:   { name: 'Arcade',                                 short: 'Arcade', igdbId: 52  },
  cdi:   { name: 'Dreamcast',                              short: 'DC',     igdbId: 23  },
  nrg:   { name: 'PlayStation 2',                          short: 'PS2',    igdbId: 8   },
  img:   { name: 'PlayStation 2',                          short: 'PS2',    igdbId: 8   },
  bin:   { name: 'PlayStation',                            short: 'PS1',    igdbId: 7   },
  cue:   { name: 'PlayStation',                            short: 'PS1',    igdbId: 7   },
};

const ROM_EXTS = new Set(Object.keys(ROM_PLATFORM_MAP).map(e => '.' + e));

// ── ES-DE system folder name map ──────────────────────────────────
// Maps platform short name → ES-DE Frontend folder name
const ES_DE_SYSTEM_MAP = {
  'NES':     'nes',
  'SNES':    'snes',
  'N64':     'n64',
  'GB':      'gb',
  'GBC':     'gbc',
  'GBA':     'gba',
  'NDS':     'nds',
  '3DS':     'n3ds',
  'Wii':     'wii',
  'GC':      'gc',
  'Switch':  'switch',
  'PS1':     'psx',
  'PS2':     'ps2',
  'PSP':     'psp',
  'Genesis': 'genesis',
  'GG':      'gamegear',
  '32X':     'sega32x',
  'PCE':     'pcengine',
  'A2600':   'atari2600',
  'A5200':   'atari5200',
  'A7800':   'atari7800',
  'Lynx':    'atarilynx',
  'NGP':     'ngp',
  'NGPC':    'ngpc',
  'WS':      'wonderswan',
  'WSC':     'wonderswancolor',
  'Arcade':  'arcade',
  'DC':      'dreamcast',
};

// ── No-Intro filename parser ──────────────────────────────────────
function parseRomFilename(filename) {
  // Strip extension
  let base = filename.replace(/\.[^.]+$/, '');

  // Collect all parenthetical and bracket groups
  const allParens = [];
  base.replace(/\(([^)]+)\)/g, (_, c) => { allParens.push(c); return ''; });
  const allBrackets = [];
  base.replace(/\[([^\]]+)\]/g, (_, c) => { allBrackets.push(c); return ''; });

  const REGIONS = ['USA','US','Europe','EUR','Japan','JPN','JP','World',
    'Australia','Korea','China','Germany','France','Spain','Italy',
    'Brazil','Netherlands','Sweden','Russia','Poland','Taiwan','Asia'];
  const REGION_NORM = { US: 'USA', EUR: 'Europe', JPN: 'Japan', JP: 'Japan' };

  // Region: check parens first, then brackets (Switch uses [US], [EUR], etc.)
  let region = '';
  for (const p of [...allParens, ...allBrackets]) {
    const parts = p.split(',').map(s => s.trim());
    if (parts.some(r => REGIONS.includes(r))) { region = p.trim(); break; }
  }
  if (REGION_NORM[region]) region = REGION_NORM[region];

  let revision = '';
  for (const p of allParens) {
    if (/^Rev\s+/i.test(p) || /^v\d/i.test(p)) { revision = p.trim(); break; }
  }

  // ── Disc detection ────────────────────────────────────────────
  let disc = null;
  for (const p of allParens) {
    const m = p.match(/^Dis[ck]\s*(\d)$/i);
    if (m) { disc = 'Disc ' + m[1]; break; }
  }

  // ── Content type + version detection ─────────────────────────
  let contentType = 'game';
  let version = '';

  // Switch TitleID: 16-char hex string in brackets
  // Last 3 hex digits: 000 = base game, 800 = update, else = DLC
  for (const b of allBrackets) {
    if (/^[0-9A-Fa-f]{16}$/.test(b.trim())) {
      const lastByte = parseInt(b.trim().slice(-3), 16);
      if (lastByte === 0x800) { contentType = 'update'; }
      else if (lastByte !== 0) { contentType = 'dlc'; }
      break; // Only one TitleID per filename
    }
  }

  // Check brackets for explicit tags (these override TitleID detection)
  for (const b of allBrackets) {
    const bt = b.trim();
    // v1.2.3 style OR v589824 Nintendo decimal — make dots optional
    if (/^v\d+(\.\d+)*$/i.test(bt) && !version) { version = bt; continue; }
    if (/^(Update|Patch|UPD)$/i.test(bt)) { contentType = 'update'; continue; }
    if (/^(DLC|Add-On|AddOn|Content|Addon)$/i.test(bt)) { contentType = 'dlc'; continue; }
  }

  // Fall back to parens if not yet determined
  if (contentType === 'game') {
    for (const p of allParens) {
      const pt = p.trim();
      if (/^(Update|Patch)$/i.test(pt)) { contentType = 'update'; break; }
      if (/^(DLC)$/i.test(pt)) { contentType = 'dlc'; break; }
      if (/^v\d+(\.\d+)*$/i.test(pt) && !version) {
        version = pt;
        contentType = 'update';
        break;
      }
    }
  }

  // Strip ALL parenthetical/bracket groups from title
  let cleanTitle = base
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim();

  // Strip inline version from title body — e.g., "Kirby v1.1.0" → "Kirby"
  // Prefer human-readable x.y.z format over Nintendo decimal bracket versions
  const bodyVersion = cleanTitle.match(/\s+(v\d+(\.\d+)+)\s*$/i);
  if (bodyVersion) {
    version = bodyVersion[1]; // override bracket version with readable one
    if (contentType === 'game') contentType = 'update'; // don't override an already-detected DLC tag
    cleanTitle = cleanTitle.replace(bodyVersion[0], '').trim();
  }

  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return { cleanTitle, region, revision, disc, contentType, version };
}

// ── Helper: escape HTML ───────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Roms module ───────────────────────────────────────────────────
const Roms = {
  files: [],
  _searchResults: [],
  _dialogResolve: null,
  _batchSource: 'igdb',
  _ctxMenuIndex: -1,

  // ── File ingestion ──────────────────────────────────────────────
  async addFiles() {
    const paths = await api.openFiles([{
      name: 'All Media & ROM Files',
      extensions: [...['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts','mpg','mpeg','mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'], ...Object.keys(ROM_PLATFORM_MAP)]
    }, {
      name: 'All Files',
      extensions: ['*']
    }]);
    if (!paths || paths.length === 0) return;
    await this._addPaths(paths);
  },

  async addFolder() {
    const dir = await api.openDirectory();
    if (!dir) return;
    const scanned = await api.scanFiles(dir, 'roms');
    await this._addPaths(scanned.map(f => f.path));
  },

  async handleDrop(paths) {
    if (!paths || paths.length === 0) return;
    await this._addPaths(paths);
  },

  async _addPaths(paths) {
    let added = 0;
    for (const p of paths) {
      if (this.files.some(f => f.path === p)) continue;
      const name    = pathBasename(p);
      const ext     = getExtension(name).toLowerCase();
      if (!ROM_EXTS.has(ext)) continue;

      const extKey      = ext.slice(1);
      const platformInfo = ROM_PLATFORM_MAP[extKey] || {
        name: 'Unknown Platform', short: extKey.toUpperCase(), igdbId: null
      };
      const { cleanTitle, region, revision, disc, contentType, version } = parseRomFilename(name);

      this.files.push({
        path: p, name, ext,
        dir: pathDirname(p),
        cleanTitle,
        region,
        revision,
        disc,
        contentType,
        version,
        platform: platformInfo,
        match: null,
        newName: '', newPath: '',
        selected: true, status: 'pending'
      });
      added++;
    }

    if (added > 0) {
      this.render();
      showToast(`Added ${added} ROM file${added !== 1 ? 's' : ''}`, 'success');
    }
  },

  // ── Matching ────────────────────────────────────────────────────
  async matchAll(source) {
    source = source || 'igdb';
    this._batchSource = source;
    if (source === 'igdb') {
      const clientId = await api.getStore('igdbClientId');
      if (!clientId) {
        showToast('Set IGDB credentials in Settings first', 'error');
        return;
      }
    }
    for (const file of this.files) {
      if (file.match) continue;
      await this._matchFile(file, source);
    }
  },

  async _matchFile(file, source) {
    source = source || this._batchSource || 'igdb';
    file.status = 'searching';
    this.render();

    const query   = file.cleanTitle || getBaseName(file.name).replace(/\./g, ' ');
    let results;

    if (source === 'ia') {
      results = await api.iaSearch(query, file.platform?.short);
    } else {
      const platformId = file.platform?.igdbId || null;
      results = await api.igdbSearch(query, platformId);
    }

    if (!results || results.error || results.length === 0) {
      file.status = 'error';
      this.render();
      return;
    }

    const uniqueTitles = [...new Set(results.map(r => r.title))];
    if (uniqueTitles.length === 1) {
      file.match  = results[0];
      if (file.match.category === 1 && file.contentType === 'game') file.contentType = 'dlc';
      file.status = 'matched';
      await this.updateNewName(file);
      this.render();
    } else {
      file.status = 'pending';
      this.render();
      await this._showSelectionDialog(this.files.indexOf(file), results, query);
    }
  },

  // ── Search helpers ──────────────────────────────────────────────
  _platformOptions(currentIgdbId) {
    const seen = new Set();
    const platforms = [];
    for (const p of Object.values(ROM_PLATFORM_MAP)) {
      if (p.igdbId && !seen.has(p.igdbId)) {
        seen.add(p.igdbId);
        platforms.push(p);
      }
    }
    platforms.sort((a, b) => a.name.localeCompare(b.name));
    return `<option value="">All Platforms</option>` +
      platforms.map(p =>
        `<option value="${p.igdbId}" data-short="${escHtml(p.short)}"${p.igdbId === currentIgdbId ? ' selected' : ''}>${escHtml(p.name)}</option>`
      ).join('');
  },

  // ── Search dialogs ──────────────────────────────────────────────
  _showSelectionDialog(fileIndex, results, query) {
    this._searchResults = results;
    const file = this.files[fileIndex];

    return new Promise(resolve => {
      this._dialogResolve = resolve;

      showModal(`Select Match — ${escHtml(file.name)}`, `
        <div class="modal-search">
          <input type="text" class="input" id="rom-search-input"
                 value="${escHtml(query)}" placeholder="Search game title..." />
          <select class="input" id="rom-search-platform" style="flex:0 0 auto;width:auto;max-width:200px;">
            ${this._platformOptions(file.platform?.igdbId)}
          </select>
          <button class="btn btn-primary" onclick="Roms.doSearch(${fileIndex})">Search</button>
          <button class="btn" onclick="Roms.skipMatch()">Skip</button>
        </div>
        <div id="rom-search-count" style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;">
          ${results.length} result${results.length !== 1 ? 's' : ''} — click to select
        </div>
        <div class="modal-results" id="rom-search-results">${this._renderResults(results, fileIndex)}</div>
      `);

      setTimeout(() => {
        const el = document.getElementById('rom-search-input');
        el?.focus();
        el?.addEventListener('keydown', e => { if (e.key === 'Enter') Roms.doSearch(fileIndex); });
      }, 80);

      // Resolve if modal is closed externally (backdrop click, X button)
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
        const observer = new MutationObserver(() => {
          if (overlay.classList.contains('hidden')) {
            observer.disconnect();
            if (this._dialogResolve) {
              this._dialogResolve(null);
              this._dialogResolve = null;
            }
          }
        });
        observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
      }
    });
  },

  skipMatch() {
    const resolver = this._dialogResolve;
    this._dialogResolve = null;
    hideModal();
    if (resolver) resolver(null);
  },

  showSearch(index) {
    const file  = this.files[index];
    const query = file.cleanTitle || getBaseName(file.name);
    showModal(`Search — ${escHtml(file.name)}`, `
      <div class="modal-search">
        <input type="text" class="input" id="rom-search-input"
               value="${escHtml(query)}" placeholder="Search game title..." />
        <select class="input" id="rom-search-platform" style="flex:0 0 auto;width:auto;max-width:200px;">
          ${this._platformOptions(file.platform?.igdbId)}
        </select>
        <button class="btn btn-primary" onclick="Roms.doSearch(${index})">Search</button>
      </div>
      <div class="modal-results" id="rom-search-results">
        <p style="color:var(--text-tertiary);font-size:13px;">Press Search or Enter</p>
      </div>
    `);
    setTimeout(() => {
      const el = document.getElementById('rom-search-input');
      el?.focus();
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') Roms.doSearch(index); });
    }, 80);
  },

  async doSearch(index) {
    const input          = document.getElementById('rom-search-input');
    const platformSelect = document.getElementById('rom-search-platform');
    const resultsEl      = document.getElementById('rom-search-results');
    if (!input?.value.trim()) return;
    resultsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">Searching...</div>';
    const file   = this.files[index];
    const source = this._batchSource || 'igdb';

    // Use platform from the select if set, otherwise fall back to file's platform
    const selVal   = platformSelect?.value;
    const platformId    = selVal ? parseInt(selVal) : (file.platform?.igdbId || null);
    const platformShort = platformSelect?.selectedOptions?.[0]?.dataset?.short || file.platform?.short;

    let results;
    if (source === 'ia') {
      results = await api.iaSearch(input.value.trim(), platformShort);
    } else {
      results = await api.igdbSearch(input.value.trim(), platformId);
    }
    if (!results || results.error || results.length === 0) {
      resultsEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;padding:10px;">No results found</p>';
      return;
    }
    this._searchResults = results;
    resultsEl.innerHTML = this._renderResults(results, index);
    const countEl = document.getElementById('rom-search-count');
    if (countEl) countEl.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} — click to select`;
  },

  _renderResults(results, fileIndex) {
    return results.map((r, i) => `
      <div class="search-result" onclick="Roms.selectMatch(${fileIndex}, ${i})">
        ${r.coverUrl
          ? `<img src="${escHtml(r.coverUrl)}" alt=""
               style="width:40px;height:56px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`
          : `<div style="width:40px;height:56px;background:var(--bg-active);border-radius:4px;
               display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🎮</div>`
        }
        <div class="search-result-info">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="search-result-title">${escHtml(r.title)}</span>
            <span class="search-result-year">${r.year || 'N/A'}</span>
            ${r.source === 'IA'
              ? `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:#2d6a2d;color:#fff;">IA</span>`
              : `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:#6a4c93;color:#fff;">IGDB</span>`
            }
          </div>
          ${r.platform ? `<div style="font-size:10.5px;color:var(--text-tertiary);margin-top:2px;">${escHtml(r.platform)}</div>` : ''}
          ${r.genre    ? `<div style="font-size:10.5px;color:var(--text-tertiary);">${escHtml(r.genre)}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  async selectMatch(fileIndex, resultIndex) {
    const file  = this.files[fileIndex];
    const match = this._searchResults[resultIndex];
    file.match  = match;
    if (match.category === 1 && file.contentType === 'game') file.contentType = 'dlc';
    file.status = 'matched';
    await this.updateNewName(file);
    this.render();
    // Clear resolver before hideModal so the MutationObserver doesn't double-resolve
    const resolver = this._dialogResolve;
    this._dialogResolve = null;
    hideModal();
    if (resolver) resolver(match);
    showToast(`Matched: ${match.title}${match.year ? ' (' + match.year + ')' : ''}`, 'success');
  },

  // ── Naming ──────────────────────────────────────────────────────
  async updateNewName(file) {
    if (!file.match) return;
    const formatKeyMap = {
      game:   { key: 'defaultRomFormat',       def: FormatEngine.defaults.rom       },
      dlc:    { key: 'defaultRomDlcFormat',    def: FormatEngine.defaults.romDlc    },
      update: { key: 'defaultRomUpdateFormat', def: FormatEngine.defaults.romUpdate },
    };
    const { key: fmtKey, def: fmtDefault } = formatKeyMap[file.contentType] || formatKeyMap.game;
    const format        = await api.getStore(fmtKey) || fmtDefault;
    const outputDir     = await api.getStore('outputDirectory');
    const articleFolder = await api.getStore('romArticleFolder');
    const articleFile   = await api.getStore('romArticleFile');
    const useEsDe       = await api.getStore('romEsDeNames');
    const match         = file.match;

    const shortName  = file.platform?.short || match.platformAbbrev || '';
    const esdeSystem = ES_DE_SYSTEM_MAP[shortName] || shortName.toLowerCase();

    const data = {
      title:         match.title         || '',
      year:          match.year          || '',
      platform:      useEsDe ? esdeSystem : (file.platform?.name || match.platform || ''),
      platformShort: useEsDe ? esdeSystem : shortName,
      esdeSystem,
      genre:         match.genre         || '',
      developer:     match.developer     || '',
      region:        file.region         || '',
      disc:          file.disc           || '',
      contentType:   file.contentType === 'game' ? '' : (file.contentType === 'dlc' ? 'DLC' : 'Update'),
      version:       file.version        || '',
    };

    let formatted = FormatEngine.apply(format, data);
    formatted     = FormatEngine.applyArticleSuffix(formatted, articleFolder, articleFile);
    file.newName  = formatted + file.ext;

    const baseDir = outputDir || file.dir;
    file.newPath  = joinPath(baseDir, file.newName);
  },

  async reapplyFormat() {
    for (const file of this.files) {
      if (file.match) await this.updateNewName(file);
    }
    this.render();
  },

  refresh() {
    for (const file of this.files) {
      file.match   = null;
      file.newName = '';
      file.newPath = '';
      file.status  = 'pending';
    }
    this.render();
    showToast('ROM matches cleared', 'info');
  },

  async renameAll() {
    const ops = this.files
      .filter(f => f.selected && f.match && f.newPath)
      .map(f => ({ oldPath: f.path, newPath: f.newPath }));
    if (ops.length === 0) {
      showToast('No matched ROMs to rename', 'error');
      return;
    }
    const results     = await api.renameFiles(ops);
    const successCount = results.filter(r => r.success).length;
    const failCount    = results.filter(r => !r.success).length;
    for (const file of this.files) {
      const res = results.find(r => r.source === file.path);
      if (res) {
        file.status = res.success ? 'done' : 'error';
        if (res.success) file.path = res.target;
      }
    }
    this.render();
    showToast(
      `Renamed ${successCount} ROM${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
      successCount > 0 ? 'success' : 'error'
    );
  },

  toggleAll(checked) {
    this.files.forEach(f => f.selected = checked);
    this.render();
  },

  clear() {
    this.files = [];
    this.render();
  },

  // ── Row context menu ────────────────────────────────────────────
  showRowMenu(index, event) {
    event.preventDefault();
    if (typeof hideSourceMenus === 'function') hideSourceMenus();
    this._ctxMenuIndex = index;
    const file = this.files[index];
    const menu = document.getElementById('rom-row-menu');
    if (!menu) return;

    // Update disc checkmarks
    document.getElementById('rom-ctx-disc-none').textContent = (!file.disc ? '✓ ' : '') + 'None';
    document.getElementById('rom-ctx-disc-1').textContent    = (file.disc === 'Disc 1' ? '✓ ' : '') + 'Disc 1';
    document.getElementById('rom-ctx-disc-2').textContent    = (file.disc === 'Disc 2' ? '✓ ' : '') + 'Disc 2';
    document.getElementById('rom-ctx-disc-3').textContent    = (file.disc === 'Disc 3' ? '✓ ' : '') + 'Disc 3';
    document.getElementById('rom-ctx-disc-4').textContent    = (file.disc === 'Disc 4' ? '✓ ' : '') + 'Disc 4';

    // Update content type checkmarks
    document.getElementById('rom-ctx-type-game').textContent   = (file.contentType === 'game'   ? '✓ ' : '') + 'Game';
    document.getElementById('rom-ctx-type-dlc').textContent    = (file.contentType === 'dlc'    ? '✓ ' : '') + 'DLC';
    document.getElementById('rom-ctx-type-update').textContent = (file.contentType === 'update' ? '✓ ' : '') + 'Update';

    // Position near cursor, clamped to viewport
    const menuW = 170, menuH = 380;
    const x = Math.min(event.clientX, window.innerWidth  - menuW - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuH - 8);
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.remove('hidden');
  },

  async setDisc(discValue) {
    document.getElementById('rom-row-menu')?.classList.add('hidden');
    const file = this.files[this._ctxMenuIndex];
    if (!file) return;
    file.disc = discValue;
    if (file.match) await this.updateNewName(file);
    this.render();
  },

  async setContentType(type) {
    document.getElementById('rom-row-menu')?.classList.add('hidden');
    const file = this.files[this._ctxMenuIndex];
    if (!file) return;
    file.contentType = type;
    if (file.match) await this.updateNewName(file);
    this.render();
  },

  async setSelectedContentType(type) {
    document.getElementById('rom-row-menu')?.classList.add('hidden');
    const targets = this.files.filter(f => f.selected);
    for (const f of targets) {
      f.contentType = type;
      if (f.match) await this.updateNewName(f);
    }
    this.render();
    const typeLabel = { game: 'Game', dlc: 'DLC', update: 'Update' };
    showToast(`Set ${targets.length} selected file${targets.length !== 1 ? 's' : ''} to ${typeLabel[type] || type}`, 'info');
  },

  async setAllContentType(type) {
    document.getElementById('rom-row-menu')?.classList.add('hidden');
    for (const f of this.files) {
      f.contentType = type;
      if (f.match) await this.updateNewName(f);
    }
    this.render();
    const typeLabel = { game: 'Game', dlc: 'DLC', update: 'Update' };
    showToast(`Set all ${this.files.length} ROM${this.files.length !== 1 ? 's' : ''} to ${typeLabel[type] || type}`, 'info');
  },

  removeFile(index) {
    document.getElementById('rom-row-menu')?.classList.add('hidden');
    this.files.splice(index, 1);
    this.render();
  },

  // ── Render ──────────────────────────────────────────────────────
  render() {
    const leftEl   = document.getElementById('roms-original-list');
    const arrowEl  = document.getElementById('roms-arrows');
    const rightEl  = document.getElementById('roms-new-list');

    if (!leftEl) return;

    if (this.files.length === 0) {
      leftEl.innerHTML  = '';
      if (arrowEl)  arrowEl.innerHTML  = '';
      if (rightEl)  rightEl.innerHTML  = '';
      if (typeof Organize !== 'undefined') Organize.updateUI();
      return;
    }

    // Left panel — original file rows
    leftEl.innerHTML = this.files.map((f, i) => `
      <div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}"
           oncontextmenu="Roms.showRowMenu(${i}, event)">
        <input type="checkbox" class="file-row-check" ${f.selected ? 'checked' : ''}
               onchange="Roms.files[${i}].selected = this.checked" />
        <svg class="file-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="7" width="20" height="12" rx="4"/>
          <path d="M7 11v4M5 13h4" stroke-linecap="round"/>
          <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/>
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>
        </svg>
        <span class="file-row-name" title="${escHtml(f.path)}">${escHtml(f.name)}</span>
        <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--bg-active);color:var(--text-tertiary);flex-shrink:0;font-family:var(--font-mono);">${escHtml(f.platform.short)}${f.region ? ' · ' + escHtml(f.region) : ''}${f.disc ? ' · ' + escHtml(f.disc) : ''}${f.contentType !== 'game' ? ' · ' + f.contentType.toUpperCase() : ''}</span>
        <button class="file-row-action" onclick="Roms.showSearch(${i})" title="Search IGDB">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Center arrows — spacer matches the type-section-header height above the file rows
    if (arrowEl) {
      arrowEl.innerHTML = '<div class="arrow-spacer">&nbsp;</div>' + this.files.map(f => {
        const cls = f.status === 'done' ? 'done' : (f.match ? 'active' : '');
        return `<div class="center-arrow-row ${cls}">→</div>`;
      }).join('');
    }

    // Right panel — new names
    if (rightEl) {
      rightEl.innerHTML = this.files.map(f => {
        let nameClass = 'pending', displayName = 'waiting for match…';
        let statusHtml = '<span class="file-row-status status-pending">pending</span>';

        if (f.status === 'searching') {
          displayName = 'searching…';
          statusHtml  = '<span class="file-row-status status-searching"></span>';
        } else if (f.status === 'matched' && f.newName) {
          nameClass   = 'matched';
          displayName = f.newName;
          statusHtml  = '<span class="file-row-status status-matched">matched</span>';
        } else if (f.status === 'done') {
          nameClass   = 'done';
          displayName = f.newName || 'renamed';
          statusHtml  = '<span class="file-row-status status-done">done</span>';
        } else if (f.status === 'error') {
          nameClass   = 'error-name';
          displayName = 'no match found';
          statusHtml  = '<span class="file-row-status status-error">error</span>';
        }

        return `
          <div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}">
            <span class="file-row-newname ${nameClass}"
                  title="${escHtml(f.newPath || '')}">${escHtml(displayName)}</span>
            ${statusHtml}
          </div>
        `;
      }).join('');
    }

    if (typeof Organize !== 'undefined') Organize.updateUI();
  }
};
