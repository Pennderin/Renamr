// ═══════════════════════════════════════════════════════════════════
// Settings Module — TMDB + OMDb keys
// ═══════════════════════════════════════════════════════════════════

const Settings = {
  async init() {
    const tmdbKey = await api.getStore('tmdbApiKey') || '';
    const omdbKey = await api.getStore('omdbApiKey') || '';
    const outputDir = await api.getStore('outputDirectory') || '';

    if (tmdbKey) {
      document.getElementById('settings-tmdb-key').value = tmdbKey;
      document.getElementById('tmdb-key-status').textContent = '✓ API key saved';
      document.getElementById('tmdb-key-status').className = 'key-status valid';
    }

    if (omdbKey) {
      document.getElementById('settings-omdb-key').value = omdbKey;
      document.getElementById('omdb-key-status').textContent = '✓ API key saved';
      document.getElementById('omdb-key-status').className = 'key-status valid';
    }

    const igdbClientId = await api.getStore('igdbClientId') || '';
    const igdbSecret   = await api.getStore('igdbClientSecret') || '';
    if (igdbClientId) {
      document.getElementById('settings-igdb-client-id').value = igdbClientId;
    }
    if (igdbSecret) {
      document.getElementById('settings-igdb-client-secret').value = igdbSecret;
      document.getElementById('igdb-key-status').textContent = '✓ Credentials saved';
      document.getElementById('igdb-key-status').className = 'key-status valid';
    }

    if (outputDir) {
      document.getElementById('settings-output-dir').value = outputDir;
    }

    const articleTypes = ['movie', 'tv', 'audiobook', 'rom'];
    for (const t of articleTypes) {
      const folderVal = await api.getStore(`${t}ArticleFolder`) || false;
      const fileVal = await api.getStore(`${t}ArticleFile`) || false;
      const folderEl = document.getElementById(`settings-article-${t}-folder`);
      const fileEl = document.getElementById(`settings-article-${t}-file`);
      if (folderEl) folderEl.checked = folderVal;
      if (fileEl) fileEl.checked = fileVal;
    }

    const esDeEl = document.getElementById('settings-rom-esde');
    if (esDeEl) esDeEl.checked = await api.getStore('romEsDeNames') || false;
  },

  async saveApiKey(provider) {
    if (provider === 'tmdb') {
      const key = document.getElementById('settings-tmdb-key').value.trim();
      if (!key) { showToast('Please enter an API key', 'error'); return; }

      const statusEl = document.getElementById('tmdb-key-status');
      statusEl.textContent = 'Testing...';
      statusEl.className = 'key-status';

      try {
        const results = await api.tmdbSearch('inception', 'movie', key);
        if (results.error) {
          statusEl.textContent = '✗ Invalid API key';
          statusEl.className = 'key-status invalid';
          return;
        }
        await api.setStore('tmdbApiKey', key);
        statusEl.textContent = '✓ Verified and saved';
        statusEl.className = 'key-status valid';
        showToast('TMDB API key saved', 'success');
      } catch (err) {
        statusEl.textContent = '✗ Could not verify';
        statusEl.className = 'key-status invalid';
      }
    } else if (provider === 'omdb') {
      const key = document.getElementById('settings-omdb-key').value.trim();
      if (!key) { showToast('Please enter an API key', 'error'); return; }

      const statusEl = document.getElementById('omdb-key-status');
      statusEl.textContent = 'Testing...';
      statusEl.className = 'key-status';

      try {
        const results = await api.omdbSearch('inception', 'movie', key);
        if (!results || results.length === 0) {
          statusEl.textContent = '✗ Invalid API key or no results';
          statusEl.className = 'key-status invalid';
          return;
        }
        await api.setStore('omdbApiKey', key);
        statusEl.textContent = '✓ Verified and saved';
        statusEl.className = 'key-status valid';
        showToast('OMDb API key saved', 'success');
      } catch (err) {
        statusEl.textContent = '✗ Could not verify';
        statusEl.className = 'key-status invalid';
      }
    } else if (provider === 'igdb') {
      const clientId = document.getElementById('settings-igdb-client-id').value.trim();
      const secret   = document.getElementById('settings-igdb-client-secret').value.trim();
      if (!clientId || !secret) { showToast('Enter both Client ID and Client Secret', 'error'); return; }

      const statusEl = document.getElementById('igdb-key-status');
      statusEl.textContent = 'Testing...';
      statusEl.className = 'key-status';

      try {
        const result = await api.igdbTestCredentials(clientId, secret);
        if (!result.success) {
          statusEl.textContent = `✗ ${result.error || 'Invalid credentials'}`;
          statusEl.className = 'key-status invalid';
          return;
        }
        statusEl.textContent = '✓ Verified and saved';
        statusEl.className = 'key-status valid';
        showToast('IGDB credentials saved', 'success');
      } catch (err) {
        statusEl.textContent = '✗ Could not verify';
        statusEl.className = 'key-status invalid';
      }
    }
  },

  toggleKeyVisibility(provider) {
    const idMap = {
      'tmdb': 'settings-tmdb-key',
      'omdb': 'settings-omdb-key',
      'igdb-id': 'settings-igdb-client-id',
      'igdb-secret': 'settings-igdb-client-secret'
    };
    const id = idMap[provider] || 'settings-tmdb-key';
    const input = document.getElementById(id);
    const btn = input.nextElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = 'Hide';
    } else {
      input.type = 'password';
      btn.textContent = 'Show';
    }
  },

  async selectOutputDir() {
    const dir = await api.openDirectory();
    if (dir) {
      document.getElementById('settings-output-dir').value = dir;
      await api.setStore('outputDirectory', dir);
      showToast('Output directory set', 'success');
    }
  },

  async clearOutputDir() {
    document.getElementById('settings-output-dir').value = '';
    await api.setStore('outputDirectory', '');
    showToast('Output directory cleared — files will be renamed in place', 'info');
  },

  async saveRomEsDeNames() {
    const checked = document.getElementById('settings-rom-esde')?.checked || false;
    await api.setStore('romEsDeNames', checked);
    if (typeof Roms !== 'undefined') Roms.reapplyFormat();
    showToast(checked ? 'ES-DE system names enabled' : 'Standard system names restored', 'info');
  },

  async saveArticleSuffix(type) {
    const folder = document.getElementById(`settings-article-${type}-folder`)?.checked || false;
    const file = document.getElementById(`settings-article-${type}-file`)?.checked || false;
    await api.setStore(`${type}ArticleFolder`, folder);
    await api.setStore(`${type}ArticleFile`, file);
    // Reapply formats to all matched files
    if (type === 'movie' && typeof Movies !== 'undefined') Movies.reapplyFormat();
    if (type === 'tv' && typeof TV !== 'undefined') TV.reapplyFormat();
    if (type === 'audiobook' && typeof Audiobooks !== 'undefined') Audiobooks.reapplyFormat();
    if (type === 'rom' && typeof Roms !== 'undefined') Roms.reapplyFormat();
  }
};
