// ═══════════════════════════════════════════════════════════════════
// History Module
// ═══════════════════════════════════════════════════════════════════

const History = {
  _undoResolve: null,

  async render() {
    const container = document.getElementById('history-list');
    const history = await api.getStore('history') || [];

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>No rename history yet</p>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map((entry, i) => {
      const date = new Date(entry.date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const failCount = entry.count - entry.successCount;

      return `
        <div class="history-entry" onclick="History.toggleDetails(${i})">
          <div class="history-header">
            <span class="history-date">${dateStr}</span>
            <span class="history-stats">
              <span class="success">${entry.successCount} succeeded</span>
              ${failCount > 0 ? `<span class="fail"> · ${failCount} failed</span>` : ''}
            </span>
          </div>
          <div class="history-details hidden" id="history-details-${i}">
            <div style="margin-top:10px; font-size:12px; font-family:var(--font-mono);">
              ${entry.operations.slice(0, 20).map(op => `
                <div style="padding: 3px 0; display: flex; gap: 8px; align-items: center;">
                  <span style="color: ${op.success ? 'var(--success)' : 'var(--error)'}; font-size: 10px;">●</span>
                  <span class="text-muted" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pathBasename(op.source)}</span>
                  <span style="color:var(--text-tertiary)">→</span>
                  <span style="color:var(--accent); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${pathBasename(op.target)}</span>
                </div>
              `).join('')}
              ${entry.operations.length > 20 ? `<div class="text-muted mt-2">...and ${entry.operations.length - 20} more</div>` : ''}
            </div>
            <div class="history-actions">
              <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); History.undo(${i})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Undo
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleDetails(index) {
    const el = document.getElementById(`history-details-${index}`);
    if (el) el.classList.toggle('hidden');
  },

  async undo(index) {
    const history = await api.getStore('history') || [];
    const entry = history[index];
    if (!entry) return;

    // Confirm before undoing
    const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const confirmed = await new Promise(resolve => {
      this._undoResolve = resolve;
      showModal('Confirm Undo', `
        <p style="margin-bottom:8px;color:var(--text-secondary);">
          Undo <strong>${entry.successCount}</strong> rename${entry.successCount !== 1 ? 's' : ''} from <strong>${dateStr}</strong>?
        </p>
        <p style="margin-bottom:16px;font-size:12px;color:var(--text-tertiary);">
          Files will be renamed back to their original names.
        </p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="History._resolveUndo(false)">Cancel</button>
          <button class="btn btn-primary" onclick="History._resolveUndo(true)">Undo</button>
        </div>
      `);
      // Resolve false if modal is dismissed externally
      const overlay = document.getElementById('modal-overlay');
      if (overlay) {
        const observer = new MutationObserver(() => {
          if (overlay.classList.contains('hidden')) {
            observer.disconnect();
            if (this._undoResolve) { this._undoResolve(false); this._undoResolve = null; }
          }
        });
        observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
      }
    });

    if (!confirmed) return;

    const results = await api.undoRename(entry.operations);
    const success = results.filter(r => r.success).length;

    if (success === 0) {
      showToast('Undo failed — files may have already been moved or deleted', 'error');
      return;
    }

    showToast(`Undid ${success} of ${entry.operations.length} renames`, 'success');

    // Remove from history only after at least a partial success
    history.splice(index, 1);
    await api.setStore('history', history);
    this.render();
  },

  _resolveUndo(confirmed) {
    const resolve = this._undoResolve;
    this._undoResolve = null;
    hideModal();
    if (resolve) resolve(confirmed);
  },

  async clearAll() {
    await api.setStore('history', []);
    this.render();
    showToast('History cleared', 'info');
  }
};
