// Bundled as the Combat Rules tab's default content so the tab isn't empty
// on first launch - "Load Markdown File..." still overrides it with
// whatever the player/GM actually wants to reference instead.
export const DEFAULT_COMBAT_RULES_FILENAME = 'Combat_Rules.md';

export const DEFAULT_COMBAT_RULES = `## Turn Structure and Initiative

Combat is broken into turns in initiative order:

- **Initiative roll**: 1d10 + Dexterity + Control (+ weapon Initiative modifier if you have a weapon readied).

- Characters act from highest Initiative to lowest each round.

- If you're surprised/ambushed and lose the contest, you may not act on the first turn and can't apply Defense.

Each character's turn in that order is their chance to act.

## Action Types (the "Action Economy")

CofD uses three main action categories in combat:

## 1. Instant Actions (Your Main Action)

- One Instant action per turn for almost everyone.

- This is your "big" action:

    - Throw a punch (Strength + Brawl)

    - Swing a weapon (Strength + Weaponry)

    - Shoot (Dexterity + Firearms)

    - Grapple, charge, use a supernatural power, etc.

- Most aimed, meaningful things in combat are Instant.

If you do an Instant action, that's basically your whole turn (plus movement).

## 2. Movement (Separate from Your Instant Action)

- You get your Speed in movement each turn in addition to your Instant action.

- You can:

    - Move up to your Speed and take an Instant action, or

    - Move up to double your Speed and skip your Instant action that turn.

So a typical turn is: move + one Instant action (attack, grapple, power, etc.).

## 3. Reflexive Actions (Free, but Limited)

- Reflexive actions "take no time" and don't use your turn.

- Examples:

    - Spending Willpower (+3 dice or +2 to a Resistance trait)

    - Rolling to resist poison, fear, certain powers, etc.

    - Some minor defensive or resource-spending actions (e.g., Quick Draw with the Merit)

- You can usually take multiple different Reflexive actions in a turn, but not repeat the same one unnaturally (e.g., you can't spend Willpower twice on the same roll).

Reflexives are how you "react" without burning your Instant action.

## Common Combat Actions (What You Can Do with Your Instant Action)

Typical Instant actions in a fight include:

- **Attack**

    - Unarmed: Strength + Brawl − target's Defense

    - Melee: Strength + Weaponry − target's Defense

    - Ranged: Dexterity + Firearms (range penalties apply)

    - Thrown: Dexterity + Athletics − target's Defense

- **All-Out Attack**: +2 to Brawl/Weaponry attack, but you lose Defense until your next turn.

- **Charge**: Move at 2× Speed and make a Brawl/Weaponry attack in one action; you lose Defense.

- **Aim**: Spend a turn aiming to gain +1 per turn (max +3) on your next attack.

- **Dodge** (defensive option):

    - Instead of attacking, you can Dodge: roll 2 × Defense as a dice pool against each attack that turn; each success cancels one of the attacker's successes.

    - This uses your Instant action; you're focusing on defense instead of offense.

- **Grapple / special maneuvers**: Initiating a grapple or similar close-combat maneuver is an Instant action.

- **Use powers / gifts / disciplines / arcs**: Most supernatural attacks or effects in combat are Instant actions.

## Defense and How It Interacts with Actions

- Defense is a derived stat (usually from Wits/Dexterity + Control/Composure, depending on edition/line) that is subtracted from attack dice pools by default.

- You normally keep your Defense every turn unless you:

    - Make an All-Out Attack (lose Defense), or

    - Charge (lose Defense), or

    - Are surprised/immobilized (Defense doesn't apply).

- If you choose to Dodge, you roll your Defense actively instead of just subtracting it.

## Example Turn

A typical PC turn might look like:

1. Move up to Speed toward the enemy.

2. Take an Instant action: make a melee attack (Strength + Weaponry − target's Defense).

3. Optionally spend Willpower as a Reflexive action to add +3 dice to that attack.

Or, defensively:

1. Move to get behind cover.

2. Take Dodge as your Instant action: roll 2 × Defense against incoming attacks this turn.

## Conditions

These are temporary status changes that a character can receive that impact their ability to fight. This list is based off the CofD "Tilts" mechanic.

- **Knocked Down** — You've been swept to the ground. You lose your action this turn (if not already taken) and are prone.

- **Stunned** — You're dazed and briefly incapacitated; you can't act normally for a short time.

- **Immobilized** — You're restrained or held in place; you can't move and are left open to attack.

- **Pinned** — Your flesh/clothing is pinned to something; you're effectively stuck until freed.

- **Arm Wrack** — One arm is incapacitated by pain/injury; attacks and actions using that arm are impaired.

- **Leg Wrack** — One leg is severely weakened/incapacitated; movement and related actions suffer.

- **Blinded** — Your vision is impaired or stripped; attacks that rely on sight are heavily penalized.

- **Deafened** — Your hearing is impaired; affects perception and some social/awareness rolls.

- **Ongoing Injury** — You're on fire, poisoned, bleeding, etc. you take rapid lethal damage each turn until condition is cleared.

- **Weakened** — You're impaired and weakened by disease, drugs, or head trauma; general penalties to actions and rolls.

- **Confused** — A panic attack or psychotic break; you act irrationally, often with combat bonuses/penalties and loss of control. You cannot act normally.

- **Defeated** — Your will or capacity to keep fighting is exhausted; often ends or limits further combat participation.
`;
