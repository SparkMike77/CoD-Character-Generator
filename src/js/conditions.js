// The Conditions a character can have, as offered by the sheet's Conditions
// dropdowns: what each one does, which body parts it visibly injures on the
// avatar, and what it does to the sheet's derived stats.
//
// Names follow the Conditions list in the Combat Rules
// (default-combat-rules.js), itself based on the CofD 2e Tilts. The effect
// text carries the Tilts' numbers (CofD 2e pp. 280-286), paraphrased. Arm and
// Leg Wrack come in Left / Right, since they affect one limb; Blinded and
// Deafened in one side / both, since the numbers differ. A character's
// conditions are stored as these names (plain strings, as the free-text list
// was), so older characters' typed conditions still load - the sheet keeps
// them as "custom" entries. Renamed entries are mapped by ALIASES.
//
// injures: avatar body parts (avatar-parts.js BODY_PARTS ids) shown as
// Damaged while the Condition is on the sheet.
// stats: what it does to Defense / Speed / Initiative (applyConditionStats).
//   halve: halved (rounded down), minus: reduced by, zero: no Defense,
//   set: fixed at, last: acts last in the turn.
// Most Tilt numbers are dice penalties to particular kinds of roll (sight-
// based, movement, Social...), which the sheet doesn't roll - those are in
// the effect text only.
export const CONDITIONS = [
  {
    name: 'Knocked Down',
    effect: "Swept to the ground and prone. You lose this turn's action if you haven't acted yet. Attacks made from the ground are at -2. Standing up takes an action. (Before acting, you can roll Dexterity + Athletics, minus the weapon's modifier, to avoid falling.)"
  },
  {
    name: 'Stunned',
    effect: 'You lose your next action, and your Defense is halved until you next act. Normally lasts one turn. You can spend 1 Willpower to act anyway, at -3 to that turn\'s actions.',
    injures: ['head'],
    stats: { defense: { halve: true } }
  },
  {
    name: 'Immobilized',
    effect: "Restrained: you can't take combat actions and get no Defense. If someone's holding you, 1 Willpower buys a head butt or similar. Escaping bindings: Strength + Athletics minus their Durability (-2 if arms and legs are bound, -4 if hogtied); each attempt costs 1 bashing damage.",
    stats: { defense: { zero: true } }
  },
  {
    name: 'Pinned',
    effect: "Your flesh or clothing is pinned to something; you're effectively stuck in place until freed."
  },
  {
    name: 'Arm Wrack (Left)',
    effect: "You drop whatever the left hand holds and can't attack with that arm. Without Ambidextrous, take the off-hand penalty on rolls needing manual dexterity. Both arms wracked: chance die on manual-dexterity rolls, -3 to other Physical actions. Ends when the damage that caused it heals.",
    injures: ['leftArm']
  },
  {
    name: 'Arm Wrack (Right)',
    effect: "You drop whatever the right hand holds and can't attack with that arm. Without Ambidextrous, take the off-hand penalty on rolls needing manual dexterity. Both arms wracked: chance die on manual-dexterity rolls, -3 to other Physical actions. Ends when the damage that caused it heals.",
    injures: ['rightArm']
  },
  {
    name: 'Leg Wrack (Left)',
    effect: 'Speed halved, -2 Defense, -2 to Physical rolls that involve moving. Both legs wracked: you fall (Knocked Down) and can\'t get up, Speed 1 (moving is your whole turn), chance die on movement rolls. Ends when the damage that caused it heals.',
    injures: ['leftLeg'],
    stats: { leg: true }
  },
  {
    name: 'Leg Wrack (Right)',
    effect: 'Speed halved, -2 Defense, -2 to Physical rolls that involve moving. Both legs wracked: you fall (Knocked Down) and can\'t get up, Speed 1 (moving is your whole turn), chance die on movement rolls. Ends when the damage that caused it heals.',
    injures: ['rightLeg'],
    stats: { leg: true }
  },
  {
    name: 'Blinded (One Eye)',
    effect: '-3 to every roll that relies on sight, attacks included, and Defense is halved. Thrown sand or dirt blinds for one turn; an injured eye stays blinded until the damage heals.',
    injures: ['head'],
    stats: { defense: { halve: true } }
  },
  {
    name: 'Blinded (Both Eyes)',
    effect: '-5 to every roll that relies on sight, attacks included, and no Defense. Thrown sand or dirt blinds for one turn; injured eyes stay blinded until the damage heals.',
    injures: ['head'],
    stats: { defense: { zero: true } }
  },
  {
    name: 'Deafened (One Ear)',
    effect: '-3 to hearing-based Perception rolls. Deafness from a loud noise lasts (10 - Stamina - Resolve) turns; an injured ear stays deaf until the damage heals.',
    injures: ['head']
  },
  {
    name: 'Deafened (Both Ears)',
    effect: 'Chance die on hearing-based Perception rolls, and -2 to all combat rolls. Deafness from a loud noise lasts (10 - Stamina - Resolve) turns; injured ears stay deaf until the damage heals.',
    injures: ['head']
  },
  {
    name: 'Ongoing Injury',
    effect: "You're on fire, poisoned, bleeding, etc.; you take damage every turn until it's cleared. Poison: 1 bashing a turn (moderate) or 1 lethal (grave); resist each turn with Stamina + Resolve as a reflexive action (-3 if you also act), a success stopping that turn's damage.",
    injures: ['torso']
  },
  {
    name: 'Weakened',
    effect: 'Impaired by disease, drugs, or head trauma. Disease (Sick): -1 to all combat actions, worsening by 1 every two turns to -5; a grave illness also deals 1 bashing a turn while you fight. Drugs (Drugged): -3 to all combat rolls including Defense and Perception, -2 Speed, wound penalties ignored, lasting (10 - Stamina - Resolve) hours.'
  },
  {
    name: 'Confused',
    effect: "A panic attack or psychotic break. +1 to combat rolls, -3 to Social rolls, you act last in the turn, and you can't spend Willpower in combat. Usually ends with the scene; to snap out of it, spend your action rolling Resolve + Composure against (10 - Willpower), with no Defense that turn.",
    stats: { initiative: { last: true } }
  },
  {
    name: 'Defeated',
    effect: 'Your will to fight is exhausted. Each violent action costs 1 Willpower (running, dodging and Defense are free). Surrendering - giving the attacker what they want - regains 1 Willpower and a Beat, but you take no further part in the fight.'
  }
];

