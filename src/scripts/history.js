// ═══════════════════════════════════════════════════════════════════
// History Module
// ═══════════════════════════════════════════════════════════════════

const History = {
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

    const results = await api.undoRename(entry.operations);
    const success = results.filter(r => r.success).length;

    showToast(`Undid ${success} of ${entry.operations.length} renames`, success > 0 ? 'success' : 'error');

    // Remove from history
    history.splice(index, 1);
    await api.setStore('history', history);
    this.render();
  },

  async clearAll() {
    await api.setStore('history', []);
    this.render();
    showToast('History cleared', 'info');
  }
};
