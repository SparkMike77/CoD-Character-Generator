#!/usr/bin/env node
// Builds the Game Setting tab's bundled settings (Modern, Apocalypse) from
// the setting notes in the GM's Obsidian vault, and writes them to
// src/js/default-game-setting.js and its GMScreen copy.
//
//   npm run game-settings -- "<vault>/Projects/Zero Day"
//
// Each setting is a list of notes (SETTINGS below), joined in order: every
// note becomes a "## <title>" section with its own headings pushed down a
// level. Obsidian [[links]] become plain text, and the "*Draft by Claude...*"
// notes-to-self at the top of drafted notes are dropped. Empty notes are
// skipped. Re-run it whenever the vault notes change.

const fs = require('fs');
const path = require('path');

const DEFAULT_VAULT = 'c:/vscode/obsidian-vault/Projects/Zero Day';
const ROOT = path.join(__dirname, '..');
const OUTPUTS = ['src/js/default-game-setting.js', 'gmscreen/src/js/default-game-setting.js'];

// [title, path within the Zero Day folder]
const SETTINGS = [
  {
    id: 'modern',
    label: 'Modern',
    title: 'Zero Day: Modern',
    intro: 'Around 2030. The Changed are few, hidden and on the run.',
    notes: [
      ['Setting and Tone', 'Modern/Setting and Tone.md'],
      ['Timeline', 'Timeline.md'],
      ['Beginnings', 'Modern/Beginnings.md'],
      ['The Great Lakes Cluster', 'Modern/The Great Lakes Cluster.md'],
      ['Evolutionists', 'Modern/Organisations/Factions/Evolutionists.md'],
      ['The Resistance', 'Modern/Organisations/Factions/The Resistance.md'],
      ['The Lunatic Fringes', 'Modern/Organisations/Factions/The Lunatic Fringes.md'],
      ['Antagonists: Cabals', 'Modern/Organisations/Antagonists/Cabals.md'],
      ['Antagonists: Conspiracies', 'Modern/Organisations/Antagonists/Conspiracies.md'],
      ['Antagonists: Accidentals', 'Modern/Organisations/Antagonists/Accidentals.md'],
      ['Antagonists: Rivals', 'Modern/Organisations/Antagonists/Rivals.md'],
      ['Artificial Intelligence', 'Artificial Intelligence.md'],
      ['AI in the Modern Era', 'Modern/AI in the Modern Era.md'],
      ['Russia', 'Modern/World/Russia (Modern).md'],
      ['The Changed: Rules', 'Modern/Game Concepts.md']
    ]
  },
  {
    id: 'apocalypse',
    label: 'Apocalypse',
    title: 'Zero Day: Apocalypse',
    intro: 'The late 2050s, twenty years after Zero Day. The Changed are close to 2% of humanity.',
    notes: [
      ['Setting and Tone', 'Apocalypse/Apocalypse Setting and Tone.md'],
      ['Timeline', 'Timeline.md'],
      ['The Grey Death', 'Apocalypse/Story bible.md'],
      ['The Changed in the 2050s', 'Apocalypse/The Changed in the 2050s.md'],
      ['The World in the 2050s', 'Apocalypse/World/The World in the 2050s.md'],
      ['Climate', 'Apocalypse/World/Climate in the 2050s.md'],
      ['North America', 'Apocalypse/World/North America (2050s).md'],
      ['Europe', 'Apocalypse/World/Europe (2050s).md'],
      ['Africa', 'Apocalypse/World/Africa (2050s).md'],
      ['South America', 'Apocalypse/World/South America (2050s).md'],
      ['Asia', 'Apocalypse/World/Asia (2050s).md'],
      ['Middle East', 'Apocalypse/World/Middle East (2050s).md'],
      ['Australia', 'Apocalypse/World/Australia (2050s).md'],
      ['The Fractured Net', 'Apocalypse/The Fractured Net.md'],
      ['Artificial Intelligence', 'Artificial Intelligence.md'],
      ['AI in the 2050s', 'Apocalypse/AI in the 2050s.md'],
      ['Names', 'Apocalypse/Names.md'],
      ["Soren's School Journal", "Apocalypse/Articles/Soren's School Journal.md"],
      ['Game Principles', 'Apocalypse/Zero Day - Game Principles.md']
    ]
  }
];

const NOTE_TO_SELF_RE = /^\*(Draft|Stub|Realigned)\b[^\n]*Claude[^\n]*\*\s*$/;

function convertNote(raw) {
  let lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines = lines.filter((line) => !NOTE_TO_SELF_RE.test(line.trim()));
  // A note's own top-level title is replaced by the section title.
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first !== -1 && /^#\s/.test(lines[first])) lines.splice(first, 1);
  let text = lines
    .map((line) => line.replace(/^(#{1,5})(\s)/, '#$1$2'))
    .join('\n')
    // [[Target#Anchor|Label]] -> Label, [[Target#Anchor]] -> Target
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]#]+)(#[^\]]*)?\]\]/g, '$1');
  // Leading/trailing rules and blank lines are just Obsidian note framing.
  text = text.replace(/^(\s*---\s*\n)+/, '').replace(/(\n\s*---\s*)+\s*$/, '');
  return text.trim();
}

function build(vault) {
  return SETTINGS.map((setting) => {
    const parts = [`# ${setting.title}`, `*${setting.intro}*`];
    for (const [title, rel] of setting.notes) {
      const file = path.join(vault, rel);
      if (!fs.existsSync(file)) {
        console.warn(`  missing, skipped: ${rel}`);
        continue;
      }
      const body = convertNote(fs.readFileSync(file, 'utf8'));
      if (!body) continue;
      parts.push('---', `## ${title}`, body);
    }
    return {
      id: setting.id,
      label: setting.label,
      filename: `${setting.title.replace(/[^A-Za-z]+/g, '_')}.md`,
      content: `${parts.join('\n\n')}\n`
    };
  });
}

const vault = process.argv[2] || DEFAULT_VAULT;
if (!fs.existsSync(vault)) {
  console.error(`Setting folder not found: ${vault}`);
  process.exit(1);
}
const settings = build(vault);
const source = `// GENERATED by scripts/build-game-settings.js from the Zero Day setting notes
// - don't edit by hand; edit the notes and re-run \`npm run game-settings\`.
//
// The Game Setting tab's bundled settings. A campaign picks one with a
// "Setting: <label>" line (see campaign-file.js extractSetting).

export const GAME_SETTINGS = ${JSON.stringify(settings, null, 2)};

export const DEFAULT_GAME_SETTING_ID = 'modern';
`;
for (const out of OUTPUTS) fs.writeFileSync(path.join(ROOT, out), source);
for (const s of settings) console.log(`${s.label}: ${s.content.length} characters`);
