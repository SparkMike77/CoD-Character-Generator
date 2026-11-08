// window.codApi for the Android app - the counterpart of src/preload.js +
// src/main.js in the Electron app, so the sheet's own code (src/js/*) runs
// unchanged. Bundled by scripts/build-android.js into js/android-api.js and
// loaded ahead of the sheet's modules.
//
// The GM connection and chronicle logic is the desktop app's own
// (src/js/gmscreen-client.js, src/js/campaign-store.js), unmodified: the
// bundler swaps the Node modules they use for the shims in ./shims, which
// hand the platform work to the app (MainActivity.kt, GmDiscovery.kt).
import { native } from './native.js';
import { GmScreenClient } from '../../src/js/gmscreen-client.js';
import { CampaignStore } from '../../src/js/campaign-store.js';

if (window.CodAndroid && !window.codApi) install();

function install() {
  setViewport();
  document.documentElement.classList.add('android-app');

  const campaignStore = new CampaignStore({ storagePath: 'campaigns.json' });
  const gm = new GmScreenClient({ storagePath: 'gm-connections.json', campaignStore }).start();
  const listen = (event) => (callback) => gm.on(event, callback);

  window.codApi = {
    // No menu bar on Android; the toolbar has New / Open / Save / Save As.
    onMenuAction: () => {},

    openCharacter: async () => {
      const file = await pickFile();
      if (!file) return null;
      try {
        return { filePath: file.uri, displayName: file.name, data: JSON.parse(file.content) };
      } catch {
        window.alert(`"${file.name}" isn't a character file.`);
        return null;
      }
    },

    // Save writes back to the file it came from; if that's no longer
    // allowed (or there isn't one yet), it asks where to save, like Save As.
    saveCharacter: async (data, filePath) => {
      const content = JSON.stringify(data, null, 2);
      if (filePath) {
        const written = await native('writeDocument', { uri: filePath, content });
        if (!written.error) return { filePath, displayName: written.name };
      }
      const name = `${(data && data.meta && data.meta.name) || 'character'}.codchar`;
      const created = await native('createDocument', { name, content });
      if (created.canceled) return null;
      if (created.error) {
        window.alert(`Couldn't save: ${created.error}`);
        return null;
      }
      return { filePath: created.uri, displayName: created.name };
    },

    openMarkdownFile: async () => {
      const file = await pickFile();
      return file ? { filePath: file.uri, displayName: file.name, content: file.content } : null;
    },

    openGettingStarted: () => openPageOverlay('getting-started.html', 'Getting Started'),

    onGmScreenUp: listen('up'),
    onGmScreenDown: listen('down'),
    onGmScreenCharacterRequest: listen('character-request'),
    listKnownGmScreens: () => gm.listKnown(),
    listLiveGmScreens: async () => gm.listLive(),
    lookupGmScreen: (address) => gm.lookup(address),
    pairGmScreen: (id, host, port, pin) => gm.pair({ id, host, port, pin }),
    checkGmScreen: (id, host, port) => gm.check({ id, host, port }),
    forgetGmScreen: (id) => gm.forget(id),
    sendCharacterToGm: (id, character) => gm.sendCharacter(id, character),

    setCurrentAvatar: async (avatar) => gm.setAvatar(avatar),

    listCampaigns: () => campaignStore.list(),
    getCampaign: (campaignId) => campaignStore.get(campaignId),
    createCustomCampaign: () => campaignStore.createCustom()
  };
}

async function pickFile() {
  const file = await native('openDocument');
  if (file.canceled) return null;
  if (file.error) {
    window.alert(`Couldn't open that file: ${file.error}`);
    return null;
  }
  return file;
}

// The device's real width: phones get the sheet's one-column phone layout
// (the max-width: 700px rules in style.css), tablets and Chromebooks the
// normal one.
function setViewport() {
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(meta);
}

// The desktop app opens Getting Started in its own window; here it's a
// full-screen panel over the sheet (closed by its button or Back), so the
// sheet underneath keeps its state.
function openPageOverlay(src, title) {
  const existing = document.querySelector('.android-overlay');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.className = 'android-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '1000', display: 'flex', flexDirection: 'column', background: 'var(--bg, #f7f6f3)'
  });

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px',
    borderBottom: '1px solid var(--border, #c9c4ba)', font: '600 18px system-ui, sans-serif'
  });
  const heading = document.createElement('span');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'android-overlay-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => overlay.remove());
  bar.append(heading, close);

  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = title;
  Object.assign(frame.style, { flex: '1', border: '0', width: '100%' });

  overlay.append(bar, frame);
  document.body.appendChild(overlay);
}
