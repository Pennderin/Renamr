// ═══════════════════════════════════════════════════════════════════
// Organize — Unified workspace orchestrator
// Routes files to Movies/TV/Audiobooks by auto-detected type
// ═══════════════════════════════════════════════════════════════════

const VIDEO_EXTS = new Set(['.mkv','.mp4','.avi','.mov','.wmv','.flv','.webm','.m4v','.ts','.mpg','.mpeg','.divx','.ogv','.3gp']);
const AUDIO_EXTS = new Set(['.mp3','.m4a','.m4b','.flac','.ogg','.opus','.wma','.aac','.wav','.ape','.alac','.aiff']);
const ORG_ROM_EXTS = new Set(['.nes','.snes','.n64','.z64','.v64','.gba','.gbc','.gb','.nds','.3ds',
  '.iso','.cso','.chd','.rvz','.gcz','.wbfs','.wad','.cia','.cci','.xci','.nsp','.nsz','.pce',
  '.md','.smd','.gen','.gg','.32x','.sfc','.smc','.fig','.bs','.st',
  '.a26','.a52','.a78','.lnx','.ngp','.ngc','.ws','.wsc','.psx','.pbp',
  '.cdi','.nrg','.img','.bin','.cue']);
const TV_PATTERNS = [
  /[Ss]\d{1,2}[Ee]\d{1,3}/,         // S01E01
  /\b\d{1,2}x\d{2,3}\b/,            // 1x01
  /[\.\s_-][Ee](?:p(?:isode)?)?[\.\s_-]?\d{1,3}\b/i, // .E01 / Ep01 / Episode.01
  /\bSeason\s*\d+/i,                 // Season 1
];

