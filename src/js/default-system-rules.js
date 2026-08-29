// Bundled as the System Rules tab's default content so the tab isn't empty
// on first launch - "Load Markdown File..." still overrides it with
// whatever the player/GM actually wants to reference instead.
export const DEFAULT_SYSTEM_RULES_FILENAME = 'CofD_Rules_Summary.md';

export const DEFAULT_SYSTEM_RULES = `# Chronicles Of Darkness — Modified Mechanics Summary

> Plain-language summary of rules and system mechanics extracted from the provided rules update document. No artwork or setting fiction included.

---

## Core Resolution

- **Dice pool:** Attribute + Skill (or other defined pool).
- **Target number:** Each die showing **8, 9, or 10** is a **success**.
- **10s explode:** Each 10 is rerolled; additional successes on those rerolls count.
- **Difficulty:** Typically, number of successes required is set by the Storyteller; many actions use **1 success** as the baseline.
- **Chance die:** If a pool would be 0 or less, roll a single die; only a 10 counts as a success (and may explode), while a 1 is a dramatic failure.

### Degrees of Success / Failure

- **Success:** Meet or exceed the required successes.
- **Exceptional Success:** Often **5+ successes** on a roll; may grant extra effects (Storyteller dependent).
- **Failure:** Fewer successes than required.
- **Dramatic Failure:** Rolling a 1 on a chance die, or other Storyteller-defined catastrophic failure; usually gives the Storyteller a strong complication.

---

## Willpower, Virtue, and Vice

### Willpower

- **Spending Willpower:** Players can spend Willpower to gain bonuses or resist effects (exact bonus is Storyteller-defined; commonly +3 to a roll or similar).
- **Regaining Willpower:** Tied to **Virtue** and **Vice** behavior in play.

### Virtue and Vice (Updated Guidance)

- **Vice:** Characters regain Willpower more easily by indulging their Vice. The update emphasizes:
  - Vice no longer needs to involve **significant risk**; small, frequent indulgences are acceptable.
  - Players should feel confident they can regain Willpower through normal play.
- **Virtue:** Fulfilling a Virtue is more meaningful and less frequent:
  - It shouldn't always be possible to fulfill a Virtue every session.
  - When a character meaningfully acts on their Virtue (especially at some cost or risk), they regain Willpower.
- Design intent: Keep **small Willpower gains trickling in** via Vice, while Virtue provides bigger, less frequent refreshes.

---

## Combat Overview

### Setup and Intent

- Before combat, **players and Storyteller describe what each character wants** out of the fight (goals, stakes).
- This helps frame when combat ends and what "winning" looks like beyond just reducing Health.

### Turn Structure (High Level)

- **Initiative:** Characters act in initiative order; each has an Initiative value and possibly an Initiative Modifier.
- On a turn, a character typically:
  - Moves.
  - Takes an action (attack, maneuver, use a power, etc.).
- Some conditions can cause a character to **lose their action** or act at penalties.

### Attack Rolls and Damage

- **Attack roll:** Attribute + Skill + modifiers vs. target's Defense and other modifiers.
- **Successes on attack:**
  - Compare net successes after modifiers to determine if the attack hits.
  - Damage is based on **weapon modifier + net successes** (exact formula is Storyteller-implemented, but the document indicates using successes to determine damage points).
- **Damage type:** Most weapons in this update deal **lethal damage**.

### Possible Combat Modifiers

Examples listed in the document include:

- **Autofire:**
  - **Long burst:** ~20 bullets, no strict target limit (Storyteller approval); **+3** to each attack roll; **-1 per additional target** after the first.
  - **Medium burst:** ~10 bullets at 1-3 targets; **+2** to each roll; **-1 per additional target**.
  - **Short burst:** 3 bullets at a single target; **+1** to the roll.
- **Cover:** Subtract the cover's **Durability** from damage; if Durability exceeds the weapon's modifier, the attack has no effect.
- **Firing from concealment:** Shooter's concealment quality (-1, -2, or -3) is reduced by one as a penalty to fire back (so: no modifier, -1, or -2).
- **Shooting into close combat:**
  - **-2** per combatant avoided in a single shot (not applicable to autofire).
  - **-4** if grappling or similarly entangled.
- **Specified target:**
  - Torso: **-1**
  - Leg or arm: **-2**
  - Head: **-3**
  - Hand: **-4**
  - Eye: **-5**

### Surprise and First Turn

- Characters who are **surprised**:
  - Lose their action on the first turn of combat.
  - Cannot apply **Defense** against attacks in that first turn.

---

## Weapons and Combat Stats

### Ranged Weapons

The document includes tables for firearms with stats such as:

- **Range bands:** Short / Medium / Long (in yards).
  - Attacks at **medium range**: **-1** penalty.
  - Attacks at **long range**: **-2** penalty.
- **Capacity:** Number of rounds a gun can hold; "+1" indicates a round can be chambered.
- **Accuracy / penalty:** Some weapons carry inherent penalties (e.g., **-1** on attack rolls).
- **Hands / concealment:**
  - **1:** Can be fired one-handed; more easily concealed.
  - **2:** Must be fired two-handed; can be hidden in a coat.
  - **3:** Larger, harder to conceal; typically two-handed.
- **Autofire capability:** Marked weapons can perform short, medium, and long bursts.

Example weapon types referenced:

- **HK MP-5 (9mm)** — Rifle class, autofire-capable.
- **Assault Rifles** — Autofire-capable, with specific range and capacity stats.

### Melee and Improvised Weapons

- Weapons are classified by **type** (e.g., blunt, edged, improvised).
- Example melee items include:
  - **Brass knuckles**
  - **Knives**
- Modifiers reflect:
  - Damage potential.
  - Penalties for certain uses or conditions.
- **Improvised weapons:** A general classification for anything picked up (e.g., a metal pipe).
  - Often carry a **-1 penalty** on attack rolls compared to proper weapons.

### Special Weapon Tags

Common tags/properties mentioned:

- **Concealed:** Affects how easily the weapon can be hidden; may also influence modifiers when attacking from concealment.
- **Grapple:** Weapons or attacks that interact with grappling rules.
- **Stun:** Attacks intended to incapacitate rather than kill (Storyteller-defined effects).
- **Two-handed:** Requires both hands to use effectively.

---

## Armor and Protection

- **Armor types:** Include items like **Kevlar vests** and potentially helmets.
- **Protection mechanics:**
  - Armor protects specific **body areas**.
  - Unless an attacker targets a specific **unarmored location** (via "Specified Targets" rules), the armor's protection applies.
  - Wearing a **helmet** increases the armor's protection for the head.
- Armor effectively reduces incoming damage according to its rating and coverage.

---

## Health, Injury, and Conditions

### Health and Damage

- Characters have a **Health track** (number of boxes/levels).
- Damage reduces Health; when Health is depleted, the character is taken out (knocked out, severely injured, or dead, depending on damage type and Storyteller ruling).
- **Lethal damage** is more serious than bashing; rules here focus heavily on lethal damage from weapons.

### Injury Conditions

The document references various conditions and environmental effects, such as:

- **Knocked Down:**
  - Imposes penalties on Physical rolls and movement.
  - Severe leg injuries can cause Knocked Down status and ongoing damage.
- **Flooding / water:**
  - Penalties to Physical dice pools per foot of flooding.
  - Once water is over the head, the character must swim or risk drowning.
- **Wind and noise:**
  - Wind severity acts as a penalty to certain rolls (e.g., aural Perception).
- **Driving in bad conditions:**
  - Dramatic failure can cause Knocked Down or loss of vehicle control; Drive rolls suffer penalties.

---

## Status, Merits, and Organizational Influence

### Status Merits

- **Status** represents a character's rank and influence within an organization (police, cults, secret societies, etc.).
- Dot rating reflects **relative influence and respect**, not just job title.
- Example: A character might have **2-4 dots of Police Status**, indicating their clout within law enforcement.

#### Common Status Examples

- **Police Status:** "Rank and file" vs. higher ranks; dots show influence.
- **Status: Hellfire Club** or similar groups: Indicates membership and standing in supernatural or secret organizations.

### Initiation Benefits

Certain organizations grant **initiation benefits**, such as:

- Free or discounted **Merits** reflecting contacts and resources:
  - **Allies**, **Resources**, **Retainers**, or similar.
- Skill or knowledge boons:
  - Bonus dots in relevant Skills (e.g., **Politics**).
  - Specialized knowledge Merits (e.g., a modified **Encyclopedic Knowledge** tied to the God-Machine's influence).
- Thematic benefits:
  - Training to better detect or resist the God-Machine's influence.
  - Access to technological weapons or specialized equipment.

---

## Supernatural Entities and Binding

- Entities (spirits, angels, God-Machine-related beings, etc.) have a **Rank**.
- **Rank effects:**
  - Each Rank levies a **-1 modifier** on attempts to forcibly bind that entity.
  - Rank also functions as a form of **Supernatural Tolerance** (resistance to certain effects).
- Binding and influencing such entities uses specialized rules (Influence, rituals, etc.), with difficulty scaling by Rank.

---

## "My Character Kills" — Moral and Psychological Mechanics

The document includes a section titled **"My Character Kills"**, addressing how killing affects characters:

- The Storyteller may apply **modifiers** to rolls based on the nature of the killing.
- Example modifiers:
  - **Killing in self-defense:** Positive modifier (less psychological trauma).
  - **Killing by accident** (e.g., car wreck): Different modifier, reflecting unintended death.
- These mechanics model guilt, trauma, and moral stress, influencing future rolls, behavior, or degeneration checks (Storyteller implementation).

---

## Environmental and Situational Rules

The update references various environmental hazards and situational modifiers:

- **Extreme temperatures:**
  - Sweltering sun can cause burns and heat stress.
  - Cold exposure risks hypothermia.
- **Flooding, wind, and visibility:** Affect Perception, movement, and combat.
- **Driving and vehicles:**
  - Poor conditions impose penalties on Drive rolls.
  - Dramatic failures can lead to crashes or loss of control.

---

## Practical Play Guidance

- **Flexibility:** Many rules are presented as frameworks; Storytellers are expected to adapt:
  - Asset Skills, Status benefits, and Merits can be tuned to fit the campaign.
  - Example: A police officer character might emphasize **Politics** and **Intimidation** over more rural Skills like **Animal Ken** or **Survival**.
- **Focus on fiction:** Mechanical choices (Willpower awards, combat goals, moral modifiers) should reflect the story and character arcs, especially around the God-Machine's influence.

---

## How to Use This Summary

- Treat this as a **mechanics reference** for running or playing in a God-Machine-themed World of Darkness game.
- For exact numbers (e.g., specific weapon stats, full Merit lists, full armor tables), consult the original document; this summary captures the structure and intent rather than reproducing every table.
- When in doubt, default to standard **World of Darkness / Chronicles of Darkness** core rules and layer these updates on top (especially for Willpower/Vice/Virtue, combat modifiers, Status, and entity binding).

---
`;
