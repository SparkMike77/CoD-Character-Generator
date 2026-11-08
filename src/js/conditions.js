// The Conditions a character can have, as offered by the sheet's Conditions
// dropdowns, and which body parts each one visibly injures on the avatar.
//
// Names and effects follow the Conditions list in the Combat Rules
// (default-combat-rules.js). Arm and Leg Wrack come in Left / Right, since
// they affect one limb. A character's conditions are stored as these names
// (plain strings, as the free-text list was), so older characters' typed
// conditions still load - the sheet keeps them as "custom" entries.
//
// injures: avatar body parts (avatar-parts.js BODY_PARTS ids) shown as
// Damaged while the Condition is on the sheet.
export const CONDITIONS = [
  { name: 'Knocked Down', effect: "You've been swept to the ground. You lose your action this turn (if not already taken) and are prone." },
  { name: 'Stunned', effect: "You're dazed and briefly incapacitated; you can't act normally for a short time.", injures: ['head'] },
  { name: 'Immobilized', effect: "You're restrained or held in place; you can't move and are left open to attack." },
  { name: 'Pinned', effect: "Your flesh/clothing is pinned to something; you're effectively stuck until freed." },
  { name: 'Arm Wrack (Left)', effect: 'Your left arm is incapacitated by pain/injury; attacks and actions using that arm are impaired.', injures: ['leftArm'] },
  { name: 'Arm Wrack (Right)', effect: 'Your right arm is incapacitated by pain/injury; attacks and actions using that arm are impaired.', injures: ['rightArm'] },
  { name: 'Leg Wrack (Left)', effect: 'Your left leg is severely weakened/incapacitated; movement and related actions suffer.', injures: ['leftLeg'] },
  { name: 'Leg Wrack (Right)', effect: 'Your right leg is severely weakened/incapacitated; movement and related actions suffer.', injures: ['rightLeg'] },
  { name: 'Blinded', effect: 'Your vision is impaired or stripped; attacks that rely on sight are heavily penalized.', injures: ['head'] },
  { name: 'Deafened', effect: 'Your hearing is impaired; affects perception and some social/awareness rolls.', injures: ['head'] },
  { name: 'Ongoing Injury', effect: "You're on fire, poisoned, bleeding, etc.; you take rapid lethal damage each turn until the Condition is cleared.", injures: ['torso'] },
  { name: 'Weakened', effect: "You're impaired and weakened by disease, drugs, or head trauma; general penalties to actions and rolls." },
  { name: 'Confused', effect: 'A panic attack or psychotic break; you act irrationally, often with combat bonuses/penalties and loss of control. You cannot act normally.' },
  { name: 'Defeated', effect: 'Your will or capacity to keep fighting is exhausted; often ends or limits further combat participation.' }
];

const BY_NAME = new Map(CONDITIONS.map((c) => [c.name, c]));

export function findCondition(name) {
  return BY_NAME.get(name) || null;
}

// body part id -> names of the Conditions on the sheet that injure it.
export function conditionInjuries(conditionNames) {
  const injuries = new Map();
  for (const name of conditionNames || []) {
    const condition = BY_NAME.get(name);
    for (const part of (condition && condition.injures) || []) {
      if (!injuries.has(part)) injuries.set(part, []);
      if (!injuries.get(part).includes(name)) injuries.get(part).push(name);
    }
  }
  return injuries;
}
