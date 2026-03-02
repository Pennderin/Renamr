// ═══════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  // Only show error toasts — suppress info/success notifications
  if (type !== 'error') return;
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function closeModal(event) {
  if (event.target === event.currentTarget) hideModal();
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function padNumber(num, digits = 2) {
  return String(num).padStart(digits, '0');
}

function getPathSeparator() {
  return navigator.platform.startsWith('Win') ? '\\' : '/';
}

function joinPath(...parts) {
  const sep = getPathSeparator();
  const joined = parts.filter(Boolean).join(sep);
  // Normalize all separators to the OS separator
  if (sep === '\\') return joined.replace(/\//g, '\\');
  return joined.replace(/\\/g, '/');
}

function getExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.substring(idx) : '';
}

function getBaseName(filename) {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.substring(0, idx) : filename;
}

// Extract path components
function pathDirname(filepath) {
  const sep = filepath.includes('\\') ? '\\' : '/';
  const parts = filepath.split(sep);
  parts.pop();
  return parts.join(sep);
}

function pathBasename(filepath) {
  const sep = filepath.includes('\\') ? '\\' : '/';
  return filepath.split(sep).pop();
}

// Count how many folder levels a format string creates (e.g. "{series}/Season {season}/{file}" → 2)
function formatFolderDepth(format) {
  return (format.match(/\//g) || []).length;
}

// Go up N directory levels from a path
function pathUp(filepath, levels) {
  if (levels <= 0) return filepath;
  let result = filepath;
  for (let i = 0; i < levels; i++) {
    const parent = pathDirname(result);
    if (!parent || parent === result) break; // hit root
    result = parent;
  }
  return result;
}

function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}
