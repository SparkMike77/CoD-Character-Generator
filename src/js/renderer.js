import {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_DESCRIPTIONS,
  SKILL_GROUPS,
  SKILL_LABELS,
  defaultCharacter,
  derivedStats,
  attributePriorityState
} from './character-model.js';
import { createDotRow, createCheckRow, createHealthTrack, createIntegrityLadder } from './widgets.js';

let character = defaultCharacter();
let currentFilePath = null;
let dirty = false;
let attributeConflict = false;

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function setDirty(value) {
  dirty = value;
  updateFileStatus();
}

function updateFileStatus() {
  const el = document.getElementById('file-status');
  const name = character.meta.name || 'Unnamed character';
  const location = currentFilePath ? currentFilePath.split(/[\\/]/).pop() : 'unsaved';
  el.textContent = `${name} — ${location}${dirty ? ' *' : ''}`;
}

function mergeCharacter(loaded) {
  const base = defaultCharacter();
  return {
    ...base,
    ...loaded,
    meta: { ...base.meta, ...(loaded.meta || {}) },
    attributes: { ...base.attributes, ...(loaded.attributes || {}) },
    skills: { ...base.skills, ...(loaded.skills || {}) },
    specialties: loaded.specialties || [],
    merits: loaded.merits && loaded.merits.length ? loaded.merits : base.merits,
    endowments: loaded.endowments && loaded.endowments.length ? loaded.endowments : base.endowments,
    aspirations: loaded.aspirations || base.aspirations,
    conditions: loaded.conditions || base.conditions,
    touchstones: loaded.touchstones || base.touchstones,
    code: loaded.code || base.code,
    tactics: loaded.tactics || base.tactics,
    health: { ...base.health, ...(loaded.health || {}) },
    willpower: { ...base.willpower, ...(loaded.willpower || {}) },
    description: { ...base.description, ...(loaded.description || {}) },
    equipment: loaded.equipment && loaded.equipment.length ? loaded.equipment : base.equipment,
    combat: loaded.combat && loaded.combat.length ? loaded.combat : base.combat
  };
}

/* ---------- Attributes ---------- */

const TIER_CLASS = {
  primary: 'priority-primary',
  secondary: 'priority-secondary'
};

function renderAttributes() {
  const grid = document.getElementById('attributes-grid');
  clearEl(grid);

  // Per-group DOM refs, filled in below, so updatePriorities() can restyle
  // every row (not just the one whose dot was clicked) after each change -
  // a tie can appear or resolve on a row nobody just touched.
  const rowRefs = [];

  ATTRIBUTE_GROUPS.forEach((group) => {
    const totalCell = document.createElement('div');
    totalCell.className = 'attr-row-total';
    grid.appendChild(totalCell);

    const rowLabel = document.createElement('div');
    rowLabel.className = 'attr-row-label';
    rowLabel.textContent = group.label;
    grid.appendChild(rowLabel);

    const nameEls = [];

    group.attributes.forEach((attrKey) => {
      const cell = document.createElement('div');
      cell.className = 'attr-cell';

      const nameWrap = document.createElement('span');
      nameWrap.className = 'attr-name-wrap';

      const infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'info-icon-sm';
      infoBtn.textContent = 'i';
      infoBtn.setAttribute('aria-label', `About ${ATTRIBUTE_LABELS[attrKey]}`);
      infoBtn.addEventListener('click', () => openAttributeDetail(attrKey));

      const name = document.createElement('span');
      name.className = 'attr-name';
      name.textContent = ATTRIBUTE_LABELS[attrKey];
      nameEls.push(name);

      nameWrap.appendChild(infoBtn);
      nameWrap.appendChild(name);

      const dotsContainer = document.createElement('div');

      cell.appendChild(nameWrap);
      cell.appendChild(dotsContainer);
      grid.appendChild(cell);

      createDotRow(dotsContainer, {
        max: 5,
        min: 1,
        getValue: () => character.attributes[attrKey],
        setValue: (v) => {
          character.attributes[attrKey] = v;
          setDirty(true);
          renderDerived();
          updatePriorities();
        }
      });
    });

    rowRefs.push({ totalCell, rowLabel, nameEls });
  });

  function updatePriorities() {
    const { rows, hasConflict } = attributePriorityState(character);
    rows.forEach((row, i) => {
      const { totalCell, rowLabel, nameEls } = rowRefs[i];
      totalCell.textContent = row.spent;

      const styleClass = row.conflict ? 'priority-conflict' : TIER_CLASS[row.tier] || '';
      [totalCell, rowLabel, ...nameEls].forEach((el) => {
        el.classList.remove('priority-primary', 'priority-secondary', 'priority-conflict');
        if (styleClass) el.classList.add(styleClass);
      });
    });

    attributeConflict = hasConflict;
    updateSaveAvailability();
    updateAttributesStatusText(rows, hasConflict);
  }

  updatePriorities();
}

