// Bundled as the Game Setting tab's default content so the tab isn't empty
// on first launch - "Load Markdown File..." still overrides it with
// whatever the player/GM actually wants to reference instead.
export const DEFAULT_GAME_SETTING_FILENAME = 'Game_Setting.md';

export const DEFAULT_GAME_SETTING = `# The Changed

> Nanite-augmented survivors in a modern, conspiracy-driven Zero Day setting.
> Uses a *Chronicles of Darkness* 2e engine with a Vampire-style resource economy re-skinned as **Swarm**.

---

## Core Concept

**The Changed** are people whose bodies host self-replicating nanite swarms (SRNS). They can shape matter, reinforce their flesh, control drones, manipulate electricity, and read/interfere with electronic and bioelectric fields.

This power comes with:

- A limited, refreshable resource: **Swarm Points**.
- Visible or detectable **Tells**.
- **Exposure** risk: using abilities draws attention from corporations, governments, and other factions.

---

## Swarm Economy

### Swarm Resonance

- **Swarm Resonance (SR)**: 1–5 dots
  - Measures how deeply your body is integrated with the nanoswarm.
  - Determines:
    - Maximum Swarm Points you can hold.
    - Maximum Aptitude dot level you can use.
    - How many passive effects you can sustain.

**Suggested starting SR:** 1–2 (campaign-dependent).

### Swarm Pool

- **Maximum Swarm Points** = Swarm Resonance × 2
  (Alternative: SR + Stamina, if you want a more physical tie-in.)

- **Current Swarm** starts equal to Maximum at character creation.

- **Regaining Swarm:**
  - Rest in a safe location with access to maintenance tech and/or large quantities of food.
  - Certain story events or faction support.

Swarm refresh should be **slow and risky** to preserve tension.

---

## Aptitudes

Each **Aptitude** represents a different expression of nanite capability. Think of them as skill trees.

- **Aptitude Dots:** • to •••••
  - Minimum **Swarm Resonance** = Aptitude dots to use that level.
  - Each dot unlocks:
    - The **Basic Trait** (free, always available with ≥1 dot in the Aptitude).
    - The **Passive Ability** at that dot level.
    - The **Active Ability** at that dot level.

- **Acquisition:**
  - At creation: characters get a limited number of Aptitude dots (e.g., 3 dots total, no higher than ••).
  - Later: buy with XP using Vampire-style scaling (e.g., 2/3/4/5/6 XP per dot).

### Structure per Aptitude

- **Basic Trait:** Free, always-on (or trivially usable) ability.
- **Passive Ability:** Sustained or always-on benefit, often limited by Aptitude dots or Swarm cost.
- **Active Ability:** Costs Swarm to activate; scales in power with Aptitude dots.

---

## The Five Aptitudes

### 1. Making

**Theme:** Matter analysis, reconfiguration, fabrication, deconstruction.

#### Basic Trait — Analyse (Free)

- By touching an object, learn its **chemical composition** and basic structure.
- Simple materials: no roll.
- Complex/exotic materials:
  - Roll **Intelligence + Science + Making**.
  - Success: learn key components, weaknesses, or fabrication requirements.
  - Exceptional success: also learn manufacturing tolerances or failure points.

#### Passive Ability — Schematics

- You can internally "store" the construction of complex objects.
- **Per Aptitude dot**, maintain **one schematic** in nanite memory.
  - Examples: a specific firearm, lock mechanism, drone, server layout.
- Benefits: **+1 die** on rolls to:
  - Repair that object.
  - Build a copy (with appropriate tools/materials).
  - Sabotage or bypass it.
- Swap schematics during downtime by studying a new object and overwriting an old one.

**Scaling:**
- •: 1 schematic
- ••: 2 schematics
- •••: 3 schematics
- ••••: 4 schematics
- •••••: 5 schematics

No Swarm cost; limit is by Aptitude dots.

#### Active Ability — Making

- **Effect:** Reshape/reconstruct matter by rearranging atoms/molecules. Can build or break.
- **Cost:** 1 Swarm per **1 kg** of material affected.
- **Action:** Extended for large/complex changes; instant for simple reshaping.
- **Dice Pool:** Intelligence + Crafts (or Science) + Making
- **Range:** Touch (or very short range).

**Scaling by Aptitude dot:**

- **•:**
  - Up to 1 kg per Swarm.
  - Simple reshaping only (bend metal, fuse broken pieces, crack a lock).
  - Cannot change material type.

- **••:**
  - Up to 2 kg per Swarm.
  - Alter material properties slightly (harden/soften, make brittle/flexible).
  - Repair broken objects with enough mass/time.

- **•••:**
  - Up to 3 kg per Swarm.
  - Transmute between similar materials (steel ↔ iron, plastic ↔ rubber-like polymer).
  - Fabricate simple devices from raw material if you have a schematic.

- **••••:**
  - Up to 4 kg per Swarm.
  - Create/repair complex devices (electronics, weapons) given raw materials, time, and a schematic.
  - Efficiently deconstruct objects into usable components.

- **•••••:**
  - Up to 5 kg per Swarm.
  - Near-miraculous fabrication: advanced tech, heavily damaged gear, or disintegration.
  - Can replicate restricted/black-tech items with schematic and resources.

**Limits / Risks:**
- Leaves nanite residue; can increase Exposure if analyzed.
- Dramatic failure: structural flaw, unstable material, or nanite feedback (Condition like **Nano-Sick** or **Unstable Construct**).

---

### 2. Shaping

**Theme:** Body modification, reinforcement, weapon formation, physical augmentation.

#### Basic Trait — Enhancement (Free)

- **+1 to Strength** (or another physical Attribute, if preferred).
- Permanent, always-on while you have ≥1 dot in Shaping.
- No Swarm cost.

#### Passive Ability — Nano-Reinforcement

- **Effect:** Damage resistance via nanite-reinforced tissues.
- **Sustain Cost:** 1 Swarm per scene while active.
- **Benefit:** Gain **Armor** against bashing and lethal damage.

**Scaling by Aptitude dot:**

- •: Armor 1
- ••: Armor 2
- •••: Armor 3
- ••••: Armor 4
- •••••: Armor 5

Toggle on/off as a reflexive action.

#### Active Ability — Shaping

- **Effect:** Temporarily reshape your body: form weapons, extend limbs, grow claws/blades, alter reach, etc.
- **Cost:** 1–3 Swarm depending on effect size/duration.
- **Action:** Instant for minor changes; turn-long for major transformations.
- **Dice Pool:** Stamina + Athletics + Shaping (combat) or Stamina + Expression (dramatic forms).

**Scaling by Aptitude dot:**

- **•:**
  - Cost 1 Swarm.
  - Simple natural weapons (claws, blades): **Strength + 1 bashing** (or lethal with story cost).
  - Minor limb extension (~0.5 m).

- **••:**
  - Cost 1–2 Swarm.
  - Weapons: **Strength + 2**; can shape shields/reinforced limbs (+1 Defense once per scene).
  - Limb extension up to ~1 m; unusual climbing/bracing.

- **•••:**
  - Cost 2 Swarm.
  - Weapons: **Strength + 3 lethal**; multi-tools (lockpicks, cutters).
  - Squeeze through tight spaces or brace against heavy impacts (once-per-scene damage reduction).

- **••••:**
  - Cost 2–3 Swarm.
  - Complex weapons (whips, multi-blades) or partial armor plating (+2 Armor for a scene).
  - Extend limbs several meters; "grapple" with your own body.

- **•••••:**
  - Cost 3 Swarm.
  - Near-monstrous transformations: multiple weapon limbs, massive reach, temporary "berserker" form.
  - May impose a Condition (e.g., **Loss of Control**) if overused.

**Tell:** Visible metallic sheen, shifting skin texture, or protruding nanite structures when active.

---

### 3. Animation

**Theme:** Enhanced perception, drone control, healing and tissue support.

#### Basic Trait — Focus (Free)

- Heightened sensitivity of existing senses.
- **+1 die** to **Wits + Investigation** or similar perception rolls when actively searching/observing.

#### Passive Ability — First Aid

- **Effect:** Nanite-assisted healing and short-term physiological support.
- **Sustain Cost:** 1 Swarm while active (per scene or per use).
- **Benefits:**
  - Stabilize dying characters automatically (no roll) if you can touch them.
  - Remove or reduce injury Conditions over time.
  - Provide short-term boosts (ignore pain, resist toxins) for yourself or others.

**Scaling by Aptitude dot:**

- **•:**
  - Remove **1 bashing** after a scene of care.
  - Stabilize a dying character once per scene.

- **••:**
  - Remove **2 bashing** or **1 lethal** after extended care.
  - Grant **+1 die** to resist pain, poison, or fatigue for a scene.

- **•••:**
  - Remove **3 bashing** or **2 lethal**, or suppress one injury Condition for a scene.
  - Can ignore a wound's penalties temporarily.

- **••••:**
  - Remove **4 bashing** or **3 lethal**, or fully suppress one injury Condition for a scene.
  - Grant **+2 dice** to resist pain/poison/fatigue.

- **•••••:**
  - Remove **all bashing** and **most lethal** over a longer period (extended action).
  - Temporarily override a severe Condition (e.g., **Bleeding Out**) for a scene.

**Tell:** Faint grey veins, glowing eyes, or nanite "mist" around wounds during healing.

#### Active Ability — Familiar

- **Effect:** Create tethered nanite drones ("familiars") with increasing capabilities.
- **Cost:** 1 Swarm per familiar activated; advanced forms cost 2.
- **Action:** Instant to deploy; minor reconfiguration may take a turn.
- **Dice Pool:** Wits + Science (or Technology) + Animation to control/coordinate complex tasks.

**Scaling by Aptitude dot:**

- **•:**
  - 1 small drone (bird/insect size).
  - Basic senses (visual/auditory feed).
  - Range: line of sight or ~100 m.

- **••:**
  - 1–2 drones, or 1 slightly larger drone.
  - Can carry tiny payloads (sensors, micro-tools).
  - Improved range and interference resistance.

- **•••:**
  - Up to 3 drones, or 1 medium drone with tools (manipulator arms, basic hacking interface).
  - Scout rooms, tag targets, deliver small items.

- **••••:**
  - Up to 4 drones, or 1 advanced drone with non-lethal options (taser, flash, smoke).
  - Coordinate as a sensor net; **+1 die** to perception/investigation when actively using them.

- **•••••:**
  - Up to 5 drones, or 1 highly capable multi-role drone.
  - Maintain a persistent "swarm eye" over an area for a scene.

**Limits:** Drones can be shot, hacked, or jammed. Losing one dramatically may impose a Condition or increase Exposure.

---

### 4. Lightning

**Theme:** Electrical manipulation, interference, power generation, shocks.

#### Basic Trait — Static (Free)

- You emit low-level EM "noise" that makes electronic detection harder.
- **-1 die** to rolls made to detect you via electronic sensors (cameras, motion detectors, RFID, etc.).
- Does not make you invisible, just harder to pick up cleanly.

#### Passive Ability — Charge

- **Effect:** Supply DC power to devices from your own nanite swarm.
- **Sustain Cost:** 1 Swarm while actively powering something significant.
- **Benefits:**
  - Power small electronics indefinitely while active.
  - Jump-start vehicles, bypass dead batteries, run tools without external power.

**Scaling by Aptitude dot:**

- **•:** Power **small devices** (phones, radios, handheld tools).
- **••:** Power **medium devices** (laptops, small appliances, medical equipment); run a small room's lighting/comms for a scene.
- **•••:** Power **large devices** (vehicles, server racks, heavy tools); act as a portable generator for a small base briefly.
- **••••:** Power **multiple large devices** simultaneously; can overload/surge a device intentionally.
- **•••••:** Act as a **mobile power plant** for a building/compound for a scene; can cause blackouts/surges in a local grid (major story effect, high Exposure risk).

#### Active Ability — Shock

- **Effect:** Deliver a taser-like electrical discharge at range or via touch.
- **Cost:** 1–3 Swarm depending on intensity.
- **Action:** Instant.
- **Dice Pool:** Dexterity + Athletics (ranged) or Dexterity + Brawl (melee) + Lightning.
- **Damage:** Primarily bashing; can escalate with higher dots and story justification.

**Scaling by Aptitude dot:**

- **•:**
  - Cost 1 Swarm.
  - Range: touch or 1–2 m arc.
  - Damage: **Strength + 1 bashing**, possible **Stunned** Condition.

- **••:**
  - Cost 1–2 Swarm.
  - Range: up to 5 m.
  - Damage: **Strength + 2 bashing**, stronger stun.

- **•••:**
  - Cost 2 Swarm.
  - Range: up to 10 m.
  - Damage: **Strength + 3 bashing**, can cause **Knocked Prone** or brief paralysis.

- **••••:**
  - Cost 2–3 Swarm.
  - Range: up to 15 m.
  - Damage: **Strength + 3 lethal** (with narrative cost) or heavy bashing with severe Conditions.

- **•••••:**
  - Cost 3 Swarm.
  - Range: up to 20 m, or small area burst.
  - Can disable electronics and fry nerves; major story impact, high Exposure.

**Tell:** Ozone smell, hair standing on end, visible arcs when discharging.

---

### 5. Sensing

**Theme:** Perception of bioelectric and electromagnetic fields, data extraction, disruption.

#### Basic Trait — Senses (Free)

- Detect both **biological** and **artificial** electric fields.
- Sense presence of living beings and active electronics within ~10–20 m.
- No roll for basic "something's there"; roll to pinpoint or identify.

#### Passive Ability — Decrypt

- **Effect:** Extract structured information from detected fields.
- **Sustain Cost:** 1 Swarm while actively decrypting/interpreting complex signals.
- **Benefits:** Turn raw EM/bioelectric "noise" into usable data: emotional states, device status, simple codes, etc.

**Scaling by Aptitude dot:**

- **•:**
  - Read **basic emotional states** (calm, stressed, afraid).
  - Tell if a device is on/off, transmitting/receiving.

- **••:**
  - Infer **intent cues** (lying, agitated, focused) with a roll.
  - Identify device type and basic function.

- **•••:**
  - Extract **simple data** from unsecured signals (IDs, basic commands, rough content).
  - Detect hidden/cloaked electronics with a roll.

- **••••:**
  - Decrypt **moderately secure** signals with time and a roll.
  - Map a room's electronic layout (cameras, mics, networks) quickly.

- **•••••:**
  - Break into **high-security** signals with extended action and risk.
  - Read deep bioelectric patterns (lie detection, trauma signatures, augmented vs natural).

#### Active Ability — Transmitter

- **Effect:** Hack, disrupt, or manipulate radio/WiFi/electronics and bioelectric fields.
- **Cost:** 1–3 Swarm depending on scope and security.
- **Action:** Instant for simple effects; extended for complex hacks.
- **Dice Pool:** Wits + Computer (or Technology) + Sensing.

**Scaling by Aptitude dot:**

- **•:**
  - Cost 1 Swarm.
  - Disrupt **consumer-grade** devices: glitch a camera, drop WiFi, reboot a phone.
  - Minor bioelectric nudge: startle someone, cause a twitch.

- **••:**
  - Cost 1–2 Swarm.
  - Disrupt **business-grade** systems: loop a camera feed, jam local comms for a scene.
  - Induce **distracted** or **disoriented** Condition via bioelectric interference.

- **•••:**
  - Cost 2 Swarm.
  - Hack **secured** consumer/small-corporate systems: open a smart lock, spoof credentials, temporarily control a drone.
  - Inflict **stun** or **pain** via bioelectric attack (bashing damage).

- **••••:**
  - Cost 2–3 Swarm.
  - Breach **corporate/military-lite** systems with time and a roll.
  - Cause **blackouts**, disable a room's electronics, or induce severe bioelectric shock (lethal with story justification).

- **•••••:**
  - Cost 3 Swarm.
  - Major hack: partial control of a facility's systems, blind a security network, or induce a seizure/heart event (heavy moral/Exposure cost).
  - Broadcast a "signal virus" that spreads through local devices for a scene.

**Tell:** Eyes flicker with faint light, headaches, nosebleeds when overused; electronics behave oddly around you.

---

## Character Creation

### Step 1: Determine Swarm Resonance

Choose a method:

- **Fixed:** All Changed start with Swarm Resonance 1 or 2.
- **Attribute-based:**
  - Example: **Swarm Resonance = 1 + (Stamina + Resolve) / 4**, rounded down, min 1, max 5.

### Step 2: Determine Swarm Pool

- **Maximum Swarm Points** = Swarm Resonance × 2
- **Current Swarm** = Maximum at creation.

### Step 3: Allocate Aptitude Dots

- Starting package (example):
  - **3 dots** of Aptitudes total.
  - No single Aptitude above **••** at creation.
  - Each dot buys:
    - Access to the Basic Trait (if first dot in that Aptitude).
    - The Passive and Active abilities at that dot level.

Players can mix Aptitudes freely (e.g., Making •, Shaping ••, Sensing •).

### Step 4: Choose Tells and Hooks

- Each Changed has at least one **Tell**: a visible or detectable sign of their alteration.
- Each should have a **story hook** tied to their nanites:
  - A faction that wants them.
  - A debt to a clinic or handler.
  - A missing test-subject peer.
  - A personal goal enabled or complicated by their abilities.

---

## Advancement (Experience)

Use CofD's Beat/XP system, with Vampire-style scaling for Aptitudes.

**Suggested costs:**

- **New Aptitude •:** 2 XP
- **Raise Aptitude • → ••:** 3 XP
- **Raise Aptitude •• → •••:** 4 XP
- **Raise Aptitude ••• → ••••:** 5 XP
- **Raise Aptitude •••• → •••••:** 6 XP

**Increase Swarm Resonance:**

- SR 1→2: 4 XP
- SR 2→3: 5 XP
- SR 3→4: 6 XP
- SR 4→5: 7 XP

Story prerequisites may apply (e.g., a major nanite upgrade event to raise SR).

---

## Exposure and Consequences

Using Swarm abilities, especially in public, risks **Exposure**:

- Increase Exposure when:
  - Using major Protocols in view of witnesses or sensors.
  - Leaving nanite residue, footage, or telemetry.
  - Suffering dramatic failures with visible/traceable effects.
  - Using illegal or unregulated nano-supplies.

- Exposure levels create Conditions, faction attention, and concrete complications (see your main Zero Day rules).

---

## Design Principles

- Technology and nanite abilities should create **interesting choices**, not erase obstacles.
- Every powerful effect should have:
  - A **cost** (Swarm, action, time).
  - A **limit** (range, duration, dice roll).
  - A **risk** (Exposure, Conditions, moral compromise).
- Normal humans must still be able to contribute meaningfully in the same scenes.

---

*This document is intended to be used alongside core Zero Day / Chronicles of Darkness rules. Alpha version 0.1a*
`;
