const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  sqlite: {
    getAll: (table) => ipcRenderer.invoke('sqlite-get-all', table),
    getSettings: () => ipcRenderer.invoke('sqlite-get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('sqlite-save-settings', settings),
    saveRow: (table, data) => ipcRenderer.invoke('sqlite-save-row', { table, data }),
    deleteRow: (table, id) => ipcRenderer.invoke('sqlite-delete-row', { table, id }),
    saveSyncQueue: (queue) => ipcRenderer.invoke('sqlite-save-sync-queue', queue),
    clearTable: (table) => ipcRenderer.invoke('sqlite-clear-table', table)
  }
});
