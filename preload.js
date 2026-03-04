const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Dialogs
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openFiles: (filters) => ipcRenderer.invoke('dialog:openFiles', filters),

  // File operations
  isDirectory: (path) => ipcRenderer.invoke('files:isDirectory', path),
  scanFiles: (dir, type) => ipcRenderer.invoke('files:scan', dir, type),
  readAudioMeta: (path) => ipcRenderer.invoke('files:readAudioMeta', path),
  parseFilename: (filename) => ipcRenderer.invoke('files:parseFilename', filename),
  renameFiles: (ops) => ipcRenderer.invoke('files:rename', ops),
  undoRename: (ops) => ipcRenderer.invoke('files:undo', ops),
  showInFolder: (path) => ipcRenderer.invoke('shell:showInFolder', path),

  // TMDB
  tmdbSearch: (query, type, key, year) => ipcRenderer.invoke('tmdb:search', query, type, key, year),
  tmdbTvDetails: (id, key) => ipcRenderer.invoke('tmdb:tvDetails', id, key),

  // TVmaze (free, no key)
  tvmazeSearch: (query, type) => ipcRenderer.invoke('tvmaze:search', query, type),
  tvmazeShowDetails: (id) => ipcRenderer.invoke('tvmaze:showDetails', id),

  // OMDb
  omdbSearch: (query, type, key) => ipcRenderer.invoke('omdb:search', query, type, key),
  omdbDetails: (id, key) => ipcRenderer.invoke('omdb:details', id, key),

  // Video probe
  probeVideo: (path) => ipcRenderer.invoke('files:probeVideo', path),

  // Books (Audible + Audnexus + Google Books)
  searchAudible: (query) => ipcRenderer.invoke('books:audible', query),
  searchAudnexus: (query, author) => ipcRenderer.invoke('books:audnexus', query, author),
  audnexusDetails: (asin) => ipcRenderer.invoke('books:audnexusDetails', asin),
  searchGoogleBooks: (query) => ipcRenderer.invoke('books:google', query),

  // Audio tag embedding
  embedTags: (filePath, metadata, coverPath) => ipcRenderer.invoke('books:embedTags', filePath, metadata, coverPath),
  downloadCover: (url) => ipcRenderer.invoke('books:downloadCover', url),
  cleanupCover: (coverPath) => ipcRenderer.invoke('books:cleanupCover', coverPath),

  // IGDB (Games / ROMs)
  igdbSearch: (query, platformId) => ipcRenderer.invoke('igdb:search', query, platformId),
  igdbTestCredentials: (clientId, clientSecret) => ipcRenderer.invoke('igdb:testCredentials', clientId, clientSecret),

  // Settings store
  getStore: (key) => ipcRenderer.invoke('store:get', key),
  setStore: (key, val) => ipcRenderer.invoke('store:set', key, val),
});
