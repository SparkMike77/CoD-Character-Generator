// The starting content for File > New > Campaign. Kept as a plain markdown
// string (not a form/schema) because campaign files are meant to be hand-
// edited and human-readable - GMScreen just needs to be able to find these
// headings again later when it parses a campaign to configure a client.
const CAMPAIGN_TEMPLATE = `# New Chronicle

*Rename this heading to your Chronicle's name - Character Manager reads it as the Chronicle field.*

Fill in "Feature 1" through "Feature 6" below. They map to Character Manager's Virtue, Cell, Vice, Compact, Concept, and Conspiracy fields, in that order. Leave a heading's body blank to leave that field free-text for the player.

## Feature 1

## Feature 2

## Feature 3

## Feature 4

## Feature 5

## Feature 6

## Species

List every species playable in this Chronicle as its own heading below. Flavor text and any mechanical changes go in the body.

Each species can define a tracked resource - a dot pool unique to that
splat, like Blood Pool for Vampires or Rage for Werewolves. Add a line
"Tracked Resource: <name>" anywhere in the species' body to give Character
Manager the field's label. Leave it out if the species has no such pool.

### Human

The baseline. No changes from the core rules.

Tracked Resource: Luck

### Vampire

Tracked Resource: Blood Pool

### Werewolf

Tracked Resource: Rage

### Changed

Tracked Resource: Swarm
`;

module.exports = { CAMPAIGN_TEMPLATE };
