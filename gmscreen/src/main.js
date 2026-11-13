const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs/promises');
const { GmServer } = require('./gm-server');
const { CAMPAIGN_TEMPLATE } = require('./campaign-template');
const { parseCampaignFile, serializeCampaignFile, extractChronicleName, extractSetting } = require('./campaign-file');
const { SessionStore } = require('./session-store');

let mainWindow;
let referencesWindow;
let gmServer;
let vtt;
// The VTT table's Storyteller view is GMScreen's own (its Table tab): only a
// page holding this per-run secret may watch it.
const storytellerSecret = crypto.randomBytes(18).toString('base64url');
let sessionStore;
// filePath/campaignId/version/body: campaignId+version travel inside the
// file itself (see campaign-file.js) so GMScreen can tell a paired client
// whether its locally-stored copy is stale - see GET /campaign.
let currentCampaign = { filePath: null, campaignId: null, version: null, body: '' };

function sendMenuAction(action) {
  if (mainWindow) mainWindow.webContents.send('menu-action', action);
}

function publishCampaign() {
  // The References window's Game Setting tab follows the campaign's
  // "Setting:" line.
  if (referencesWindow && !referencesWindow.isDestroyed()) {
    referencesWindow.webContents.send('campaign:setting-changed', extractSetting(currentCampaign.body));
  }
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

// The VTT table runs inside GMScreen, on its own port, under /vtt/ (see
// src/vtt/BUILD.txt - built from the VTT repo by its scripts/build-gmscreen.mjs).
// Joining uses this session's pairing: a player's GMScreen token is their seat,
// and their sheet's name and avatar are their character's.
function startTable() {
  const { createVtt } = require('./vtt/vtt-server.cjs');
  const sameSecret = (s) => {
    const a = Buffer.from(String(s));
    const b = Buffer.from(storytellerSecret);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };
  vtt = createVtt({
    staticDir: path.join(__dirname, 'vtt', 'client'),
    // The same avatar models the Roster builds from.
    assetDirs: { 'assets/avatar': path.join(__dirname, 'assets', 'avatar') },
    host: {
      sessionName: () => gmServer.getState().name,
      sessionId: () => gmServer.instanceId,
      inviteUrl: () => `http://${gmServer.getState().lanAddress}:${gmServer.port}/vtt/`,
      player: (token) => gmServer.tablePlayer(token),
      isStoryteller: sameSecret,
      reportLook: (token, name, avatar) => gmServer.reportTableLook(token, name, avatar)
    }
  });
  gmServer.extraHandler = (req, res) => vtt.handleHttp(req, res);
  gmServer.httpServer.on('upgrade', (req, socket, head) => {
    if (!vtt.handleUpgrade(req, socket, head)) socket.destroy();
  });
  // A sheet's name or avatar changed: the table follows.
  gmServer.on('players-change', () => vtt.hostChanged());
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

  // The References window is a convenience spun off from the main window,
  // not an independent app - closing GMScreen should take it down too
  // rather than leaving an orphaned window (and gmServer) with no owner.
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (referencesWindow && !referencesWindow.isDestroyed()) referencesWindow.close();
  });
}

// Its own top-level window, not a child/modal of mainWindow - it must stay
// usable (and movable to a second monitor) while the GM keeps working the
// main GMScreen window, so neither one blocks the other.
function createReferencesWindow() {
  if (referencesWindow && !referencesWindow.isDestroyed()) {
    referencesWindow.show();
    referencesWindow.focus();
    return;
  }

  referencesWindow = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'references-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  referencesWindow.loadFile(path.join(__dirname, 'references.html'));
  referencesWindow.on('closed', () => {
    referencesWindow = null;
  });
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
    startTable();
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
    if (vtt) vtt.close();
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

ipcMain.handle('references:open', () => createReferencesWindow());

ipcMain.handle('rules:openMarkdown', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender) || referencesWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: 'Open Markdown File',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  return { filePath, content };
});

ipcMain.handle('session:get', () => gmServer.getState());
ipcMain.handle('table:url', () => `http://127.0.0.1:${gmServer.port}/vtt/storyteller.html#st=${storytellerSecret}`);
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
ipcMain.handle('players:set-conditions', (_event, { playerId, conditions }) => gmServer.setConditions(playerId, conditions));

// Exposure: the Storyteller's private record, per character, of what each
// one's actions have exposed - so consequences get set up later. It's kept
// only here (userData/exposure.json, by campaign then character name) and
// never sent to a player. Character names, not pairing tokens, key it,
// since tokens reset every run and Exposure lasts the whole chronicle.
const exposureFile = () => path.join(app.getPath('userData'), 'exposure.json');
const exposureCampaignKey = () => currentCampaign.campaignId || 'no-campaign';

async function readExposure() {
  try {
    return JSON.parse(await fs.readFile(exposureFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function sanitizeExposure(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.slice(0, 500).map((e) => ({
    text: String((e && e.text) || '').slice(0, 500),
    at: typeof (e && e.at) === 'string' ? e.at.slice(0, 40) : new Date().toISOString(),
    done: !!(e && e.done)
  })).filter((e) => e.text.trim());
}

ipcMain.handle('exposure:get', async () => (await readExposure())[exposureCampaignKey()] || {});
ipcMain.handle('exposure:set', async (_event, { character, entries }) => {
  const key = String(character || '').trim().toLowerCase().slice(0, 120);
  if (!key) return null;
  const all = await readExposure();
  const campaign = (all[exposureCampaignKey()] = all[exposureCampaignKey()] || {});
  const clean = sanitizeExposure(entries);
  if (clean.length) campaign[key] = clean;
  else delete campaign[key];
  await fs.writeFile(exposureFile(), JSON.stringify(all, null, 2), 'utf-8');
  return campaign;
});

ipcMain.handle('campaign:setting', () => extractSetting(currentCampaign.body));
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
