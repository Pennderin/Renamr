const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const fastGlob = require('fast-glob');
const axios = require('axios');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    tmdbApiKey: '',
    omdbApiKey: '',
    preferredMovieSource: 'tmdb',
    preferredTvSource: 'tmdb',
    defaultMovieFormat: '{title} ({year})/{title} ({year})',
    defaultTvFormat: '{series}/Season {season}/{series} - S{season}E{episode} - {title}',
    defaultAudiobookFormat: '{author}/{title}/{title} - Chapter {track}',
    defaultRomFormat: '{platform}/{title} ({year})',
    outputDirectory: '',
    theme: 'dark',
    history: [],
    igdbClientId: '',
    igdbClientSecret: '',
    igdbAccessToken: '',
    igdbTokenExpiry: 0,
    romArticleFolder: false,
    romArticleFile: false
  }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Window Controls ──────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window:close', () => mainWindow.close());

// ── Dialog Handlers ──────────────────────────────────────────────
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:openFiles', async (_, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [
      { name: 'Media Files', extensions: ['mkv','mp4','avi','mov','wmv','flv','m4v','mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

// ── Path helpers ─────────────────────────────────────────────────
ipcMain.handle('files:isDirectory', async (_, filePath) => {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
});

// ── File Scanner ─────────────────────────────────────────────────
ipcMain.handle('files:scan', async (_, dirPath, mediaType) => {
  const ROM_EXTS = ['nes','snes','n64','z64','v64','gba','gbc','gb','nds','3ds',
    'iso','cso','chd','rvz','gcz','wbfs','wad','cia','xci','nsp','nsz','pce',
    'md','smd','gen','gg','32x','sfc','smc','fig','bs','st',
    'a26','a52','a78','lnx','ngp','ngc','ws','wsc','psx','pbp',
    'cdi','nrg','img','bin','cue'];
  const extensions = {
    video: ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts'],
    audio: ['mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'],
    roms: ROM_EXTS,
    all: ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts','mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav', ...ROM_EXTS]
  };

  const exts = extensions[mediaType] || extensions.all;
  const pattern = `**/*.{${exts.join(',')}}`;

  try {
    const files = await fastGlob(pattern, {
      cwd: dirPath,
      absolute: true,
      onlyFiles: true,
      dot: false
    });

    const fileInfos = await Promise.all(files.map(async (filePath) => {
      const stat = await fs.promises.stat(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        ext: path.extname(filePath).toLowerCase(),
        dir: path.dirname(filePath),
        size: stat.size,
        modified: stat.mtime.toISOString()
      };
    }));

    return fileInfos;
  } catch (err) {
    console.error('Scan error:', err);
    return [];
  }
});

// ── Audio Metadata Reader ────────────────────────────────────────
ipcMain.handle('files:readAudioMeta', async (_, filePath) => {
  try {
    const mm = require('music-metadata');
    const metadata = await mm.parseFile(filePath);
    const common = metadata.common || {};
    const native = metadata.native || {};

    // Flatten all native tags to find series/grouping/narrator fields
    const allTags = {};
    for (const format of Object.values(native)) {
      for (const tag of format) {
        const key = (tag.id || '').toUpperCase();
        if (!allTags[key]) allTags[key] = typeof tag.value === 'object' ? (tag.value?.description || tag.value?.text || JSON.stringify(tag.value)) : tag.value;
      }
    }

    // Extract series from various tag formats
    const series = allTags['TXXX:SERIES'] || allTags['MVNM'] ||
                   allTags['----:COM.APPLE.ITUNES:SERIES'] || allTags['©GRP'] ||
                   allTags['TIT1'] || common.grouping || '';
    const seriesPart = allTags['TXXX:SERIES-PART'] || allTags['MVIN'] ||
                       allTags['----:COM.APPLE.ITUNES:SERIES-PART'] ||
                       allTags['TXXX:SERIES_POSITION'] || '';
    const narrator = allTags['TXXX:NARRATOR'] || allTags['----:COM.APPLE.ITUNES:NARRATOR'] ||
                     common.albumartist || '';

    // Extract ASIN from tags (most audiobook files have it)
    const asin = allTags['TXXX:ASIN'] || allTags['TXXX:AUDIBLE_ASIN'] ||
                 allTags['----:COM.APPLE.ITUNES:ASIN'] || allTags['----:COM.AUDIBLE.ASIN'] ||
                 allTags['ASIN'] || '';

    return {
      title: common.title || '',
      artist: common.artist || '',
      album: common.album || '',
      albumArtist: common.albumartist || '',
      year: common.year || '',
      track: common.track?.no || '',
      trackTotal: common.track?.of || '',
      disc: common.disk?.no || '',
      discTotal: common.disk?.of || '',
      genre: (common.genre || [])[0] || '',
      composer: (common.composer || [])[0] || '',
      duration: metadata.format.duration || 0,
      codec: metadata.format.codec || '',
      bitrate: metadata.format.bitrate || 0,
      sampleRate: metadata.format.sampleRate || 0,
      narrator: narrator,
      series: typeof series === 'string' ? series : '',
      seriesPart: typeof seriesPart === 'string' ? seriesPart : '',
      grouping: common.grouping || '',
      asin: typeof asin === 'string' ? asin : '',
      picture: common.picture?.[0] ? {
        format: common.picture[0].format,
        data: common.picture[0].data.toString('base64')
      } : null
    };
  } catch (err) {
    console.error('Metadata read error:', err);
    return null;
  }
});

// ── TMDB Search ──────────────────────────────────────────────────
ipcMain.handle('tmdb:search', async (_, query, type, apiKey, year) => {
  const key = apiKey || store.get('tmdbApiKey');
  if (!key) return { error: 'No TMDB API key configured' };

  try {
    const endpoint = type === 'tv'
      ? 'https://api.themoviedb.org/3/search/tv'
      : 'https://api.themoviedb.org/3/search/movie';

    const params = { api_key: key, query, language: 'en-US', page: 1 };
    // TMDB uses different year params: 'year' for movies, 'first_air_date_year' for TV
    if (year) {
      if (type === 'tv') params.first_air_date_year = year;
      else params.year = year;
    }

    const res = await axios.get(endpoint, { params });

    return res.data.results.slice(0, 10).map(item => ({
      id: item.id,
      title: item.title || item.name,
      originalTitle: item.original_title || item.original_name,
      year: (item.release_date || item.first_air_date || '').substring(0, 4),
      overview: item.overview,
      posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null,
      rating: item.vote_average,
      type
    }));
  } catch (err) {
    console.error('TMDB search error:', err);
    return { error: err.message };
  }
});

ipcMain.handle('tmdb:tvDetails', async (_, tvId, apiKey) => {
  const key = apiKey || store.get('tmdbApiKey');
  if (!key) return { error: 'No API key' };

  try {
    const res = await axios.get(`https://api.themoviedb.org/3/tv/${tvId}`, {
      params: { api_key: key, language: 'en-US' }
    });
    const seasons = [];
    for (const s of res.data.seasons) {
      if (s.season_number === 0) continue;
      try {
        const sRes = await axios.get(`https://api.themoviedb.org/3/tv/${tvId}/season/${s.season_number}`, {
          params: { api_key: key, language: 'en-US' }
        });
        seasons.push({
          seasonNumber: s.season_number,
          name: s.name,
          episodes: sRes.data.episodes.map(ep => ({
            episodeNumber: ep.episode_number,
            name: ep.name,
            airDate: ep.air_date,
            overview: ep.overview
          }))
        });
      } catch (e) { /* skip */ }
    }
    return {
      id: res.data.id,
      name: res.data.name,
      year: (res.data.first_air_date || '').substring(0, 4),
      seasons
    };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Audnexus + Google Books (for audiobooks) ────────────────────

// ── TVmaze Search (free, no API key) ─────────────────────────────
ipcMain.handle('tvmaze:search', async (_, query, type) => {
  try {
    const endpoint = type === 'tv'
      ? 'https://api.tvmaze.com/search/shows'
      : 'https://api.tvmaze.com/search/shows'; // TVmaze is TV only
    const res = await axios.get(endpoint, { params: { q: query } });
    return res.data.slice(0, 10).map(item => ({
      id: item.show.id,
      title: item.show.name,
      originalTitle: item.show.name,
      year: (item.show.premiered || '').substring(0, 4),
      overview: (item.show.summary || '').replace(/<[^>]+>/g, ''),
      posterPath: item.show.image?.medium || null,
      rating: item.show.rating?.average || 0,
      type: 'tv',
      source: 'TVmaze'
    }));
  } catch (err) {
    console.error('TVmaze error:', err.message);
    return [];
  }
});

ipcMain.handle('tvmaze:showDetails', async (_, showId) => {
  try {
    const res = await axios.get(`https://api.tvmaze.com/shows/${showId}?embed=episodes`);
    const episodes = res.data._embedded?.episodes || [];
    const seasonMap = {};
    for (const ep of episodes) {
      if (!seasonMap[ep.season]) seasonMap[ep.season] = { seasonNumber: ep.season, name: `Season ${ep.season}`, episodes: [] };
      seasonMap[ep.season].episodes.push({
        episodeNumber: ep.number,
        name: ep.name,
        airDate: ep.airdate,
        overview: (ep.summary || '').replace(/<[^>]+>/g, '')
      });
    }
    return {
      id: res.data.id,
      name: res.data.name,
      year: (res.data.premiered || '').substring(0, 4),
      seasons: Object.values(seasonMap)
    };
  } catch (err) {
    return { error: err.message };
  }
});

// ── OMDb Search (free with API key) ──────────────────────────────
ipcMain.handle('omdb:search', async (_, query, type, apiKey) => {
  const key = apiKey || store.get('omdbApiKey');
  if (!key) return [];
  try {
    const omdbType = type === 'tv' ? 'series' : 'movie';
    const res = await axios.get('https://www.omdbapi.com/', {
      params: { apikey: key, s: query, type: omdbType }
    });
    if (res.data.Response === 'False') return [];
    return (res.data.Search || []).slice(0, 10).map(item => ({
      id: item.imdbID,
      title: item.Title,
      originalTitle: item.Title,
      year: item.Year?.replace(/–.*/, '') || '',
      overview: '',
      posterPath: item.Poster !== 'N/A' ? item.Poster : null,
      rating: 0,
      type: type,
      source: 'OMDb'
    }));
  } catch (err) {
    console.error('OMDb error:', err.message);
    return [];
  }
});

ipcMain.handle('omdb:details', async (_, imdbId, apiKey) => {
  const key = apiKey || store.get('omdbApiKey');
  if (!key) return null;
  try {
    const res = await axios.get('https://www.omdbapi.com/', {
      params: { apikey: key, i: imdbId, plot: 'short' }
    });
    if (res.data.Response === 'False') return null;
    return {
      title: res.data.Title,
      year: res.data.Year?.replace(/–.*/, '') || '',
      overview: res.data.Plot || '',
      rating: parseFloat(res.data.imdbRating) || 0,
      genre: res.data.Genre || '',
      director: res.data.Director || '',
      runtime: res.data.Runtime || '',
      posterPath: res.data.Poster !== 'N/A' ? res.data.Poster : null
    };
  } catch (err) {
    return null;
  }
});

// ── IGDB (Games / ROMs) ─────────────────────────────────────────
async function _getIgdbToken() {
  const clientId     = store.get('igdbClientId');
  const clientSecret = store.get('igdbClientSecret');
  if (!clientId || !clientSecret) throw new Error('No IGDB credentials configured');

  const cachedToken  = store.get('igdbAccessToken');
  const cachedExpiry = store.get('igdbTokenExpiry', 0);
  if (cachedToken && cachedExpiry > Date.now() + 60000) return cachedToken;

  const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: { client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }
  });
  const token  = res.data.access_token;
  const expiry = Date.now() + (res.data.expires_in * 1000);
  store.set('igdbAccessToken', token);
  store.set('igdbTokenExpiry', expiry);
  return token;
}

ipcMain.handle('igdb:search', async (_, query, platformId) => {
  try {
    const clientId = store.get('igdbClientId');
    const token    = await _getIgdbToken();

    let body = `search "${query.replace(/"/g, '')}";\n`;
    body    += `fields name,first_release_date,category,platforms.name,platforms.abbreviation,genres.name,involved_companies.company.name,involved_companies.developer,cover.url;\n`;
    body    += `limit 10;\n`;
    if (platformId) body += `where platforms = (${platformId});\n`;

    const res = await axios.post('https://api.igdb.com/v4/games', body, {
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      timeout: 10000
    });

    const items = Array.isArray(res.data) ? res.data : [];
    return items.map(item => {
      const releaseYear  = item.first_release_date
        ? new Date(item.first_release_date * 1000).getFullYear().toString()
        : '';
      const platforms    = item.platforms || [];
      const firstPlat    = platforms[0] || {};
      const genre        = ((item.genres || [])[0] || {}).name || '';
      const developers   = (item.involved_companies || [])
        .filter(ic => ic.developer)
        .map(ic => ic.company?.name)
        .filter(Boolean);
      const coverUrl     = item.cover?.url
        ? 'https:' + item.cover.url.replace('t_thumb', 't_cover_big')
        : null;
      return {
        id:             item.id,
        title:          item.name || '',
        year:           releaseYear,
        platform:       firstPlat.name || '',
        platformAbbrev: firstPlat.abbreviation || '',
        platforms:      platforms.map(p => ({ id: p.id, name: p.name, abbrev: p.abbreviation })),
        genre,
        developer:      developers[0] || '',
        coverUrl,
        category:       item.category || 0,
        source:         'IGDB'
      };
    });
  } catch (err) {
    console.error('IGDB search error:', err.message);
    return { error: err.message };
  }
});

ipcMain.handle('igdb:testCredentials', async (_, clientId, clientSecret) => {
  try {
    const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: { client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }
    });
    const token  = res.data.access_token;
    const expiry = Date.now() + (res.data.expires_in * 1000);
    store.set('igdbClientId',     clientId);
    store.set('igdbClientSecret', clientSecret);
    store.set('igdbAccessToken',  token);
    store.set('igdbTokenExpiry',  expiry);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ── Internet Archive (free ROM search, no API key) ───────────────
ipcMain.handle('ia:search', async (_, query, platformShort) => {
  try {
    const encodedQuery = encodeURIComponent(`title:"${query}" AND mediatype:software`);
    const url = `https://archive.org/advancedsearch.php?q=${encodedQuery}&fl=identifier,title,year,subject,creator&rows=15&output=json`;
    const res = await axios.get(url, { timeout: 12000 });
    const docs = res.data?.response?.docs || [];
    return docs.map(doc => ({
      id:             doc.identifier || '',
      title:          doc.title      || '',
      year:           doc.year       ? String(doc.year) : '',
      platform:       Array.isArray(doc.subject) ? doc.subject[0] : (doc.subject || ''),
      platformAbbrev: platformShort  || '',
      genre:          '',
      developer:      Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || ''),
      coverUrl:       null,
      source:         'IA'
    }));
  } catch (err) {
    console.error('IA search error:', err.message);
    return { error: err.message };
  }
});

// ── Video File Probe (via bundled ffprobe) ───────────────────────
ipcMain.handle('files:probeVideo', async (_, filePath) => {
  try {
    const { execFile } = require('child_process');
    const util = require('util');
    const execFileAsync = util.promisify(execFile);

    // Use bundled ffprobe from ffprobe-static package
    let ffprobePath;
    try {
      ffprobePath = require('ffprobe-static').path;
      // In packaged Electron app, the path may need adjustment
      if (ffprobePath.includes('app.asar')) {
        ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
      }
    } catch (e) {
      // Fallback: try system ffprobe
      ffprobePath = 'ffprobe';
    }

    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', filePath
    ], { timeout: 15000 });

    const result = JSON.parse(stdout);
    if (!result || !result.streams) return null;

    const vs = result.streams.find(s => s.codec_type === 'video');
    const as = result.streams.find(s => s.codec_type === 'audio');
    const probe = {};

    if (vs) {
      const w = vs.width;
      const h = vs.height;
      // Use width as primary indicator — handles widescreen aspect ratios
      // where height can be misleading (e.g. 1920x800 is still 1080p)
      if (w >= 3800 || h >= 2100) probe.resolution = '2160p';
      else if (w >= 1900 || h >= 1070) probe.resolution = '1080p';
      else if (w >= 1260 || h >= 700) probe.resolution = '720p';
      else if (w >= 1020 || h >= 560) probe.resolution = '576p';
      else if (w >= 640 || h >= 460) probe.resolution = '480p';
      else if (h > 0) probe.resolution = h + 'p';

      const vc = (vs.codec_name || '').toLowerCase();
      if (vc === 'hevc' || vc === 'h265') probe.videoCodec = 'x265';
      else if (vc === 'h264' || vc === 'avc') probe.videoCodec = 'x264';
      else if (vc === 'av1') probe.videoCodec = 'AV1';
      else if (vc === 'vp9') probe.videoCodec = 'VP9';
      else if (vc) probe.videoCodec = vc.toUpperCase();

      const pix = vs.pix_fmt || '';
      if (pix.includes('10le') || pix.includes('10be') || vs.bits_per_raw_sample === '10') {
        if (!probe.hdr) probe.hdr = '10bit';
      }
      const colorTransfer = (vs.color_transfer || '').toLowerCase();
      if (colorTransfer.includes('smpte2084') || colorTransfer.includes('arib-std-b67')) {
        probe.hdr = 'HDR';
      }
    }

    if (as) {
      const ac = (as.codec_name || '').toLowerCase();
      if (ac === 'truehd') probe.audioCodec = 'TrueHD';
      else if (ac === 'dts') probe.audioCodec = as.profile?.includes('MA') ? 'DTS-HD MA' : 'DTS';
      else if (ac === 'eac3') probe.audioCodec = 'EAC3';
      else if (ac === 'ac3') probe.audioCodec = 'AC3';
      else if (ac === 'aac') probe.audioCodec = 'AAC';
      else if (ac === 'flac') probe.audioCodec = 'FLAC';
      else if (ac === 'opus') probe.audioCodec = 'Opus';
      else if (ac) probe.audioCodec = ac.toUpperCase();

      const ch = as.channels;
      if (ch >= 8) probe.channels = '7.1';
      else if (ch >= 6) probe.channels = '5.1';
      else if (ch >= 2) probe.channels = '2.0';
      else if (ch === 1) probe.channels = '1.0';
    }

    return probe;
  } catch (err) {
    console.error('Probe error:', err.message);
    return null;
  }
});

// ── Audnexus Search (Audiobookshelf's Audible backend — free, no key) ──
ipcMain.handle('books:audnexus', async (_, query, author) => {
  try {
    const params = { title: query, region: 'us' };
    if (author) params.author = author;
    const res = await axios.get('https://api.audnex.us/books', {
      params,
      timeout: 8000
    });
    const items = Array.isArray(res.data) ? res.data : (res.data?.books || []);
    console.log('Audnexus search returned', items.length, 'results for:', query);
    return items.slice(0, 10).map(item => {
      // Series can be in multiple places depending on API version
      const sp = item.seriesPrimary || item.series?.[0] || {};
      const seriesNum = sp.position || sp.bookNumber || sp.sequence || '';
      return {
        asin: item.asin || '',
        title: item.title || '',
        author: item.authorName || (item.authors?.[0]?.name) || '',
        narrator: item.narratorName || (item.narrators?.[0]?.name) || '',
        series: sp.name || sp.title || '',
        seriesNum: seriesNum != null ? String(seriesNum) : '',
        year: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '',
        coverUrl: item.image || '',
        description: item.summary || item.description || '',
        source: 'Audnexus'
      };
    });
  } catch (err) {
    console.error('Audnexus search error:', err.message);
    return [];
  }
});

// ── Audnexus book details by ASIN ──
ipcMain.handle('books:audnexusDetails', async (_, asin) => {
  try {
    const res = await axios.get(`https://api.audnex.us/books/${asin}`, {
      params: { region: 'us' },
      timeout: 8000
    });
    const item = res.data;
    console.log('Audnexus details raw:', JSON.stringify({
      asin: item.asin,
      title: item.title,
      seriesPrimary: item.seriesPrimary,
      series: item.series,
    }));
    // Series can be in multiple places
    const sp = item.seriesPrimary || item.series?.[0] || {};
    const seriesNum = sp.position || sp.bookNumber || sp.sequence || item.seriesSequence || '';
    return {
      asin: item.asin || '',
      title: item.title || '',
      author: (item.authors?.[0]?.name) || item.authorName || '',
      narrator: (item.narrators?.[0]?.name) || item.narratorName || '',
      series: sp.name || sp.title || '',
      seriesNum: seriesNum != null ? String(seriesNum) : '',
      year: item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '',
      coverUrl: item.image || '',
      genres: (item.genres || []).map(g => g.name || g).slice(0, 5),
      description: item.summary || '',
      source: 'Audnexus'
    };
  } catch (err) {
    console.error('Audnexus details error:', err.message);
    return null;
  }
});

// ── Audible Catalog Search (public, no key needed) ─────────────
ipcMain.handle('books:audible', async (_, query) => {
  try {
    const res = await axios.get('https://api.audible.com/1.0/catalog/products', {
      params: {
        keywords: query,
        num_results: 15,
        products_sort_by: 'Relevance',
        response_groups: 'contributors,product_desc,product_extended_attrs,series,media,product_attrs,rating',
        image_sizes: '500,1024'
      },
      timeout: 10000
    });
    const products = res.data?.products || [];
    console.log('Audible search returned', products.length, 'results for:', query);
    return products.slice(0, 10).map(item => {
      // Authors
      const author = (item.authors || []).map(a => a.name).filter(Boolean)[0] || '';
      // Narrators
      const narrator = (item.narrators || []).map(n => n.name).filter(Boolean)[0] || '';
      // Series — Audible returns series[] with title and sequence
      const seriesInfo = (item.series || [])[0] || {};
      const series = seriesInfo.title || '';
      const seriesNum = seriesInfo.sequence || '';
      // Cover image
      const coverUrl = item.product_images?.['500'] || item.product_images?.['1024'] || '';
      // Year from release_date
      const year = item.release_date ? item.release_date.slice(0, 4) : '';

      console.log('Audible match:', JSON.stringify({ title: item.title, series, seriesNum, asin: item.asin }));

      return {
        asin: item.asin || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        author,
        narrator,
        series,
        seriesNum: seriesNum != null ? String(seriesNum) : '',
        year,
        coverUrl: coverUrl.replace('http:', 'https:'),
        description: (item.merchandising_summary || item.publisher_summary || '').replace(/<[^>]*>/g, '').slice(0, 500),
        publisher: item.publisher_name || '',
        genres: (item.category_ladders || []).flatMap(c => (c.ladder || []).map(l => l.name)).slice(0, 5),
        rating: item.rating?.overall_distribution?.display_average_rating || '',
        language: item.language || '',
        source: 'Audible'
      };
    });
  } catch (err) {
    console.error('Audible search error:', err.message);
    return [];
  }
});

// ── Google Books Search (free, no key) ──────────────────────────
ipcMain.handle('books:google', async (_, query) => {
  try {
    const res = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: { q: query, maxResults: 10, printType: 'books' },
      timeout: 8000
    });
    if (!res.data.items) return [];
    return res.data.items.slice(0, 10).map(item => {
      const v = item.volumeInfo || {};
      const fullTitle = [v.title, v.subtitle].filter(Boolean).join(': ');

      // Extract series info from title, subtitle, and description
      const { series, seriesNum } = extractSeriesFromGoogleBook(v);

      return {
        googleId: item.id,
        title: v.title || '',
        subtitle: v.subtitle || '',
        author: (v.authors || [])[0] || '',
        year: v.publishedDate ? v.publishedDate.slice(0, 4) : '',
        coverUrl: v.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        description: v.description || '',
        publisher: v.publisher || '',
        genres: (v.categories || []).slice(0, 5),
        isbn: ((v.industryIdentifiers || []).find(i => i.type === 'ISBN_13') || {}).identifier || '',
        series: series,
        seriesNum: seriesNum,
        source: 'Google'
      };
    });
  } catch (err) {
    console.error('Google Books search error:', err.message);
    return [];
  }
});

