import { renderMarkdown } from './markdown.js';
import { renderCharacterSheet } from './character-view.js';
import { AvatarViewer } from './avatar-view.js';
import { BODY_PARTS, PART_STATES } from './avatar-parts.js';
import { CONDITIONS, findCondition } from './conditions.js';

let renameTimer = null;
let currentCampaignPath = null;
let campaignDirty = false;
let campaignPreviewMode = false;

function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderState(state) {
  const nameInput = document.getElementById('session-name-input');
  if (document.activeElement !== nameInput) nameInput.value = state.name;

  const pinDisplay = document.getElementById('pin-display');
  pinDisplay.innerHTML = '';
  for (const digit of state.pin) {
    const box = document.createElement('span');
    box.className = 'pin-digit';
    box.textContent = digit;
    pinDisplay.appendChild(box);
  }

  document.getElementById('status-address').textContent = `${state.lanAddress}:${state.port}`;
  document.getElementById('status-paired').textContent = state.pairedCount;
}

/* ---------- Tabs ---------- */

function activateTab(pageId) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === pageId));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === pageId));
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.page));
  });
}

/* ---------- Player tabs (paired Character Managers) ---------- */

// Slot order (Player1..Player9, assigned by GmServer in pairing order) is
// the tab order too - a tab first appears the moment that Character Manager
// pairs this session, and stays for the rest of the run.
function playerTabLabel(player) {
  return player.character && player.name ? player.name : `Player${player.slot}`;
}

function ensurePlayerTab(player) {
  const nav = document.querySelector('.page-tabs');
  const main = document.querySelector('main');
  const pageId = `page-player-${player.id}`;

  let btn = document.querySelector(`.tab-btn[data-page="${pageId}"]`);
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-btn';
    btn.dataset.page = pageId;
    btn.addEventListener('click', () => activateTab(pageId));
    nav.appendChild(btn);
  }
  btn.textContent = playerTabLabel(player);

  let page = document.getElementById(pageId);
  if (!page) {
    page = document.createElement('section');
    page.id = pageId;
    page.className = 'page page-player';
    main.appendChild(page);
  }
  return page;
}

