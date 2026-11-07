const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_FORMATS = ['stl', 'obj', 'glb'];
const MAX_MODEL_BYTES = 25 * 1024 * 1024;

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// The player's library of avatar models: the built-ins shipped with the app
// (src/assets/avatars/, listed in index.json) plus anything the player has
// imported, copied into userData so it survives the original file moving.
//
// Every model is identified by the SHA-256 of its bytes rather than a path
// or name. That's what a character file stores, and what GMScreen caches
// uploads under - so a model is the same model on every machine regardless
// of what anyone named the file, and GMScreen only ever needs each distinct
// model's bytes sent to it once.
class AvatarLibrary {
  constructor({ builtinDir, userDir }) {
    this.builtinDir = builtinDir;
    this.userDir = userDir;
    this.indexPath = path.join(userDir, 'library.json');
    this.builtins = null; // [{ hash, name, format, file }] - hashed lazily, once
  }

  async _loadBuiltins() {
    if (this.builtins) return this.builtins;
    let manifest = [];
    try {
      manifest = JSON.parse(await fs.readFile(path.join(this.builtinDir, 'index.json'), 'utf-8'));
    } catch {
      /* no built-ins shipped - library is just the player's imports */
    }
    const builtins = [];
    for (const { file, name } of manifest) {
      try {
        const bytes = await fs.readFile(path.join(this.builtinDir, file));
        builtins.push({ hash: sha256(bytes), name, format: path.extname(file).slice(1).toLowerCase(), file });
      } catch {
        /* manifest lists a file that isn't there - skip it rather than fail the whole library */
      }
    }
    this.builtins = builtins;
    return builtins;
  }

  async _loadUserIndex() {
    try {
      return JSON.parse(await fs.readFile(this.indexPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  async _saveUserIndex(entries) {
    await fs.mkdir(this.userDir, { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  async list() {
    const builtins = await this._loadBuiltins();
    const imported = await this._loadUserIndex();
    return [
      ...builtins.map(({ hash, name, format }) => ({ hash, name, format, builtin: true })),
      ...imported.map(({ hash, name, format }) => ({ hash, name, format, builtin: false }))
    ];
  }

  async _find(hash) {
    const builtin = (await this._loadBuiltins()).find((m) => m.hash === hash);
    if (builtin) return { ...builtin, builtin: true, fullPath: path.join(this.builtinDir, builtin.file) };
    const imported = (await this._loadUserIndex()).find((m) => m.hash === hash);
    if (imported) return { ...imported, builtin: false, fullPath: path.join(this.userDir, imported.file) };
    return null;
  }

  // { hash, name, format, data: Buffer } | null if this machine doesn't
  // have it (e.g. a character file made on someone else's computer with a
  // model they imported there).
  async getModel(hash) {
    const entry = hash && (await this._find(hash));
    if (!entry) return null;
    try {
      return { hash: entry.hash, name: entry.name, format: entry.format, data: await fs.readFile(entry.fullPath) };
    } catch {
      return null;
    }
  }

  async importFile(sourcePath) {
    const format = path.extname(sourcePath).slice(1).toLowerCase();
    if (!SUPPORTED_FORMATS.includes(format)) {
      return { ok: false, error: `Unsupported file type ".${format}". Use STL, OBJ, or GLB.` };
    }
    const stat = await fs.stat(sourcePath);
    if (stat.size > MAX_MODEL_BYTES) {
      return { ok: false, error: `That model is ${(stat.size / 1048576).toFixed(1)} MB - the limit is 25 MB.` };
    }

    const bytes = await fs.readFile(sourcePath);
    const hash = sha256(bytes);
    const name = path.basename(sourcePath, path.extname(sourcePath));

    const existing = await this._find(hash);
    // Same bytes already in the library (re-import, or a copy of a built-in):
    // just select the existing entry rather than storing a duplicate.
    if (existing) return { ok: true, model: { hash, name: existing.name, format: existing.format, builtin: existing.builtin } };

    const file = `${hash}.${format}`;
    await fs.mkdir(this.userDir, { recursive: true });
    await fs.writeFile(path.join(this.userDir, file), bytes);
    const entries = await this._loadUserIndex();
    entries.push({ hash, name, format, file, importedAt: Date.now() });
    await this._saveUserIndex(entries);
    return { ok: true, model: { hash, name, format, builtin: false } };
  }

  async remove(hash) {
    const entries = await this._loadUserIndex();
    const entry = entries.find((m) => m.hash === hash);
    if (!entry) return { ok: false };
    await this._saveUserIndex(entries.filter((m) => m.hash !== hash));
    await fs.rm(path.join(this.userDir, entry.file), { force: true });
    return { ok: true };
  }
}

module.exports = { AvatarLibrary, SUPPORTED_FORMATS, MAX_MODEL_BYTES };
