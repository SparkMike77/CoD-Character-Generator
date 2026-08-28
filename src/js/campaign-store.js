const fs = require('fs/promises');
const crypto = require('crypto');
const { CAMPAIGN_TEMPLATE } = require('./campaign-template');
const { extractChronicleName, extractSpeciesList } = require('./campaign-file');

// Every campaign a player's Character Manager has ever received (from any
// GMScreen) or created locally ("Custom"), so characters can be built and
// kept up between sessions even while disconnected - see gmscreen-client.js
// for where campaigns actually arrive from a paired GMScreen.
class CampaignStore {
  constructor({ storagePath }) {
    this.storagePath = storagePath;
  }

  async _load() {
    try {
      const raw = await fs.readFile(this.storagePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async _save(index) {
    await fs.writeFile(this.storagePath, JSON.stringify(index, null, 2), 'utf-8');
  }

  async list() {
    const index = await this._load();
    return Object.values(index)
      .map((c) => ({ campaignId: c.campaignId, chronicle: c.chronicle, version: c.version, isCustom: c.isCustom }))
      .sort((a, b) => a.chronicle.localeCompare(b.chronicle));
  }

  async get(campaignId) {
    const index = await this._load();
    const entry = index[campaignId];
    if (!entry) return null;
    return { ...entry, speciesList: extractSpeciesList(entry.body) };
  }

  // Only replaces a locally-stored campaign if this is a newer version (or
  // it's simply new to us) - never lets a stale reconnect clobber a copy
  // that's already up to date.
  async upsert({ campaignId, version, body, sourceGmScreenId }) {
    const index = await this._load();
    const existing = index[campaignId];
    if (existing && existing.version >= version) return false;

    index[campaignId] = {
      campaignId,
      version,
      chronicle: extractChronicleName(body),
      body,
      isCustom: false,
      sourceGmScreenId,
      receivedAt: Date.now()
    };
    await this._save(index);
    return true;
  }

  async createCustom() {
    const index = await this._load();
    const campaignId = crypto.randomUUID();
    const entry = {
      campaignId,
      version: 1,
      chronicle: extractChronicleName(CAMPAIGN_TEMPLATE),
      body: CAMPAIGN_TEMPLATE,
      isCustom: true,
      sourceGmScreenId: null,
      receivedAt: Date.now()
    };
    index[campaignId] = entry;
    await this._save(index);
    return { ...entry, speciesList: extractSpeciesList(entry.body) };
  }
}

module.exports = { CampaignStore };
