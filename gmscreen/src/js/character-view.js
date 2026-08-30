// Read-only rendering of a character sent over from Character Manager. Kept
// deliberately independent from that app's character-model.js/widgets.js -
// GMScreen and Character Manager are packaged and shipped separately, so
// there's no shared module to import across that boundary. This only needs
// display, never validation or point-buy rules, so it's a small trimmed-down
// copy of the label/derived-stat constants, not the whole model.

const ATTRIBUTE_LABELS = {
  intelligence: 'Intelligence', wits: 'Wits', resolve: 'Resolve',
  strength: 'Strength', dexterity: 'Dexterity', stamina: 'Stamina',
  presence: 'Presence', manipulation: 'Manipulation', composure: 'Composure'
};

const ATTRIBUTE_COLUMNS = [
  { label: 'Mental', attributes: ['intelligence', 'wits', 'resolve'] },
  { label: 'Physical', attributes: ['strength', 'dexterity', 'stamina'] },
  { label: 'Social', attributes: ['presence', 'manipulation', 'composure'] }
];

const SKILL_LABELS = {
  academics: 'Academics', computer: 'Computer', crafts: 'Crafts',
  investigation: 'Investigation', medicine: 'Medicine', occult: 'Occult',
  politics: 'Politics', science: 'Science',
  athletics: 'Athletics', brawl: 'Brawl', drive: 'Drive', firearms: 'Firearms',
  larceny: 'Larceny', stealth: 'Stealth', survival: 'Survival', weaponry: 'Weaponry',
  animalKen: 'Animal Ken', empathy: 'Empathy', expression: 'Expression',
  intimidation: 'Intimidation', persuasion: 'Persuasion', socialize: 'Socialize',
  streetwise: 'Streetwise', subterfuge: 'Subterfuge'
};

const SKILL_GROUPS = [
  { label: 'Mental', skills: ['academics', 'computer', 'crafts', 'investigation', 'medicine', 'occult', 'politics', 'science'] },
  { label: 'Physical', skills: ['athletics', 'brawl', 'drive', 'firearms', 'larceny', 'stealth', 'survival', 'weaponry'] },
  { label: 'Social', skills: ['animalKen', 'empathy', 'expression', 'intimidation', 'persuasion', 'socialize', 'streetwise', 'subterfuge'] }
];

const SIZE_MODIFIER = { small: -1, average: 0, giant: 1 };
const BASE_SIZE = 5;

