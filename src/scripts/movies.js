// ═══════════════════════════════════════════════════════════════════
// Movies Module
// ═══════════════════════════════════════════════════════════════════

const Movies = {
  files: [],
  _searchResults: [],
  _probing: false,
  _matchSource: 'tmdb',  // default source

  async addFiles() {
    const paths = await api.openFiles([{ name: 'Video Files', extensions: ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts'] }]);
    if (paths.length === 0) return;
    await this._addPaths(paths);
  },

  async addFolder() {
    const dir = await api.openDirectory();
    if (!dir) return;
    const scanned = await api.scanFiles(dir, 'video');
    await this._addPaths(scanned.map(f => f.path));
    showToast(`Added ${scanned.length} video files`, 'success');
  },

  async handleDrop(paths) {
    if (!paths || paths.length === 0) return;
    await this._addPaths(paths);
    showToast(`Added ${paths.length} files`, 'success');
  },

  async _addPaths(paths) {
    let added = 0;
    for (const p of paths) {
      if (this.files.some(f => f.path === p)) continue;
      const name = pathBasename(p);
      const ext = getExtension(name).toLowerCase();
      const videoExts = ['.mkv','.mp4','.avi','.mov','.wmv','.flv','.m4v','.webm','.ts'];
      if (!videoExts.includes(ext)) continue;
      const parsed = await api.parseFilename(name);
      const dir = pathDirname(p);

      // ── Folder-based enrichment ──────────────────────────────────
      // If filename didn't parse a title or looks too generic, use parent folder
      if (parsed.type === 'unknown' || parsed.type === 'movie') {
        const parentFolder = pathBasename(dir);
        const genericNames = ['movie','film','video','clip','sample','extras','featurettes','bonus'];
        const baseName = getBaseName(name).toLowerCase().replace(/[._-]/g, ' ').trim();

        // If filename is generic (e.g. "movie.mkv", "video.mkv") or very short
        if (!parsed.title || genericNames.includes(baseName) || baseName.length <= 3) {
          // Try parent folder for "Title (Year)" pattern
          const folderMatch = parentFolder.match(/^(.+?)[\s._-]*[\(\[]?(\d{4})[\)\]]?\s*$/);
          if (folderMatch) {
            parsed.title = folderMatch[1].trim();
            parsed.year = parseInt(folderMatch[2]);
            parsed.type = 'movie';
          } else if (parentFolder && !genericNames.includes(parentFolder.toLowerCase())) {
            parsed.title = parentFolder;
            parsed.type = 'movie';
          }
        }
        // If filename parsed but has no year, try to get year from parent folder
        if (parsed.title && !parsed.year) {
          const yearMatch = parentFolder.match(/[\(\[]?(\d{4})[\)\]]?\s*$/);
          if (yearMatch) parsed.year = parseInt(yearMatch[1]);
        }
      }

      this.files.push({
        path: p, name, ext, dir, parsed,
        probed: false, match: null,
        newName: '', newPath: '', selected: true, status: 'pending'
      });
      added++;
    }
    this.render();

    // Probe all unprobed files right away
    if (added > 0) await this._probeAll();
  },

  // ── Probe video files for real resolution/codec ─────────────────
  async _probeAll() {
    const unprobed = this.files.filter(f => !f.probed);
    if (unprobed.length === 0) return;

    this._probing = true;
    this.render();
    let probeCount = 0;

    for (const file of unprobed) {
      const probe = await api.probeVideo(file.path);
      file.probed = true;
      if (probe) {
        // Merge probe data into parsed — probe wins for empty fields
        if (probe.resolution)  file.parsed.resolution  = probe.resolution;
        if (probe.videoCodec)  file.parsed.videoCodec  = probe.videoCodec;
        if (probe.audioCodec)  file.parsed.audioCodec  = probe.audioCodec;
        if (probe.channels)    file.parsed.channels    = probe.channels;
        if (probe.hdr)         file.parsed.hdr         = probe.hdr;
        probeCount++;
      }
      // If already matched, update name with new probe data
      if (file.match) await this.updateNewName(file);
    }

    this._probing = false;
    this.render();

    if (probeCount > 0) {
      showToast(`Detected video info for ${probeCount} files`, 'success');
    }
  },

  // ── Match All (uses current _matchSource) ───────────────────────
  async matchAll(source) {
    if (source) this._matchSource = source;
    const src = this._matchSource;

    // Validate we have the needed key
    if (src === 'tmdb' || src === 'all') {
      const key = await api.getStore('tmdbApiKey');
      if (!key && src === 'tmdb') { showToast('Set TMDB API key in Settings', 'error'); return; }
    }

    for (const file of this.files) {
      if (file.match) continue;
      await this._matchFile(file, src);
    }
  },

  async _matchFile(file, src) {
    let query = file.parsed?.title || getBaseName(file.name).replace(/\./g, ' ');
    // If query is too generic, try parent folder
    const genericNames = ['movie','film','video','clip','sample'];
    if (genericNames.includes(query.toLowerCase()) || query.length <= 3) {
      const parentFolder = pathBasename(file.dir);
      query = parentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim() || query;
    }
    file.status = 'searching';
    this.render();

    const results = await this._searchWithSource(query, 'movie', src);

    if (results.length === 0) {
      file.status = 'error';
      this.render();
      return;
    }

    // Check for ambiguity: multiple different titles or years
    const uniqueKeys = [...new Set(results.map(r => `${r.title}|${r.year}`))];

    let autoMatch = null;
    if (uniqueKeys.length === 1) {
      autoMatch = results[0];
    } else if (file.parsed?.year) {
      const yearMatch = results.find(r => r.year === String(file.parsed.year));
      if (yearMatch) autoMatch = yearMatch;
    }

    if (autoMatch) {
      file.match = autoMatch;
      file.status = 'matched';
      await this.updateNewName(file);
      this.render();
    } else {
      // Ambiguous — show selection
      file.status = 'pending';
      this.render();
      this._showSelectionDialog(this.files.indexOf(file), results, query);
    }
  },

  async _searchWithSource(query, type, src) {
    const results = [];

    if (src === 'tmdb' || src === 'all') {
      const key = await api.getStore('tmdbApiKey');
      if (key) {
        const r = await api.tmdbSearch(query, type, key);
        if (!r.error) r.forEach(x => { x.source = 'TMDB'; results.push(x); });
      }
    }

    if (src === 'omdb' || src === 'all') {
      const key = await api.getStore('omdbApiKey');
      if (key) {
        const r = await api.omdbSearch(query, type, key);
        r.forEach(x => results.push(x));
      }
    }

    return results;
  },

  // ── Selection Dialog ────────────────────────────────────────────
  _showSelectionDialog(fileIndex, results, query) {
    this._searchResults = results;
    const file = this.files[fileIndex];

    showModal(`Select Match — ${escapeHtml(file.name)}`, `
      <div class="modal-search">
        <input type="text" class="input" id="movie-search-input" value="${escapeHtml(query)}" placeholder="Search..." />
        <select class="input" id="movie-search-source" style="width:auto;min-width:90px;">
          <option value="all">All Sources</option>
          <option value="tmdb">TMDB</option>
          <option value="omdb">OMDb</option>
        </select>
        <button class="btn btn-primary" onclick="Movies.doSearch(${fileIndex})">Search</button>
      </div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;">${results.length} results — click to select the correct match</div>
      <div class="modal-results" id="movie-search-results">${this._renderResults(results, fileIndex)}</div>
    `);
    setTimeout(() => {
      const el = document.getElementById('movie-search-input');
      el?.focus();
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') Movies.doSearch(fileIndex); });
    }, 80);
  },

  showSearch(index) {
    const file = this.files[index];
    const query = file.parsed?.title || getBaseName(file.name).replace(/\./g, ' ');
    showModal(`Search — ${escapeHtml(file.name)}`, `
      <div class="modal-search">
        <input type="text" class="input" id="movie-search-input" value="${escapeHtml(query)}" placeholder="Search..." />
        <select class="input" id="movie-search-source" style="width:auto;min-width:90px;">
          <option value="all">All Sources</option>
          <option value="tmdb">TMDB</option>
          <option value="omdb">OMDb</option>
        </select>
        <button class="btn btn-primary" onclick="Movies.doSearch(${index})">Search</button>
      </div>
      <div class="modal-results" id="movie-search-results"><p class="text-muted">Press Search or Enter</p></div>
    `);
    setTimeout(() => {
      const el = document.getElementById('movie-search-input');
      el?.focus();
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') Movies.doSearch(index); });
    }, 80);
  },

  async doSearch(index) {
    const input = document.getElementById('movie-search-input');
    const sourceEl = document.getElementById('movie-search-source');
    const resultsEl = document.getElementById('movie-search-results');
    if (!input?.value.trim()) return;

    resultsEl.innerHTML = '<div class="spinner"></div>';
    const results = await this._searchWithSource(input.value.trim(), 'movie', sourceEl?.value || 'all');

    if (results.length === 0) {
      resultsEl.innerHTML = '<p class="text-muted">No results found</p>';
      return;
    }

    this._searchResults = results;
    resultsEl.innerHTML = this._renderResults(results, index);
  },

  _renderResults(results, fileIndex) {
    return results.map((r, i) => `
      <div class="search-result" onclick="Movies.selectMatch(${fileIndex}, ${i})">
        ${r.posterPath ? `<img src="${r.posterPath}" alt="" />` : '<div style="width:40px;height:60px;background:var(--bg-active);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">🎬</div>'}
        <div class="search-result-info">
          <div>
            <span class="search-result-title">${escapeHtml(r.title)}</span>
            <span class="search-result-year">${r.year || 'N/A'}</span>
            ${sourceBadge(r.source || 'TMDB')}
          </div>
          ${r.rating ? `<div style="font-size:10.5px;color:var(--text-tertiary);margin-top:2px;">★ ${r.rating}</div>` : ''}
          <p class="search-result-overview">${escapeHtml(r.overview || 'No description available')}</p>
        </div>
      </div>
    `).join('');
  },

  async selectMatch(fileIndex, resultIndex) {
    const file = this.files[fileIndex];
    const match = this._searchResults[resultIndex];
    file.match = match;
    file.status = 'matched';
    await this.updateNewName(file);
    this.render();
    hideModal();
    showToast(`Matched: ${match.title} (${match.year})`, 'success');
  },

  async updateNewName(file) {
    if (!file.match) return;
    const format = await api.getStore('defaultMovieFormat') || FormatEngine.defaults.movie;
    const outputDir = await api.getStore('outputDirectory');
    const articleFolder = await api.getStore('movieArticleFolder');
    const articleFile = await api.getStore('movieArticleFile');

    const data = {
      title: file.match.title,
      year: file.match.year,
      rating: file.match.rating?.toFixed?.(1) || (file.match.rating || ''),
      resolution: file.parsed?.resolution || '',
      source: file.parsed?.source || '',
      videoCodec: file.parsed?.videoCodec || '',
      audioCodec: file.parsed?.audioCodec || '',
      hdr: file.parsed?.hdr || '',
      edition: file.parsed?.edition || '',
      group: file.parsed?.group || '',
      channels: file.parsed?.channels || '',
    };

    let formatted = FormatEngine.apply(format, data);
    formatted = FormatEngine.applyArticleSuffix(formatted, articleFolder, articleFile);
    file.newName = formatted + file.ext;

    let baseDir = outputDir || file.dir;
    if (!outputDir) {
      const depth = formatFolderDepth(format);
      if (depth > 0) {
        const formatSegs = formatted.split('/').slice(0, -1);
        const sep = file.dir.includes('\\') ? '\\' : '/';
        const pathSegs = file.dir.split(sep);
        const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let rootIdx = -1;
        for (let f = 0; f < formatSegs.length; f++) {
          const target = norm(formatSegs[f]);
          if (!target) continue;
          for (let p = 0; p < pathSegs.length; p++) {
            if (norm(pathSegs[p]) === target) {
              rootIdx = p - f;
              break;
            }
          }
          if (rootIdx >= 0) break;
        }
        
        if (rootIdx >= 0 && rootIdx <= pathSegs.length) {
          baseDir = pathSegs.slice(0, rootIdx).join(sep);
        } else {
          const candidate = pathUp(file.dir, depth);
          const parent = pathDirname(candidate);
          baseDir = (!parent || parent === candidate) ? file.dir : candidate;
        }
      }
    }
    file.newPath = joinPath(baseDir, file.newName);
  },

  async reapplyFormat() {
    for (const file of this.files) {
      if (file.match) await this.updateNewName(file);
    }
    this.render();
  },

  // ── Refresh: clear matches but keep files ───────────────────────
  refresh() {
    for (const file of this.files) {
      file.match = null;
      file.newName = '';
      file.newPath = '';
      file.status = 'pending';
    }
    this.render();
    showToast('Matches cleared', 'info');
  },

  async renameAll() {
    const ops = this.files
      .filter(f => f.selected && f.match && f.newPath)
      .map(f => ({ oldPath: f.path, newPath: f.newPath }));
    if (ops.length === 0) { showToast('No matched files to rename', 'error'); return; }
    const results = await api.renameFiles(ops);
    const success = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;
    for (const file of this.files) {
      const res = results.find(r => r.source === file.path);
      if (res) { file.status = res.success ? 'done' : 'error'; if (res.success) file.path = res.target; }
    }
    this.render();
    showToast(`Renamed ${success} files${fail > 0 ? `, ${fail} failed` : ''}`, success > 0 ? 'success' : 'error');
  },

  toggleAll(checked) { this.files.forEach(f => f.selected = checked); this.render(); },
  clear() { this.files = []; this.render(); },

  render() {
    if (this.files.length === 0) {
      const el = document.getElementById('movies-original-list');
      if (el) el.innerHTML = '';
      const ar = document.getElementById('movies-arrows');
      if (ar) ar.innerHTML = '';
      const nl = document.getElementById('movies-new-list');
      if (nl) nl.innerHTML = '';
      Organize.updateUI();
      return;
    }

    // Left panel
    document.getElementById('movies-original-list').innerHTML = this.files.map((f, i) => {
      const tags = [];
      if (f.parsed?.resolution) tags.push(f.parsed.resolution);
      if (f.parsed?.videoCodec) tags.push(f.parsed.videoCodec);
      if (f.parsed?.audioCodec) tags.push(f.parsed.audioCodec);
      const tagStr = tags.length ? `<span class="file-row-tags">${tags.join(' · ')}</span>` : '';

      return `
        <div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}">
          <input type="checkbox" class="file-row-check" ${f.selected ? 'checked' : ''} onchange="Movies.files[${i}].selected=this.checked" />
          <svg class="file-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/></svg>
          <div class="file-row-nameblock">
            <span class="file-row-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span>
            ${tagStr}
          </div>
          <button class="file-row-action" onclick="Movies.showSearch(${i})" title="Search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>
      `;
    }).join('');

    // Arrows
    document.getElementById('movies-arrows').innerHTML = this.files.map(f => {
      const cls = f.status === 'done' ? 'done' : (f.match ? 'active' : '');
      return `<div class="center-arrow-row ${cls}">→</div>`;
    }).join('');

    // Right panel
    document.getElementById('movies-new-list').innerHTML = this.files.map(f => {
      let nc = 'pending', dn = 'waiting for match...', sh = '<span class="file-row-status status-pending">pending</span>';
      if (f.status === 'searching') { dn = 'searching...'; sh = '<span class="file-row-status status-searching"><span class="spinner"></span></span>'; }
      else if (f.status === 'matched' && f.newName) { nc = 'matched'; dn = f.newName; sh = '<span class="file-row-status status-matched">matched</span>'; }
      else if (f.status === 'done') { nc = 'done'; dn = f.newName || 'renamed'; sh = '<span class="file-row-status status-done">done</span>'; }
      else if (f.status === 'error') { nc = 'error-name'; dn = 'no match found'; sh = '<span class="file-row-status status-error">error</span>'; }
      return `<div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}">
        <span class="file-row-newname ${nc}" title="${escapeHtml(f.newPath || '')}">${escapeHtml(dn)}</span>${sh}</div>`;
    }).join('');

    Organize.updateUI();
  }
};

// ── Shared helper: source badge ───────────────────────────────────
function sourceBadge(src) {
  const colors = { 'TMDB': '#01b4e4', 'OMDb': '#f5c518', 'TVmaze': '#3c948b' };
  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.03em;background:${colors[src] || '#555'};color:#000;margin-left:6px;">${escapeHtml(src)}</span>`;
}
