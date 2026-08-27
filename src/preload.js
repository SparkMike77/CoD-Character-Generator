const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codApi', {
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },
  openCharacter: () => ipcRenderer.invoke('character:open'),
  saveCharacter: (data, filePath) => ipcRenderer.invoke('character:save', { data, filePath })
});
