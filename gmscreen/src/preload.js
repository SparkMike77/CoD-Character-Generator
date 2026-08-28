const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmApi', {
  getSession: () => ipcRenderer.invoke('session:get'),
  renameSession: (name) => ipcRenderer.invoke('session:rename', name),
  rotatePin: () => ipcRenderer.invoke('session:rotate-pin'),
  onSessionUpdate: (callback) => {
    ipcRenderer.on('session:update', (_event, state) => callback(state));
  },
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },
  getCampaign: () => ipcRenderer.invoke('campaign:get'),
  newCampaign: () => ipcRenderer.invoke('campaign:new'),
  openCampaign: () => ipcRenderer.invoke('campaign:open'),
  saveCampaign: (content) => ipcRenderer.invoke('campaign:save', content)
});
