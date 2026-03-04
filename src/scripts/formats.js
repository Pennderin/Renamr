// ═══════════════════════════════════════════════════════════════════
// Format Editor Module
// ═══════════════════════════════════════════════════════════════════

const Formats = {
  async init() {
    // Auto-migrate old audiobook format that doesn't have series support
    const storedAbFmt = await api.getStore('defaultAudiobookFormat');
    if (storedAbFmt && !storedAbFmt.includes('{series}') && !storedAbFmt.includes('{bookNum}')) {
      // Old format from pre-series version — upgrade to new default
      await api.setStore('defaultAudiobookFormat', FormatEngine.defaults.audiobook);
    }

    const movieFmt = await api.getStore('defaultMovieFormat') || FormatEngine.defaults.movie;
    const tvFmt = await api.getStore('defaultTvFormat') || FormatEngine.defaults.tv;
    const abFmt = await api.getStore('defaultAudiobookFormat') || FormatEngine.defaults.audiobook;
    const romFmt = await api.getStore('defaultRomFormat') || FormatEngine.defaults.rom;

    document.getElementById('format-movie').value = movieFmt;
    document.getElementById('format-tv').value = tvFmt;
    document.getElementById('format-audiobook').value = abFmt;
    document.getElementById('format-rom').value = romFmt;

    this.updatePreviews();

    // Live preview on input
    document.getElementById('format-movie').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-tv').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-audiobook').addEventListener('input', () => this.updatePreviews());
    document.getElementById('format-rom').addEventListener('input', () => this.updatePreviews());
  },

  async updatePreviews() {
    const movieFmt = document.getElementById('format-movie').value;
    const tvFmt = document.getElementById('format-tv').value;
    const abFmt = document.getElementById('format-audiobook').value;

    const romFmt = document.getElementById('format-rom').value;
    document.getElementById('format-movie-preview').textContent = (await FormatEngine.preview(movieFmt, 'movie')) + '.mkv';
    document.getElementById('format-tv-preview').textContent = (await FormatEngine.preview(tvFmt, 'tv')) + '.mkv';
    document.getElementById('format-audiobook-preview').textContent = (await FormatEngine.preview(abFmt, 'audiobook')) + '.m4b';
    document.getElementById('format-rom-preview').textContent = (await FormatEngine.preview(romFmt, 'rom')) + '.snes';
  },

  async save() {
    const movieFmt = document.getElementById('format-movie').value;
    const tvFmt = document.getElementById('format-tv').value;
    const abFmt = document.getElementById('format-audiobook').value;
    const romFmt = document.getElementById('format-rom').value;

    await api.setStore('defaultMovieFormat', movieFmt);
    await api.setStore('defaultTvFormat', tvFmt);
    await api.setStore('defaultAudiobookFormat', abFmt);
    await api.setStore('defaultRomFormat', romFmt);

    // Re-apply formats to all currently matched files
    if (Movies.files.length > 0) await Movies.reapplyFormat();
    if (TV.files.length > 0) await TV.reapplyFormat();
    if (Audiobooks.files.length > 0) await Audiobooks.reapplyFormat();
    if (Roms.files.length > 0) await Roms.reapplyFormat();

    showToast('Formats saved and applied to matched files', 'success');
  },

  async reset() {
    document.getElementById('format-movie').value = FormatEngine.defaults.movie;
    document.getElementById('format-tv').value = FormatEngine.defaults.tv;
    document.getElementById('format-audiobook').value = FormatEngine.defaults.audiobook;
    document.getElementById('format-rom').value = FormatEngine.defaults.rom;
    this.updatePreviews();

    await api.setStore('defaultMovieFormat', FormatEngine.defaults.movie);
    await api.setStore('defaultTvFormat', FormatEngine.defaults.tv);
    await api.setStore('defaultAudiobookFormat', FormatEngine.defaults.audiobook);
    await api.setStore('defaultRomFormat', FormatEngine.defaults.rom);

    showToast('Formats reset to defaults', 'info');
  }
};
