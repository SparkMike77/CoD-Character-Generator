#!/usr/bin/env node
// Builds the Game Setting tab's bundled settings (Modern, Apocalypse) from
// the setting notes in the GM's Obsidian vault. Each setting comes as two
// guides:
//
//   - the Player's Guide, bundled into the Character Manager
//     (src/js/default-game-setting.js), and
//   - the Storyteller's Guide (everything, secrets included), bundled only
//     into GMScreen (gmscreen/src/js/default-game-setting.js), which also
//     gets the Player's Guide so the GM can see what players see.
//
//   npm run game-settings -- "<vault>/Projects/Zero Day"
//
// Each setting is a list of notes (SETTINGS below), joined in order: every
// note becomes a "## <title>" section with its own headings pushed down a
// level. Obsidian [[links]] become plain text, and the italic notes-to-self
// at the top of notes ("*Draft with Claude...*", "*Part of [[...]]*") are
// dropped. Empty notes are skipped. Re-run it whenever the vault changes.
//
// Marking Storyteller-only content in the vault:
//   - any note inside a "Storyteller" folder;
//   - a heading containing "(Storyteller)" or "for the GM", or starting
//     with "Open threads": the whole section, down to the next heading of
//     the same or a higher level;
//   - a "> [!storyteller]" callout block;
//   - per note, `playerOmit` below: headings left out of the Player's
//     Guide for that setting only (e.g. the Modern timeline's future).

const fs = require('fs');
const path = require('path');

const DEFAULT_VAULT = 'c:/vscode/obsidian-vault/Projects/Zero Day';
const ROOT = path.join(__dirname, '..');
const PLAYER_OUT = 'src/js/default-game-setting.js';
const GM_OUT = 'gmscreen/src/js/default-game-setting.js';

const MODERN_ST = 'Modern/Storyteller';

