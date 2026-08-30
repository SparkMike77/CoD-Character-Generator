const fs = require('fs/promises');
const path = require('path');

function sanitizeFilenamePart(value) {
  const trimmed = String(value || '').trim().replace(/[\\/:*?"<>|]/g, '_');
  return trimmed || 'Untitled Session';
}

function todayStamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// A GM session (the live Scene state - Initiative, Combat/Social notes) can
// get interrupted mid-game and needs to be picked back up weeks later, so it
// saves itself with no manual naming: "<Campaign title> - <today>.gmsession"
// in a dedicated folder under userData. Saving again the same day for the
// same campaign overwrites that day's file rather than piling up duplicates;
// a new day (or a differently-named campaign) gets its own file.
class SessionStore {
  constructor({ sessionsDir }) {
    this.sessionsDir = sessionsDir;
  }

  async ensureDir() {
    await fs.mkdir(this.sessionsDir, { recursive: true });
  }

  async save(chronicle, payload) {
    await this.ensureDir();
    const filename = `${sanitizeFilenamePart(chronicle)} - ${todayStamp()}.gmsession`;
    const filePath = path.join(this.sessionsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return { filePath };
  }
}

module.exports = { SessionStore };