function renderPlayerPage(page, player) {
  clearEl(page);

  if (!player.character) {
    const wrap = document.createElement('div');
    wrap.className = 'block player-blank';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-row-btn player-request-btn';
    if (player.pendingRequest) {
      btn.textContent = 'Waiting for response...';
      btn.disabled = true;
    } else {
      btn.textContent = 'Request Character';
      btn.addEventListener('click', () => window.gmApi.requestCharacter(player.id));
    }
    wrap.appendChild(btn);
    page.appendChild(wrap);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'block ro-sheet-block';
  renderCharacterSheet(wrap, player.character);
  page.appendChild(wrap);
}

/* ---------- Roster (every connected player's avatar) ---------- */

// Unlike the player pages (rebuilt wholesale on every update, which is fine
// for plain HTML), roster cards are long-lived: each owns a WebGL viewer,
// and players-change fires constantly (every avatar push, name keystroke
// batch, character send). So cards are created once per player and only
// patched - the figure is rebuilt only when that player's parts descriptor
// actually changes, never just because something else updated.
const rosterCards = new Map(); // player id -> { card, viewer, nameEl, metaEl, msgEl, condEl, shownKey, condKey }

function rosterDisplayName(player) {
  return (player.avatar && player.avatar.name) || (player.character && player.name) || `Player${player.slot}`;
}

function createRosterCard(player) {
  const card = document.createElement('div');
  card.className = 'roster-card';

  const viewport = document.createElement('div');
  viewport.className = 'roster-viewport';
  const msgEl = document.createElement('div');
  msgEl.className = 'roster-message';
  viewport.appendChild(msgEl);

  const nameEl = document.createElement('div');
  nameEl.className = 'roster-name';
  const metaEl = document.createElement('div');
  metaEl.className = 'roster-meta';

  const openBtn = document.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'roster-open-btn';
  openBtn.textContent = 'Open sheet';
  openBtn.addEventListener('click', () => activateTab(`page-player-${player.id}`));

  const condEl = document.createElement('div');
  condEl.className = 'roster-conditions';

  card.appendChild(viewport);
  card.appendChild(nameEl);
  card.appendChild(metaEl);
  card.appendChild(condEl);
  card.appendChild(openBtn);
  document.getElementById('roster-grid').appendChild(card);

  const entry = { card, viewer: new AvatarViewer(viewport), nameEl, metaEl, msgEl, condEl, shownKey: null, condKey: null };
  rosterCards.set(player.id, entry);
  return entry;
}

function setRosterMessage(entry, text) {
  entry.msgEl.textContent = text || '';
  entry.msgEl.classList.toggle('hidden', !text);
}

// "Head damaged · R.Leg morphed" - only parts that aren't healthy, so a
// glance at the roster shows who's hurt or changed without rotating models.
function partSummary(avatar) {
  const stateLabel = Object.fromEntries(PART_STATES.map((st) => [st.id, st.label.toLowerCase()]));
  return BODY_PARTS.filter(({ id }) => avatar.parts[id] !== 'healthy')
    .map(({ id, short }) => `${short} ${stateLabel[avatar.parts[id]]}`)
    .join(' · ');
}

// The player's Conditions, editable: each a chip (hover for its effect, x
// to remove) plus an "Add" dropdown. A change goes to the player's sheet
// (gmApi.setPlayerConditions), which applies it - stats, injuries, pose -
// and sends its avatar back. Rebuilt only when the list changes.
function renderRosterConditions(entry, player) {
  const conditions = player.avatar ? player.avatar.conditions : undefined;
  const key = JSON.stringify(conditions === undefined ? 'none' : conditions);
  if (key === entry.condKey) return;
  entry.condKey = key;
  const wrap = entry.condEl;
  clearEl(wrap);
  if (!player.avatar) return;
  const head = document.createElement('div');
  head.className = 'roster-cond-head';
  head.textContent = 'Conditions';
  wrap.appendChild(head);
  if (!Array.isArray(conditions)) {
    const hint = document.createElement('p');
    hint.className = 'roster-cond-hint';
    hint.textContent = "This player's Character Manager is too old to share Conditions - they need to update it.";
    wrap.appendChild(hint);
    return;
  }
  const send = (list) => window.gmApi.setPlayerConditions(player.id, list);

  const chips = document.createElement('div');
  chips.className = 'roster-cond-chips';
  conditions.forEach((name, idx) => {
    const known = findCondition(name);
    const chip = document.createElement('span');
    chip.className = 'roster-cond-chip';
    chip.title = known ? known.effect : "A custom Condition from the player's sheet";
    const label = document.createElement('span');
    label.textContent = name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'roster-cond-remove';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => send(conditions.filter((_, i) => i !== idx)));
    chip.append(label, remove);
    chips.appendChild(chip);
  });
  if (!conditions.length) {
    const none = document.createElement('span');
    none.className = 'roster-cond-hint';
    none.textContent = 'None';
    chips.appendChild(none);
  }
  wrap.appendChild(chips);

  const add = document.createElement('select');
  add.className = 'roster-cond-add';
  add.setAttribute('aria-label', `Add a Condition to ${rosterDisplayName(player)}`);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '+ Add Condition...';
  add.appendChild(placeholder);
  CONDITIONS.filter((c) => !conditions.includes(c.name)).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = c.name;
    opt.title = c.effect;
    add.appendChild(opt);
  });
  add.addEventListener('change', () => {
    if (add.value) send([...conditions, add.value]);
  });
  wrap.appendChild(add);
}

function updateRosterCard(entry, player) {
  const avatar = player.avatar;
  entry.nameEl.textContent = rosterDisplayName(player);
  renderRosterConditions(entry, player);

  if (!avatar) {
    entry.metaEl.textContent = `Player${player.slot}`;
    entry.viewer.clear();
    entry.shownKey = null;
    setRosterMessage(entry, 'Waiting for avatar...');
    return;
  }
  entry.metaEl.textContent = [`Player${player.slot}`, partSummary(avatar)].filter(Boolean).join(' · ');

  // name/updatedAt/conditions change without the figure changing (the pose
  // and injuries the Conditions cause come with the player's next push) -
  // key on the parts only.
  const { name, updatedAt, conditions, ...parts } = avatar;
  const key = JSON.stringify(parts);
  if (key === entry.shownKey) return;
  entry.shownKey = key; // set now, so a poll arriving mid-build doesn't restart it
  entry.viewer.setAvatar(parts).then(
    () => setRosterMessage(entry, ''),
    (err) => {
      entry.shownKey = null; // let the next poll retry
      setRosterMessage(entry, `Couldn't display avatar: ${err.message || err}`);
    }
  );
}

function renderRoster(players) {
  const list = players || [];
  const ids = new Set(list.map((p) => p.id));

  // Players don't currently leave mid-run (slots last the whole session),
  // but don't leak a WebGL context if that ever changes.
  for (const [id, entry] of rosterCards) {
    if (!ids.has(id)) {
      entry.viewer.dispose();
      entry.card.remove();
      rosterCards.delete(id);
    }
  }

  list.forEach((player) => {
    const entry = rosterCards.get(player.id) || createRosterCard(player);
    updateRosterCard(entry, player);
  });
  document.getElementById('roster-empty').classList.toggle('hidden', list.length > 0);
}

