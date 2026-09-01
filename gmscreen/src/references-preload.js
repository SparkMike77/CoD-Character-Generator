const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('referencesApi', {
  openMarkdownFile: () => ipcRenderer.invoke('rules:openMarkdown')
});