const TIER_LABEL = { primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary' };

function updateAttributesStatusText(rows, hasConflict) {
  const statusEl = document.getElementById('attributes-status');
  if (!statusEl) return;

  statusEl.classList.toggle('priority-conflict', hasConflict);
  clearEl(statusEl);

  if (hasConflict) {
    statusEl.classList.add('single');
    statusEl.textContent = 'Error — attribute points overspent';
    return;
  }
  if (rows.every((row) => row.spent === 0)) {
    statusEl.classList.add('single');
    statusEl.textContent = 'Allocate 5 / 4 / 3 points across the rows below';
    return;
  }

  statusEl.classList.remove('single');
  rows.forEach((row) => {
    const item = document.createElement('span');
    item.textContent = `${row.group.label}: ${row.tier ? TIER_LABEL[row.tier] : '—'}`;
    statusEl.appendChild(item);
  });
}

/* ---------- Skills ---------- */

function getSpecialty(skillKey) {
  const entry = character.specialties.find((s) => s.skill === skillKey);
  return entry ? entry.name : '';
}

function setSpecialty(skillKey, value) {
  const entry = character.specialties.find((s) => s.skill === skillKey);
  if (!value) {
    if (entry) character.specialties = character.specialties.filter((s) => s.skill !== skillKey);
    return;
  }
  if (entry) entry.name = value;
  else character.specialties.push({ skill: skillKey, name: value });
}

function renderSkills() {
  const container = document.getElementById('skills-columns');
  clearEl(container);

  Object.values(SKILL_GROUPS).forEach((group) => {
    const col = document.createElement('div');
    col.className = 'skill-column';

    const header = document.createElement('div');
    header.className = 'skill-col-header';
    const h3 = document.createElement('h3');
    h3.textContent = group.label;
    const note = document.createElement('span');
    note.className = 'skill-unskilled-note';
    note.textContent = `(${group.unskilled} unskilled)`;
    header.appendChild(h3);
    header.appendChild(note);
    col.appendChild(header);

    group.skills.forEach((skillKey) => {
      const row = document.createElement('div');
      row.className = 'skill-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'skill-name';
      nameSpan.textContent = SKILL_LABELS[skillKey];

      const dotsContainer = document.createElement('div');

      const specialtyInput = document.createElement('input');
      specialtyInput.type = 'text';
      specialtyInput.className = 'skill-specialty';
      specialtyInput.placeholder = 'specialty';
      specialtyInput.value = getSpecialty(skillKey);
      specialtyInput.addEventListener('input', (e) => {
        setSpecialty(skillKey, e.target.value);
        setDirty(true);
      });

      row.appendChild(nameSpan);
      row.appendChild(dotsContainer);
      row.appendChild(specialtyInput);
      col.appendChild(row);

      createDotRow(dotsContainer, {
        max: 5,
        min: 0,
        getValue: () => character.skills[skillKey],
        setValue: (v) => {
          character.skills[skillKey] = v;
          setDirty(true);
          renderDerived();
        }
      });
    });

    container.appendChild(col);
  });
}

/* ---------- Rated lists (Merits / Endowments) ---------- */

function renderRatedListInto(container, list, rerender) {
  clearEl(container);
  list.forEach((row, idx) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'rated-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.value = row.name;
    nameInput.addEventListener('input', (e) => {
      row.name = e.target.value;
      setDirty(true);
    });

    const dotsContainer = document.createElement('div');

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-row';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', () => {
      list.splice(idx, 1);
      setDirty(true);
      rerender();
    });

    rowEl.appendChild(nameInput);
    rowEl.appendChild(dotsContainer);
    rowEl.appendChild(removeBtn);
    container.appendChild(rowEl);

    createDotRow(dotsContainer, {
      max: 5,
      min: 0,
      getValue: () => row.dots,
      setValue: (v) => {
        row.dots = v;
        setDirty(true);
      }
    });
  });
}

