// Data model and derived-stat rules for a baseline human Chronicles of Darkness
// 2nd Edition character. Formulas below are transcribed directly from the
// reference character sheet's footer key, not guessed at.
//
//   Health = Stamina + Size
//   Willpower = Resolve + Composure
//   Size = 5 for adult humans
//   Defense = lower of Dexterity or Wits, + Athletics
//   Initiative Mod = Dexterity + Composure
//   Speed = Strength + Dexterity + 5
//   Starting Integrity = 7

// Attribute point-buy priorities: every attribute starts at 1 dot, so only
// dots after the first count as spent points for a row. Which row is
// Primary/Secondary/Tertiary is NOT fixed to Power/Finesse/Resistance - it's
// determined by how many points the player actually puts into that row.
// Whichever row reaches 5 spent points becomes Primary; whichever reaches 4
// becomes Secondary. See attributePriorityState() for the tie-conflict rule.
const ATTRIBUTE_GROUPS = [
  { label: 'Power', attributes: ['intelligence', 'strength', 'presence'] },
  { label: 'Finesse', attributes: ['wits', 'dexterity', 'manipulation'] },
  { label: 'Resistance', attributes: ['resolve', 'stamina', 'composure'] }
];

function attributePointsSpent(character, attributeKeys) {
  return attributeKeys.reduce((sum, key) => sum + (character.attributes[key] - 1), 0);
}

// Determines each row's Primary/Secondary/Tertiary tier from what's actually
// been spent, and flags any rows tied on the same nonzero point total (an
// unresolved conflict - two rows can't both hold the same priority). A
// row's spent total of 0 is the untouched starting state, not a tie.
function attributePriorityState(character) {
  const spentByGroup = ATTRIBUTE_GROUPS.map((group) => attributePointsSpent(character, group.attributes));

  const conflictFlags = spentByGroup.map(
    (spent, i) => spent !== 0 && spentByGroup.some((other, j) => j !== i && other === spent)
  );
  const hasConflict = conflictFlags.some(Boolean);

  const rows = ATTRIBUTE_GROUPS.map((group, i) => {
    const spent = spentByGroup[i];
    const conflict = conflictFlags[i];
    let tier = null;
    if (!conflict) {
      if (spent === 5) tier = 'primary';
      else if (spent === 4) tier = 'secondary';
    }
    return { group, spent, tier, conflict };
  });

  return { rows, hasConflict };
}

const ATTRIBUTE_COLUMNS = [
  { label: 'Mental', attributes: ['intelligence', 'wits', 'resolve'] },
  { label: 'Physical', attributes: ['strength', 'dexterity', 'stamina'] },
  { label: 'Social', attributes: ['presence', 'manipulation', 'composure'] }
];

const SKILL_GROUPS = {
  mental: {
    label: 'Mental',
    unskilled: -3,
    skills: ['academics', 'computer', 'crafts', 'investigation', 'medicine', 'occult', 'politics', 'science']
  },
  physical: {
    label: 'Physical',
    unskilled: -1,
    skills: ['athletics', 'brawl', 'drive', 'firearms', 'larceny', 'stealth', 'survival', 'weaponry']
  },
  social: {
    label: 'Social',
    unskilled: -1,
    skills: ['animalKen', 'empathy', 'expression', 'intimidation', 'persuasion', 'socialize', 'streetwise', 'subterfuge']
  }
};

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

const ATTRIBUTE_LABELS = {
  intelligence: 'Intelligence', wits: 'Wits', resolve: 'Resolve',
  strength: 'Strength', dexterity: 'Dexterity', stamina: 'Stamina',
  presence: 'Presence', manipulation: 'Manipulation', composure: 'Composure'
};

function emptyRatedRow() {
  return { name: '', dots: 0 };
}

function defaultCharacter() {
  const attributes = {};
  Object.keys(ATTRIBUTE_LABELS).forEach((key) => { attributes[key] = 1; });

  const skills = {};
  Object.keys(SKILL_LABELS).forEach((key) => { skills[key] = 0; });

  return {
    schemaVersion: 1,
    meta: {
      name: '', player: '', chronicle: '',
      virtue: '', vice: '', concept: '',
      cell: '', compact: '', conspiracy: ''
    },
    attributes,
    skills,
    specialties: [], // { skill, name }
    merits: Array.from({ length: 7 }, emptyRatedRow),
    endowments: Array.from({ length: 4 }, emptyRatedRow),
    aspirations: ['', '', ''],
    conditions: ['', '', '', ''],
    touchstones: ['', '', ''],
    code: ['', '', '', ''],
    tactics: ['', '', '', ''],
    health: { boxes: [] }, // array of 'empty' | 'bashing' | 'lethal' | 'aggravated'
    willpower: { spent: 0, risked: false },
    integrity: 7,
    beats: 0,
    groupBeats: 0,
    experience: 0,
    armor: '',
    size: 5,
    description: {
      age: '', hair: '', eyes: '', sex: '',
      height: '', weight: '', race: 'Human', nationality: '',
      history: '', appearance: ''
    },
    equipment: Array.from({ length: 4 }, () => ({ item: '', durability: '', structure: '', size: '', cost: '' })),
    combat: Array.from({ length: 4 }, () => ({ weapon: '', dmg: '', range: '', clip: '', init: '', str: '', size: '' }))
  };
}

function derivedStats(character) {
  const a = character.attributes;
  const size = character.size || 5;
  const health = a.stamina + size;
  const willpowerMax = a.resolve + a.composure;
  const defense = Math.min(a.dexterity, a.wits) + (character.skills.athletics || 0);
  const initiativeMod = a.dexterity + a.composure;
  const speed = a.strength + a.dexterity + 5;

  return { health, willpowerMax, defense, initiativeMod, speed, size };
}

export {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_COLUMNS,
  ATTRIBUTE_LABELS,
  SKILL_GROUPS,
  SKILL_LABELS,
  defaultCharacter,
  derivedStats,
  attributePointsSpent,
  attributePriorityState
};
