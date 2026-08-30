const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const { GmServer } = require('./gm-server');
const { CAMPAIGN_TEMPLATE } = require('./campaign-template');
const { parseCampaignFile, serializeCampaignFile, extractChronicleName } = require('./campaign-file');
const { SessionStore } = require('./session-store');

let mainWindow;
let gmServer;
let sessionStore;
// filePath/campaignId/version/body: campaignId+version travel inside the
// file itself (see campaign-file.js) so GMScreen can tell a paired client
// whether its locally-stored copy is stale - see GET /campaign.
let currentCampaign = { filePath: null, campaignId: null, version: null, body: '' };

function sendMenuAction(action) {
  if (mainWindow) mainWindow.webContents.send('menu-action', action);
}

function publishCampaign() {
  if (!gmServer) return;
  if (!currentCampaign.filePath) {
    gmServer.setCampaign(null);
    return;
  }
  gmServer.setCampaign({
    campaignId: currentCampaign.campaignId,
    version: currentCampaign.version,
    chronicle: extractChronicleName(currentCampaign.body),
    body: currentCampaign.body
  });
}

function handleNewSession() {
  if (!currentCampaign.filePath) {
    sendMenuAction('session-needs-campaign');
    return;
  }
  // Session-running itself isn't designed/built yet - this is just the
  // "a Campaign has to be loaded first" guard for now. Paired clients pick
  // up the current campaign as soon as they (re)connect, via GET /campaign.
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
        { label: 'Save Session', click: () => sendMenuAction('save-session') },
        { label: 'Open Session...', click: () => sendMenuAction('open-session') },
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

// Only one GMScreen can ever bind the pairing port (4177) at a time, so a
// second launch (e.g. double-clicking the shortcut while one's already
// running) must not try to start its own server - it just hands off to the
// instance that's already running and quits.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();

    gmServer = new GmServer({ port: 4177 }).start();
    gmServer.on('change', (state) => {
      if (mainWindow) mainWindow.webContents.send('session:update', state);
    });
    gmServer.on('players-change', (players) => {
      if (mainWindow) mainWindow.webContents.send('players:update', players);
    });

    sessionStore = new SessionStore({ sessionsDir: path.join(app.getPath('userData'), 'Sessions') });

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  try {
    if (gmServer) gmServer.stop();
  } catch (err) {
    console.error('Error stopping GM server on quit:', err);
  }
});

// Failsafe: closing the window should always take the whole app down with
// it, with nothing left running in the background. gmServer.stop() above
// handles the normal case, but if anything (a stuck socket, mDNS teardown,
// anything unforeseen) keeps the event loop alive past that, force a hard
// exit shortly after quit begins rather than leaving a zombie process
// holding the pairing port - which blocks both future launches and
// rebuilds. unref() so this timer itself never keeps the process open.
app.on('before-quit', () => {
  setTimeout(() => app.exit(0), 1500).unref();
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

ipcMain.handle('players:get', () => gmServer.getPlayers());
ipcMain.handle('players:request', (_event, playerId) => gmServer.requestCharacter(playerId));

ipcMain.handle('campaign:get', () => ({ filePath: currentCampaign.filePath, content: currentCampaign.body }));

ipcMain.handle('campaign:new', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'New Campaign',
    defaultPath: 'New Chronicle.md',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const campaignId = crypto.randomUUID();
  const version = 1;
  await fs.writeFile(result.filePath, serializeCampaignFile({ campaignId, version, body: CAMPAIGN_TEMPLATE }), 'utf-8');
  currentCampaign = { filePath: result.filePath, campaignId, version, body: CAMPAIGN_TEMPLATE };
  publishCampaign();
  return { filePath: result.filePath, content: CAMPAIGN_TEMPLATE };
});

ipcMain.handle('campaign:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Campaign',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = parseCampaignFile(raw);
  // A plain .md with no frontmatter (hand-written, or from before versioning
  // existed) gets adopted: treated as version 1 of a brand-new campaign, so
  // it gains proper frontmatter the next time it's saved.
  const campaignId = parsed.campaignId || crypto.randomUUID();
  const version = parsed.version || 1;
  currentCampaign = { filePath, campaignId, version, body: parsed.body };
  publishCampaign();
  return { filePath, content: parsed.body };
});

ipcMain.handle('campaign:save', async (_event, content) => {
  if (!currentCampaign.filePath) return { ok: false, error: 'No campaign file is open.' };
  const version = (currentCampaign.version || 0) + 1;
  const campaignId = currentCampaign.campaignId || crypto.randomUUID();
  await fs.writeFile(
    currentCampaign.filePath,
    serializeCampaignFile({ campaignId, version, body: content }),
    'utf-8'
  );
  currentCampaign = { filePath: currentCampaign.filePath, campaignId, version, body: content };
  publishCampaign();
  return { ok: true };
});

ipcMain.handle('gmsession:save', async (_event, scene) => {
  const chronicle = currentCampaign.filePath ? extractChronicleName(currentCampaign.body) : 'No Campaign';
  const payload = {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    sessionName: gmServer.getState().name,
    chronicle,
    scene
  };
  const { filePath } = await sessionStore.save(chronicle, payload);
  return { ok: true, filePath };
});

ipcMain.handle('gmsession:open', async () => {
  await sessionStore.ensureDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Session',
    defaultPath: sessionStore.sessionsDir,
    filters: [{ name: 'GM Session', extensions: ['gmsession'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const raw = await fs.readFile(result.filePaths[0], 'utf-8');
  const payload = JSON.parse(raw);
  if (payload.sessionName) gmServer.rename(payload.sessionName);
  return payload;
});
