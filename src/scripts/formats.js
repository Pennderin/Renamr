// ═══════════════════════════════════════════════════════════════════
// Format Editor Module
// ═══════════════════════════════════════════════════════════════════

const Formats = {
  _baseValues: { movie: '', tv: '', audiobook: '', rom: '', romDlc: '', romUpdate: '' },
  _navResolve: null,

  async init() {
    // Auto-migrate old audiobook format that doesn't have series support
    const storedAbFmt = await api.getStore('defaultAudiobookFormat');
    if (storedAbFmt && !storedAbFmt.includes('{series}') && !storedAbFmt.includes('{bookNum}')) {
      // Old format from pre-series version — upgrade to new default
      await api.setStore('defaultAudiobookFormat', FormatEngine.defaults.audiobook);
    }

    const movieFmt     = await api.getStore('defaultMovieFormat')     || FormatEngine.defaults.movie;
    const tvFmt        = await api.getStore('defaultTvFormat')        || FormatEngine.defaults.tv;
    const abFmt        = await api.getStore('defaultAudiobookFormat') || FormatEngine.defaults.audiobook;
    const romFmt       = await api.getStore('defaultRomFormat')       || FormatEngine.defaults.rom;
    const romDlcFmt    = await api.getStore('defaultRomDlcFormat')    || FormatEngine.defaults.romDlc;
    const romUpdateFmt = await api.getStore('defaultRomUpdateFormat') || FormatEngine.defaults.romUpdate;

    document.getElementById('format-movie').value      = movieFmt;
    document.getElementById('format-tv').value         = tvFmt;
    document.getElementById('format-audiobook').value  = abFmt;
    document.getElementById('format-rom').value        = romFmt;
    document.getElementById('format-rom-dlc').value    = romDlcFmt;
    document.getElementById('format-rom-update').value = romUpdateFmt;

    this._baseValues = { movie: movieFmt, tv: tvFmt, audiobook: abFmt, rom: romFmt, romDlc: romDlcFmt, romUpdate: romUpdateFmt };

    this.updatePreviews();

    // Live preview on input
    document.getElementById('format-movie').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-tv').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-audiobook').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-rom').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-rom-dlc').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-rom-update').addEventListener('input', () => this.updatePreviews());
  },

  async updatePreviews() {
    const movieFmt     = document.getElementById('format-movie').value;
    const tvFmt        = document.getElementById('format-tv').value;
    const abFmt        = document.getElementById('format-audiobook').value;
    const romFmt       = document.getElementById('format-rom').value;
    const romDlcFmt    = document.getElementById('format-rom-dlc').value;
    const romUpdateFmt = document.getElementById('format-rom-update').value;

    document.getElementById('format-movie-preview').textContent      = (await FormatEngine.preview(movieFmt, 'movie')) + '.mkv';
    document.getElementById('format-tv-preview').textContent         = (await FormatEngine.preview(tvFmt, 'tv')) + '.mkv';
    document.getElementById('format-audiobook-preview').textContent  = (await FormatEngine.preview(abFmt, 'audiobook')) + '.m4b';
    document.getElementById('format-rom-preview').textContent        = (await FormatEngine.preview(romFmt, 'rom')) + '.snes';
    document.getElementById('format-rom-dlc-preview').textContent    = (await FormatEngine.preview(romDlcFmt, 'romDlc')) + '.nsp';
    document.getElementById('format-rom-update-preview').textContent = (await FormatEngine.preview(romUpdateFmt, 'romUpdate')) + '.nsp';
  },

  hasUnsavedChanges() {
    return (
      document.getElementById('format-movie')?.value      !== this._baseValues.movie     ||
      document.getElementById('format-tv')?.value         !== this._baseValues.tv        ||
      document.getElementById('format-audiobook')?.value  !== this._baseValues.audiobook ||
      document.getElementById('format-rom')?.value        !== this._baseValues.rom       ||
      document.getElementById('format-rom-dlc')?.value    !== this._baseValues.romDlc    ||
      document.getElementById('format-rom-update')?.value !== this._baseValues.romUpdate
    );
  },

  async promptUnsaved() {
    return new Promise(resolve => {
      this._navResolve = resolve;
      showModal('Unsaved Changes', `
        <p style="margin-bottom:16px;color:var(--text-secondary);">
          You have unsaved changes to your format strings. Would you like to save them before leaving?
        </p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="Formats._resolveNav('cancel')">Cancel</button>
          <button class="btn btn-secondary" onclick="Formats._resolveNav('discard')">Don't Save</button>
          <button class="btn btn-primary" onclick="Formats._resolveNav('save')">Save</button>
        </div>
      `);
    });
  },

  _resolveNav(action) {
    const resolve = this._navResolve;
    this._navResolve = null;
    hideModal();
    if (resolve) resolve(action);
  },

  async save() {
    const movieFmt     = document.getElementById('format-movie').value;
    const tvFmt        = document.getElementById('format-tv').value;
    const abFmt        = document.getElementById('format-audiobook').value;
    const romFmt       = document.getElementById('format-rom').value;
    const romDlcFmt    = document.getElementById('format-rom-dlc').value;
    const romUpdateFmt = document.getElementById('format-rom-update').value;

    await api.setStore('defaultMovieFormat',     movieFmt);
    await api.setStore('defaultTvFormat',         tvFmt);
    await api.setStore('defaultAudiobookFormat',  abFmt);
    await api.setStore('defaultRomFormat',        romFmt);
    await api.setStore('defaultRomDlcFormat',     romDlcFmt);
    await api.setStore('defaultRomUpdateFormat',  romUpdateFmt);

    // Re-apply formats to all currently matched files
    if (Movies.files.length > 0)     await Movies.reapplyFormat();
    if (TV.files.length > 0)         await TV.reapplyFormat();
    if (Audiobooks.files.length > 0) await Audiobooks.reapplyFormat();
    if (Roms.files.length > 0)       await Roms.reapplyFormat();

    this._baseValues = { movie: movieFmt, tv: tvFmt, audiobook: abFmt, rom: romFmt, romDlc: romDlcFmt, romUpdate: romUpdateFmt };
    showToast('Formats saved and applied to matched files', 'success');
  },

  async reset() {
    document.getElementById('format-movie').value      = FormatEngine.defaults.movie;
    document.getElementById('format-tv').value         = FormatEngine.defaults.tv;
    document.getElementById('format-audiobook').value  = FormatEngine.defaults.audiobook;
    document.getElementById('format-rom').value        = FormatEngine.defaults.rom;
    document.getElementById('format-rom-dlc').value    = FormatEngine.defaults.romDlc;
    document.getElementById('format-rom-update').value = FormatEngine.defaults.romUpdate;
    this.updatePreviews();

    await api.setStore('defaultMovieFormat',     FormatEngine.defaults.movie);
    await api.setStore('defaultTvFormat',         FormatEngine.defaults.tv);
    await api.setStore('defaultAudiobookFormat',  FormatEngine.defaults.audiobook);
    await api.setStore('defaultRomFormat',        FormatEngine.defaults.rom);
    await api.setStore('defaultRomDlcFormat',     FormatEngine.defaults.romDlc);
    await api.setStore('defaultRomUpdateFormat',  FormatEngine.defaults.romUpdate);

    this._baseValues = {
      movie:     FormatEngine.defaults.movie,
      tv:        FormatEngine.defaults.tv,
      audiobook: FormatEngine.defaults.audiobook,
      rom:       FormatEngine.defaults.rom,
      romDlc:    FormatEngine.defaults.romDlc,
      romUpdate: FormatEngine.defaults.romUpdate
    };
    showToast('Formats reset to defaults', 'info');
  }
};
