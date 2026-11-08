// The Avatar column on the left of the character sheet: a 3D viewer plus
// each body part's Healthy / Damaged / Morphed state, hairstyle, and
// colors. Also owns the Gender select in the sheet's meta grid, which
// drives the avatar's body shape. Owns
// character.avatar - a parts descriptor, see AVATAR_DEFAULT in
// avatar-parts.js.
//
// Every change is also handed to the main process (setCurrentAvatar), which
// keeps the latest avatar and pushes it to every GMScreen this player is
// connected to - that's what feeds the GM's Roster page. GMScreen rebuilds
// the same figure from the descriptor, so nothing but that small JSON is
// ever sent.
//
// Conditions on the sheet (conditions.js) can injure body parts: those
// show as Damaged - on the viewer and to the GM - for as long as the
// Condition is there, over the player's own setting for the part (which is
// what's saved, and comes back when the Condition goes). Only a Healthy
// part is overridden; a Morphed one stays Morphed. They also pose the
// figure (kneeling, lying down... - conditions.js conditionPose), likewise
// never saved.
import { AvatarViewer } from './avatar-view.js';
import { BODY_PARTS, GENDERS, HAIRSTYLES, PART_STATES, normalizeAvatar } from './avatar-parts.js';
import { conditionInjuries, conditionPose } from './conditions.js';

const NAME_SYNC_DEBOUNCE_MS = 600;
const SPIN_PREF_KEY = 'avatar.spin';

let viewer = null;
let getCharacter = () => null;
let markDirty = () => {};
let nameSyncTimer = null;

const el = (id) => document.getElementById(id);
const partSelects = () => document.querySelectorAll('[data-avatar-part]');
const colorInputs = () => document.querySelectorAll('[data-avatar-color]');

function avatar() {
  return getCharacter().avatar;
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

function fillSelect(select, options) {
  options.forEach(({ id, label }) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

// Body part id -> the Conditions injuring it, for parts they override.
function conditionOverrides() {
  const injuries = conditionInjuries(getCharacter().conditions);
  const parts = avatar().parts;
  return new Map([...injuries].filter(([part]) => parts[part] === 'healthy'));
}

// The avatar as shown and sent to the GM: the saved one with Condition
// injuries and pose applied.
function displayed() {
  const a = avatar();
  const overrides = conditionOverrides();
  const parts = { ...a.parts };
  for (const part of overrides.keys()) parts[part] = 'damaged';
  return { ...a, parts, pose: conditionPose(getCharacter().conditions) };
}

function renderControls() {
  const a = avatar();
  const overrides = conditionOverrides();
  el('avatar-gender').value = a.gender;
  el('avatar-style').value = a.style;
  partSelects().forEach((select) => {
    const injuredBy = overrides.get(select.dataset.avatarPart);
    select.value = injuredBy ? 'damaged' : a.parts[select.dataset.avatarPart];
    select.disabled = !!injuredBy;
    select.title = injuredBy ? `Damaged by ${injuredBy.join(', ')} - remove the Condition to change it` : '';
    select.classList.toggle('from-condition', !!injuredBy);
  });
  const note = el('avatar-condition-note');
  note.textContent = overrides.size
    ? 'From Conditions: ' + BODY_PARTS.filter((p) => overrides.has(p.id))
      .map((p) => `${p.label} (${overrides.get(p.id).join(', ')})`).join('; ')
    : '';
  note.classList.toggle('hidden', !overrides.size);
  colorInputs().forEach((input) => {
    input.value = a[input.dataset.avatarColor];
  });
}

function renderName() {
  const name = (getCharacter().meta.name || '').trim();
  el('avatar-name').textContent = name || 'Unnamed character';
}

function showAvatar(descriptor) {
  viewer.setAvatar(descriptor).catch((err) => console.error('Avatar build failed:', err));
}

function syncToGm() {
  window.codApi.setCurrentAvatar({
    name: (getCharacter().meta.name || '').trim(),
    ...displayed(),
    // So the GM sees (and can change - see renderer.js applyGmConditions) them.
    conditions: getCharacter().conditions.filter(Boolean)
  });
}

// A part/state picker changed: persist it, redraw, tell the GM.
function commit() {
  markDirty();
  showAvatar(displayed());
  syncToGm();
}

// The sheet's Conditions changed: their injuries may have too.
export function avatarConditionsChanged() {
  if (!viewer) return;
  renderControls();
  showAvatar(displayed());
  syncToGm();
}

// Call whenever the character object is replaced (New / Open / startup).
export function avatarCharacterLoaded() {
  if (!viewer) return;
  const character = getCharacter();
  // Normalizing here is what migrates older files: characters saved with
  // the earlier imported-model avatar (or none) get a default parts avatar.
  character.avatar = normalizeAvatar(character.avatar);
  renderName();
  renderControls();
  showAvatar(displayed());
  syncToGm();
}

export function initAvatarPanel(options) {
  getCharacter = options.getCharacter;
  markDirty = options.markDirty;

  fillSelect(el('avatar-gender'), GENDERS);
  fillSelect(el('avatar-style'), HAIRSTYLES);
  partSelects().forEach((select) => fillSelect(select, PART_STATES));

  const spin = readSpinPref();
  el('avatar-spin').checked = spin;
  viewer = new AvatarViewer(el('avatar-viewport'), { autoRotate: spin });

  el('avatar-gender').addEventListener('change', (e) => {
    avatar().gender = e.target.value;
    commit();
  });
  el('avatar-style').addEventListener('change', (e) => {
    avatar().style = e.target.value;
    commit();
  });
  partSelects().forEach((select) => {
    select.addEventListener('change', () => {
      avatar().parts[select.dataset.avatarPart] = select.value;
      commit();
    });
  });

  colorInputs().forEach((input) => {
    const key = input.dataset.avatarColor;
    // Live preview while dragging; only the final pick marks dirty/syncs.
    input.addEventListener('input', () => showAvatar({ ...displayed(), [key]: input.value }));
    input.addEventListener('change', () => {
      avatar()[key] = input.value;
      commit();
    });
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