function renderMerits() {
  renderRatedListInto(document.getElementById('merits-list'), character.merits, renderMerits);
}

function renderEndowments() {
  renderRatedListInto(document.getElementById('endowments-list'), character.endowments, renderEndowments);
}

/* ---------- Line lists (free text lines) ---------- */

function renderLineList(containerEl, arr, rerender) {
  clearEl(containerEl);
  arr.forEach((val, idx) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = val;
    input.addEventListener('input', (e) => {
      arr[idx] = e.target.value;
      setDirty(true);
    });
    containerEl.appendChild(input);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'add-row-btn';
  addBtn.textContent = '+ Add Line';
  addBtn.addEventListener('click', () => {
    arr.push('');
    setDirty(true);
    rerender();
  });
  containerEl.appendChild(addBtn);
}

function renderAspirations() {
  renderLineList(document.getElementById('aspirations-list'), character.aspirations, renderAspirations);
}
function renderConditions() {
  renderLineList(document.getElementById('conditions-list'), character.conditions, renderConditions);
}
function renderTouchstones() {
  renderLineList(document.getElementById('touchstones-list'), character.touchstones, renderTouchstones);
}
function renderCode() {
  renderLineList(document.getElementById('code-list'), character.code, renderCode);
}
function renderTactics() {
  renderLineList(document.getElementById('tactics-list'), character.tactics, renderTactics);
}

/* ---------- Health / Willpower / Integrity / Beats ---------- */

function renderHealth() {
  const container = document.getElementById('health-track');
  createHealthTrack(container, {
    getCount: () => derivedStats(character).health,
    getBoxes: () => character.health.boxes,
    setBoxes: (boxes) => {
      character.health.boxes = boxes;
      setDirty(true);
    }
  });
}

function renderWillpower() {
  const max = derivedStats(character).willpowerMax;
  const container = document.getElementById('willpower-track');
  createDotRow(container, {
    max,
    min: 0,
    getValue: () => Math.max(0, max - character.willpower.spent),
    setValue: (current) => {
      character.willpower.spent = Math.max(0, max - current);
      setDirty(true);
    }
  });

  createCheckRow(document.getElementById('willpower-risked'), {
    max: 1,
    getValue: () => (character.willpower.risked ? 1 : 0),
    setValue: (v) => {
      character.willpower.risked = v > 0;
      setDirty(true);
    }
  });
}

function renderIntegrity() {
  createIntegrityLadder(document.getElementById('integrity-ladder'), {
    getValue: () => character.integrity,
    setValue: (v) => {
      character.integrity = v;
      setDirty(true);
    }
  });
}

function renderBeats() {
  createCheckRow(document.getElementById('beats-track'), {
    max: 5,
    getValue: () => character.beats,
    setValue: (v) => {
      character.beats = v;
      setDirty(true);
    }
  });
  createCheckRow(document.getElementById('group-beats-track'), {
    max: 5,
    getValue: () => character.groupBeats,
    setValue: (v) => {
      character.groupBeats = v;
      setDirty(true);
    }
  });
}

function renderDerived() {
  const d = derivedStats(character);
  document.getElementById('size-category-select').value = character.sizeCategory;
  document.getElementById('derived-size').textContent = d.size;
  document.getElementById('derived-speed').textContent = d.speed;
  document.getElementById('derived-defense').textContent = d.defense;
  document.getElementById('derived-initiative').textContent = d.initiativeMod;
  renderHealth();
  renderWillpower();
}

function initSizeControl() {
  document.getElementById('size-category-select').addEventListener('change', (e) => {
    character.sizeCategory = e.target.value;
    setDirty(true);
    renderDerived();
  });
}

/* ---------- Equipment / Combat tables ---------- */

function renderTableRows(tbodyEl, rows, fields, rerender) {
  clearEl(tbodyEl);
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    fields.forEach((field) => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = row[field] || '';
      input.addEventListener('input', (e) => {
        row[field] = e.target.value;
        setDirty(true);
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const tdRemove = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-row';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      rows.splice(idx, 1);
      setDirty(true);
      rerender();
    });
    tdRemove.appendChild(removeBtn);
    tr.appendChild(tdRemove);

    tbodyEl.appendChild(tr);
  });
}