function renderPlayers(players) {
  (players || []).forEach((player) => {
    const page = ensurePlayerTab(player);
    renderPlayerPage(page, player);
  });
  renderRoster(players);
}

function initPlayers() {
  window.gmApi.getPlayers().then(renderPlayers);
  window.gmApi.onPlayersUpdate(renderPlayers);
}

/* ---------- About modal ---------- */

function openAboutModal() {
  document.getElementById('about-modal').classList.remove('hidden');
}

function closeAboutModal() {
  document.getElementById('about-modal').classList.add('hidden');
}

function initAboutModal() {
  const overlay = document.getElementById('about-modal');
  const closeBtn = document.getElementById('about-close');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', closeAboutModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAboutModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeAboutModal();
  });
}

/* ---------- "load a campaign first" modal ---------- */

function openSessionNeedsCampaignModal() {
  document.getElementById('session-needs-campaign-modal').classList.remove('hidden');
}

function closeSessionNeedsCampaignModal() {
  document.getElementById('session-needs-campaign-modal').classList.add('hidden');
}

function initSessionNeedsCampaignModal() {
  const overlay = document.getElementById('session-needs-campaign-modal');
  const closeBtn = document.getElementById('session-needs-campaign-close');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', closeSessionNeedsCampaignModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSessionNeedsCampaignModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeSessionNeedsCampaignModal();
  });
}

/* ---------- Campaign editor ---------- */

function updateCampaignFilenameLabel() {
  const el = document.getElementById('campaign-filename');
  el.textContent = currentCampaignPath ? currentCampaignPath.split(/[\\/]/).pop() : 'No campaign loaded';
}

function setCampaignDirty(value) {
  campaignDirty = value;
  document.getElementById('campaign-save-btn').disabled = !value;
}

function renderCampaignPreview() {
  const content = document.getElementById('campaign-editor').value;
  document.getElementById('campaign-preview').innerHTML = renderMarkdown(content);
}

function applyCampaign(campaign) {
  currentCampaignPath = campaign.filePath;
  document.getElementById('campaign-editor').value = campaign.content;
  setCampaignDirty(false);
  updateCampaignFilenameLabel();
  if (campaignPreviewMode) renderCampaignPreview();
}

async function handleSaveCampaign() {
  const content = document.getElementById('campaign-editor').value;
  const result = await window.gmApi.saveCampaign(content);
  if (result.ok) setCampaignDirty(false);
  else window.alert(result.error);
}

async function handleNewCampaignClick() {
  if (campaignDirty && !window.confirm('Discard unsaved changes to the current campaign?')) return;
  const result = await window.gmApi.newCampaign();
  if (!result) return;
  applyCampaign(result);
  activateTab('page-campaign');
}

async function handleOpenCampaignClick() {
  if (campaignDirty && !window.confirm('Discard unsaved changes to the current campaign?')) return;
  const result = await window.gmApi.openCampaign();
  if (!result) return;
  applyCampaign(result);
  activateTab('page-campaign');
}

function toggleCampaignPreview() {
  campaignPreviewMode = !campaignPreviewMode;
  const editor = document.getElementById('campaign-editor');
  const preview = document.getElementById('campaign-preview');
  const btn = document.getElementById('campaign-preview-toggle');

  if (campaignPreviewMode) {
    renderCampaignPreview();
    editor.classList.add('hidden');
    preview.classList.remove('hidden');
    btn.textContent = 'Edit';
  } else {
    preview.classList.add('hidden');
    editor.classList.remove('hidden');
    btn.textContent = 'Preview';
  }
}

function initCampaignEditor() {
  document.getElementById('campaign-editor').addEventListener('input', () => setCampaignDirty(true));
  document.getElementById('campaign-save-btn').addEventListener('click', handleSaveCampaign);
  document.getElementById('campaign-preview-toggle').addEventListener('click', toggleCampaignPreview);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (campaignDirty) handleSaveCampaign();
    }
  });
}

/* ---------- Scene: Combat / Initiative ---------- */

// Purely in-memory, like the rest of a GM "session" (tokens, PIN) - a
// combat's initiative order doesn't need to survive an app restart.
let initiativeRows = [{ num: '', name: '', status: '', action: '' }];

const INITIATIVE_STATUS_OPTIONS = [
  'Knocked Down', 'Stunned', 'Immobilised', 'Pinned', 'Arm Wrack', 'Leg Wrack',
  'Blinded', 'Deafened', 'Ongoing Injury', 'Weakened', 'Confused', 'Defeated'
];

const INITIATIVE_ACTION_OPTIONS = ['Attack', 'Charge', 'Aim', 'Dodge', 'Maneuver', 'Aptitude', 'No Action'];

