// ═══════════════════════════════════════════════════════════════════
// TV Shows Module
// ═══════════════════════════════════════════════════════════════════

const TV = {
  files: [],
  _searchResults: [],
  _tvDetails: {},
  _pendingGroupFiles: null,

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
    for (const p of paths) {
      if (this.files.some(f => f.path === p)) continue;
      const name = pathBasename(p);
      const ext = getExtension(name).toLowerCase();
      const videoExts = ['.mkv','.mp4','.avi','.mov','.wmv','.flv','.m4v','.webm','.ts'];
      if (!videoExts.includes(ext)) continue;
      const parsed = await api.parseFilename(name);
      const dir = pathDirname(p);

      // ── Folder-based enrichment ──────────────────────────────────
      // If parser didn't find series/season/episode, try parent folders
      // Common structure: Show Name/Season X/01 - Episode Title.mkv
      if (!parsed.series || parsed.type !== 'tv') {
        const parentFolder = pathBasename(dir);
        const grandparentDir = pathDirname(dir);
        const grandparentFolder = grandparentDir ? pathBasename(grandparentDir) : '';

        // Check parent folder for "Season X" pattern
        const seasonMatch = parentFolder.match(/^Season[\s._-]*(\d{1,2})$/i)
          || parentFolder.match(/^S(\d{1,2})$/i)
          || parentFolder.match(/^Saison[\s._-]*(\d{1,2})$/i)
          || parentFolder.match(/^Staffel[\s._-]*(\d{1,2})$/i);

        if (seasonMatch) {
          if (!parsed.season) parsed.season = parseInt(seasonMatch[1]);
          // Grandparent is the show name
          if (grandparentFolder && !parsed.series) {
            // Clean year suffix from show folder name: "The Night Agent (2023)" → "The Night Agent"
            parsed.series = grandparentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
          }
        } else if (!parsed.series && parentFolder) {
          // Parent folder might be the show name directly (single-season shows)
          // but only if it doesn't look like a generic folder
          const genericFolders = ['downloads','videos','tv','tv shows','series','media','new','incoming','temp'];
          if (!genericFolders.includes(parentFolder.toLowerCase())) {
            parsed.series = parentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
          }
        }

        // Check filename for bare episode number: "10 - Title.mkv", "E10 - Title.mkv", "10.mkv"
        if (!parsed.episode) {
          const baseName = getBaseName(name);
          const bareEpMatch = baseName.match(/^(\d{1,3})\s*[-–—.]\s*(.*)/)     // "10 - Razzmatazz"
            || baseName.match(/^[Ee][Pp]?(\d{1,3})\s*[-–—.]\s*(.*)/)            // "E10 - Razzmatazz" or "Ep10 - Razzmatazz"
            || baseName.match(/^(\d{1,3})$/);                                    // just "10"
          if (bareEpMatch) {
            parsed.episode = parseInt(bareEpMatch[1]);
            parsed.type = 'tv';
          }
        }

        // Mark as TV if we now have series + episode
        if (parsed.series && parsed.episode) {
          parsed.type = 'tv';
        }
      }

      this.files.push({ path: p, name, ext, dir, parsed, probeData: null, match: null, episodeMatch: null, newName: '', newPath: '', selected: true, status: 'pending' });
    }
    this.render();
    this._probeAllInBackground();
  },

  async _probeAllInBackground() {
    for (const file of this.files) {
      if (file.probeData) continue;
      const probe = await api.probeVideo(file.path);
      if (probe) {
        file.probeData = probe;
        if (probe.resolution && !file.parsed.resolution) file.parsed.resolution = probe.resolution;
        if (probe.videoCodec && !file.parsed.videoCodec) file.parsed.videoCodec = probe.videoCodec;
        if (probe.audioCodec && !file.parsed.audioCodec) file.parsed.audioCodec = probe.audioCodec;
        if (probe.channels && !file.parsed.channels) file.parsed.channels = probe.channels;
        if (probe.hdr && !file.parsed.hdr) file.parsed.hdr = probe.hdr;
        if (file.match) await this.updateNewName(file);
      }
    }
    this.render();
  },

  _matchSource: 'tmdb',

  async matchAll(source) {
    if (source) this._matchSource = source;
    const src = this._matchSource;
    const apiKey = await api.getStore('tmdbApiKey');
    if (!apiKey && src === 'tmdb') { showToast('Please set your TMDB API key in Settings first', 'error'); return; }

    const groups = {};
    for (const file of this.files) {
      if (file.match) continue;
      let seriesName = file.parsed?.series;
      if (!seriesName) {
        // Fallback: strip S##E## and clean up filename
        seriesName = getBaseName(file.name).replace(/S\d+E\d+.*/i, '').replace(/\./g, ' ').trim();
        // If that resulted in just a number or empty, try parent/grandparent folder
        if (!seriesName || /^\d+\s*[-–—.]?\s*\w*$/.test(seriesName)) {
          const parentFolder = pathBasename(file.dir);
          const grandparentDir = pathDirname(file.dir);
          const grandparentFolder = grandparentDir ? pathBasename(grandparentDir) : '';
          // If parent looks like "Season X", use grandparent
          if (/^Season[\s._-]*\d+$/i.test(parentFolder) && grandparentFolder) {
            seriesName = grandparentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
          } else if (parentFolder && !/^(Season|S)\s*\d+$/i.test(parentFolder)) {
            seriesName = parentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
          }
        }
      }
      if (!groups[seriesName]) groups[seriesName] = [];
      groups[seriesName].push(file);
    }

    for (const [seriesName, groupFiles] of Object.entries(groups)) {
      // Search sources based on selection
      let results = [];
      const src = this._matchSource;

      // Extract year from the first file's parsed data for disambiguation
      const seriesYear = groupFiles[0]?.parsed?.seriesYear || null;

      if (src === 'tmdb' || src === 'all') {
        if (apiKey) {
          // Search with year first for disambiguation (e.g. Scrubs 2026 vs Scrubs 2001)
          let tmdbResults = await api.tmdbSearch(seriesName, 'tv', apiKey, seriesYear);
          // If no results with year, retry without
          if ((!tmdbResults || tmdbResults.error || tmdbResults.length === 0) && seriesYear) {
            tmdbResults = await api.tmdbSearch(seriesName, 'tv', apiKey, null);
          }
          if (tmdbResults && !tmdbResults.error) {
            // If we have a year, prefer the result whose year matches
            if (seriesYear) {
              tmdbResults.sort((a, b) => {
                const aMatch = a.year === String(seriesYear) ? 1 : 0;
                const bMatch = b.year === String(seriesYear) ? 1 : 0;
                return bMatch - aMatch;
              });
            }
            tmdbResults.forEach(r => { r.source = 'TMDB'; results.push(r); });
          }
        }
      }
      if (src === 'tvmaze' || src === 'all') {
        const tvmazeResults = await api.tvmazeSearch(seriesName, 'tv');
        if (tvmazeResults && tvmazeResults.length) tvmazeResults.forEach(r => results.push(r));
      }

      if (results.length === 0) { groupFiles.forEach(f => f.status = 'error'); this.render(); continue; }

      // If multiple different shows found, prompt for the first file in group
      let show = results[0];
      const uniqueNames = [...new Set(results.map(r => r.title.toLowerCase()))];
      if (uniqueNames.length > 1) {
        // Show selection for the group
        this._searchResults = results;
        const firstFile = groupFiles[0];
        const idx = this.files.indexOf(firstFile);
        this._pendingGroupFiles = groupFiles;
        this._showTvSelectionDialog(idx, results, seriesName);
        return; // Wait for user selection
      }

      await this._applyShowToGroup(show, groupFiles);
      this.render();
    }
  },

  async _applyShowToGroup(show, groupFiles) {
    const apiKey = await api.getStore('tmdbApiKey');
    let details = this._tvDetails[show.id + '_' + (show.source || 'TMDB')];
    if (!details) {
      if (show.source === 'TVmaze') {
        details = await api.tvmazeShowDetails(show.id);
      } else if (apiKey) {
        details = await api.tmdbTvDetails(show.id, apiKey);
      }
      if (details && !details.error) this._tvDetails[show.id + '_' + (show.source || 'TMDB')] = details;
    }

    for (const file of groupFiles) {
      file.match = show;
      if (file.parsed?.type === 'tv' && details?.seasons) {
        const season = details.seasons.find(s => s.seasonNumber === file.parsed.season);
        if (season) {
          const episode = season.episodes.find(e => e.episodeNumber === file.parsed.episode);
          if (episode) file.episodeMatch = { season: file.parsed.season, episode: file.parsed.episode, title: episode.name };
        }
      }
      file.status = 'matched';
      await this.updateNewName(file);
    }
  },

  _showTvSelectionDialog(fileIndex, results, query) {
    const file = this.files[fileIndex];
    this._searchResults = results;

    const sourceBadge = (src) => {
      const colors = { 'TMDB': '#01b4e4', 'OMDb': '#f5c518', 'TVmaze': '#3c948b' };
      return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${colors[src] || '#555'};color:#000;margin-left:6px;">${src}</span>`;
    };

    const resultsHTML = results.map((r, i) => `
      <div class="search-result" onclick="TV.selectMatch(${fileIndex}, ${i})">
        ${r.posterPath ? `<img src="${r.posterPath}" alt="" />` : '<div style="width:40px;height:60px;background:var(--bg-active);border-radius:4px;"></div>'}
        <div class="search-result-info">
          <div><span class="search-result-title">${escapeHtml(r.title)}</span><span class="search-result-year">${r.year || 'N/A'}</span>${sourceBadge(r.source || 'TMDB')}</div>
          ${r.rating ? `<div style="font-size:10.5px;color:var(--text-tertiary);margin-top:2px;">★ ${r.rating}</div>` : ''}
          <p class="search-result-overview">${escapeHtml(r.overview || '')}</p>
        </div>
      </div>
    `).join('');

    showModal(`Select Show — ${escapeHtml(query)}`, `
      <div class="modal-search">
        <input type="text" class="input" id="tv-search-input" value="${escapeHtml(query)}" />
        <select class="input" id="tv-search-source" style="width:auto;min-width:90px;">
          <option value="all">All Sources</option>
          <option value="tmdb">TMDB</option>
          <option value="tvmaze">TVmaze</option>
        </select>
        <button class="btn btn-primary" onclick="TV.doSearch(${fileIndex})">Search</button>
      </div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:10px;">${results.length} results — click to select</div>
      <div class="modal-results" id="tv-search-results">${resultsHTML}</div>
    `);
    setTimeout(() => { const el = document.getElementById('tv-search-input'); el?.focus(); el?.addEventListener('keydown', e => { if (e.key === 'Enter') TV.doSearch(fileIndex); }); }, 80);
  },

  async updateNewName(file) {
    if (!file.match) return;
    const format = await api.getStore('defaultTvFormat') || FormatEngine.defaults.tv;
    const outputDir = await api.getStore('outputDirectory');
    const data = {
      series: file.match.title,
      season: String(file.episodeMatch?.season || file.parsed?.season || 1),
      episode: String(file.episodeMatch?.episode || file.parsed?.episode || 1),
      title: file.episodeMatch?.title || '',
      year: file.match.year || '',
      resolution: file.parsed?.resolution || '',
      source: file.parsed?.source || '',
      videoCodec: file.parsed?.videoCodec || '',
      audioCodec: file.parsed?.audioCodec || '',
      hdr: file.parsed?.hdr || '',
      group: file.parsed?.group || '',
      channels: file.parsed?.channels || '',
    };
    const articleFolder = await api.getStore('tvArticleFolder');
    const articleFile = await api.getStore('tvArticleFile');
    let formatted = FormatEngine.apply(format, data);
    formatted = FormatEngine.applyArticleSuffix(formatted, articleFolder, articleFile);
    file.newName = formatted + file.ext;
    let baseDir = outputDir || file.dir;
    if (!outputDir) {
      const depth = formatFolderDepth(format);
      if (depth > 0) {
        const formatSegs = formatted.split('/').slice(0, -1); // folder segments only
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

  async renameAll() {
    const ops = this.files.filter(f => f.selected && f.match && f.newPath).map(f => ({ oldPath: f.path, newPath: f.newPath }));
    if (ops.length === 0) { showToast('No matched files to rename', 'error'); return; }
    const results = await api.renameFiles(ops);
    const success = results.filter(r => r.success).length;
    for (const file of this.files) { const res = results.find(r => r.source === file.path); if (res) { file.status = res.success ? 'done' : 'error'; if (res.success) file.path = res.target; } }
    this.render();
    showToast(`Renamed ${success} files`, success > 0 ? 'success' : 'error');
  },

  showSearch(index) {
    const file = this.files[index];
    let query = file.parsed?.series;
    if (!query) {
      query = getBaseName(file.name).replace(/S\d+E\d+.*/i, '').replace(/\./g, ' ').trim();
      // If query is just a number or too short, use folder name
      if (!query || /^\d+\s*[-–—.]?\s*\w*$/.test(query)) {
        const parentFolder = pathBasename(file.dir);
        const grandparentDir = pathDirname(file.dir);
        const grandparentFolder = grandparentDir ? pathBasename(grandparentDir) : '';
        if (/^Season[\s._-]*\d+$/i.test(parentFolder) && grandparentFolder) {
          query = grandparentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
        } else if (parentFolder) {
          query = parentFolder.replace(/\s*[\(\[]\d{4}[\)\]]$/, '').trim();
        }
      }
    }
    showModal(`Search TV Show — ${escapeHtml(file.name)}`, `
      <div class="modal-search">
        <input type="text" class="input" id="tv-search-input" value="${escapeHtml(query)}" />
        <select class="input" id="tv-search-source" style="width:auto;min-width:90px;">
          <option value="all">All Sources</option>
          <option value="tmdb">TMDB</option>
          <option value="tvmaze">TVmaze</option>
        </select>
        <button class="btn btn-primary" onclick="TV.doSearch(${index})">Search</button>
      </div>
      <div class="modal-results" id="tv-search-results"><p class="text-muted">Press Search or Enter</p></div>
    `);
    setTimeout(() => { const el = document.getElementById('tv-search-input'); el?.focus(); el?.addEventListener('keydown', e => { if (e.key === 'Enter') TV.doSearch(index); }); }, 80);
  },

  async doSearch(index) {
    const input = document.getElementById('tv-search-input');
    const sourceEl = document.getElementById('tv-search-source');
    const resultsEl = document.getElementById('tv-search-results');
    if (!input?.value.trim()) return;
    const source = sourceEl?.value || 'all';
    const query = input.value.trim();
    resultsEl.innerHTML = '<div class="spinner"></div>';

    let results = [];
    if (source === 'all' || source === 'tmdb') {
      const apiKey = await api.getStore('tmdbApiKey');
      if (apiKey) { const r = await api.tmdbSearch(query, 'tv', apiKey); if (!r.error) r.forEach(x => { x.source = 'TMDB'; results.push(x); }); }
    }
    if (source === 'all' || source === 'tvmaze') {
      const r = await api.tvmazeSearch(query, 'tv');
      if (r && r.length) r.forEach(x => results.push(x));
    }

    if (results.length === 0) { resultsEl.innerHTML = '<p class="text-muted">No results found</p>'; return; }
    this._searchResults = results;

    const sourceBadge = (src) => {
      const colors = { 'TMDB': '#01b4e4', 'TVmaze': '#3c948b' };
      return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${colors[src] || '#555'};color:#000;margin-left:6px;">${src}</span>`;
    };
    resultsEl.innerHTML = results.map((r, i) => `<div class="search-result" onclick="TV.selectMatch(${index}, ${i})">${r.posterPath ? `<img src="${r.posterPath}" />` : '<div style="width:40px;height:60px;background:var(--bg-active);border-radius:4px;"></div>'}<div class="search-result-info"><div><span class="search-result-title">${escapeHtml(r.title)}</span><span class="search-result-year">${r.year || ''}</span>${sourceBadge(r.source || 'TMDB')}</div><p class="search-result-overview">${escapeHtml(r.overview || '')}</p></div></div>`).join('');
  },

  async selectMatch(fileIndex, resultIndex) {
    const file = this.files[fileIndex]; const match = this._searchResults[resultIndex];

    // If we have pending group files, apply to all of them
    const groupFiles = this._pendingGroupFiles || [file];
    this._pendingGroupFiles = null;

    await this._applyShowToGroup(match, groupFiles);
    this.render(); hideModal();
    showToast(`Matched: ${match.title} (${match.year})`, 'success');
  },

  // Re-apply format to all matched files
  async reapplyFormat() {
    for (const file of this.files) {
      if (file.match) await this.updateNewName(file);
    }
    this.render();
  },

  clear() { this.files = []; this._tvDetails = {}; this.render(); },

  refresh() {
    for (const file of this.files) {
      file.match = null;
      file.episodeMatch = null;
      file.newName = '';
      file.newPath = '';
      file.status = 'pending';
    }
    this.render();
    showToast('Matches cleared', 'info');
  },

  render() {
    if (this.files.length === 0) {
      const el = document.getElementById('tv-original-list');
      if (el) el.innerHTML = '';
      const ar = document.getElementById('tv-arrows');
      if (ar) ar.innerHTML = '';
      const nl = document.getElementById('tv-new-list');
      if (nl) nl.innerHTML = '';
      Organize.updateUI();
      return;
    }

    document.getElementById('tv-original-list').innerHTML = this.files.map((f, i) => `<div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}"><input type="checkbox" class="file-row-check" ${f.selected ? 'checked' : ''} onchange="TV.files[${i}].selected=this.checked" /><svg class="file-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/></svg><span class="file-row-name" title="${escapeHtml(f.path)}">${escapeHtml(f.name)}</span><button class="file-row-action" onclick="TV.showSearch(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button></div>`).join('');

    document.getElementById('tv-arrows').innerHTML = '<div class="arrow-spacer">&nbsp;</div>' + this.files.map(f => `<div class="center-arrow-row ${f.status === 'done' ? 'done' : (f.match ? 'active' : '')}">→</div>`).join('');

    document.getElementById('tv-new-list').innerHTML = this.files.map(f => {
      let nc = 'pending', dn = 'waiting for match...', sh = '<span class="file-row-status status-pending">pending</span>';
      if (f.status === 'matched' && f.newName) { nc = 'matched'; dn = f.newName; sh = '<span class="file-row-status status-matched">matched</span>'; }
      else if (f.status === 'done') { nc = 'done'; dn = f.newName; sh = '<span class="file-row-status status-done">done</span>'; }
      else if (f.status === 'error') { nc = 'error-name'; dn = 'no match'; sh = '<span class="file-row-status status-error">error</span>'; }
      return `<div class="file-row ${f.status === 'done' ? 'done' : ''} ${f.status === 'error' ? 'error-row' : ''}"><span class="file-row-newname ${nc}" title="${escapeHtml(f.newPath || '')}">${escapeHtml(dn)}</span>${sh}</div>`;
    }).join('');
    Organize.updateUI();
  }
};