// Helper to extract series name and book number from Google Books data
function extractSeriesFromGoogleBook(volumeInfo) {
  let series = '';
  let seriesNum = '';

  // Check title + subtitle for series patterns
  const textsToCheck = [
    volumeInfo.subtitle || '',
    volumeInfo.title || '',
    (volumeInfo.description || '').slice(0, 500),
  ];

  const patterns = [
    // "Series Name, Book 2" or "Series Name, #2"
    /(.+?),\s*(?:Book|Vol\.?|Volume|#)\s*(\d+)/i,
    // "Book 2 of Series Name" or "Book 2 in the Series Name"
    /(?:Book|Vol\.?|Volume)\s*(\d+)\s*(?:of|in|in the)\s+(?:the\s+)?(.+?)(?:\s+series)?$/i,
    // "(Series Name Book 2)" or "(Series Name #2)"
    /\((.+?)\s+(?:Book|Vol\.?|Volume|#)\s*(\d+)\)/i,
    // "Series Name Book 2" at end of string
    /(.+?)\s+(?:Book|Vol\.?|Volume)\s+(\d+)\s*$/i,
    // "#2 in Series" or "Number 2 in Series"
    /(?:#|Number|No\.?)\s*(\d+)\s+(?:of|in)\s+(?:the\s+)?(.+?)(?:\s+series)?$/i,
    // "the Nth book in the Series"
    /the\s+(\w+)\s+(?:book|novel|installment)\s+(?:of|in)\s+(?:the\s+)?(.+?)(?:\s+series)/i,
  ];

  const ordinals = { first: '1', second: '2', third: '3', fourth: '4', fifth: '5',
    sixth: '6', seventh: '7', eighth: '8', ninth: '9', tenth: '10' };

  for (const text of textsToCheck) {
    if (!text) continue;
    for (const re of patterns) {
      const m = text.match(re);
      if (m) {
        // Some patterns have series first, some have number first
        if (/^(?:Book|Vol|Volume|#|Number|No)/i.test(re.source.slice(0, 20))) {
          // Number is m[1], series is m[2]
          seriesNum = m[1];
          series = m[2].trim();
        } else if (/^the/i.test(re.source.slice(0, 5))) {
          // Ordinal pattern: word is m[1], series is m[2]
          seriesNum = ordinals[m[1].toLowerCase()] || m[1];
          series = m[2].trim();
        } else {
          // Series is m[1], number is m[2]
          series = m[1].trim();
          seriesNum = m[2];
        }
        // Clean up series name
        series = series.replace(/\s*series\s*$/i, '').trim();
        if (series && seriesNum) return { series, seriesNum };
      }
    }
  }

  return { series, seriesNum };
}

// ── File Rename / Move Operations ────────────────────────────────
ipcMain.handle('files:rename', async (_, operations) => {
  const results = [];
  const dirsToClean = new Set();

  // Helper: normalize path and ensure consistent separators
  const normalizePath = (p) => {
    let n = path.normalize(p);
    // Ensure UNC paths keep their prefix
    if (p.startsWith('\\\\') && !n.startsWith('\\\\')) {
      n = '\\\\' + n.replace(/^\\+/, '');
    }
    // Also handle forward-slash UNC paths (from Electron file dialogs)
    if (p.startsWith('//') && !n.startsWith('\\\\') && !n.startsWith('//')) {
      n = '//' + n.replace(/^\/+/, '');
    }
    return n;
  };

  console.log(`\n═══ RENAME: ${operations.length} operations ═══`);

  // ── Phase 1: Analyze folder structure changes ─────────────────
  // For each operation, compare old and new path segments to determine:
  // - Which existing folders need renaming
  // - Which new folders need creating
  // We align the old and new paths by finding the common root, then
  // compare segments to figure out what changed.
  
  const folderRenames = new Map();     // oldFolder → newFolderName
  const folderRenameConflicts = new Set();

  for (const op of operations) {
    if (!op.oldPath || !op.newPath) continue;
    const oldNorm = normalizePath(op.oldPath);
    const newNorm = normalizePath(op.newPath);
    const sep = path.sep;

    const oldParts = oldNorm.split(sep);
    const newParts = newNorm.split(sep);

    // Find common prefix
    let commonLen = 0;
    while (commonLen < oldParts.length && commonLen < newParts.length && oldParts[commonLen] === newParts[commonLen]) {
      commonLen++;
    }

    const oldRemaining = oldParts.slice(commonLen);
    const newRemaining = newParts.slice(commonLen);

    // Same depth: straightforward folder renames
    if (oldRemaining.length === newRemaining.length && oldRemaining.length > 1) {
      for (let i = 0; i < oldRemaining.length - 1; i++) {
        if (oldRemaining[i] !== newRemaining[i]) {
          const oldFolder = [...oldParts.slice(0, commonLen), ...oldRemaining.slice(0, i + 1)].join(sep);
          const newFolderName = newRemaining[i];
          if (folderRenames.has(oldFolder)) {
            if (folderRenames.get(oldFolder) !== newFolderName) {
              folderRenameConflicts.add(oldFolder);
            }
          } else {
            folderRenames.set(oldFolder, newFolderName);
          }
        }
      }
    }
    // Different depth: new path has MORE segments (missing folders need to be inserted).
    // The rename handler will just mkdir -p the target directory in Phase 3.
    // No special folder rename logic needed for this case.
  }

  for (const conflict of folderRenameConflicts) {
    folderRenames.delete(conflict);
  }

  // ── Phase 2: Execute folder renames (shallowest first) ─────────
  const completedFolderRenames = new Map();
  const sortedFolderOps = [...folderRenames.entries()]
    .sort((a, b) => a[0].split(path.sep).length - b[0].split(path.sep).length);

  console.log(`Folder renames needed: ${sortedFolderOps.length}`);

  for (const [oldFolder, newFolderName] of sortedFolderOps) {
    try {
      const folderDepth = oldFolder.split(path.sep).filter(Boolean).length;
      if (folderDepth < 3) {
        console.log('Folder rename skipped (too shallow):', oldFolder);
        continue;
      }

      let currentOld = oldFolder;
      for (const [prevOld, prevNew] of completedFolderRenames) {
        if (currentOld.startsWith(prevOld + path.sep)) {
          currentOld = prevNew + currentOld.slice(prevOld.length);
        }
      }

      const parentDir = path.dirname(currentOld);
      const newFolder = path.join(parentDir, newFolderName);

      if (currentOld === newFolder) continue;
      if (!fs.existsSync(currentOld)) {
        console.log('Folder rename skipped (source missing):', currentOld);
        continue;
      }
      if (fs.existsSync(newFolder)) {
        console.log('Folder rename skipped (target exists):', currentOld, '→', newFolder);
        continue;
      }

      await fs.promises.rename(currentOld, newFolder);
      completedFolderRenames.set(oldFolder, newFolder);
      console.log('Folder renamed:', currentOld, '→', newFolder);
    } catch (err) {
      console.error('Folder rename failed:', oldFolder, '→', newFolderName, err.message);
    }
  }

  // ── Phase 3: Execute file renames/moves ────────────────────────
  for (const op of operations) {
    try {
      if (!op.oldPath || !op.newPath) {
        results.push({ source: op.oldPath, target: op.newPath, success: false, error: 'Missing path' });
        continue;
      }

      const newPath = normalizePath(op.newPath);

      // Update oldPath to account for any folder renames from Phase 2
      let currentOld = normalizePath(op.oldPath);
      const sortedRenames = [...completedFolderRenames.entries()]
        .sort((a, b) => b[0].length - a[0].length);
      for (const [prevOld, prevNew] of sortedRenames) {
        const prevOldNorm = normalizePath(prevOld);
        if (currentOld.startsWith(prevOldNorm + path.sep)) {
          currentOld = prevNew + currentOld.slice(prevOldNorm.length);
          break;
        }
      }

      // If paths now match (folders were renamed and filename unchanged), done
      if (currentOld === newPath) {
        console.log('File already in place:', path.basename(newPath));
        results.push({ source: op.oldPath, target: newPath, success: true });
        continue;
      }

      // Ensure target directory exists (handles missing intermediate folders)
      const targetDir = path.dirname(newPath);
      await fs.promises.mkdir(targetDir, { recursive: true });

      if (fs.existsSync(newPath) && currentOld !== newPath) {
        results.push({ source: op.oldPath, target: newPath, success: false, error: 'Target file already exists' });
        continue;
      }

      dirsToClean.add(path.dirname(currentOld));
      console.log('Moving file:', path.basename(currentOld), '→', path.basename(newPath),
        path.dirname(currentOld) === targetDir ? '(same dir)' : '(different dir)');

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          await fs.promises.rename(currentOld, newPath);
          break;
        } catch (renameErr) {
          if (renameErr.code === 'EXDEV') {
            console.log('Cross-device move, copying:', path.basename(currentOld));
            const srcStat = await fs.promises.stat(currentOld);
            await fs.promises.copyFile(currentOld, newPath);
            const dstStat = await fs.promises.stat(newPath);
            if (dstStat.size === srcStat.size) {
              await fs.promises.unlink(currentOld);
            } else {
              try { await fs.promises.unlink(newPath); } catch (e) { /* ignore */ }
              throw new Error(`Copy verification failed: src=${srcStat.size} dst=${dstStat.size}`);
            }
            break;
          } else if (renameErr.code === 'EBUSY' && attempt < maxRetries) {
            console.warn(`File busy, retrying (${attempt}/${maxRetries - 1}):`, path.basename(currentOld));
            await new Promise(r => setTimeout(r, 1000 * attempt));
          } else {
            throw renameErr;
          }
        }
      }
      results.push({ source: op.oldPath, target: newPath, success: true });
    } catch (err) {
      console.error('Rename failed:', op.oldPath, '→', op.newPath, err.message);
      results.push({ source: op.oldPath, target: op.newPath, success: false, error: err.message });
    }
  }

  // ── Phase 4: Clean up empty directories ────────────────────────
  // Only clean the immediate source directory if it's now empty.
  // Walk up at most 2 levels to catch empty parent left by moves.
  for (const dir of dirsToClean) {
    let current = dir;
    for (let i = 0; i < 2; i++) {
      try {
        if (!fs.existsSync(current)) { current = path.dirname(current); continue; }
        const entries = await fs.promises.readdir(current);
        if (entries.length === 0) {
          await fs.promises.rmdir(current);
          console.log('Cleaned empty dir:', current);
          current = path.dirname(current);
        } else {
          break;
        }
      } catch (e) { break; }
    }
  }

  // Save to history
  const history = store.get('history') || [];
  history.unshift({
    date: new Date().toISOString(),
    operations: results,
    count: results.length,
    successCount: results.filter(r => r.success).length
  });
  store.set('history', history.slice(0, 100));

  return results;
});

ipcMain.handle('files:undo', async (_, operations) => {
  const results = [];
  for (const op of operations) {
    if (!op.success) continue;
    try {
      const sourceDir = path.dirname(op.source);
      await fs.promises.mkdir(sourceDir, { recursive: true });
      await fs.promises.rename(op.target, op.source);
      results.push({ success: true, restored: op.source });
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  return results;
});

// ── Settings Store ───────────────────────────────────────────────
ipcMain.handle('store:get', (_, key) => store.get(key));
ipcMain.handle('store:set', (_, key, value) => { store.set(key, value); return true; });

// ── Shell Operations ─────────────────────────────────────────────
ipcMain.handle('shell:showInFolder', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── File name parser (extract info from filename) ────────────────
// Extracts: title, year, resolution, source, videoCodec, audioCodec, hdr, edition, group
ipcMain.handle('files:parseFilename', async (_, filename) => {
  return parseMediaFilename(filename);
});

function parseMediaFilename(filename) {
  const name = path.basename(filename, path.extname(filename));
  const raw = name.replace(/\./g, ' ').replace(/_/g, ' ');

  // ── Extract technical tags BEFORE cleaning ──
  const tags = extractMediaTags(raw);

  const clean = raw
    .replace(/\[.*?\]/g, '')
    .replace(/\((?!\d{4})[^)]*\)/g, '')
    .trim();

  // TV Show pattern: S01E02, 1x02, etc.
  const tvPatterns = [
    /(.+?)[\s._-]+S(\d{1,2})E(\d{1,3})/i,
    /(.+?)[\s._-]+(\d{1,2})x(\d{1,3})/i,
    /(.+?)[\s._-]+Season[\s._-]*(\d{1,2})[\s._-]*Episode[\s._-]*(\d{1,3})/i,
  ];

  for (const pattern of tvPatterns) {
    const match = clean.match(pattern);
    if (match) {
      let series = match[1].trim();
      let seriesYear = null;
      // Extract year from series name (e.g. "Scrubs 2026" → series: "Scrubs", year: 2026)
      const yearInSeries = series.match(/[\s._-]+((?:19|20)\d{2})$/);
      if (yearInSeries) {
        seriesYear = parseInt(yearInSeries[1]);
        series = series.replace(/[\s._-]+(?:19|20)\d{2}$/, '').trim();
      }
      return {
        type: 'tv',
        series,
        seriesYear,
        season: parseInt(match[2]),
        episode: parseInt(match[3]),
        title: '',
        ...tags
      };
    }
  }

  // Movie pattern: Title (Year) or Title Year
  const moviePattern = /(.+?)[\s._-]*[\(\[]?(\d{4})[\)\]]?/;
  const movieMatch = clean.match(moviePattern);
  if (movieMatch) {
    return {
      type: 'movie',
      title: movieMatch[1].trim(),
      year: parseInt(movieMatch[2]),
      ...tags
    };
  }

  return { type: 'unknown', title: clean, ...tags };
}

function extractMediaTags(str) {
  const s = str.toLowerCase();
  const result = {
    resolution: '',
    source: '',
    videoCodec: '',
    audioCodec: '',
    hdr: '',
    edition: '',
    group: '',
    channels: '',
  };

  // Resolution
  if (/2160p|4k|uhd/i.test(str))       result.resolution = '2160p';
  else if (/1080p|1080i/i.test(str))    result.resolution = '1080p';
  else if (/720p/i.test(str))           result.resolution = '720p';
  else if (/480p|sd/i.test(str))        result.resolution = '480p';
  else if (/576p/i.test(str))           result.resolution = '576p';

  // Source / media
  if (/\bblu[\s-]?ray\b|bdremux|bdmux|bdrip/i.test(str))       result.source = 'BluRay';
  else if (/\bremux\b/i.test(str))                               result.source = 'Remux';
  else if (/\bweb[\s-]?dl\b/i.test(str))                        result.source = 'WEB-DL';
  else if (/\bwebrip\b/i.test(str))                              result.source = 'WEBRip';
  else if (/\bweb\b/i.test(str))                                 result.source = 'WEB';
  else if (/\bhdtv\b/i.test(str))                                result.source = 'HDTV';
  else if (/\bpdtv\b/i.test(str))                                result.source = 'PDTV';
  else if (/\bdvd(?:rip|scr)?\b/i.test(str))                    result.source = 'DVD';
  else if (/\bcam\b|\bts\b|\btelesync\b/i.test(str))            result.source = 'CAM';
  else if (/\bhd[\s-]?rip\b/i.test(str))                        result.source = 'HDRip';

  // Video codec
  if (/\bx265\b|\bhevc\b|\bh[\s.]?265\b/i.test(str))           result.videoCodec = 'x265';
  else if (/\bx264\b|\bavc\b|\bh[\s.]?264\b/i.test(str))       result.videoCodec = 'x264';
  else if (/\bav1\b/i.test(str))                                 result.videoCodec = 'AV1';
  else if (/\bxvid\b/i.test(str))                                result.videoCodec = 'XviD';
  else if (/\bvp9\b/i.test(str))                                 result.videoCodec = 'VP9';
  else if (/\bmpeg[24]?\b/i.test(str))                           result.videoCodec = 'MPEG';

  // Audio codec
  if (/\batmos\b/i.test(str))                                    result.audioCodec = 'Atmos';
  else if (/\btruehd\b/i.test(str))                              result.audioCodec = 'TrueHD';
  else if (/\bdts[\s-]?hd[\s-]?ma\b/i.test(str))                result.audioCodec = 'DTS-HD MA';
  else if (/\bdts[\s-]?hd\b/i.test(str))                        result.audioCodec = 'DTS-HD';
  else if (/\bdts[\s-]?x\b/i.test(str))                         result.audioCodec = 'DTS:X';
  else if (/\bdts\b/i.test(str))                                 result.audioCodec = 'DTS';
  else if (/\bflac\b/i.test(str))                                result.audioCodec = 'FLAC';
  else if (/\beac3\b|\bddp\b|\bdd\+|dolby[\s]?digital[\s]?plus/i.test(str)) result.audioCodec = 'EAC3';
  else if (/\bac3\b|\bdd5|dolby[\s]?digital\b/i.test(str))      result.audioCodec = 'AC3';
  else if (/\baac\b/i.test(str))                                 result.audioCodec = 'AAC';
  else if (/\bmp3\b/i.test(str))                                 result.audioCodec = 'MP3';
  else if (/\bpcm\b|\blpcm\b/i.test(str))                       result.audioCodec = 'LPCM';
  else if (/\bopus\b/i.test(str))                                result.audioCodec = 'Opus';

  // Audio channels
  if (/\b7[\s.]1\b/.test(str))          result.channels = '7.1';
  else if (/\b5[\s.]1\b/.test(str))     result.channels = '5.1';
  else if (/\b2[\s.]0\b/.test(str))     result.channels = '2.0';
  else if (/\bstereo\b/i.test(str))     result.channels = '2.0';
  else if (/\bmono\b/i.test(str))       result.channels = '1.0';

  // HDR
  if (/\bdolby[\s-]?vision\b|\b(?:dv|dovi)\b/i.test(str))      result.hdr = 'DV';
  if (/\bhdr10\+?\b/i.test(str))                                 result.hdr = result.hdr ? result.hdr + ' HDR10' : 'HDR10';
  else if (/\bhdr\b/i.test(str) && !result.hdr)                  result.hdr = 'HDR';
  if (/\bhlg\b/i.test(str))                                      result.hdr = result.hdr ? result.hdr + ' HLG' : 'HLG';
  if (/\b10[\s-]?bit\b/i.test(str) && !result.hdr)              result.hdr = '10bit';

  // Edition
  if (/\bimax\b/i.test(str))                                     result.edition = 'IMAX';
  else if (/\bdirector'?s[\s-]?cut\b/i.test(str))               result.edition = "Director's Cut";
  else if (/\bextended\b/i.test(str))                            result.edition = 'Extended';
  else if (/\bunrated\b/i.test(str))                             result.edition = 'Unrated';
  else if (/\btheatrical\b/i.test(str))                          result.edition = 'Theatrical';
  else if (/\bremastered\b/i.test(str))                          result.edition = 'Remastered';
  else if (/\bcriterion\b/i.test(str))                           result.edition = 'Criterion';
  else if (/\bspecial[\s-]?edition\b/i.test(str))                result.edition = 'Special Edition';
  else if (/\bopen[\s-]?matte\b/i.test(str))                    result.edition = 'Open Matte';

  // Release group (usually last token after a dash)
  const groupMatch = str.match(/[-\s]([A-Za-z0-9]+)$/);
  if (groupMatch && groupMatch[1].length >= 2 && groupMatch[1].length <= 20) {
    const g = groupMatch[1];
    // Filter out common false positives
    const falsePositives = ['mkv','mp4','avi','mov','x264','x265','hevc','avc','hdr','web','dl','bluray','rip','remux','imax','extended'];
    if (!falsePositives.includes(g.toLowerCase())) {
      result.group = g;
    }
  }

  return result;
}

// ── FFmpeg path ─────────────────────────────────────────────────
function getFFmpegPath() {
  try {
    let ffmpegPath = require('ffmpeg-static');
    // Handle asar-unpacked path in packaged app
    if (ffmpegPath && ffmpegPath.includes('app.asar')) {
      ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    }
    return ffmpegPath;
  } catch (e) {
    console.error('ffmpeg-static not found:', e.message);
    return null;
  }
}

// Run ffmpeg with args, returns promise
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = getFFmpegPath();
    if (!ffmpeg) return reject(new Error('ffmpeg not found'));
    execFile(ffmpeg, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

// ── Download cover art to temp file ─────────────────────────────
async function downloadCoverToTemp(url) {
  if (!url || url.startsWith('data:')) return null; // skip embedded base64 art
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const contentType = res.headers['content-type'] || 'image/jpeg';
    const ext = contentType.includes('png') ? '.png' : '.jpg';
    const tmpFile = path.join(os.tmpdir(), `renamr_cover_${Date.now()}${ext}`);
    await fs.promises.writeFile(tmpFile, res.data);
    return tmpFile;
  } catch (err) {
    console.error('Cover download failed:', err.message);
    return null;
  }
}

// ── Embed metadata into a single audio file ─────────────────────
ipcMain.handle('books:embedTags', async (_, filePath, metadata, coverPath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const tmpOutput = filePath + '.tmp' + ext;

    // Build ffmpeg args
    const args = ['-y', '-i', filePath];

    // Add cover art as second input if available
    if (coverPath && fs.existsSync(coverPath)) {
      args.push('-i', coverPath);
    }

    // Map streams
    if (coverPath && fs.existsSync(coverPath)) {
      args.push('-map', '0:a', '-map', '1:0');
    } else {
      args.push('-map', '0:a');
    }

    // Copy audio (no re-encoding)
    args.push('-c:a', 'copy');

    // If we added cover art, set it as attached_pic
    if (coverPath && fs.existsSync(coverPath)) {
      if (ext === '.mp3') {
        args.push('-c:v', 'mjpeg');  // MP3 needs mjpeg codec for cover
      } else {
        args.push('-c:v', 'copy');
      }
      args.push('-disposition:v:0', 'attached_pic');
    }

    // Standard metadata tags
    if (metadata.title)      args.push('-metadata', `title=${metadata.title}`);
    if (metadata.artist)     args.push('-metadata', `artist=${metadata.artist}`);
    if (metadata.albumArtist) args.push('-metadata', `album_artist=${metadata.albumArtist}`);
    if (metadata.album)      args.push('-metadata', `album=${metadata.album}`);
    if (metadata.date)       args.push('-metadata', `date=${metadata.date}`);
    if (metadata.genre)      args.push('-metadata', `genre=${metadata.genre}`);
    if (metadata.composer)   args.push('-metadata', `composer=${metadata.composer}`);
    if (metadata.track)      args.push('-metadata', `track=${metadata.track}`);
    if (metadata.disc)       args.push('-metadata', `disc=${metadata.disc}`);
    if (metadata.comment)    args.push('-metadata', `comment=${metadata.comment}`);
    if (metadata.description) args.push('-metadata', `description=${metadata.description}`);
    if (metadata.grouping)   args.push('-metadata', `grouping=${metadata.grouping}`);
    if (metadata.narrator)   args.push('-metadata', `composer=${metadata.narrator}`);

    // MP4/M4B specific: series in sort fields (Plex reads these)
    if (ext === '.m4b' || ext === '.m4a' || ext === '.mp4') {
      if (metadata.sortAlbum)  args.push('-metadata', `sort_album=${metadata.sortAlbum}`);
      if (metadata.sortArtist) args.push('-metadata', `sort_artist=${metadata.sortArtist}`);
      if (metadata.asin)       args.push('-metadata', `ASIN=${metadata.asin}`);
    }

    args.push(tmpOutput);

    console.log('FFmpeg embed tags:', filePath, '→', tmpOutput);
    await runFFmpeg(args);

    // Replace original with tagged version
    await fs.promises.unlink(filePath);
    await fs.promises.rename(tmpOutput, filePath);

    return { success: true, path: filePath };
  } catch (err) {
    // Clean up temp file on error
    const tmpOutput = filePath + '.tmp' + path.extname(filePath).toLowerCase();
    try { await fs.promises.unlink(tmpOutput); } catch (e) { /* ignore */ }
    console.error('Embed tags failed:', filePath, err.message);
    return { success: false, path: filePath, error: err.message };
  }
});

// ── Download cover art ──────────────────────────────────────────
ipcMain.handle('books:downloadCover', async (_, url) => {
  const tmpFile = await downloadCoverToTemp(url);
  return tmpFile; // returns path or null
});

// ── Clean up temp cover files ───────────────────────────────────
ipcMain.handle('books:cleanupCover', async (_, coverPath) => {
  if (coverPath) {
    try { await fs.promises.unlink(coverPath); } catch (e) { /* ignore */ }
  }
});