// Former names -> current ones, for characters saved before the split.
const ALIASES = {
  Blinded: 'Blinded (One Eye)',
  Deafened: 'Deafened (One Ear)'
};

const BY_NAME = new Map(CONDITIONS.map((c) => [c.name, c]));

export function canonicalCondition(name) {
  return ALIASES[name] || name;
}

export function findCondition(name) {
  return BY_NAME.get(canonicalCondition(name)) || null;
}

function activeConditions(conditionNames) {
  const seen = new Set();
  const list = [];
  for (const name of conditionNames || []) {
    const condition = findCondition(name);
    if (condition && !seen.has(condition.name)) {
      seen.add(condition.name);
      list.push(condition);
    }
  }
  return list;
}

// body part id -> names of the Conditions on the sheet that injure it.
export function conditionInjuries(conditionNames) {
  const injuries = new Map();
  for (const condition of activeConditions(conditionNames)) {
    for (const part of condition.injures || []) {
      if (!injuries.has(part)) injuries.set(part, []);
      injuries.get(part).push(condition.name);
    }
  }
  return injuries;
}

// The derived stats with the Conditions on the sheet applied:
// { defense, speed, initiative } each as { base, value, reasons: [..] }
// (value is a number, or 'Last' for initiative). reasons name the
// Conditions that changed it. Order: no Defense beats everything; otherwise
// halving (once, however many halve it) then subtractions; floor 0.
export function applyConditionStats(conditionNames, base) {
  const active = activeConditions(conditionNames);
  const result = {
    defense: { base: base.defense, value: base.defense, reasons: [] },
    speed: { base: base.speed, value: base.speed, reasons: [] },
    initiative: { base: base.initiativeMod, value: base.initiativeMod, reasons: [] }
  };

  const defense = { halve: [], minus: 0, minusBy: [], zero: [] };
  for (const c of active) {
    const d = c.stats && c.stats.defense;
    if (d && d.halve) defense.halve.push(c.name);
    if (d && d.zero) defense.zero.push(c.name);
    if (c.stats && c.stats.initiative && c.stats.initiative.last) {
      result.initiative.value = 'Last';
      result.initiative.reasons.push(`${c.name}: acts last`);
    }
  }

  const legs = active.filter((c) => c.stats && c.stats.leg).map((c) => c.name);
  if (legs.length) {
    // -2 Defense for a wracked leg; the book gives no extra for both.
    defense.minus = 2;
    defense.minusBy = legs;
    if (legs.length > 1) {
      result.speed.value = Math.min(1, base.speed);
      result.speed.reasons.push('Both legs wracked: Speed 1');
    } else {
      result.speed.value = Math.floor(base.speed / 2);
      result.speed.reasons.push(`${legs[0]}: halved`);
    }
  }

  if (defense.zero.length) {
    result.defense.value = 0;
    result.defense.reasons.push(`${defense.zero.join(', ')}: no Defense`);
  } else {
    let value = base.defense;
    if (defense.halve.length) {
      value = Math.floor(value / 2);
      result.defense.reasons.push(`${defense.halve.join(', ')}: halved`);
    }
    if (defense.minus) {
      value -= defense.minus;
      result.defense.reasons.push(`${defense.minusBy.join(', ')}: -${defense.minus}`);
    }
    result.defense.value = Math.max(0, value);
  }
  return result;
}
