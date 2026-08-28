const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { EventEmitter } = require('events');
const { Bonjour } = require('bonjour-service');

const MDNS_TYPE = 'gmscreen';
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 60_000;

function generatePin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Prefers a real routable LAN address over Windows' APIPA link-local
// range (169.254.0.0/16), which shows up whenever a secondary/disabled
// adapter has no DHCP lease and can otherwise get picked first depending
// on os.networkInterfaces() enumeration order.
function firstLanAddress() {
  const candidates = [];
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === 'IPv4' && !addr.internal) candidates.push(addr.address);
    }
  }
  const routable = candidates.find((addr) => !addr.startsWith('169.254.'));
  return routable || candidates[0] || '127.0.0.1';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

// GM-facing session server: advertises itself on the LAN via mDNS, and
// PIN-gates pairing so a Character Manager instance has to be told the PIN
// out of band (by the GM, reading it off the GMScreen window) before it can
// connect - this is what stops randoms on a shared/convention network from
// just joining because they can see the service.
class GmServer extends EventEmitter {
  constructor({ port = 4177, sessionName = "GM's Game" } = {}) {
    super();
    this.port = port;
    this.sessionName = sessionName;
    this.instanceId = crypto.randomUUID();
    this.pin = generatePin();
    this.tokens = new Map(); // token -> { pairedAt }
    this.attempts = new Map(); // remoteAddress -> { count, lockUntil }
    this.campaign = null; // { campaignId, version, chronicle, body } | null
    this.bonjour = null;
    this.mdnsService = null;
    this.httpServer = null;
  }

  setCampaign(campaign) {
    this.campaign = campaign;
  }

  getState() {
    return {
      id: this.instanceId,
      name: this.sessionName,
      pin: this.pin,
      port: this.port,
      lanAddress: firstLanAddress(),
      pairedCount: this.tokens.size
    };
  }

  start() {
    this.httpServer = http.createServer((req, res) => this._handleRequest(req, res));
    this.httpServer.listen(this.port);

    this.bonjour = new Bonjour();
    this._publish();

    return this;
  }

  stop() {
    if (this.mdnsService) this.mdnsService.stop();
    if (this.bonjour) this.bonjour.destroy();
    if (this.httpServer) this.httpServer.close();
  }

  rename(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed || trimmed === this.sessionName) return;
    this.sessionName = trimmed;
    this._republish();
    this.emit('change', this.getState());
  }

  rotatePin() {
    this.pin = generatePin();
    this.attempts.clear();
    this.emit('change', this.getState());
  }

  _publish() {
    this.mdnsService = this.bonjour.publish({
      name: `GMScreen-${this.instanceId.slice(0, 8)}`,
      type: MDNS_TYPE,
      port: this.port,
      txt: { id: this.instanceId, name: this.sessionName }
    });
  }

  _republish() {
    if (this.mdnsService) this.mdnsService.stop(() => this._publish());
    else this._publish();
  }

  _isLockedOut(remoteAddress) {
    const entry = this.attempts.get(remoteAddress);
    if (!entry) return false;
    if (entry.lockUntil && entry.lockUntil > Date.now()) return true;
    if (entry.lockUntil && entry.lockUntil <= Date.now()) this.attempts.delete(remoteAddress);
    return false;
  }

  _recordFailure(remoteAddress) {
    const entry = this.attempts.get(remoteAddress) || { count: 0, lockUntil: 0 };
    entry.count += 1;
    if (entry.count >= PIN_MAX_ATTEMPTS) {
      entry.lockUntil = Date.now() + PIN_LOCKOUT_MS;
      entry.count = 0;
    }
    this.attempts.set(remoteAddress, entry);
  }

  _bearerToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }

  async _handleRequest(req, res) {
    try {
      if (req.method === 'GET' && req.url === '/session') {
        return sendJson(res, 200, { id: this.instanceId, name: this.sessionName });
      }

      if (req.method === 'POST' && req.url === '/pair') {
        const remoteAddress = req.socket.remoteAddress || 'unknown';
        if (this._isLockedOut(remoteAddress)) {
          return sendJson(res, 429, { error: 'Too many attempts. Try again in a minute.' });
        }
        const body = await readJsonBody(req);
        if (body.pin === this.pin) {
          this.attempts.delete(remoteAddress);
          const token = crypto.randomBytes(24).toString('hex');
          this.tokens.set(token, { pairedAt: Date.now() });
          this.emit('change', this.getState());
          return sendJson(res, 200, { token, id: this.instanceId, name: this.sessionName });
        }
        this._recordFailure(remoteAddress);
        return sendJson(res, 401, { error: 'Incorrect PIN' });
      }

      if (req.method === 'GET' && req.url === '/whoami') {
        const token = this._bearerToken(req);
        if (!token || !this.tokens.has(token)) return sendJson(res, 401, { error: 'Invalid token' });
        return sendJson(res, 200, { id: this.instanceId, name: this.sessionName });
      }

      if (req.method === 'GET' && req.url === '/campaign') {
        const token = this._bearerToken(req);
        if (!token || !this.tokens.has(token)) return sendJson(res, 401, { error: 'Invalid token' });
        if (!this.campaign) return sendJson(res, 404, { error: 'No campaign loaded' });
        return sendJson(res, 200, this.campaign);
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Bad request' });
    }
  }
}

module.exports = { GmServer };