// [title, path within the Zero Day folder, options?]
const SETTINGS = [
  {
    id: 'modern',
    label: 'Modern',
    title: 'Zero Day: Modern',
    intro: 'Around 2030. The Changed are few, hidden and on the run.',
    notes: [
      ['Setting and Tone', 'Modern/Setting and Tone.md'],
      ['Timeline', 'Timeline.md', { playerOmit: ['Between the settings', 'The Apocalypse era'] }],
      ['Beginnings', 'Modern/Beginnings.md'],
      ['Your First Character', 'Modern/Your First Character.md'],
      ['The Great Lakes Cluster', 'Modern/The Great Lakes Cluster.md'],
      ['Windsor–Detroit', 'Modern/Windsor-Detroit/Windsor-Detroit.md'],
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
      ['Windsor–Detroit: Marigold', `${MODERN_ST}/Windsor-Detroit/Marigold.md`],
      ['Windsor–Detroit: The Actuaries', `${MODERN_ST}/Windsor-Detroit/The Actuaries.md`],
      ['Windsor–Detroit: The Bridge Trolls', `${MODERN_ST}/Windsor-Detroit/The Bridge Trolls.md`],
      ['Adventure: First Fever', `${MODERN_ST}/First Fever/First Fever.md`],
      ['First Fever, Scene 1: Before', `${MODERN_ST}/First Fever/First Fever 1 - Before.md`],
      ['First Fever, Scene 2: Ward 4 East', `${MODERN_ST}/First Fever/First Fever 2 - Ward 4 East.md`],
      ['First Fever, Scene 3: Expedited Discharge', `${MODERN_ST}/First Fever/First Fever 3 - Expedited Discharge.md`],
      ['First Fever, Scene 4: The Crossing', `${MODERN_ST}/First Fever/First Fever 4 - The Crossing.md`],
      ['First Fever, Scene 5: The Toll Booth', `${MODERN_ST}/First Fever/First Fever 5 - The Toll Booth.md`],
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

const GUIDES = [
  { id: 'player', label: "Player's Guide", storyteller: false },
  { id: 'storyteller', label: "Storyteller's Guide", storyteller: true }
];

const NOTE_TO_SELF_RE = /^\*(?:(?:Draft|Stub|Realigned)\b[^\n]*Claude[^\n]*|Part of \[\[[^\n]*)\*\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;
const ST_MARK_RE = /\s*\(storyteller\)\s*/i;
const CALLOUT_START_RE = /^>\s*\[!storyteller\][+-]?\s*(.*)$/i;

function isStorytellerHeading(text, playerOmit) {
  return ST_MARK_RE.test(text) || /for the gm/i.test(text) || /^open threads/i.test(text) ||
    playerOmit.includes(text.trim());
}

// Drops (Player's Guide) or keeps and unmarks (Storyteller's Guide) the
// Storyteller-only sections and callouts of one note.
function filterNote(lines, { storyteller, playerOmit = [] }) {
  const out = [];
  let skipLevel = 0; // inside a Storyteller-only section of this level
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (skipLevel && level <= skipLevel) skipLevel = 0;
      if (!skipLevel && !storyteller && isStorytellerHeading(heading[2], playerOmit)) skipLevel = level;
    }
    if (skipLevel) continue;

    const callout = CALLOUT_START_RE.exec(line);
    if (callout) {
      const body = [];
      while (i + 1 < lines.length && /^>/.test(lines[i + 1])) body.push(lines[++i]);
      if (storyteller) {
        out.push(`> **Storyteller${callout[1] ? `: ${callout[1]}` : ''}**`, ...body);
      }
      continue;
    }

    out.push(heading && storyteller ? line.replace(ST_MARK_RE, ' ').trimEnd() : line);
  }
  return out;
}

function convertNote(raw, options) {
  let lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines = lines.filter((line) => !NOTE_TO_SELF_RE.test(line.trim()));
  // A note's own top-level title is replaced by the section title.
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first !== -1 && /^#\s/.test(lines[first])) lines.splice(first, 1);
  lines = filterNote(lines, options);
  let text = lines
    .map((line) => line.replace(/^(#{1,5})(\s)/, '#$1$2'))
    .join('\n')
    // [[Target#Anchor|Label]] -> Label, [[Target#Anchor]] -> Target
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]#]+)(#[^\]]*)?\]\]/g, '$1');
  // Leading/trailing rules and blank lines are just Obsidian note framing.
  text = text.replace(/^(\s*---\s*\n)+/, '').replace(/(\n\s*---\s*)+\s*$/, '');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function buildGuide(vault, setting, guide) {
  const parts = [`# ${setting.title} — ${guide.label}`, `*${setting.intro}*`];
  for (const [title, rel, opts = {}] of setting.notes) {
    const storytellerNote = rel.split('/').includes('Storyteller');
    if (storytellerNote && !guide.storyteller) continue;
    const file = path.join(vault, rel);
    if (!fs.existsSync(file)) {
      console.warn(`  missing, skipped: ${rel}`);
      continue;
    }
    const body = convertNote(fs.readFileSync(file, 'utf8'), { storyteller: guide.storyteller, playerOmit: opts.playerOmit });
    if (!body) continue;
    parts.push('---', `## ${title}`, body);
  }
  return {
    id: guide.id,
    label: guide.label,
    filename: `${setting.title.replace(/[^A-Za-z]+/g, '_')}_${guide.id === 'player' ? 'Players' : 'Storytellers'}_Guide.md`,
    content: `${parts.join('\n\n')}\n`
  };
}

function writeModule(out, settings, note) {
  const source = `// GENERATED by scripts/build-game-settings.js from the Zero Day setting notes
// - don't edit by hand; edit the notes and re-run \`npm run game-settings\`.
//
// The Game Setting tab's bundled settings, ${note}. A campaign picks one
// with a "Setting: <label>" line (see campaign-file.js extractSetting).

export const GAME_SETTINGS = ${JSON.stringify(settings, null, 2)};

export const DEFAULT_GAME_SETTING_ID = 'modern';
`;
  fs.writeFileSync(path.join(ROOT, out), source);
}

const vault = process.argv[2] || DEFAULT_VAULT;
if (!fs.existsSync(vault)) {
  console.error(`Setting folder not found: ${vault}`);
  process.exit(1);
}
const built = SETTINGS.map((s) => ({ id: s.id, label: s.label, guides: GUIDES.map((g) => buildGuide(vault, s, g)) }));
writeModule(PLAYER_OUT, built.map((s) => ({ ...s, guides: s.guides.filter((g) => g.id === 'player') })),
  "Player's Guides only - the Storyteller's Guides are bundled only into GMScreen");
writeModule(GM_OUT, built, "Player's and Storyteller's Guides");
for (const s of built) for (const g of s.guides) console.log(`${s.label} ${g.label}: ${g.content.length} characters`);
