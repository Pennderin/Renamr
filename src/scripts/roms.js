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
  wad:   { name: 'Wii',                                    short: 'Wii',    igdbId: 5   },
  wbfs:  { name: 'Wii',                                    short: 'Wii',    igdbId: 5   },
  rvz:   { name: 'Wii',                                    short: 'Wii',    igdbId: 5   },
  gcz:   { name: 'Nintendo GameCube',                      short: 'GC',     igdbId: 21  },
  xci:   { name: 'Nintendo Switch',                        short: 'Switch', igdbId: 130 },
  nsp:   { name: 'Nintendo Switch',                        short: 'Switch', igdbId: 130 },
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

// ── No-Intro filename parser ──────────────────────────────────────
function parseRomFilename(filename) {
  // Strip extension
  let base = filename.replace(/\.[^.]+$/, '');

  // Collect all parenthetical and bracket groups
  const allParens = [];
  base.replace(/\(([^)]+)\)/g, (_, c) => { allParens.push(c); return ''; });

  const REGIONS = ['USA','US','Europe','EUR','Japan','JPN','JP','World',
    'Australia','Korea','China','Germany','France','Spain','Italy',
    'Brazil','Netherlands','Sweden','Russia','Poland','Taiwan','Asia'];
  const REGION_NORM = { US: 'USA', EUR: 'Europe', JPN: 'Japan', JP: 'Japan' };

  let region = '';
  for (const p of allParens) {
    const parts = p.split(',').map(s => s.trim());
    if (parts.some(r => REGIONS.includes(r))) { region = p.trim(); break; }
  }
  if (REGION_NORM[region]) region = REGION_NORM[region];

  let revision = '';
  for (const p of allParens) {
    if (/^Rev\s+/i.test(p) || /^v\d/i.test(p)) { revision = p.trim(); break; }
  }

  // Strip ALL parenthetical/bracket groups from title
  let cleanTitle = base
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanTitle, region, revision };
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

  // ── File ingestion ──────────────────────────────────────────────
  async addFiles() {
    const paths = await api.openFiles([{
      name: 'ROM Files',
      extensions: Object.keys(ROM_PLATFORM_MAP)
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
      const { cleanTitle, region, revision } = parseRomFilename(name);

      this.files.push({
        path: p, name, ext,
        dir: pathDirname(p),
        cleanTitle,
        region,
        revision,
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
  async matchAll() {
    const clientId = await api.getStore('igdbClientId');
    if (!clientId) {
      showToast('Set IGDB credentials in Settings first', 'error');
      return;
    }
    for (const file of this.files) {
      if (file.match) continue;
      await this._matchFile(file);
    }
  },

  async _matchFile(file) {
    file.status = 'searching';
    this.render();

    const query      = file.cleanTitle || getBaseName(file.name).replace(/\./g, ' ');
    const platformId = file.platform?.igdbId || null;
    const results    = await api.igdbSearch(query, platformId);

    if (!results || results.error || results.length === 0) {
      file.status = 'error';
      this.render();
      return;
    }

    const uniqueTitles = [...new Set(results.map(r => r.title))];
    if (uniqueTitles.length === 1) {
      file.match  = results[0];
      file.status = 'matched';
      await this.updateNewName(file);
      this.render();
    } else {
      file.status = 'pending';
      this.render();
      await this._showSelectionDialog(this.files.indexOf(file), results, query);
    }
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
          <button class="btn btn-primary" onclick="Roms.doSearch(${fileIndex})">Search</button>
          <button class="btn" onclick="Roms.skipMatch()">Skip</button>
        </div>
        <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;">
          Platform: <strong>${escHtml(file.platform.name)}</strong>
          &nbsp;·&nbsp; ${results.length} result${results.length !== 1 ? 's' : ''} — click to select
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
    const input     = document.getElementById('rom-search-input');
    const resultsEl = document.getElementById('rom-search-results');
    if (!input?.value.trim()) return;
    resultsEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);">Searching...</div>';
    const file    = this.files[index];
    const results = await api.igdbSearch(input.value.trim(), file.platform?.igdbId || null);
    if (!results || results.error || results.length === 0) {
      resultsEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;padding:10px;">No results found</p>';
      return;
    }
    this._searchResults = results;
    resultsEl.innerHTML = this._renderResults(results, index);
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
            <span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;
                         font-weight:700;background:#6a4c93;color:#fff;">IGDB</span>
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
    const format        = await api.getStore('defaultRomFormat') || FormatEngine.defaults.rom;
    const outputDir     = await api.getStore('outputDirectory');
    const articleFolder = await api.getStore('romArticleFolder');
    const articleFile   = await api.getStore('romArticleFile');
    const match         = file.match;

    const data = {
      title:         match.title         || '',
      year:          match.year          || '',
      platform:      file.platform?.name || match.platform  || '',
      platformShort: file.platform?.short || match.platformAbbrev || '',
      genre:         match.genre         || '',
      developer:     match.developer     || '',
      region:        file.region         || '',
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
      <div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}">
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
        <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:var(--bg-active);color:var(--text-tertiary);flex-shrink:0;font-family:var(--font-mono);">${escHtml(f.platform.short)}${f.region ? ' · ' + escHtml(f.region) : ''}</span>
        <button class="file-row-action" onclick="Roms.showSearch(${i})" title="Search IGDB">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Center arrows
    if (arrowEl) {
      arrowEl.innerHTML = this.files.map(f => {
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