const EQUIPMENT_FIELDS = ['item', 'durability', 'structure', 'size', 'cost'];
const COMBAT_FIELDS = ['weapon', 'dmg', 'range', 'clip', 'init', 'str', 'size'];

function renderEquipment() {
  renderTableRows(
    document.querySelector('#equipment-table tbody'),
    character.equipment,
    EQUIPMENT_FIELDS,
    renderEquipment
  );
}

function renderCombat() {
  renderTableRows(
    document.querySelector('#combat-table tbody'),
    character.combat,
    COMBAT_FIELDS,
    renderCombat
  );
}

/* ---------- Plain field bindings (meta + data-field) ---------- */

function bindStaticFields() {
  document.querySelectorAll('[data-meta]').forEach((el) => {
    const key = el.dataset.meta;
    el.value = character.meta[key] || '';
    el.oninput = () => {
      character.meta[key] = el.value;
      setDirty(true);
      updateFileStatus();
    };
  });

  document.querySelectorAll('[data-field]').forEach((el) => {
    const path = el.dataset.field;
    const current = getPath(character, path);
    el.value = current == null ? '' : current;
    el.oninput = () => {
      setPath(character, path, el.type === 'number' ? Number(el.value) : el.value);
      setDirty(true);
    };
  });
}

/* ---------- Top-level render / lifecycle ---------- */

function renderAll() {
  bindStaticFields();
  renderAttributes();
  renderSkills();
  renderMerits();
  renderEndowments();
  renderAspirations();
  renderConditions();
  renderTouchstones();
  renderCode();
  renderTactics();
  renderIntegrity();
  renderBeats();
  renderDerived();
  renderEquipment();
  renderCombat();
  updateFileStatus();
}

function handleNew() {
  if (dirty && !window.confirm('Discard unsaved changes and start a new character?')) return;
  character = defaultCharacter();
  currentFilePath = null;
  setDirty(false);
  renderAll();
}

async function handleOpen() {
  if (!window.codApi) return;
  if (dirty && !window.confirm('Discard unsaved changes and open a different character?')) return;
  const result = await window.codApi.openCharacter();
  if (!result) return;
  character = mergeCharacter(result.data);
  currentFilePath = result.filePath;
  setDirty(false);
  renderAll();
}

const SAVE_BLOCKED_MESSAGE =
  'Two Attribute rows have the same number of points spent. Resolve the tie (one row must be uniquely Primary/5 and one uniquely Secondary/4) before saving.';

