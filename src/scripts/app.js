// ═══════════════════════════════════════════════════════════════════
// App — Navigation, drag/drop, panel sync, init
// ═══════════════════════════════════════════════════════════════════

let currentPage = 'organize';

// ── HTML Escape helper ───────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Source Menu (right-click on Match button) ────────────────────
function showSourceMenu(event, prefix) {
  event.preventDefault();
  event.stopPropagation();
  hideSourceMenus();
  const menu = document.getElementById(`${prefix}-source-menu`);
  if (menu) menu.classList.remove('hidden');
}

function hideSourceMenus() {
  document.querySelectorAll('.source-menu').forEach(m => m.classList.add('hidden'));
}

// Click anywhere to close source menus
document.addEventListener('click', (e) => {
  if (!e.target.closest('.match-btn-wrapper')) {
    hideSourceMenus();
  }
});

// ── Navigation ───────────────────────────────────────────────────
async function navigateTo(page) {
  // Prompt to save if leaving the format editor with unsaved changes
  if (currentPage === 'formats' && page !== 'formats' && Formats.hasUnsavedChanges()) {
    const action = await Formats.promptUnsaved();
    if (action === 'cancel') return;
    if (action === 'save') await Formats.save();
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  currentPage = page;
  if (page === 'history') History.render();
  if (page === 'formats') Formats.init();
  if (page === 'settings') Settings.init();
}

// ── Synchronized panel scrolling ─────────────────────────────────
function syncPanelScroll(prefix) {
  // In unified mode, Organize handles scroll sync
  // This is kept as a no-op for module compatibility
}

// ── Drag & Drop (working with Electron) ──────────────────────────
function setupDragDrop() {
  // Prevent default browser behavior for drag/drop everywhere
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  // Unified drop targets — all route through Organize
  const targets = ['organize-drop', 'organize-workspace'];

  targets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropTarget = el.querySelector('.drop-target') || el;
      dropTarget.classList?.add('drag-over');
    });

    el.addEventListener('dragleave', (e) => {
      e.preventDefault();
      const dropTarget = el.querySelector('.drop-target') || el;
      dropTarget.classList?.remove('drag-over');
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dropTarget = el.querySelector('.drop-target') || el;
      dropTarget.classList?.remove('drag-over');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const paths = [];
      for (let i = 0; i < files.length; i++) {
        if (files[i].path) paths.push(files[i].path);
      }

      if (paths.length > 0) {
        const allFilePaths = [];
        for (const p of paths) {
          const isDir = await api.isDirectory(p);
          if (isDir) {
            const scanned = await api.scanFiles(p, 'all');
            if (scanned && scanned.length > 0) {
              scanned.forEach(f => allFilePaths.push(f.path));
            }
          } else {
            allFilePaths.push(p);
          }
        }
        if (allFilePaths.length > 0) {
          await Organize.handleDrop(allFilePaths);
        }
      }
    });
  });
}

// ── Keyboard Shortcuts ───────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    const pages = ['organize', 'batch', 'formats', 'history'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= pages.length) {
      e.preventDefault();
      navigateTo(pages[num - 1]);
    }
  }
  if (e.key === 'Escape') hideModal();
});

// ── Initialize ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await Settings.init();
  await Formats.init();
  setupDragDrop();
  navigateTo('organize');
  console.log('Renamr v1.0.0 initialized');
});
