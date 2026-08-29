const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codApi', {
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (_event, action) => callback(action));
  },
  openCharacter: () => ipcRenderer.invoke('character:open'),
  saveCharacter: (data, filePath) => ipcRenderer.invoke('character:save', { data, filePath }),
  openMarkdownFile: () => ipcRenderer.invoke('rules:openMarkdown'),
  openGettingStarted: () => ipcRenderer.invoke('getting-started:open'),

  onGmScreenUp: (callback) => {
    ipcRenderer.on('gmscreen:up', (_event, info) => callback(info));
  },
  onGmScreenDown: (callback) => {
    ipcRenderer.on('gmscreen:down', (_event, info) => callback(info));
  },
  listKnownGmScreens: () => ipcRenderer.invoke('gmscreen:known'),
  pairGmScreen: (id, host, port, pin) => ipcRenderer.invoke('gmscreen:pair', { id, host, port, pin }),
  checkGmScreen: (id, host, port) => ipcRenderer.invoke('gmscreen:check', { id, host, port }),
  forgetGmScreen: (id) => ipcRenderer.invoke('gmscreen:forget', id),

  listCampaigns: () => ipcRenderer.invoke('campaigns:list'),
  getCampaign: (campaignId) => ipcRenderer.invoke('campaigns:get', campaignId),
  createCustomCampaign: () => ipcRenderer.invoke('campaigns:createCustom')
});
