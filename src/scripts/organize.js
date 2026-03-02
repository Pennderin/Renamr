// ═══════════════════════════════════════════════════════════════════
// Organize — Unified workspace orchestrator
// Routes files to Movies/TV/Audiobooks by auto-detected type
// ═══════════════════════════════════════════════════════════════════

const VIDEO_EXTS = new Set(['.mkv','.mp4','.avi','.mov','.wmv','.flv','.webm','.m4v','.ts','.mpg','.mpeg','.divx','.ogv','.3gp']);
const AUDIO_EXTS = new Set(['.mp3','.m4a','.m4b','.flac','.ogg','.opus','.wma','.aac','.wav','.ape','.alac','.aiff']);
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
    const groups = { movies: [], tv: [], audiobooks: [] };
    for (const p of paths) {
      const type = this.detectType(p);
      groups[type].push(p);
    }
    return groups;
  },

  // ── Add Files (dialog) ───────────────────────────────────────
  async addFiles() {
    const paths = await api.openFiles([
      { name: 'All Media Files', extensions: ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts','mpg','mpeg','mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'] }
    ]);
    if (!paths || paths.length === 0) return;
    await this.handleDrop(paths);
  },

  // ── Add Folder (dialog) ──────────────────────────────────────
  async addFolder() {
    const dir = await api.openFolder();
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

    this.updateUI();
  },

  // ── Match all loaded types ───────────────────────────────────
  async matchAll(source) {
    const promises = [];
    if (Movies.files.length > 0) promises.push(Movies.matchAll(source === 'all' ? 'all' : undefined));
    if (TV.files.length > 0) promises.push(TV.matchAll(source === 'all' ? 'all' : undefined));
    if (Audiobooks.files.length > 0) promises.push(Audiobooks.matchAll(source === 'all' ? 'all' : undefined));
    await Promise.all(promises);
    this.updateUI();
  },

  // ── Match a specific type with source ────────────────────────
  async matchType(type, source) {
    if (type === 'movies' && Movies.files.length > 0) await Movies.matchAll(source);
    if (type === 'tv' && TV.files.length > 0) await TV.matchAll(source);
    if (type === 'audiobooks' && Audiobooks.files.length > 0) await Audiobooks.matchAll(source);
    this.updateUI();
  },

  // ── Rename all ───────────────────────────────────────────────
  async renameAll() {
    if (Movies.files.length > 0) await Movies.renameAll();
    if (TV.files.length > 0) await TV.renameAll();
    if (Audiobooks.files.length > 0) await Audiobooks.renameAll();
    this.updateUI();
  },

  // ── Refresh all ──────────────────────────────────────────────
  refresh() {
    if (Movies.files.length > 0) Movies.refresh();
    if (TV.files.length > 0) TV.refresh();
    if (Audiobooks.files.length > 0) Audiobooks.refresh();
    this.updateUI();
  },

  // ── Clear all ────────────────────────────────────────────────
  clear() {
    Movies.clear();
    TV.clear();
    Audiobooks.clear();
    this.updateUI();
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
    if (moviesGroup) moviesGroup.style.display = Movies.files.length > 0 ? '' : 'none';
    if (tvGroup) tvGroup.style.display = TV.files.length > 0 ? '' : 'none';
    if (abGroup) abGroup.style.display = Audiobooks.files.length > 0 ? '' : 'none';

    const menu = document.getElementById('organize-source-menu');
    if (menu) menu.classList.remove('hidden');
  },

  // ── Update unified UI state ──────────────────────────────────
  updateUI() {
    const totalFiles = Movies.files.length + TV.files.length + Audiobooks.files.length;
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
    if (stats) stats.textContent = parts.join(' · ');

    // Show/hide type sections
    const moviesSec = document.getElementById('org-movies-section');
    const movieSecR = document.getElementById('org-movies-section-r');
    const tvSec = document.getElementById('org-tv-section');
    const tvSecR = document.getElementById('org-tv-section-r');
    const abSec = document.getElementById('org-audiobooks-section');
    const abSecR = document.getElementById('org-audiobooks-section-r');

    const hasMovies = Movies.files.length > 0;
    const hasTV = TV.files.length > 0;
    const hasAB = Audiobooks.files.length > 0;

    if (moviesSec) moviesSec.style.display = hasMovies ? '' : 'none';
    if (movieSecR) movieSecR.style.display = hasMovies ? '' : 'none';
    if (tvSec) tvSec.style.display = hasTV ? '' : 'none';
    if (tvSecR) tvSecR.style.display = hasTV ? '' : 'none';
    if (abSec) abSec.style.display = hasAB ? '' : 'none';
    if (abSecR) abSecR.style.display = hasAB ? '' : 'none';

    // Section counts
    const mCount = document.getElementById('org-movies-count');
    const tCount = document.getElementById('org-tv-count');
    const aCount = document.getElementById('org-audiobooks-count');
    if (mCount) mCount.textContent = `(${Movies.files.length})`;
    if (tCount) tCount.textContent = `(${TV.files.length})`;
    if (aCount) aCount.textContent = `(${Audiobooks.files.length})`;

    // Add type header spacers in arrows container so rows stay aligned
    const arrowSpacerHtml = '<div class="type-section-header arrow-spacer">&nbsp;</div>';
    const movArrows = document.getElementById('movies-arrows');
    const tvArrows = document.getElementById('tv-arrows');
    const abArrows = document.getElementById('audiobooks-arrows');
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

    // Rename button — enable if anything is matched
    const anyMatched = Movies.files.some(f => f.match)
      || TV.files.some(f => f.match)
      || Audiobooks.books.some(b => b.matched);
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