function derivedStats(character) {
  const a = character.attributes || {};
  const size = BASE_SIZE + (SIZE_MODIFIER[character.sizeCategory] ?? 0);
  return {
    health: (a.stamina || 0) + size,
    willpowerMax: (a.resolve || 0) + (a.composure || 0)
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function dotsRow(value, max) {
  const row = el('div', 'ro-dot-row');
  for (let i = 0; i < max; i += 1) {
    row.appendChild(el('span', 'ro-dot' + (i < value ? ' filled' : '')));
  }
  return row;
}

const HEALTH_GLYPH = { empty: '', bashing: '/', lethal: 'X', aggravated: '★' };

function healthRow(character) {
  const count = derivedStats(character).health;
  const boxes = character.health?.boxes || [];
  const row = el('div', 'ro-health-row');
  for (let i = 0; i < count; i += 1) {
    const state = boxes[i] || 'empty';
    row.appendChild(el('span', `ro-health-box ${state}`, HEALTH_GLYPH[state]));
  }
  return row;
}

function fieldRow(label, value) {
  const row = el('div', 'ro-field');
  row.appendChild(el('span', 'ro-field-label', label));
  row.appendChild(el('span', 'ro-field-value', value || '—'));
  return row;
}

function block(title) {
  const wrap = el('div', 'ro-block');
  if (title) wrap.appendChild(el('h3', null, title));
  return wrap;
}

function ratedList(entries) {
  const list = el('div', 'ro-rated-list');
  const filtered = (entries || []).filter((e) => e.name && e.name.trim());
  if (!filtered.length) {
    list.appendChild(el('p', 'ro-empty-hint', 'None'));
    return list;
  }
  filtered.forEach((e) => {
    const row = el('div', 'ro-rated-row');
    row.appendChild(el('span', 'ro-rated-name', e.name));
    row.appendChild(dotsRow(e.dots || 0, 5));
    list.appendChild(row);
  });
  return list;
}

function lineList(values) {
  const list = el('div', 'ro-line-list');
  const filtered = (values || []).filter((v) => v && v.trim());
  if (!filtered.length) {
    list.appendChild(el('p', 'ro-empty-hint', 'None'));
    return list;
  }
  filtered.forEach((v) => list.appendChild(el('p', 'ro-line', v)));
  return list;
}

function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Renders a read-only character summary into `container`. Not a pixel copy
// of Character Manager's full two-page sheet - covers the core Page 1
// fields a GM needs mid-session (identity, Attributes, Skills, vitals,
// tracked resource, Features/Disciplines/Gifts/etc, Merits, and the
// free-text trait lists).
function renderCharacterSheet(container, character) {
  clearEl(container);
  const c = character || {};
  const meta = c.meta || {};
  const derived = derivedStats(c);

  const header = block(null);
  header.classList.add('ro-header');
  header.appendChild(fieldRow('Player', meta.player));
  header.appendChild(fieldRow('Chronicle', meta.chronicle));
  header.appendChild(fieldRow('Species', meta.species));
  header.appendChild(fieldRow('Concept', meta.concept));
  container.appendChild(header);

  const attrBlock = block('Attributes');
  const attrGrid = el('div', 'ro-attr-grid');
  ATTRIBUTE_COLUMNS.forEach((col) => {
    const colEl = el('div', 'ro-attr-col');
    colEl.appendChild(el('h4', null, col.label));
    col.attributes.forEach((key) => {
      const row = el('div', 'ro-attr-line');
      row.appendChild(el('span', 'ro-attr-name', ATTRIBUTE_LABELS[key]));
      row.appendChild(dotsRow((c.attributes && c.attributes[key]) || 0, 5));
      colEl.appendChild(row);
    });
    attrGrid.appendChild(colEl);
  });
  attrBlock.appendChild(attrGrid);
  container.appendChild(attrBlock);

  const skillBlock = block('Skills');
  const skillGrid = el('div', 'ro-attr-grid');
  SKILL_GROUPS.forEach((group) => {
    const colEl = el('div', 'ro-attr-col');
    colEl.appendChild(el('h4', null, group.label));
    group.skills.forEach((key) => {
      const value = (c.skills && c.skills[key]) || 0;
      if (!value) return;
      const row = el('div', 'ro-attr-line');
      row.appendChild(el('span', 'ro-attr-name', SKILL_LABELS[key]));
      row.appendChild(dotsRow(value, 5));
      colEl.appendChild(row);
    });
    if (!colEl.querySelector('.ro-attr-line')) colEl.appendChild(el('p', 'ro-empty-hint', 'None'));
    skillGrid.appendChild(colEl);
  });
  skillBlock.appendChild(skillGrid);
  container.appendChild(skillBlock);

  const vitalsBlock = block('Vitals');
  vitalsBlock.classList.add('ro-vitals');

  const healthWrap = el('div', 'ro-vital');
  healthWrap.appendChild(el('h4', null, `Health (${derived.health})`));
  healthWrap.appendChild(healthRow(c));
  vitalsBlock.appendChild(healthWrap);

  const willpowerMax = derived.willpowerMax;
  const willpowerCurrent = Math.max(0, willpowerMax - (c.willpower?.spent || 0));
  const wpWrap = el('div', 'ro-vital');
  wpWrap.appendChild(el('h4', null, `Willpower${c.willpower?.risked ? ' (Risked)' : ''}`));
  wpWrap.appendChild(dotsRow(willpowerCurrent, willpowerMax));
  vitalsBlock.appendChild(wpWrap);

  const integrityWrap = el('div', 'ro-vital');
  integrityWrap.appendChild(el('h4', null, 'Integrity'));
  integrityWrap.appendChild(el('p', 'ro-field-value', String(c.integrity ?? '—')));
  vitalsBlock.appendChild(integrityWrap);

  if (c.resource && c.resource.label) {
    const resWrap = el('div', 'ro-vital');
    resWrap.appendChild(el('h4', null, c.resource.label));
    resWrap.appendChild(dotsRow(c.resource.dots || 0, 10));
    vitalsBlock.appendChild(resWrap);
  }

  container.appendChild(vitalsBlock);

  const featureBlock = block(c.featureLabel || 'Features');
  featureBlock.appendChild(ratedList(c.features));
  container.appendChild(featureBlock);

  const meritBlock = block('Merits');
  meritBlock.appendChild(ratedList(c.merits));
  container.appendChild(meritBlock);

  const traitsBlock = block(null);
  traitsBlock.classList.add('ro-traits-grid');
  [
    ['Aspirations', c.aspirations],
    ['Conditions', c.conditions],
    ['Touchstones', c.touchstones],
    ['The Code', c.code]
  ].forEach(([label, values]) => {
    const wrap = el('div', 'ro-trait-col');
    wrap.appendChild(el('h4', null, label));
    wrap.appendChild(lineList(values));
    traitsBlock.appendChild(wrap);
  });
  container.appendChild(traitsBlock);
}

export { renderCharacterSheet };
