const http = require('http');
const fs = require('fs/promises');
const { EventEmitter } = require('events');
const { Bonjour } = require('bonjour-service');

const MDNS_TYPE = 'gmscreen';
const REQUEST_TIMEOUT_MS = 5000;
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

// Renderer-side discovery is impossible under this app's CSP/contextIsolation
// setup, so the main process owns both the mDNS browser and the pairing HTTP
// calls; the renderer only ever sees normalized IPC events/results.
class GmScreenClient extends EventEmitter {
  constructor({ storagePath, campaignStore }) {
    super();
    this.storagePath = storagePath;
    this.campaignStore = campaignStore;
    this.bonjour = null;
    this.browser = null;
    this.live = new Map(); // id -> { id, name, host, port }
    this.pollTimers = new Map(); // gmscreen id -> interval handle
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
