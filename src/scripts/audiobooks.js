// ═══════════════════════════════════════════════════════════════════
// Audiobooks Module — Book-centric with series detection
// ═══════════════════════════════════════════════════════════════════

const Audiobooks = {
  files: [],       // all individual audio files
  books: [],       // grouped books: { id, title, author, series, seriesNum, narrator, year, genre, files[], coverUrl }
  _searchResults: [],

  // ── Add Files ───────────────────────────────────────────────────
  async addFiles() {
    const paths = await api.openFiles([{ name: 'Audio Files', extensions: ['mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'] }]);
    if (paths.length === 0) return;
    await this._addPaths(paths);
  },

  async addFolder() {
    const dir = await api.openDirectory();
    if (!dir) return;
    const scanned = await api.scanFiles(dir, 'audio');
    await this._addPaths(scanned.map(f => f.path));
  },

  async handleDrop(paths) {
    if (!paths || paths.length === 0) return;
    await this._addPaths(paths);
  },

  async _addPaths(paths) {
    const audioExts = ['.mp3','.m4a','.m4b','.flac','.ogg','.wma','.aac','.opus','.wav'];
    for (const p of paths) {
      if (this.files.some(f => f.path === p)) continue;
      const name = pathBasename(p);
      const ext = getExtension(name).toLowerCase();
      if (!audioExts.includes(ext)) continue;
      this.files.push({
        path: p, name, ext,
        dir: pathDirname(p),
        metadata: null,
        bookId: null,
        newName: '', newPath: '',
        selected: true, status: 'pending'
      });
    }
    this.render();

    // Read metadata for all new files, then group into books
    await this._readAllMeta();
    this._groupIntoBooks();
    this.render();
  },

  // ── Read Metadata ───────────────────────────────────────────────
  async _readAllMeta() {
    for (const file of this.files) {
      if (file.metadata) continue;
      const meta = await api.readAudioMeta(file.path);
      if (meta) file.metadata = meta;
    }
  },

  // ── Group files into books ──────────────────────────────────────
  // Strategy: group by album tag, then by folder ancestry
  _groupIntoBooks() {
    const filesByGroup = {};

    for (const file of this.files) {
      if (file.bookId) continue; // already grouped

      // Determine group key: album tag > book-level folder
      const groupKey = this._getGroupKey(file);
      if (!filesByGroup[groupKey]) filesByGroup[groupKey] = [];
      filesByGroup[groupKey].push(file);
    }

    for (const [key, groupFiles] of Object.entries(filesByGroup)) {
      // Create a book from this group
      const book = this._buildBook(groupFiles);
      this.books.push(book);

      // Assign book ID to each file
      for (const file of groupFiles) {
        file.bookId = book.id;
      }
    }
  },

  _getGroupKey(file) {
    // Priority 1: album tag (most reliable) — but normalize to strip Part/Disc suffixes
    if (file.metadata?.album) {
      let album = file.metadata.album.trim();
      // Strip trailing Part/Disc/CD indicators so "Book Title Part 1" and "Book Title Part 2" group together
      album = album
        .replace(/[\s,_-]+(?:Part|Disc|CD|Disk|Volume|Vol\.?)\s*\d+\s*$/i, '')
        .replace(/\s*[\(\[]\s*(?:Part|Disc|CD|Disk|Vol\.?)\s*\d+\s*[\)\]]\s*$/i, '')
        .replace(/\s*[-–]\s*(?:Part|Disc|CD|Disk)\s*\d+\s*$/i, '')
        .trim();
      return 'album:' + album;
    }

    // Priority 2: smart folder detection
    let dir = file.dir;
    const dirName = pathBasename(dir);

    // If this folder looks like a Part/Disc/CD subfolder, go up one level
    if (/^(part|disc|cd|disk)\s*\d+$/i.test(dirName)) {
      dir = pathDirname(dir);
    }

    return 'dir:' + dir;
  },

  _buildBook(files) {
    const id = 'book_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    // Sort files: by disc/part then track number, then by filename
    files.sort((a, b) => {
      // Try part-track from filename (e.g., [01-07])
      const aPT = this._extractPartTrackFromName(a.name);
      const bPT = this._extractPartTrackFromName(b.name);

      const aPart = aPT?.part || a.metadata?.disc || this._extractPartNum(a.dir) || 1;
      const bPart = bPT?.part || b.metadata?.disc || this._extractPartNum(b.dir) || 1;
      if (aPart !== bPart) return aPart - bPart;

      const aTrack = aPT?.track || a.metadata?.track || this._extractTrackFromName(a.name) || 999;
      const bTrack = bPT?.track || b.metadata?.track || this._extractTrackFromName(b.name) || 999;
      if (aTrack !== bTrack) return aTrack - bTrack;

      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    // Extract book info from first file's metadata + folder structure
    const meta = files[0].metadata || {};
    const folderInfo = this._parseBookFromFolders(files[0]);
    const filenameInfo = this._parseBookFromFilename(files[0].name);

    // Series detection: tags first, then filename patterns, then folder parsing
    let series = meta.series || filenameInfo.series || folderInfo.series || '';
    let seriesNum = meta.seriesPart || filenameInfo.seriesNum || folderInfo.seriesNum || '';
    let title = meta.album || filenameInfo.title || folderInfo.title || '';
    let author = meta.artist || meta.albumArtist || meta.composer || folderInfo.author || '';
    let narrator = meta.narrator || '';
    let year = meta.year ? String(meta.year) : '';
    let genre = meta.genre || '';

    // If album tag has Part/Disc suffix, clean it for the book title
    if (title) {
      title = title
        .replace(/[\s,_-]+(?:Part|Disc|CD|Disk|Volume|Vol\.?)\s*\d+\s*$/i, '')
        .replace(/\s*[\(\[]\s*(?:Part|Disc|CD|Disk|Vol\.?)\s*\d+\s*[\)\]]\s*$/i, '')
        .replace(/\s*[-–]\s*(?:Part|Disc|CD|Disk)\s*\d+\s*$/i, '')
        .trim();
    }

    // Try to parse series from album tag: "Series Name #N - Book Title" patterns
    if (title && !series) {
      const parsed = this._parseSeriesFromTitle(title);
      if (parsed.series) {
        series = parsed.series;
        seriesNum = parsed.num;
        if (parsed.bookTitle) title = parsed.bookTitle;
      }
    }

    // Clean up series number
    if (seriesNum) seriesNum = String(seriesNum).replace(/^[#\s]+/, '').trim();

    // Filter fake series (author name, title, or generic groupings used as series)
    if (series) {
      series = this._validateSeries(series, author, title);
      if (!series) seriesNum = '';
    }

    // Get cover from first file with embedded art
    let coverUrl = null;
    for (const f of files) {
      if (f.metadata?.picture) {
        coverUrl = `data:${f.metadata.picture.format};base64,${f.metadata.picture.data}`;
        break;
      }
    }

    // Get ASIN from any file in the group (most audiobook files have it)
    let asin = '';
    for (const f of files) {
      if (f.metadata?.asin) { asin = f.metadata.asin; break; }
    }

    return {
      id, title, author, series, seriesNum, narrator, year, genre, coverUrl, asin,
      files, matched: false, status: 'pending'
    };
  },

  _extractPartNum(dirPath) {
    const dirName = pathBasename(dirPath);
    const m = dirName.match(/(?:part|disc|cd|disk)\s*(\d+)/i);
    return m ? parseInt(m[1]) : null;
  },

  // Extract part and track from filename patterns like [01-07], [02-03], etc.
  _extractPartTrackFromName(filename) {
    const base = getBaseName(filename);
    // Pattern: [Part-Track] — e.g., "[01-07]", "[02-03]"
    const pt = base.match(/\[(\d{1,3})[-.](\d{1,3})\]\s*$/);
    if (pt) return { part: parseInt(pt[1]), track: parseInt(pt[2]) };
    // Pattern: [Part-Track] anywhere in filename
    const ptAny = base.match(/\[(\d{1,3})[-.](\d{1,3})\]/);
    if (ptAny) return { part: parseInt(ptAny[1]), track: parseInt(ptAny[2]) };
    return null;
  },

  _extractTrackFromName(filename) {
    const base = getBaseName(filename);
    // Try part-track pattern first: [01-07]
    const pt = this._extractPartTrackFromName(filename);
    if (pt) return pt.track;
    // Try various patterns: "01 - title", "Chapter 01", "track01", etc.
    const m = base.match(/(?:^|\b)(\d{1,3})(?:\s*[-._]|\b)/);
    return m ? parseInt(m[1]) : null;
  },

  _parseBookFromFolders(file) {
    // Walk up the directory tree to extract Author/Series/Book info
    // Typical structures:
    //   Author/Series/Series - N - Title/Part X/files
    //   Author/Series - N - Title/files
    //   Author/Title/files
    //   Author/Title/Part X/files

    const parts = [];
    let dir = file.dir;
    // Collect up to 5 levels of parent folders
    for (let i = 0; i < 5; i++) {
      const name = pathBasename(dir);
      if (!name || name === dir) break;
      parts.unshift(name);
      dir = pathDirname(dir);
    }

    const result = { author: '', series: '', seriesNum: '', title: '' };
    if (parts.length === 0) return result;

    // Remove Part/Disc folders from consideration
    const meaningful = parts.filter(p => !/^(part|disc|cd|disk)\s*\d+$/i.test(p));

    if (meaningful.length >= 3) {
      // Author / Series / Book Title  (or Author / Series / Series - N - Title)
      result.author = meaningful[meaningful.length - 3];
      result.series = meaningful[meaningful.length - 2];
      const bookFolder = meaningful[meaningful.length - 1];
      const parsed = this._parseSeriesFromTitle(bookFolder);
      if (parsed.series) {
        result.seriesNum = parsed.num;
        result.title = parsed.bookTitle || bookFolder;
      } else {
        result.title = bookFolder;
      }
    } else if (meaningful.length === 2) {
      // Author / Book Title (might contain series info)
      result.author = meaningful[0];
      const bookFolder = meaningful[1];
      const parsed = this._parseSeriesFromTitle(bookFolder);
      if (parsed.series) {
        result.series = parsed.series;
        result.seriesNum = parsed.num;
        result.title = parsed.bookTitle || bookFolder;
      } else {
        result.title = bookFolder;
      }
    } else if (meaningful.length === 1) {
      result.title = meaningful[0];
    }

    return result;
  },

  // Parse book info from filename patterns like:
  //   "The Stormlight Archive [01] The Way Of Kings [01-07].mp3"
  //   "Series Name - 02 - Book Title [03-12].mp3"
  //   "Author - Series 01 - Title.mp3"
  _parseBookFromFilename(filename) {
    const base = getBaseName(filename);
    // Strip trailing part-track [NN-NN] or [NN]
    const cleaned = base.replace(/\s*\[\d{1,3}[-.]?\d{0,3}\]\s*$/, '').trim();

    // Try series patterns on the cleaned filename
    const parsed = this._parseSeriesFromTitle(cleaned);
    if (parsed.series) return { series: parsed.series, seriesNum: parsed.num, title: parsed.bookTitle };

    return { series: '', seriesNum: '', title: '' };
  },

  _parseSeriesFromTitle(text) {
    // Match patterns like:
    //   "Stormlight Archive - 2 - Words of Radiance"
    //   "The Stormlight Archive [02] Words of Radiance"
    //   "Series Name #3 - Book Title"
    //   "Series Name, Book 3: Title"
    //   "Series Name 02 - Title"

    const patterns = [
      // "Series - N - Title"
      /^(.+?)\s*[-–]\s*(\d+)\s*[-–]\s*(.+)$/,
      // "Series [N] Title" or "Series [0N] Title"
      /^(.+?)\s*\[(\d+)\]\s*(.+)$/,
      // "Series #N - Title" or "Series #N: Title"
      /^(.+?)\s*#(\d+)\s*[-–:]\s*(.+)$/,
      // "Series, Book N - Title" or "Series, Book N: Title"
      /^(.+?),?\s*(?:Book|Vol\.?|Volume)\s*(\d+)\s*[-–:]\s*(.+)$/i,
      // "Series Book N - Title"
      /^(.+?)\s+(?:Book|Vol\.?|Volume)\s+(\d+)\s*[-–:]\s*(.+)$/i,
    ];

    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        return { series: m[1].trim(), num: m[2].trim(), bookTitle: m[3].trim() };
      }
    }

    // No series detected
    return { series: '', num: '', bookTitle: '' };
  },

  // Check if a "series" is actually a real series and not just an author name, title, or generic grouping
  _validateSeries(series, author, title) {
    if (!series) return '';
    const s = series.toLowerCase().replace(/[^a-z0-9]/g, '');
    const a = (author || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    // Reject if series matches author name exactly (that's not a real series)
    if (a && s === a) return '';
    // NOTE: Don't reject when series === title. This is common for Book 1
    // where the series takes its name from the first book (e.g., "Dungeon Crawler Carl")
    return series;
  },

  // ── Match / Lookup ──────────────────────────────────────────────
  async matchAll(source) {
    for (const book of this.books) {
      if (Organize._cancelMatch) break;
      if (book.matched) continue;
      await this._matchBook(book, source);
    }
  },

  async _matchBook(book, source) {
    book.status = 'searching';
    this.render();

    const query = book.author ? `${book.title} ${book.author}` : book.title;

    // Strategy 1: If we have an ASIN from tags and no specific source forced, try Audnexus details
    if (book.asin && (!source || source === 'audnexus' || source === 'all')) {
      console.log('Found ASIN in tags:', book.asin);
      const details = await api.audnexusDetails(book.asin);
      if (details && details.title) {
        console.log('Audnexus details:', JSON.stringify({
          title: details.title, series: details.series,
          seriesNum: details.seriesNum, narrator: details.narrator
        }));
        await this._applyBookMatch(book, details);
        this.render();
        return;
      }
    }

    // Strategy 2: Audible catalog search (has series + book number data)
    if (!source || source === 'audible' || source === 'all') {
      let results = await api.searchAudible(query);
      if (results && results.length > 0) {
        const best = this._pickBestMatch(book, results);
        console.log('Audible best match:', JSON.stringify({
          title: best.title, series: best.series,
          seriesNum: best.seriesNum, source: best.source
        }));
        await this._applyBookMatch(book, best);
        this.render();
        return;
      }
    }

    // Strategy 3: Google Books fallback (sometimes has series in subtitle)
    if (!source || source === 'google' || source === 'all') {
      let results = await api.searchGoogleBooks(query);
      if (results && results.length > 0) {
        const best = this._pickBestMatch(book, results);
        await this._applyBookMatch(book, best);
        this.render();
        return;
      }
    }

    // No API results — use parsed tag/folder data as-is
    book.matched = true;
    book.status = 'matched';

    // If we know the series but not the book number, ask the user
    if (book.series && !book.seriesNum) {
      this.render();
      const bookNum = await this._promptBookNumber(book);
      if (bookNum === '__NOT_A_SERIES__') {
        book.series = '';
        book.seriesNum = '';
      } else if (bookNum) {
        book.seriesNum = bookNum;
      }
    }

    await this._updateBookFileNames(book);
    this.render();
  },

  // Pick the best result from search results — prefer matches with series data
  _pickBestMatch(book, results) {
    if (!results || results.length === 0) return null;

    const titleLower = (book.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const authorLower = (book.author || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Score each result
    let bestScore = -1;
    let bestMatch = results[0];

    for (const r of results) {
      let score = 0;
      const rTitle = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const rAuthor = (r.author || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      // Title similarity
      if (rTitle === titleLower) score += 10;
      else if (rTitle.includes(titleLower) || titleLower.includes(rTitle)) score += 5;

      // Author match
      if (authorLower && rAuthor.includes(authorLower)) score += 5;
      else if (authorLower && authorLower.includes(rAuthor)) score += 3;

      // Has series + book number — big bonus (but not if series = author name)
      const isFakeSeries = !this._validateSeries(r.series, r.author, r.title);
      if (r.series && r.seriesNum && !isFakeSeries) score += 8;
      else if (r.series && !isFakeSeries) score += 3;

      // Has narrator
      if (r.narrator) score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = r;
      }
    }

    return bestMatch;
  },

  async _applyBookMatch(book, match) {
    // API data is authoritative — always use it when available
    if (match.title) book.title = match.title;
    if (match.author && match.author !== 'Unknown') book.author = match.author;
    if (match.narrator) book.narrator = match.narrator;
    if (match.year) book.year = String(match.year);
    if (match.coverUrl) book.coverUrl = match.coverUrl;
    if (match.genres?.length && !book.genre) book.genre = match.genres[0];
    if (match.asin) book.asin = match.asin;
    if (match.source) book.source = match.source;
    if (match.description) book.description = match.description;

    // Only apply series if it's a real series (not just the author name or book title)
    if (match.series) {
      const validSeries = this._validateSeries(match.series, match.author || book.author, match.title || book.title);
      if (validSeries) {
        book.series = validSeries;
        if (match.seriesNum) book.seriesNum = match.seriesNum;
      }
    }

    book.matched = true;
    book.status = 'matched';

    // If we know the series but not the book number, ask the user
    if (book.series && !book.seriesNum) {
      this.render();
      const bookNum = await this._promptBookNumber(book);
      if (bookNum === '__NOT_A_SERIES__') {
        book.series = '';
        book.seriesNum = '';
      } else if (bookNum) {
        book.seriesNum = bookNum;
      }
    }

    await this._updateBookFileNames(book);
  },

  // ── Prompt user for book number when series is known but position is not ──
  _promptBookNumber(book) {
    return new Promise((resolve) => {
      // Store resolve so the modal buttons can call it
      this._bookNumResolve = resolve;

      showModal(`Which book number?`, `
        <div style="text-align:center;padding:10px 0;">
          <p style="color:var(--text-secondary);margin-bottom:12px;">
            <strong style="color:var(--accent);">${escapeHtml(book.title)}</strong><br>
            is part of the <strong>${escapeHtml(book.series)}</strong> series,<br>
            but the book number couldn't be determined.
          </p>
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:16px 0;">
            <label style="font-size:14px;color:var(--text-secondary);">Book #</label>
            <input type="number" id="book-num-input" class="input" min="1" max="99"
              style="width:70px;text-align:center;font-size:18px;font-weight:600;" value="1" />
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:16px;">
            <button class="btn btn-primary" onclick="Audiobooks._submitBookNum()">Set Book Number</button>
            <button class="btn btn-secondary" onclick="Audiobooks._notASeries()">Not a Series</button>
          </div>
        </div>
      `);

      setTimeout(() => {
        const el = document.getElementById('book-num-input');
        el?.focus();
        el?.select();
        el?.addEventListener('keydown', e => {
          if (e.key === 'Enter') Audiobooks._submitBookNum();
        });
      }, 80);
    });
  },

  _submitBookNum() {
    const val = document.getElementById('book-num-input')?.value?.trim();
    hideModal();
    if (this._bookNumResolve) {
      this._bookNumResolve(val || '');
      this._bookNumResolve = null;
    }
  },

  _notASeries() {
    hideModal();
    if (this._bookNumResolve) {
      this._bookNumResolve('__NOT_A_SERIES__');
      this._bookNumResolve = null;
    }
  },

  // ── Generate new filenames for all files in a book ──────────────
  async _updateBookFileNames(book) {
    const format = await api.getStore('defaultAudiobookFormat') || FormatEngine.defaults.audiobook;
    const articleFolder = await api.getStore('audiobookArticleFolder');
    const articleFile = await api.getStore('audiobookArticleFile');
    const outputDir = await api.getStore('outputDirectory');

    // Compute the library root: this is the directory ABOVE the format's folder structure.
    // We find it by aligning the format output against the existing path.
    const baseDir = await this._getBaseDir(book);

    // Sequential chapter numbering across all files (flattening parts)
    for (let i = 0; i < book.files.length; i++) {
      const file = book.files[i];
      const chapterNum = i + 1;

      const data = {
        author: book.author || 'Unknown Author',
        title: book.title || 'Unknown Title',
        series: book.series || '',
        bookNum: book.seriesNum || '',
        year: book.year || '',
        narrator: book.narrator || '',
        genre: book.genre || '',
        chapter: String(chapterNum),
        track: String(chapterNum),
        chapterTitle: file.metadata?.title || '',
      };

      let formatted = FormatEngine.apply(format, data);
      formatted = FormatEngine.applyArticleSuffix(formatted, articleFolder, articleFile);

      file.newName = formatted + file.ext;
      file.newPath = joinPath(baseDir, file.newName);
      file.status = 'matched';
      if (i === 0) console.log('Audiobook path debug:', {
        baseDir, newName: file.newName, newPath: file.newPath, oldPath: file.path
      });
    }
  },

  // Find the library root directory.
  // The library root is the folder ABOVE the format's top-level folder.
  //
  // Strategy: Build the ideal path from the format, then align it against
  // the existing file path to find where the library root is.
  //
  // Example:
  //   Format: {author}/{series}/Book {bookNum} - {title}/Chapter {chapter}
  //   Produces: Martha Wells/Murderbot Diaries/Book 1 - All Systems Red/Chapter 01
  //   Existing: //server/Plex/AudioBook/Martha Wells/Book 1 - All Systems Red/file.m4b
  //
  //   Alignment finds "Martha Wells" at position 4 → library root = //server/Plex/AudioBook
  //
  async _getBaseDir(book) {
    const outputDir = await api.getStore('outputDirectory');
    if (outputDir) return outputDir;

    const format = await api.getStore('defaultAudiobookFormat') || FormatEngine.defaults.audiobook;
    const depth = formatFolderDepth(format);
    if (depth === 0) return book.files[0]?.dir || '';

    const firstDir = book.files[0]?.dir || '';
    if (!firstDir) return '';

    // Build what the format WILL produce (folder segments only)
    const data = {
      author: book.author || '', title: book.title || '',
      series: book.series || '', bookNum: book.seriesNum || '',
      year: book.year || '', narrator: book.narrator || '',
      genre: book.genre || '', chapter: '1', track: '1', chapterTitle: '',
    };
    const formatted = FormatEngine.apply(format, data);
    const formatSegs = formatted.split('/').slice(0, -1); // folder segments only (exclude filename)

    // Split existing path
    const sep = firstDir.includes('\\') ? '\\' : '/';
    const pathSegs = firstDir.split(sep);

    // Normalize for comparison
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Try to find the best alignment point.
    // Walk through the existing path looking for a segment that matches
    // ANY of the format's folder segments. The library root is everything
    // before the first matching format segment we find.
    //
    // We search for the FIRST format segment first (usually author), then
    // fall back to later segments if not found.
    let rootIdx = -1;

    for (let f = 0; f < formatSegs.length; f++) {
      const target = norm(formatSegs[f]);
      if (!target) continue;

      for (let p = 0; p < pathSegs.length; p++) {
        if (norm(pathSegs[p]) === target) {
          // Found match: library root ends at (p - f) segments
          // e.g., if format seg 0 (author) matches path seg 4,
          // root = path[0..3]. If format seg 1 (series) matches path seg 3,
          // root = path[0..1] (3 - 1 = 2, so 0..1).
          rootIdx = p - f;
          break;
        }
      }
      if (rootIdx >= 0) break;
    }

    let baseDir;
    if (rootIdx >= 0 && rootIdx <= pathSegs.length) {
      baseDir = pathSegs.slice(0, rootIdx).join(sep);
    } else {
      // No match found: fall back to going up by depth
      baseDir = pathUp(firstDir, depth);
      const parent = pathDirname(baseDir);
      if (!parent || parent === baseDir) baseDir = firstDir;
    }

    // Sanity: baseDir shouldn't be empty for UNC paths
    if (!baseDir && firstDir.startsWith(sep + sep)) {
      baseDir = firstDir;
    }

    console.log('_getBaseDir:', { firstDir, formatSegs, rootIdx, baseDir });
    return baseDir;
  },

  // ── Manual search for a book ────────────────────────────────────
  showBookSearch(bookIndex) {
    const book = this.books[bookIndex];
    const query = book.title || '';
    showModal(`Search — ${escapeHtml(book.title || 'Unknown Book')}`, `
      <div class="modal-search">
        <input type="text" class="input" id="book-search-input" value="${escapeHtml(query)}" />
        <select class="input" id="book-search-source" style="width:auto;min-width:100px;">
          <option value="audible">Audible</option>
          <option value="audnexus">Audnexus</option>
          <option value="google">Google Books</option>
        </select>
        <button class="btn btn-primary" onclick="Audiobooks.doBookSearch(${bookIndex})">Search</button>
      </div>
      <div class="modal-results" id="book-search-results"><p class="text-muted">Search for audiobook metadata</p></div>
    `);
    setTimeout(() => {
      const el = document.getElementById('book-search-input');
      el?.focus();
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') Audiobooks.doBookSearch(bookIndex); });
    }, 80);
  },

  async doBookSearch(bookIndex) {
    const input = document.getElementById('book-search-input');
    const sourceEl = document.getElementById('book-search-source');
    const resultsEl = document.getElementById('book-search-results');
    if (!input?.value.trim()) return;
    resultsEl.innerHTML = '<div class="spinner"></div>';

    const source = sourceEl?.value || 'audible';
    let results = [];
    if (source === 'audible') {
      results = await api.searchAudible(input.value.trim());
    } else if (source === 'audnexus') {
      results = await api.searchAudnexus(input.value.trim(), '');
    } else {
      results = await api.searchGoogleBooks(input.value.trim());
    }

    if (!results || results.length === 0) { resultsEl.innerHTML = '<p class="text-muted">No results found</p>'; return; }
    this._searchResults = results;
    resultsEl.innerHTML = results.map((r, i) => {
      const srcColors = { Audible: '#f90', Audnexus: '#8b5cf6', Google: '#4285f4' };
      const srcBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;background:${srcColors[r.source] || '#666'};color:#fff;margin-left:6px;">${r.source || 'Unknown'}</span>`;
      const seriesInfo = r.series ? ` · ${r.series}${r.seriesNum ? ' #' + r.seriesNum : ''}` : '';
      const narratorInfo = r.narrator ? ` · Narrated by ${r.narrator}` : '';
      return `
        <div class="search-result" onclick="Audiobooks.selectBookMatch(${bookIndex}, ${i})">
          ${r.coverUrl ? `<img src="${r.coverUrl}" />` : '<div style="width:40px;height:60px;background:var(--bg-active);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:16px;">📚</div>'}
          <div class="search-result-info">
            <div>
              <span class="search-result-title">${escapeHtml(r.title)}</span>
              <span class="search-result-year">${r.year || ''}</span>
              ${srcBadge}
            </div>
            <p class="search-result-overview">by ${escapeHtml(r.author)}${seriesInfo}${narratorInfo}</p>
            ${r.description ? `<p class="search-result-overview" style="margin-top:2px;">${escapeHtml(r.description.slice(0, 120))}${r.description.length > 120 ? '...' : ''}</p>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async selectBookMatch(bookIndex, resultIndex) {
    const book = this.books[bookIndex];
    const match = this._searchResults[resultIndex];

    // If Audnexus result with ASIN, fetch full details for series info
    if (match.asin) {
      const details = await api.audnexusDetails(match.asin);
      if (details) {
        if (details.series) match.series = details.series;
        if (details.seriesNum) match.seriesNum = details.seriesNum;
        if (details.narrator) match.narrator = details.narrator;
        if (details.genres?.length) match.genres = details.genres;
      }
    }

    hideModal();
    await this._applyBookMatch(book, match);
    this.render();
  },

  // ── Rename ──────────────────────────────────────────────────────
  async renameAll() {
    const ops = this.files
      .filter(f => f.selected && f.status === 'matched' && f.newPath)
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
    if (fail > 0) {
      const firstError = results.find(r => !r.success);
      const errMsg = firstError?.error || 'Unknown error';
      showToast(`${fail} files failed to rename: ${errMsg}`, 'error');
      console.error('Rename failures:', results.filter(r => !r.success));
    }
    // Show embed tags button after successful rename
    if (success > 0) {
      const embedBtn = document.getElementById('audiobooks-embed-btn');
      if (embedBtn) embedBtn.style.display = '';
    }
  },

  // ── Embed metadata tags into audio files ────────────────────────
  async embedAllTags() {
    const matchedBooks = this.books.filter(b => b.matched);
    if (matchedBooks.length === 0) { showToast('No matched books to embed', 'error'); return; }

    // Confirmation modal with tag preview
    const firstBook = matchedBooks[0];
    const tagPreview = [
      `Author: ${firstBook.author || '—'}`,
      `Title: ${firstBook.title || '—'}`,
      firstBook.series ? `Series: ${firstBook.series}` : null,
      firstBook.seriesNum ? `Book #: ${firstBook.seriesNum}` : null,
      firstBook.narrator ? `Narrator: ${firstBook.narrator}` : null,
      firstBook.year ? `Year: ${firstBook.year}` : null,
      firstBook.genre ? `Genre: ${firstBook.genre}` : null,
      firstBook.coverUrl ? `Cover Art: ✓` : `Cover Art: ✗`,
      firstBook.asin ? `ASIN: ${firstBook.asin}` : null,
    ].filter(Boolean).join('\n');

    const bookCount = matchedBooks.length;
    const fileCount = matchedBooks.reduce((n, b) => n + b.files.length, 0);

    showModal('Embed Metadata Tags', `
      <div style="padding:10px 0;">
        <p style="color:var(--text-secondary);margin-bottom:12px;">
          Write metadata into <strong>${fileCount}</strong> file${fileCount !== 1 ? 's' : ''} across <strong>${bookCount}</strong> book${bookCount !== 1 ? 's' : ''}.
          <br><span style="font-size:12px;opacity:0.7;">This modifies the audio files directly — original audio is preserved.</span>
        </p>
        <div style="background:var(--bg-tertiary);border-radius:6px;padding:10px 14px;font-size:12px;font-family:monospace;white-space:pre-line;margin:12px 0;max-height:180px;overflow-y:auto;color:var(--text-secondary);">${escapeHtml(tagPreview)}${bookCount > 1 ? `\n\n... and ${bookCount - 1} more book${bookCount > 1 ? 's' : ''}` : ''}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0;">
          <label style="font-size:12px;display:flex;align-items:center;gap:4px;color:var(--text-secondary);">
            <input type="checkbox" id="embed-cover" checked /> Cover Art
          </label>
          <label style="font-size:12px;display:flex;align-items:center;gap:4px;color:var(--text-secondary);">
            <input type="checkbox" id="embed-chapters" checked /> Chapter Numbers
          </label>
        </div>
        <div id="embed-progress" style="display:none;margin:12px 0;">
          <div style="background:var(--bg-tertiary);border-radius:4px;height:6px;overflow:hidden;">
            <div id="embed-progress-bar" style="height:100%;background:var(--accent);width:0%;transition:width 0.3s;"></div>
          </div>
          <p id="embed-progress-text" style="font-size:11px;color:var(--text-secondary);margin-top:4px;">Preparing...</p>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;" id="embed-buttons">
          <button class="btn btn-secondary" onclick="hideModal()">Cancel</button>
          <button class="btn btn-primary" onclick="Audiobooks._startEmbedding()">Embed Tags</button>
        </div>
      </div>
    `);
  },

  async _startEmbedding() {
    const embedCover = document.getElementById('embed-cover')?.checked !== false;
    const embedChapters = document.getElementById('embed-chapters')?.checked !== false;
    const progressEl = document.getElementById('embed-progress');
    const progressBar = document.getElementById('embed-progress-bar');
    const progressText = document.getElementById('embed-progress-text');
    const buttonsEl = document.getElementById('embed-buttons');

    // Show progress, hide buttons
    if (progressEl) progressEl.style.display = '';
    if (buttonsEl) buttonsEl.innerHTML = '<button class="btn btn-secondary" disabled>Embedding...</button>';

    const matchedBooks = this.books.filter(b => b.matched);
    const PARALLEL = 4; // Process 4 files at once
    let totalFiles = matchedBooks.reduce((n, b) => n + b.files.length, 0);
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const updateProgress = (label) => {
      if (progressText) progressText.textContent = label || `Embedding... (${processed}/${totalFiles})`;
      if (progressBar) progressBar.style.width = `${Math.round((processed / totalFiles) * 100)}%`;
    };

    for (const book of matchedBooks) {
      // Download cover art once per book
      let coverPath = null;
      if (embedCover && book.coverUrl && !book.coverUrl.startsWith('data:')) {
        updateProgress(`Downloading cover for "${book.title}"...`);
        coverPath = await api.downloadCover(book.coverUrl);
      }

      // Build all metadata objects upfront
      const jobs = book.files.map((file, i) => {
        const chapterNum = i + 1;
        const metadata = {
          title: file.metadata?.title || `Chapter ${chapterNum}`,
          artist: book.author || '',
          albumArtist: book.author || '',
          album: book.title || '',
          date: book.year || '',
          genre: book.genre || '',
          composer: book.narrator || '',
          narrator: book.narrator || '',
          grouping: book.series || '',
          asin: book.asin || '',
          description: book.description || '',
        };
        if (embedChapters) metadata.track = String(chapterNum);
        if (book.seriesNum) metadata.disc = String(book.seriesNum);
        if (book.series && book.seriesNum) metadata.comment = `${book.series}, Book ${book.seriesNum}`;
        else if (book.series) metadata.comment = book.series;
        if (book.series) metadata.sortAlbum = `${book.series} ${(book.seriesNum || '0').padStart(3, '0')} - ${book.title}`;
        if (book.author) {
          const authorParts = book.author.split(/\s+/);
          if (authorParts.length >= 2) metadata.sortArtist = `${authorParts[authorParts.length - 1]}, ${authorParts.slice(0, -1).join(' ')}`;
        }
        return { file, metadata };
      });

      // Process in parallel batches
      for (let i = 0; i < jobs.length; i += PARALLEL) {
        const batch = jobs.slice(i, i + PARALLEL);
        updateProgress(`Embedding: ${book.title} (${processed + 1}–${Math.min(processed + batch.length, totalFiles)}/${totalFiles})`);

        const results = await Promise.all(
          batch.map(({ file, metadata }) => api.embedTags(file.path, metadata, coverPath))
        );

        for (const result of results) {
          processed++;
          if (result.success) succeeded++;
          else { failed++; console.error('Embed failed:', result.path, result.error); }
        }
        updateProgress();
      }

      // Clean up temp cover file
      if (coverPath) await api.cleanupCover(coverPath);
    }

    // Done
    if (progressText) {
      progressText.textContent = `Done! ${succeeded} files tagged${failed > 0 ? `, ${failed} failed` : ''}.`;
      progressText.style.color = failed > 0 ? 'var(--error)' : 'var(--success, #4ade80)';
    }
    if (progressBar) progressBar.style.width = '100%';
    if (buttonsEl) buttonsEl.innerHTML = '<button class="btn btn-primary" onclick="hideModal()">Done</button>';
  },

  removeBook(bookIndex) {
    const book = this.books[bookIndex];
    if (!book) return;
    this.files = this.files.filter(f => !book.files.includes(f));
    this.books.splice(bookIndex, 1);
    this.render();
  },

  // ── Clear / Refresh ─────────────────────────────────────────────
  clear() { this.files = []; this.books = []; this.render(); },

  refresh() {
    for (const book of this.books) {
      book.matched = false;
      book.status = 'pending';
    }
    for (const file of this.files) {
      file.newName = '';
      file.newPath = '';
      file.status = 'pending';
    }
    this.render();
  },

  async reapplyFormat() {
    for (const book of this.books) {
      if (book.matched) await this._updateBookFileNames(book);
    }
    this.render();
  },

  toggleAll(checked) { this.files.forEach(f => f.selected = checked); this.render(); },

  // ── Render ──────────────────────────────────────────────────────
  render() {
    if (this.files.length === 0) {
      const el = document.getElementById('audiobooks-original-list');
      if (el) el.innerHTML = '';
      const ar = document.getElementById('audiobooks-arrows');
      if (ar) ar.innerHTML = '';
      const nl = document.getElementById('audiobooks-new-list');
      if (nl) nl.innerHTML = '';
      const embedBtn = document.getElementById('audiobooks-embed-btn');
      if (embedBtn) embedBtn.style.display = 'none';
      Organize.updateUI();
      return;
    }

    const matched = this.books.filter(b => b.matched).length;
    // Show embed button when any books are matched
    const embedBtn = document.getElementById('audiobooks-embed-btn');
    if (embedBtn) embedBtn.style.display = matched > 0 ? '' : 'none';

    // Render book-grouped view
    let leftHtml = '';
    let arrowHtml = '<div class="arrow-spacer">&nbsp;</div>';
    let rightHtml = '';

    for (let bi = 0; bi < this.books.length; bi++) {
      const book = this.books[bi];

      // Book header row (left side)
      leftHtml += `
        <div class="file-row book-header" oncontextmenu="Organize.showRowMenu('audiobooks',${bi},event)">
          ${book.coverUrl ? `<img src="${book.coverUrl}" class="book-cover-thumb" />` : '<div class="book-cover-thumb book-cover-placeholder">📚</div>'}
          <div class="file-row-nameblock">
            <span class="file-row-name book-title-row">${escapeHtml(book.title || 'Unknown Book')}</span>
            <span class="file-row-tags">
              ${book.author ? escapeHtml(book.author) : 'Unknown Author'}
              ${book.series ? ` · ${escapeHtml(book.series)}${book.seriesNum ? ' #' + book.seriesNum : ''}` : ''}
              · ${book.files.length} files
              ${book.source ? `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700;background:${book.source === 'Audible' ? '#f90' : book.source === 'Audnexus' ? '#8b5cf6' : '#4285f4'};color:#fff;margin-left:4px;">${book.source}</span>` : ''}
            </span>
          </div>
          <button class="file-row-action" onclick="Audiobooks.showBookSearch(${bi})" title="Search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
        </div>`;

      // Book header arrow
      const bookArrowCls = book.matched ? (book.files.every(f => f.status === 'done') ? 'done' : 'active') : '';
      arrowHtml += `<div class="center-arrow-row ${bookArrowCls}" style="font-weight:bold;height:44px;">→</div>`;

      // Book header (right side) — show target folder structure
      if (book.matched && book.files[0]?.newName) {
        const samplePath = book.files[0].newName;
        const folderPart = samplePath.includes('/') ? samplePath.split('/').slice(0, -1).join('/') + '/' : '';
        rightHtml += `<div class="file-row book-header">
          <span class="file-row-newname matched" title="${escapeHtml(folderPart)}">${escapeHtml(folderPart || book.title)}</span>
          <span class="file-row-status status-matched">${book.status}</span>
        </div>`;
      } else {
        rightHtml += `<div class="file-row book-header">
          <span class="file-row-newname pending">waiting for match...</span>
          <span class="file-row-status status-pending">pending</span>
        </div>`;
      }

      // Individual file rows
      for (let fi = 0; fi < book.files.length; fi++) {
        const file = book.files[fi];
        const globalIdx = this.files.indexOf(file);

        // Left: original filename (indented)
        leftHtml += `
          <div class="file-row file-indent ${file.status === 'done' ? 'done' : ''} ${file.status === 'error' ? 'error-row' : ''}">
            <input type="checkbox" class="file-row-check" ${file.selected ? 'checked' : ''} onchange="Audiobooks.files[${globalIdx}].selected=this.checked" />
            <span class="file-row-name" title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</span>
          </div>`;

        // Arrow
        const cls = file.status === 'done' ? 'done' : (file.status === 'matched' ? 'active' : '');
        arrowHtml += `<div class="center-arrow-row ${cls}">→</div>`;

        // Right: new name
        let nc = 'pending', dn = '', sh = '<span class="file-row-status status-pending">·</span>';
        if (file.status === 'matched' && file.newName) {
          nc = 'matched';
          // Show just the filename part (last segment)
          dn = file.newName.includes('/') ? file.newName.split('/').pop() : file.newName;
          sh = '<span class="file-row-status status-matched">✓</span>';
        } else if (file.status === 'done') {
          nc = 'done';
          dn = file.newName.includes('/') ? file.newName.split('/').pop() : file.newName;
          sh = '<span class="file-row-status status-done">done</span>';
        } else if (file.status === 'error') {
          nc = 'error-name'; dn = 'failed';
          sh = '<span class="file-row-status status-error">✗</span>';
        }
        rightHtml += `<div class="file-row file-indent ${file.status === 'done' ? 'done' : ''} ${file.status === 'error' ? 'error-row' : ''}">
          <span class="file-row-newname ${nc}" title="${escapeHtml(file.newPath || '')}">${escapeHtml(dn || '...')}</span>${sh}
        </div>`;
      }
    }

    document.getElementById('audiobooks-original-list').innerHTML = leftHtml;
    document.getElementById('audiobooks-arrows').innerHTML = arrowHtml;
    document.getElementById('audiobooks-new-list').innerHTML = rightHtml;
    Organize.updateUI();
  }
};
