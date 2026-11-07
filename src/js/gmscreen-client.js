const http = require('http');
const fs = require('fs/promises');
const { EventEmitter } = require('events');
const { Bonjour } = require('bonjour-service');

const MDNS_TYPE = 'gmscreen';
const REQUEST_TIMEOUT_MS = 5000;
const MODEL_UPLOAD_TIMEOUT_MS = 60000;
const CHARACTER_REQUEST_POLL_MS = 2000;

// Prefers a routable IPv4 address advertised by the service over Windows'
// APIPA link-local range (169.254.0.0/16) or referer.address, either of
// which can end up being an unreachable secondary adapter rather than the
// actual LAN interface GMScreen is reachable on.
function pickAddress(service) {
  const ipv4Addresses = (service.addresses || []).filter((addr) => !addr.includes(':'));
  const routable = ipv4Addresses.find((addr) => !addr.startsWith('169.254.'));
  if (routable) return routable;
  if (ipv4Addresses.length) return ipv4Addresses[0];
  if (service.referer && service.referer.family === 'IPv4') return service.referer.address;
  return service.host;
}

function requestJson(host, port, method, urlPath, { body, token } = {}) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(
      { host, port, method, path: urlPath, headers, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch {
            /* non-JSON response, fall through with empty data */
          }
          resolve({ status: res.statusCode, data });
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', (err) => resolve({ status: 0, data: {}, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

// Raw-bytes POST for avatar model uploads - kept separate from requestJson
// so a multi-megabyte model never has to be base64'd into a JSON body.
function requestBinary(host, port, urlPath, bytes, { token, headers = {} } = {}) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host,
        port,
        method: 'POST',
        path: urlPath,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': bytes.length,
          Authorization: `Bearer ${token}`,
          ...headers
        },
        timeout: MODEL_UPLOAD_TIMEOUT_MS
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Upload timed out')));
    req.on('error', (err) => resolve({ status: 0, error: err.message }));
    req.end(bytes);
  });
}

// Renderer-side discovery is impossible under this app's CSP/contextIsolation
// setup, so the main process owns both the mDNS browser and the pairing HTTP
// calls; the renderer only ever sees normalized IPC events/results.
class GmScreenClient extends EventEmitter {
  constructor({ storagePath, campaignStore, avatarLibrary }) {
    super();
    this.storagePath = storagePath;
    this.campaignStore = campaignStore;
    this.avatarLibrary = avatarLibrary;
    this.bonjour = null;
    this.browser = null;
    this.live = new Map(); // id -> { id, name, host, port }
    this.pollTimers = new Map(); // gmscreen id -> interval handle (doubles as "connected" set)
    this.currentAvatar = null; // latest { name, modelHash, modelName, format, color } from the renderer
    this.avatarPushChains = new Map(); // gmscreen id -> promise, so pushes to one GM never overlap
  }

  start() {
    this.bonjour = new Bonjour();
    this.browser = this.bonjour.find({ type: MDNS_TYPE });

    this.browser.on('up', (service) => {
      const id = service.txt && service.txt.id;
      if (!id) return;
      const info = {
        id,
        name: (service.txt && service.txt.name) || service.name,
        host: pickAddress(service),
        port: service.port
      };
      this.live.set(id, info);
      this.emit('up', info);
    });

    this.browser.on('down', (service) => {
      const id = service.txt && service.txt.id;
      if (!id) return;
      this.live.delete(id);
      this.emit('down', { id });
    });

    return this;
  }

  stop() {
    if (this.browser) this.browser.stop();
    if (this.bonjour) this.bonjour.destroy();
    for (const id of this.pollTimers.keys()) this.stopPolling(id);
  }

  // While paired, GMScreen may want to push a "load your character" request
  // at any moment - but GMScreen is the HTTP server here and can't dial back
  // in to us, so we poll it instead. Kept lightweight (a plain GET, no body)
  // since it runs continuously for every connected GMScreen.
  startPolling(id) {
    if (this.pollTimers.has(id)) return;
    const timer = setInterval(async () => {
      const connections = await this._loadConnections();
      const entry = connections[id];
      if (!entry) {
        this.stopPolling(id);
        return;
      }
      const { status, data } = await requestJson(entry.host, entry.port, 'GET', '/character-request', {
        token: entry.token
      });
      if (status === 200 && data.pending) this.emit('character-request', { id });
    }, CHARACTER_REQUEST_POLL_MS);
    this.pollTimers.set(id, timer);
  }

  stopPolling(id) {
    const timer = this.pollTimers.get(id);
    if (!timer) return;
    clearInterval(timer);
    this.pollTimers.delete(id);
  }

