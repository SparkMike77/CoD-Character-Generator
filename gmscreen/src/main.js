const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { GmServer } = require('./gm-server');
const { CAMPAIGN_TEMPLATE } = require('./campaign-template');

let mainWindow;
let gmServer;
let currentCampaign = { filePath: null, content: '' };

function sendMenuAction(action) {
  if (mainWindow) mainWindow.webContents.send('menu-action', action);
}

function handleNewSession() {
  if (!currentCampaign.filePath) {
    sendMenuAction('session-needs-campaign');
    return;
  }
  // Session-running itself isn't designed/built yet - this is just the
  // "a Campaign has to be loaded first" guard for now.
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          submenu: [
            { label: 'Campaign', click: () => sendMenuAction('new-campaign') },
            { label: 'Session', click: () => handleNewSession() }
          ]
        },
        { label: 'Open Campaign...', click: () => sendMenuAction('open-campaign') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [{ label: 'About', click: () => sendMenuAction('about') }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 840,
    height: 680,
    minWidth: 640,
    minHeight: 480,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  buildMenu();

  gmServer = new GmServer({ port: 4177 }).start();
  gmServer.on('change', (state) => {
    if (mainWindow) mainWindow.webContents.send('session:update', state);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (gmServer) gmServer.stop();
});

ipcMain.handle('session:get', () => gmServer.getState());
ipcMain.handle('session:rename', (_event, name) => {
  gmServer.rename(name);
  return gmServer.getState();
});
ipcMain.handle('session:rotate-pin', () => {
  gmServer.rotatePin();
  return gmServer.getState();
});

ipcMain.handle('campaign:get', () => currentCampaign);

ipcMain.handle('campaign:new', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'New Campaign',
    defaultPath: 'New Chronicle.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });
  if (result.canceled || !result.filePath) return null;

  await fs.writeFile(result.filePath, CAMPAIGN_TEMPLATE, 'utf-8');
  currentCampaign = { filePath: result.filePath, content: CAMPAIGN_TEMPLATE };
  return currentCampaign;
});

ipcMain.handle('campaign:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Campaign',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  currentCampaign = { filePath, content };
  return currentCampaign;
});

ipcMain.handle('campaign:save', async (_event, content) => {
  if (!currentCampaign.filePath) return { ok: false, error: 'No campaign file is open.' };
  await fs.writeFile(currentCampaign.filePath, content, 'utf-8');
  currentCampaign = { filePath: currentCampaign.filePath, content };
  return { ok: true };
});