function buildOptionSelect(className, options, value, onChange) {
  const select = document.createElement('select');
  select.className = className;
  const blankOpt = document.createElement('option');
  blankOpt.value = '';
  blankOpt.textContent = '—';
  select.appendChild(blankOpt);
  options.forEach((label) => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
  select.value = value;
  select.addEventListener('change', (e) => onChange(e.target.value));
  return select;
}

function renderInitiativeList() {
  const container = document.getElementById('initiative-list');
  clearEl(container);

  initiativeRows.forEach((row, idx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'initiative-row';

    const numInput = document.createElement('input');
    numInput.type = 'text';
    numInput.inputMode = 'numeric';
    numInput.maxLength = 2;
    numInput.className = 'initiative-num';
    numInput.value = row.num;
    numInput.addEventListener('input', (e) => {
      row.num = e.target.value.replace(/\D/g, '').slice(0, 2);
      e.target.value = row.num;
    });

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.className = 'initiative-name';
    nameInput.value = row.name;
    nameInput.addEventListener('input', (e) => {
      row.name = e.target.value;
    });

    const statusSelect = buildOptionSelect('initiative-status', INITIATIVE_STATUS_OPTIONS, row.status, (value) => {
      row.status = value;
    });

    const actionSelect = buildOptionSelect('initiative-action', INITIATIVE_ACTION_OPTIONS, row.action, (value) => {
      row.action = value;
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-row';
    removeBtn.title = 'Remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      initiativeRows.splice(idx, 1);
      renderInitiativeList();
    });

    rowEl.appendChild(numInput);
    rowEl.appendChild(nameInput);
    rowEl.appendChild(statusSelect);
    rowEl.appendChild(actionSelect);
    rowEl.appendChild(removeBtn);
    container.appendChild(rowEl);
  });
}

function activateSceneTab(id) {
  document.querySelectorAll('.scene-tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.scenePage === id));
  document.querySelectorAll('.scene-subpage').forEach((p) => p.classList.toggle('active', p.id === id));
}

function initSceneTabs() {
  document.querySelectorAll('.scene-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateSceneTab(btn.dataset.scenePage));
  });
}

function initScene() {
  document.getElementById('add-initiative').addEventListener('click', () => {
    initiativeRows.push({ num: '', name: '', status: '', action: '' });
    renderInitiativeList();
  });
  renderInitiativeList();
  initSceneTabs();
}

/* ---------- Session save / reload (Scene state) ---------- */

function gatherSceneState() {
  return {
    initiative: initiativeRows,
    combatNotes: document.querySelector('#scene-combat .scene-textarea').value,
    socialNotes: document.querySelector('#scene-social .scene-textarea').value
  };
}

function applySceneState(scene) {
  initiativeRows = scene && scene.initiative && scene.initiative.length
    ? scene.initiative.map((r) => ({ num: r.num || '', name: r.name || '', status: r.status || '', action: r.action || '' }))
    : [{ num: '', name: '', status: '', action: '' }];
  renderInitiativeList();
  document.querySelector('#scene-combat .scene-textarea').value = (scene && scene.combatNotes) || '';
  document.querySelector('#scene-social .scene-textarea').value = (scene && scene.socialNotes) || '';
}

async function handleSaveSession() {
  const result = await window.gmApi.saveSession(gatherSceneState());
  if (result && result.ok) window.alert(`Session saved: ${result.filePath.split(/[\\/]/).pop()}`);
}

async function handleOpenSession() {
  const payload = await window.gmApi.openSession();
  if (!payload) return;
  applySceneState(payload.scene);
  activateTab('page-scene');
}

async function init() {
  const state = await window.gmApi.getSession();
  renderState(state);
  window.gmApi.onSessionUpdate(renderState);

  document.getElementById('session-name-input').addEventListener('input', (e) => {
    clearTimeout(renameTimer);
    const value = e.target.value;
    renameTimer = setTimeout(() => window.gmApi.renameSession(value), 500);
  });

  document.getElementById('rotate-pin-btn').addEventListener('click', () => {
    window.gmApi.rotatePin();
  });

  document.getElementById('btn-references').addEventListener('click', () => {
    window.gmApi.openReferences();
  });

  const campaign = await window.gmApi.getCampaign();
  applyCampaign(campaign);

  initTabs();
  initCampaignEditor();
  initScene();
  initAboutModal();
  initSessionNeedsCampaignModal();
  initPlayers();

  window.gmApi.onMenuAction((action) => {
    if (action === 'about') openAboutModal();
    else if (action === 'new-campaign') handleNewCampaignClick();
    else if (action === 'open-campaign') handleOpenCampaignClick();
    else if (action === 'session-needs-campaign') openSessionNeedsCampaignModal();
    else if (action === 'save-session') handleSaveSession();
    else if (action === 'open-session') handleOpenSession();
  });
}

init();