  // The GM's Roster shows every connected player's current avatar without
  // asking - so unlike the full character (sent only when the GM requests
  // it and the player agrees), the avatar is pushed: whenever it changes,
  // and whenever a connection to a GMScreen is (re)established.
  setAvatar(avatar) {
    this.currentAvatar = avatar;
    for (const id of this.pollTimers.keys()) this._queueAvatarPush(id);
  }

  // Serialized per GMScreen: a burst of changes (dragging through models)
  // runs one push at a time, so a model GMScreen asked for is uploaded once
  // and the next push already sees it cached there.
  _queueAvatarPush(id) {
    const prev = this.avatarPushChains.get(id) || Promise.resolve();
    const next = prev.then(() => this._pushAvatar(id)).catch(() => {});
    this.avatarPushChains.set(id, next);
    return next;
  }

  // Two steps: a small JSON descriptor, and - only if GMScreen replies that
  // it doesn't already have that model's bytes - a one-time binary upload.
  // GMScreen caches models by content hash, so switching back to a model
  // it's seen before (from any player) costs nothing.
  async _pushAvatar(id) {
    const avatar = this.currentAvatar;
    if (!avatar) return;
    const connections = await this._loadConnections();
    const entry = connections[id];
    if (!entry) return;

    const { status, data } = await requestJson(entry.host, entry.port, 'POST', '/avatar', {
      token: entry.token,
      body: { avatar }
    });
    if (status !== 200 || !data.needModel || !avatar.modelHash) return;

    const model = await this.avatarLibrary.getModel(avatar.modelHash);
    if (!model) return; // character references a model this machine doesn't have
    await requestBinary(entry.host, entry.port, '/avatar-model', model.data, {
      token: entry.token,
      headers: { 'X-Model-Hash': model.hash, 'X-Model-Format': model.format }
    });
  }

  async sendCharacter(id, characterData) {
    const connections = await this._loadConnections();
    const entry = connections[id];
    if (!entry) return { ok: false, error: 'Not connected to that GMScreen.' };
    const { status } = await requestJson(entry.host, entry.port, 'POST', '/character', {
      token: entry.token,
      body: { character: characterData }
    });
    return { ok: status === 200 };
  }

  async _loadConnections() {
    try {
      const raw = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async _saveConnections(connections) {
    await fs.writeFile(this.storagePath, JSON.stringify(connections, null, 2), 'utf-8');
  }

  async listKnown() {
    return this._loadConnections();
  }

  // Fire-and-forget: a missing/unreachable campaign shouldn't block pairing
  // or reconnection, so failures here are silent (the client just keeps
  // whatever campaign copy - if any - it already had locally).
  async _fetchAndStoreCampaign(host, port, token, sourceGmScreenId) {
    const { status, data } = await requestJson(host, port, 'GET', '/campaign', { token });
    if (status !== 200) return;
    await this.campaignStore.upsert({
      campaignId: data.campaignId,
      version: data.version,
      body: data.body,
      sourceGmScreenId
    });
  }

  async pair({ id, host, port, pin }) {
    const { status, data, error } = await requestJson(host, port, 'POST', '/pair', { body: { pin } });
    if (error) return { ok: false, error: 'Could not reach GMScreen.' };
    if (status === 200) {
      const connections = await this._loadConnections();
      connections[id] = { id, name: data.name, host, port, token: data.token, pairedAt: Date.now() };
      await this._saveConnections(connections);
      await this._fetchAndStoreCampaign(host, port, data.token, id);
      this.startPolling(id);
      this._queueAvatarPush(id);
      return { ok: true, name: data.name };
    }
    if (status === 429) return { ok: false, error: data.error || 'Too many attempts. Try again shortly.' };
    return { ok: false, error: data.error || 'Incorrect PIN.' };
  }

  async check({ id, host, port }) {
    const connections = await this._loadConnections();
    const entry = connections[id];
    if (!entry) return { ok: false };

    const { status } = await requestJson(host || entry.host, port || entry.port, 'GET', '/whoami', {
      token: entry.token
    });
    if (status === 200) {
      await this._fetchAndStoreCampaign(host || entry.host, port || entry.port, entry.token, id);
      this.startPolling(id);
      this._queueAvatarPush(id);
      return { ok: true, name: entry.name };
    }

    this.stopPolling(id);
    delete connections[id];
    await this._saveConnections(connections);
    return { ok: false };
  }

  async forget(id) {
    this.stopPolling(id);
    const connections = await this._loadConnections();
    delete connections[id];
    await this._saveConnections(connections);
  }
}

module.exports = { GmScreenClient };
