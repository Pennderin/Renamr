// ═══════════════════════════════════════════════════════════════════
// Batch Organize Module
// ═══════════════════════════════════════════════════════════════════

const Batch = {
  sourceDir: '',
  destDir: '',
  pendingOps: [],

  async selectSource() {
    const dir = await api.openDirectory();
    if (dir) {
      this.sourceDir = dir;
      document.getElementById('batch-source').value = dir;
    }
  },

  async selectDest() {
    const dir = await api.openDirectory();
    if (dir) {
      this.destDir = dir;
      document.getElementById('batch-dest').value = dir;
    }
  },

  async run() {
    if (!this.sourceDir) { showToast('Please select a source directory', 'error'); return; }
    if (!this.destDir) { showToast('Please select a destination directory', 'error'); return; }

    const rule = document.querySelector('input[name="batch-rule"]:checked')?.value || 'type';
    const recursive = document.getElementById('batch-recursive').checked;
    const preview = document.getElementById('batch-preview').checked;

    showToast('Scanning files...', 'info');
    const files = await api.scanFiles(this.sourceDir, 'all');

    if (files.length === 0) {
      showToast('No files found in the source directory', 'error');
      return;
    }

    // Generate operations based on rule
    this.pendingOps = files.map(file => {
      const subDir = this.getSubDir(file, rule);
      const newPath = joinPath(this.destDir, subDir, file.name);
      return { oldPath: file.path, newPath, subDir, fileName: file.name };
    });

    if (preview) {
      this.showPreview();
    } else {
      await this.execute();
    }
  },

  getSubDir(file, rule) {
    const ext = file.ext.replace('.', '').toLowerCase();
    const modified = new Date(file.modified);

    switch (rule) {
      case 'type': {
        const videoExts = ['mkv','mp4','avi','mov','wmv','flv','m4v','webm','ts'];
        const audioExts = ['mp3','m4a','m4b','flac','ogg','wma','aac','opus','wav'];
        const imageExts = ['jpg','jpeg','png','gif','bmp','webp','svg','tiff'];
        const docExts = ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','csv'];

        if (videoExts.includes(ext)) return 'Videos';
        if (audioExts.includes(ext)) return 'Audio';
        if (imageExts.includes(ext)) return 'Images';
        if (docExts.includes(ext)) return 'Documents';
        return 'Other';
      }
      case 'date': {
        const year = modified.getFullYear();
        const month = modified.toLocaleString('en', { month: 'long' });
        return joinPath(String(year), month);
      }
      case 'ext': {
        return ext.toUpperCase() || 'No Extension';
      }
      case 'alpha': {
        const firstChar = (file.name[0] || '').toUpperCase();
        if (/[A-D]/.test(firstChar)) return 'A-D';
        if (/[E-H]/.test(firstChar)) return 'E-H';
        if (/[I-L]/.test(firstChar)) return 'I-L';
        if (/[M-P]/.test(firstChar)) return 'M-P';
        if (/[Q-T]/.test(firstChar)) return 'Q-T';
        if (/[U-X]/.test(firstChar)) return 'U-X';
        if (/[Y-Z]/.test(firstChar)) return 'Y-Z';
        return '0-9 & Symbols';
      }
      default:
        return '';
    }
  },

  showPreview() {
    const previewArea = document.getElementById('batch-preview-area');
    const previewList = document.getElementById('batch-preview-list');
    previewArea.classList.remove('hidden');

    // Show first 100 operations
    const displayOps = this.pendingOps.slice(0, 100);
    previewList.innerHTML = displayOps.map(op => `
      <div class="preview-item">
        <span class="preview-old" title="${op.oldPath}">${op.fileName}</span>
        <span class="preview-arrow">→</span>
        <span class="preview-new" title="${op.newPath}">${op.subDir}/${op.fileName}</span>
      </div>
    `).join('');

    if (this.pendingOps.length > 100) {
      previewList.innerHTML += `<div class="text-muted mt-2">...and ${this.pendingOps.length - 100} more files</div>`;
    }
  },

  async confirm() {
    await this.execute();
    this.cancelPreview();
  },

  cancelPreview() {
    document.getElementById('batch-preview-area').classList.add('hidden');
    this.pendingOps = [];
  },

  async execute() {
    if (this.pendingOps.length === 0) return;

    showToast(`Organizing ${this.pendingOps.length} files...`, 'info');
    const results = await api.renameFiles(this.pendingOps.map(op => ({
      oldPath: op.oldPath,
      newPath: op.newPath
    })));

    const success = results.filter(r => r.success).length;
    const fail = results.filter(r => !r.success).length;

    this.pendingOps = [];
    showToast(
      `Organized ${success} files${fail > 0 ? `, ${fail} failed` : ''}`,
      success > 0 ? 'success' : 'error'
    );
  }
};
