const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { GmServer } = require('./gm-server');

let mainWindow;
let gmServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 620,
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