function updateSaveAvailability() {
  const saveBtn = document.getElementById('btn-save');
  const saveAsBtn = document.getElementById('btn-save-as');
  [saveBtn, saveAsBtn].forEach((btn) => {
    btn.disabled = attributeConflict;
    btn.title = attributeConflict ? SAVE_BLOCKED_MESSAGE : '';
  });
}

async function handleSave() {
  if (!window.codApi) return;
  if (attributeConflict) {
    window.alert(SAVE_BLOCKED_MESSAGE);
    return;
  }
  const result = await window.codApi.saveCharacter(character, currentFilePath);
  if (!result) return;
  currentFilePath = result.filePath;
  setDirty(false);
}

async function handleSaveAs() {
  if (!window.codApi) return;
  if (attributeConflict) {
    window.alert(SAVE_BLOCKED_MESSAGE);
    return;
  }
  const result = await window.codApi.saveCharacter(character, null);
  if (!result) return;
  currentFilePath = result.filePath;
  setDirty(false);
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.page).classList.add('active');
    });
  });
}

function initToolbar() {
  document.getElementById('btn-new').addEventListener('click', handleNew);
  document.getElementById('btn-open').addEventListener('click', handleOpen);
  document.getElementById('btn-save').addEventListener('click', handleSave);
  document.getElementById('btn-save-as').addEventListener('click', handleSaveAs);
  document.getElementById('add-merit').addEventListener('click', () => {
    character.merits.push({ name: '', dots: 0 });
    setDirty(true);
    renderMerits();
  });
  document.getElementById('add-endowment').addEventListener('click', () => {
    character.endowments.push({ name: '', dots: 0 });
    setDirty(true);
    renderEndowments();
  });
  document.getElementById('add-equipment').addEventListener('click', () => {
    character.equipment.push({ item: '', durability: '', structure: '', size: '', cost: '' });
    setDirty(true);
    renderEquipment();
  });
  document.getElementById('add-combat').addEventListener('click', () => {
    character.combat.push({ weapon: '', dmg: '', range: '', clip: '', init: '', str: '', size: '' });
    setDirty(true);
    renderCombat();
  });
}

function initMenuBridge() {
  if (!window.codApi) return;
  window.codApi.onMenuAction((action) => {
    if (action === 'new') handleNew();
    else if (action === 'open') handleOpen();
    else if (action === 'save') handleSave();
    else if (action === 'save-as') handleSaveAs();
    else if (action === 'print') window.print();
  });
}

function initAttributesInfoModal() {
  const openBtn = document.getElementById('attributes-info-btn');
  const overlay = document.getElementById('attributes-info-modal');
  const closeBtn = document.getElementById('attributes-info-close');
  if (!openBtn || !overlay || !closeBtn) return;

  const open = () => overlay.classList.remove('hidden');
  const close = () => overlay.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
}

function initSkillsInfoModal() {
  const openBtn = document.getElementById('skills-info-btn');
  const overlay = document.getElementById('skills-info-modal');
  const closeBtn = document.getElementById('skills-info-close');
  if (!openBtn || !overlay || !closeBtn) return;

  const open = () => overlay.classList.remove('hidden');
  const close = () => overlay.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
}

function openAttributeDetail(attrKey) {
  document.getElementById('attribute-detail-title').textContent = ATTRIBUTE_LABELS[attrKey];
  document.getElementById('attribute-detail-body').textContent = ATTRIBUTE_DESCRIPTIONS[attrKey];
  document.getElementById('attribute-detail-modal').classList.remove('hidden');
}

function initAttributeDetailModal() {
  const overlay = document.getElementById('attribute-detail-modal');
  const closeBtn = document.getElementById('attribute-detail-close');
  if (!overlay || !closeBtn) return;

  const close = () => overlay.classList.add('hidden');

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
}

initTabs();
initToolbar();
initMenuBridge();
initAttributesInfoModal();
initAttributeDetailModal();
initSkillsInfoModal();
initSizeControl();
renderAll();
