const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('referencesApi', {
  openMarkdownFile: () => ipcRenderer.invoke('rules:openMarkdown'),
  getCampaignSetting: () => ipcRenderer.invoke('campaign:setting'),
  onCampaignSetting: (callback) => ipcRenderer.on('campaign:setting-changed', (_event, setting) => callback(setting))
});