const Organize = {
  // ── File type detection ──────────────────────────────────────
  detectType(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const name = filePath.replace(/\\/g, '/').split('/').pop();
    const parentPath = filePath.replace(/\\/g, '/');

    if (ORG_ROM_EXTS.has(ext)) return 'roms';
    if (AUDIO_EXTS.has(ext)) return 'audiobooks';
    if (VIDEO_EXTS.has(ext)) {
      // Check filename for TV patterns
      if (TV_PATTERNS.some(p => p.test(name))) return 'tv';
      // Check parent folder for TV patterns (e.g. "Season 1/episode.mkv")
      if (TV_PATTERNS.some(p => p.test(parentPath))) return 'tv';
      return 'movies';
    }
    // Fallback: video by default for unknown extensions
    return 'movies';
  },

  // ── Classify an array of file paths ──────────────────────────
  classifyPaths(paths) {
    const groups = { movies: [], tv: [], audiobooks: [], roms: [] };
    for (const p of paths) {
      const type = this.detectType(p);
      groups[type].push(p);
    }
    return groups;
  },

  // ── Add Files (dialog) ───────────────────────────────────────
  async addFiles() {
    const paths = await api.openFiles([
      { name: 'All Media & ROM Files', extensions: ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts','mpg','mpeg','mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav','nes','snes','n64','z64','v64','gba','gbc','gb','nds','3ds','iso','cso','chd','rvz','gcz','wbfs','wad','cia','cci','xci','nsp','nsz','pce','md','smd','gen','gg','32x','sfc','smc','fig','a26','a52','a78','lnx','ngp','ngc','ws','wsc','psx','pbp','cdi','nrg','img','bin','cue'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (!paths || paths.length === 0) return;
    await this.handleDrop(paths);
  },

  // ── Add Folder (dialog) ──────────────────────────────────────
  async addFolder() {
    const dir = await api.openDirectory();
    if (!dir) return;
    const scanned = await api.scanFiles(dir, 'all');
    if (scanned && scanned.length > 0) {
      await this.handleDrop(scanned.map(f => f.path));
    }
  },

  // ── Handle dropped/added files ───────────────────────────────
  async handleDrop(paths) {
    const groups = this.classifyPaths(paths);

    if (groups.movies.length > 0) await Movies.handleDrop(groups.movies);
    if (groups.tv.length > 0) await TV.handleDrop(groups.tv);
    if (groups.audiobooks.length > 0) await Audiobooks.handleDrop(groups.audiobooks);
    if (groups.roms.length > 0) await Roms.handleDrop(groups.roms);

    this.updateUI();
  },

  // ── Match all loaded types ───────────────────────────────────
  async matchAll(source) {
    const promises = [];
    if (Movies.files.length > 0) promises.push(Movies.matchAll(source === 'all' ? 'all' : undefined));
    if (TV.files.length > 0) promises.push(TV.matchAll(source === 'all' ? 'all' : undefined));
    if (Audiobooks.files.length > 0) promises.push(Audiobooks.matchAll(source === 'all' ? 'all' : undefined));
    if (Roms.files.length > 0) promises.push(Roms.matchAll());
    await Promise.all(promises);
    this.updateUI();
  },

  // ── Match a specific type with source ────────────────────────
  async matchType(type, source) {
    if (type === 'movies' && Movies.files.length > 0) await Movies.matchAll(source);
    if (type === 'tv' && TV.files.length > 0) await TV.matchAll(source);
    if (type === 'audiobooks' && Audiobooks.files.length > 0) await Audiobooks.matchAll(source);
    if (type === 'roms' && Roms.files.length > 0) await Roms.matchAll(source);
    this.updateUI();
  },

  // ── Rename all ───────────────────────────────────────────────
  async renameAll() {
    if (Movies.files.length > 0) await Movies.renameAll();
    if (TV.files.length > 0) await TV.renameAll();
    if (Audiobooks.files.length > 0) await Audiobooks.renameAll();
    if (Roms.files.length > 0) await Roms.renameAll();
    this.updateUI();
  },

  // ── Refresh all ──────────────────────────────────────────────
  refresh() {
    if (Movies.files.length > 0) Movies.refresh();
    if (TV.files.length > 0) TV.refresh();
    if (Audiobooks.files.length > 0) Audiobooks.refresh();
    if (Roms.files.length > 0) Roms.refresh();
    this.updateUI();
  },

  // ── Clear all ────────────────────────────────────────────────
  clear() {
    Movies.clear();
    TV.clear();
    Audiobooks.clear();
    Roms.clear();
    this.updateUI();
  },

  // ── Right-click row remove menu ──────────────────────────────
  _orgCtxType: null,
  _orgCtxIndex: -1,

  showRowMenu(type, index, event) {
    event.preventDefault();
    event.stopPropagation();
    hideSourceMenus();
    this._orgCtxType = type;
    this._orgCtxIndex = index;
    const menu = document.getElementById('org-row-menu');
    if (!menu) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = 160, mh = 40;
    let x = event.clientX, y = event.clientY;
    if (x + mw > vw) x = vw - mw - 4;
    if (y + mh > vh) y = vh - mh - 4;
    menu.style.left = x + 'px';
    menu.style.top  = y + 'px';
    menu.classList.remove('hidden');
  },

  removeEntry() {
    document.getElementById('org-row-menu')?.classList.add('hidden');
    const { _orgCtxType: type, _orgCtxIndex: index } = this;
    if (index < 0) return;
    if (type === 'movies') Movies.removeFile(index);
    else if (type === 'tv') TV.removeFile(index);
    else if (type === 'audiobooks') Audiobooks.removeBook(index);
    this._orgCtxType = null;
    this._orgCtxIndex = -1;
  },

  // ── Right-click match menu ───────────────────────────────────
  showMatchMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    hideSourceMenus();

    // Show/hide source groups based on which types have files
    const moviesGroup = document.getElementById('org-match-movies-group');
    const tvGroup = document.getElementById('org-match-tv-group');
    const abGroup = document.getElementById('org-match-audiobooks-group');
    const romsGroup = document.getElementById('org-match-roms-group');
    if (moviesGroup) moviesGroup.style.display = Movies.files.length > 0 ? '' : 'none';
    if (tvGroup) tvGroup.style.display = TV.files.length > 0 ? '' : 'none';
    if (abGroup) abGroup.style.display = Audiobooks.files.length > 0 ? '' : 'none';
    if (romsGroup) romsGroup.style.display = Roms.files.length > 0 ? '' : 'none';

    const menu = document.getElementById('organize-source-menu');
    if (menu) menu.classList.remove('hidden');
  },

  // ── Update unified UI state ──────────────────────────────────
  updateUI() {
    const totalFiles = Movies.files.length + TV.files.length + Audiobooks.files.length + Roms.files.length;
    const empty = document.getElementById('organize-empty');
    const panels = document.getElementById('organize-panels');
    const stats = document.getElementById('organize-stats');
    const clearBtn = document.getElementById('organize-clear-btn');
    const renameBtn = document.getElementById('organize-rename-btn');

    if (totalFiles === 0) {
      if (empty) empty.classList.remove('hidden');
      if (panels) panels.classList.add('hidden');
      if (clearBtn) clearBtn.style.display = 'none';
      if (stats) stats.textContent = 'No files loaded';
      return;
    }

    if (empty) empty.classList.add('hidden');
    if (panels) panels.classList.remove('hidden');
    if (clearBtn) clearBtn.style.display = '';

    // Build stats
    const parts = [];
    if (Movies.files.length > 0) {
      const m = Movies.files.filter(f => f.match).length;
      parts.push(`${Movies.files.length} movie${Movies.files.length !== 1 ? 's' : ''}${m > 0 ? ` (${m} matched)` : ''}`);
    }
    if (TV.files.length > 0) {
      const t = TV.files.filter(f => f.match).length;
      parts.push(`${TV.files.length} episode${TV.files.length !== 1 ? 's' : ''}${t > 0 ? ` (${t} matched)` : ''}`);
    }
    if (Audiobooks.files.length > 0) {
      const a = Audiobooks.books.filter(b => b.matched).length;
      parts.push(`${Audiobooks.files.length} audiobook file${Audiobooks.files.length !== 1 ? 's' : ''}${a > 0 ? ` (${a}/${Audiobooks.books.length} books matched)` : ''}`);
    }
    if (Roms.files.length > 0) {
      const r = Roms.files.filter(f => f.match).length;
      parts.push(`${Roms.files.length} ROM${Roms.files.length !== 1 ? 's' : ''}${r > 0 ? ` (${r} matched)` : ''}`);
    }
    if (stats) stats.textContent = parts.join(' · ');

    // Show/hide type sections
    const moviesSec = document.getElementById('org-movies-section');
    const movieSecR = document.getElementById('org-movies-section-r');
    const tvSec = document.getElementById('org-tv-section');
    const tvSecR = document.getElementById('org-tv-section-r');
    const abSec = document.getElementById('org-audiobooks-section');
    const abSecR = document.getElementById('org-audiobooks-section-r');
    const romsSec = document.getElementById('org-roms-section');
    const romsSecR = document.getElementById('org-roms-section-r');

    const hasMovies = Movies.files.length > 0;
    const hasTV = TV.files.length > 0;
    const hasAB = Audiobooks.files.length > 0;
    const hasRoms = Roms.files.length > 0;

    if (moviesSec) moviesSec.style.display = hasMovies ? '' : 'none';
    if (movieSecR) movieSecR.style.display = hasMovies ? '' : 'none';
    if (tvSec) tvSec.style.display = hasTV ? '' : 'none';
    if (tvSecR) tvSecR.style.display = hasTV ? '' : 'none';
    if (abSec) abSec.style.display = hasAB ? '' : 'none';
    if (abSecR) abSecR.style.display = hasAB ? '' : 'none';
    if (romsSec) romsSec.style.display = hasRoms ? '' : 'none';
    if (romsSecR) romsSecR.style.display = hasRoms ? '' : 'none';

    // Section counts
    const mCount = document.getElementById('org-movies-count');
    const tCount = document.getElementById('org-tv-count');
    const aCount = document.getElementById('org-audiobooks-count');
    const rCount = document.getElementById('org-roms-count');
    if (mCount) mCount.textContent = `(${Movies.files.length})`;
    if (tCount) tCount.textContent = `(${TV.files.length})`;
    if (aCount) aCount.textContent = `(${Audiobooks.files.length})`;
    if (rCount) rCount.textContent = `(${Roms.files.length})`;

    // Add type header spacers in arrows container so rows stay aligned
    const arrowSpacerHtml = '<div class="type-section-header arrow-spacer">&nbsp;</div>';
    const movArrows = document.getElementById('movies-arrows');
    const tvArrows = document.getElementById('tv-arrows');
    const abArrows = document.getElementById('audiobooks-arrows');
    const romsArrows = document.getElementById('roms-arrows');
    // Prepend spacer before each arrow group if that type has files
    if (movArrows && hasMovies) {
      if (!movArrows.querySelector('.arrow-spacer')) movArrows.insertAdjacentHTML('afterbegin', arrowSpacerHtml);
    }
    if (tvArrows && hasTV) {
      if (!tvArrows.querySelector('.arrow-spacer')) tvArrows.insertAdjacentHTML('afterbegin', arrowSpacerHtml);
    }
    if (abArrows && hasAB) {
      if (!abArrows.querySelector('.arrow-spacer')) abArrows.insertAdjacentHTML('afterbegin', arrowSpacerHtml);
    }
    if (romsArrows && hasRoms) {
      if (!romsArrows.querySelector('.arrow-spacer')) romsArrows.insertAdjacentHTML('afterbegin', arrowSpacerHtml);
    }

    // Rename button — enable if anything is matched
    const anyMatched = Movies.files.some(f => f.match)
      || TV.files.some(f => f.match)
      || Audiobooks.books.some(b => b.matched)
      || Roms.files.some(f => f.match);
    if (renameBtn) renameBtn.disabled = !anyMatched;

    // Sync scrolling on the unified panels
    this._syncScroll();
  },

  _syncScroll() {
    const left = document.getElementById('organize-original-list');
    const right = document.getElementById('organize-new-list');
    const arrowsContainer = document.getElementById('organize-arrows-container');
    if (!left || !right) return;

    left._scrollHandler && left.removeEventListener('scroll', left._scrollHandler);
    right._scrollHandler && right.removeEventListener('scroll', right._scrollHandler);

    let syncing = false;
    left._scrollHandler = () => {
      if (syncing) return; syncing = true;
      right.scrollTop = left.scrollTop;
      if (arrowsContainer) arrowsContainer.scrollTop = left.scrollTop;
      syncing = false;
    };
    right._scrollHandler = () => {
      if (syncing) return; syncing = true;
      left.scrollTop = right.scrollTop;
      if (arrowsContainer) arrowsContainer.scrollTop = right.scrollTop;
      syncing = false;
    };
    left.addEventListener('scroll', left._scrollHandler);
    right.addEventListener('scroll', right._scrollHandler);
  }
};
