const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmApi', {
  getSession: () => ipcRenderer.invoke('session:get'),
  renameSession: (name) => ipcRenderer.invoke('session:rename', name),
  rotatePin: () => ipcRenderer.invoke('session:rotate-pin'),
  onSessionUpdate: (callback) => {
    ipcRenderer.on('session:update', (_event, state) => callback(state));
  }
});
