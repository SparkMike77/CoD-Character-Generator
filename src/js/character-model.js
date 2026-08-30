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

// Generic Primary/Secondary/Tertiary point-buy validation, shared by
// Attributes (budgets 5/4/3, rows Power/Finesse/Resistance) and Skills
// (budgets 11/7/4, categories Mental/Physical/Social). Which group holds
// which tier is NOT fixed - it's determined by how many points the player
// actually put into that group. A group's spent total of 0 is the
// untouched starting state, never a violation on its own.
//
// This runs in two passes so Experience can forgive an over-budget group
// (see computeExperienceState below) without touching the "same total as
// another group" tie check, which XP can never resolve - it doesn't tell
// us which of two identically-spent groups was actually meant to be
// Primary. Only genuine excess-over-budget is something XP can buy off.
//
// Pass 1 (computeRawExcess): for each group, which rule it would violate
// ignoring XP entirely, and by how many dots:
//   - 'primary': it exceeds the Primary budget outright (no group can ever
//     go past that, regardless of what any other group has)
//   - 'secondary': another group already claimed exactly the Primary
//     budget and this group exceeds the Secondary budget (the max left
//     once Primary's taken)
//   - 'tertiary': another group claimed the Primary budget AND another
//     claimed the Secondary budget, and this group exceeds the Tertiary
//     budget (the max left once both are taken)
//   plus a separate `tied` flag: this group's total matches another
//   group's nonzero total (always a conflict, never XP-forgivable).
function computeRawExcess(spentByGroup, [primaryBudget, secondaryBudget, tertiaryBudget]) {
  return spentByGroup.map((spent, i) => {
    const others = spentByGroup.filter((_, j) => j !== i);
    const hasPrimaryElsewhere = others.includes(primaryBudget);
    const hasSecondaryElsewhere = others.includes(secondaryBudget);
    const tied = spent !== 0 && others.includes(spent);

    let rule = null;
    let excessDots = 0;
    if (spent > primaryBudget) {
      rule = 'primary';
      excessDots = spent - primaryBudget;
    } else if (hasPrimaryElsewhere && spent > secondaryBudget) {
      rule = 'secondary';
      excessDots = spent - secondaryBudget;
    } else if (hasPrimaryElsewhere && hasSecondaryElsewhere && spent > tertiaryBudget) {
      rule = 'tertiary';
      excessDots = spent - tertiaryBudget;
    }

    return { spent, tied, rule, excessDots };
  });
}

// The tier a row's spending is pointing at, ignoring Experience entirely -
// a rule-triggered row unambiguously identifies its target tier (over
// budget or not), so only a genuine tie is truly unresolvable. Used both
// to finalize Attribute display (below) and, via attributesRawlyResolved,
// to gate the Skill mechanic - deliberately XP-independent so computing
// "are Attributes resolved" never has to ask "does XP cover them," which
// would be circular (XP coverage is a total across Attributes AND Skills).
function computeRawTiers(rawRows, spentByGroup, [primaryBudget, secondaryBudget]) {
  return rawRows.map((r, i) => {
    if (r.tied) return null;
    if (r.rule) return r.rule;
    const others = spentByGroup.filter((_, j) => j !== i);
    if (r.spent === primaryBudget) return 'primary';
    if (r.spent === secondaryBudget) return 'secondary';
    if (others.includes(primaryBudget) && others.includes(secondaryBudget)) return 'tertiary';
    return null;
  });
}

// Combines the raw per-group results with whether Experience covers ALL of
// the character's excess spending everywhere (Attributes, Skills, Merits,
// Specialties, Integrity combined - see computeExperienceState). A
// rule-triggered group still shows its target tier when XP covers it (it
// validly bought the overage), just without the conflict flag; a tied
// group is always a conflict, XP or not.
function finalizePriorityRows(rawRows, budgets, xpCoversAllExcess) {
  const spentByGroup = rawRows.map((r) => r.spent);
  const rawTiers = computeRawTiers(rawRows, spentByGroup, budgets);

  return rawRows.map((r, i) => {
    const conflict = r.tied || (r.rule !== null && !xpCoversAllExcess);
    return { spent: r.spent, tier: conflict ? null : rawTiers[i], conflict };
  });
}

