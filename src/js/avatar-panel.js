// The Avatar column on the left of the character sheet: a 3D viewer plus
// model/color pickers. Owns character.avatar = { modelHash, modelName,
// format, color }, where modelHash null means "the library's default
// model" - so a brand-new character always shows something.
//
// Every change is also handed to the main process (setCurrentAvatar), which
// keeps the latest avatar and pushes it to every GMScreen this player is
// connected to - that's what feeds the GM's Roster page.
import { AvatarViewer } from './avatar-view.js';

const NAME_SYNC_DEBOUNCE_MS = 600;
const SPIN_PREF_KEY = 'avatar.spin';

let viewer = null;
let getCharacter = () => null;
let markDirty = () => {};
let models = []; // [{ hash, name, format, builtin }]
let shownHash = null;
let nameSyncTimer = null;

const el = (id) => document.getElementById(id);

function avatar() {
  return getCharacter().avatar;
}

function resolvedHash() {
  return avatar().modelHash || (models[0] && models[0].hash) || null;
}

function readSpinPref() {
  try {
    return localStorage.getItem(SPIN_PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeSpinPref(on) {
  try {
    localStorage.setItem(SPIN_PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable - preference just isn't remembered */
  }
}

function showMessage(text) {
  const msg = el('avatar-message');
  msg.textContent = text || '';
  msg.classList.toggle('hidden', !text);
}

function renderModelSelect() {
  const select = el('avatar-model-select');
  while (select.firstChild) select.removeChild(select.firstChild);

  const addGroup = (label, items) => {
    if (!items.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    items.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.hash;
      opt.textContent = m.name;
      group.appendChild(opt);
    });
    select.appendChild(group);
  };
  addGroup('Built-in', models.filter((m) => m.builtin));
  addGroup('Imported', models.filter((m) => !m.builtin));

  // A character made elsewhere can reference a model this library doesn't
  // have - keep it visible (and selected) rather than silently swapping it.
  const hash = resolvedHash();
  if (hash && !models.some((m) => m.hash === hash)) {
    const opt = document.createElement('option');
    opt.value = hash;
    opt.textContent = `${avatar().modelName || 'Unknown model'} (missing)`;
    select.appendChild(opt);
  }
  select.value = hash || '';

  const current = models.find((m) => m.hash === hash);
  el('avatar-remove-btn').disabled = !current || current.builtin;
}

function renderColorControl() {
  const input = el('avatar-color');
  input.value = avatar().color;
  const format = (models.find((m) => m.hash === resolvedHash()) || {}).format || avatar().format;
  const isGlb = format === 'glb';
  input.disabled = isGlb;
  el('avatar-color').closest('label').title = isGlb ? 'GLB models use their own colors and textures.' : '';
}

async function showCurrentModel({ force = false } = {}) {
  const hash = resolvedHash();
  viewer.setColor(avatar().color);
  if (!hash) {
    viewer.clear();
    shownHash = null;
    showMessage('No models in your library yet. Import an STL, OBJ, or GLB file.');
    return;
  }
  if (hash === shownHash && !force) return;

  const model = await window.codApi.getAvatarModel(hash);
  if (hash !== resolvedHash()) return; // selection changed while loading
  if (!model) {
    viewer.clear();
    shownHash = hash;
    showMessage(`This character's model "${avatar().modelName || 'Unknown'}" isn't in your library. Import it, or pick another model.`);
    return;
  }
  try {
    await viewer.setModel({ format: model.format, data: model.data });
    shownHash = hash;
    showMessage('');
  } catch (err) {
    viewer.clear();
    shownHash = null;
    showMessage(`Couldn't display "${model.name}": ${err.message || err}`);
  }
}

function renderName() {
  const name = (getCharacter().meta.name || '').trim();
  el('avatar-name').textContent = name || 'Unnamed character';
}

// What GMScreen's Roster shows for this player. Sends the resolved hash, not
// null, since GMScreen has no idea what this library's default model is.
function syncToGm() {
  const hash = resolvedHash();
  const model = models.find((m) => m.hash === hash);
  window.codApi.setCurrentAvatar({
    name: (getCharacter().meta.name || '').trim(),
    modelHash: hash,
    modelName: model ? model.name : avatar().modelName,
    format: model ? model.format : avatar().format,
    color: avatar().color
  });
}

async function refreshLibrary() {
  models = await window.codApi.listAvatarModels();
  renderModelSelect();
  renderColorControl();
}

function selectModel(hash) {
  const model = models.find((m) => m.hash === hash);
  if (!model) return;
  Object.assign(avatar(), { modelHash: model.hash, modelName: model.name, format: model.format });
  markDirty();
  renderModelSelect();
  renderColorControl();
  showCurrentModel();
  syncToGm();
}

async function handleImport() {
  const result = await window.codApi.importAvatarModel();
  if (!result) return; // dialog cancelled
  if (!result.ok) {
    window.alert(result.error);
    return;
  }
  await refreshLibrary();
  selectModel(result.model.hash);
}

async function handleRemove() {
  const hash = resolvedHash();
  const model = models.find((m) => m.hash === hash);
  if (!model || model.builtin) return;
  if (!window.confirm(`Remove "${model.name}" from your avatar library? Characters using it will show the default model until you pick another.`)) return;
  await window.codApi.removeAvatarModel(hash);
  Object.assign(avatar(), { modelHash: null, modelName: '', format: '' });
  markDirty();
  await refreshLibrary();
  await showCurrentModel();
  syncToGm();
}

// Call whenever the character object is replaced (New / Open / startup).
export async function avatarCharacterLoaded() {
  if (!viewer) return;
  renderName();
  await refreshLibrary();
  await showCurrentModel({ force: true });
  syncToGm();
}

export function initAvatarPanel(options) {
  getCharacter = options.getCharacter;
  markDirty = options.markDirty;

  const spin = readSpinPref();
  el('avatar-spin').checked = spin;
  viewer = new AvatarViewer(el('avatar-viewport'), { autoRotate: spin });

  el('avatar-model-select').addEventListener('change', (e) => selectModel(e.target.value));
  el('avatar-import-btn').addEventListener('click', handleImport);
  el('avatar-remove-btn').addEventListener('click', handleRemove);

  const colorInput = el('avatar-color');
  colorInput.addEventListener('input', () => viewer.setColor(colorInput.value)); // live preview while dragging
  colorInput.addEventListener('change', () => {
    avatar().color = colorInput.value;
    markDirty();
    syncToGm();
  });

  el('avatar-spin').addEventListener('change', (e) => {
    viewer.setAutoRotate(e.target.checked);
    writeSpinPref(e.target.checked);
  });

  // The character name is edited in the meta grid, not here - mirror it,
  // and push it to GMScreen once typing settles.
  document.querySelector('[data-meta="name"]').addEventListener('input', () => {
    renderName();
    clearTimeout(nameSyncTimer);
    nameSyncTimer = setTimeout(syncToGm, NAME_SYNC_DEBOUNCE_MS);
  });
}
