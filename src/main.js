const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

function sendMenuAction(action) {
  if (mainWindow) mainWindow.webContents.send('menu-action', action);
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Character', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendMenuAction('save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('save-as') },
        { type: 'separator' },
        { label: 'Print / Export PDF...', accelerator: 'CmdOrCtrl+P', click: () => sendMenuAction('print') },
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
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
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
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('character:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Character',
    filters: [{ name: 'CoD Character', extensions: ['codchar', 'json'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const raw = await fs.readFile(filePath, 'utf-8');
  return { filePath, data: JSON.parse(raw) };
});

ipcMain.handle('character:save', async (_event, { data, filePath }) => {
  let targetPath = filePath;
  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Character',
      defaultPath: `${data?.meta?.name || 'character'}.codchar`,
      filters: [{ name: 'CoD Character', extensions: ['codchar'] }]
    });
    if (result.canceled || !result.filePath) return null;
    targetPath = result.filePath;
  }
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2), 'utf-8');
  return { filePath: targetPath };
});