function attributesRawlyResolved(character) {
  const spentByGroup = ATTRIBUTE_GROUPS.map((group) => attributePointsSpent(character, group.attributes));
  const rawRows = computeRawExcess(spentByGroup, ATTRIBUTE_PRIORITY_BUDGETS);
  const rawTiers = computeRawTiers(rawRows, spentByGroup, ATTRIBUTE_PRIORITY_BUDGETS);
  return rawTiers.every((t) => t !== null);
}

const ATTRIBUTE_PRIORITY_BUDGETS = [5, 4, 3];

function attributePriorityState(character) {
  const spentByGroup = ATTRIBUTE_GROUPS.map((group) => attributePointsSpent(character, group.attributes));
  const rawRows = computeRawExcess(spentByGroup, ATTRIBUTE_PRIORITY_BUDGETS);
  const { xpCovers } = computeExperienceState(character);
  const finalRows = finalizePriorityRows(rawRows, ATTRIBUTE_PRIORITY_BUDGETS, xpCovers);

  const rows = finalRows.map((r, i) => ({ ...r, group: ATTRIBUTE_GROUPS[i] }));
  const hasConflict = rows.some((r) => r.conflict);

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

// Skill category priorities: unlike Attributes, this is NOT rank-derived
// from spending. As soon as all three Attribute rows have a resolved tier
// (any valid combination - Skills don't care which Attribute row got
// which), Skills lock to a fixed mapping - Mental=Primary(11),
// Physical=Secondary(7), Social=Tertiary(4) - visible immediately via the
// superscripts and header countdown, before a single skill dot is spent.
// If Attributes later change and stop being fully resolved (a new tie,
// an unassigned row), Skills drop back to unassigned too. Skills start at
// 0 (no free dot), so every dot counts as spent.
const SKILL_CATEGORY_BUDGETS = [11, 7, 4];
const SKILL_FIXED_TIERS = ['primary', 'secondary', 'tertiary'];

function skillPointsSpent(character, skillKeys) {
  return skillKeys.reduce((sum, key) => sum + character.skills[key], 0);
}

function skillPriorityState(character) {
  const groups = Object.values(SKILL_GROUPS);
  const spentByGroup = groups.map((group) => skillPointsSpent(character, group.skills));
  const attributesResolved = attributesRawlyResolved(character);

  if (!attributesResolved) {
    const rows = groups.map((group, i) => ({ group, spent: spentByGroup[i], tier: null, conflict: false, budget: null }));
    return { rows, hasConflict: false, attributesResolved };
  }

  const { xpCovers } = computeExperienceState(character);
  const rows = groups.map((group, i) => {
    const budget = SKILL_CATEGORY_BUDGETS[i];
    const spent = spentByGroup[i];
    const conflict = spent > budget && !xpCovers;
    return { group, spent, tier: SKILL_FIXED_TIERS[i], conflict, budget };
  });
  const hasConflict = rows.some((r) => r.conflict);

  return { rows, hasConflict, attributesResolved };
}

// Experience: buys extra dots/specialties above each domain's free budget.
// XP is one shared pool (character.experience), spent across every domain
// at once - not tracked per-purchase - so "does XP cover this?" is always
// a question about the TOTAL cost of everything currently over-budget
// everywhere, compared against the total available. If the total fits,
// every over-budget item everywhere is allowed (not highlighted). If it
// doesn't, every over-budget item everywhere is flagged, exactly as if
// Experience didn't exist - there's no reliable way to say which specific
// purchase the player "meant" to afford with a partial pool, so this
// deliberately doesn't try to guess an allocation order.
const XP_COSTS = {
  meritDot: 1,
  specialty: 1,
  skillDot: 2,
  attributeDot: 4,
  integrityDot: 2
};

const MERIT_FREE_DOTS = 7; // per the reference sheet footer ("Merits 7")
const SPECIALTY_FREE_COUNT = 3; // "(+3 Specialties)"
const INTEGRITY_BASE = 7; // "Starting Integrity = 7"

function computeExperienceState(character) {
  const attrSpentByGroup = ATTRIBUTE_GROUPS.map((group) => attributePointsSpent(character, group.attributes));
  const attrRaw = computeRawExcess(attrSpentByGroup, ATTRIBUTE_PRIORITY_BUDGETS);
  const attrExcessDots = attrRaw.reduce((sum, r) => sum + r.excessDots, 0);

  // Skill budgets only exist once Attributes are resolved (see
  // skillPriorityState) - before that there's nothing defined to be over,
  // so no XP is required for Skills yet regardless of dots spent.
  const attributesResolved = attributesRawlyResolved(character);
  let skillExcessDots = 0;
  if (attributesResolved) {
    const skillGroups = Object.values(SKILL_GROUPS);
    skillGroups.forEach((group, i) => {
      const spent = skillPointsSpent(character, group.skills);
      skillExcessDots += Math.max(0, spent - SKILL_CATEGORY_BUDGETS[i]);
    });
  }

  const meritDotsTotal = character.merits.reduce((sum, m) => sum + m.dots, 0);
  const meritExcess = Math.max(0, meritDotsTotal - MERIT_FREE_DOTS);

  const specialtyExcess = Math.max(0, character.specialties.length - SPECIALTY_FREE_COUNT);

  const integrityExcess = Math.max(0, character.integrity - INTEGRITY_BASE);

  const totalRequiredXP =
    attrExcessDots * XP_COSTS.attributeDot +
    skillExcessDots * XP_COSTS.skillDot +
    meritExcess * XP_COSTS.meritDot +
    specialtyExcess * XP_COSTS.specialty +
    integrityExcess * XP_COSTS.integrityDot;

  const available = character.experience || 0;
  const xpCovers = totalRequiredXP <= available;

  return {
    totalRequiredXP,
    available,
    xpCovers,
    meritExcess,
    specialtyExcess,
    integrityExcess
  };
}

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

const ATTRIBUTE_DESCRIPTIONS = {
  intelligence: 'Raw mental capacity: reasoning, learning, memory, comprehension, and solving complex problems.',
  wits: 'Mental quickness: noticing details, improvising, reacting under pressure, and thinking on your feet.',
  resolve: 'Focus and determination: staying on task, resisting distraction, and pushing through mental pressure.',
  strength: 'Raw bodily force: lifting, carrying, pushing, grappling, and hitting hard.',
  dexterity: 'Physical coordination: agility, balance, precision, reflexes, and fine motor control.',
  stamina: 'Bodily resilience: enduring pain, fatigue, illness, exertion, and physical punishment.',
  presence: 'Force of personality: natural authority, confidence, magnetism, and the ability to command attention.',
  manipulation: 'Social subtlety: persuading, charming, deceiving, bargaining with, or steering other people.',
  composure: 'Emotional self-control: remaining calm under pressure and resisting intimidation, temptation, or manipulation.'
};

function emptyRatedRow() {
  return { name: '', dots: 0 };
}

const BASE_SIZE = 5; // adult human baseline, per the reference sheet

const SIZE_CATEGORIES = {
  small: { label: 'Small', modifier: -1 },
  average: { label: 'Average', modifier: 0 },
  giant: { label: 'Giant', modifier: 1 }
};

function defaultCharacter() {
  const attributes = {};
  Object.keys(ATTRIBUTE_LABELS).forEach((key) => { attributes[key] = 1; });

  const skills = {};
  Object.keys(SKILL_LABELS).forEach((key) => { skills[key] = 0; });

  return {
    schemaVersion: 1,
    campaignId: null,
    meta: {
      name: '', player: '', chronicle: '',
      virtue: '', vice: '', concept: '',
      cell: '', compact: '', conspiracy: '', species: ''
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
    resource: { label: '', dots: 0 }, // per-species tracked pool, e.g. Blood Pool, Rage, Swarm
    beats: 0,
    groupBeats: 0,
    experience: 0,
    armor: '',
    sizeCategory: 'average',
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
  const sizeModifier = SIZE_CATEGORIES[character.sizeCategory]?.modifier ?? 0;
  const size = BASE_SIZE + sizeModifier;
  const health = a.stamina + size;
  const willpowerMax = a.resolve + a.composure;
  const defense = Math.min(a.dexterity, a.wits) + (character.skills.athletics || 0);
  const initiativeMod = a.dexterity + a.composure;
  const speed = a.strength + a.dexterity + size;

  return { health, willpowerMax, defense, initiativeMod, speed, size };
}

export {
  ATTRIBUTE_GROUPS,
  ATTRIBUTE_COLUMNS,
  ATTRIBUTE_LABELS,
  ATTRIBUTE_DESCRIPTIONS,
  SKILL_GROUPS,
  SKILL_LABELS,
  SIZE_CATEGORIES,
  defaultCharacter,
  derivedStats,
  attributePointsSpent,
  attributePriorityState,
  skillPointsSpent,
  skillPriorityState,
  computeExperienceState,
  XP_COSTS,
  MERIT_FREE_DOTS,
  SPECIALTY_FREE_COUNT,
  INTEGRITY_BASE
};
