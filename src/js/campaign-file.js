// Campaigns need a stable identity and a version number that travels with
// the file itself (not just as transport metadata), since a .md file can
// be handed around outside of GMScreen entirely (copied, emailed, etc.)
// and still needs to self-describe when a client eventually sees it. A
// tiny YAML-like frontmatter block does that without meaning the GM ever
// has to look at it - it's stripped before the body reaches the editor.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseCampaignFile(raw) {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    return { campaignId: null, version: null, body: raw };
  }

  const fields = {};
  match[1].split('\n').forEach((line) => {
    const sep = line.indexOf(':');
    if (sep === -1) return;
    fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  });

  const version = Number(fields.version);
  return {
    campaignId: fields.campaign_id || null,
    version: Number.isFinite(version) ? version : null,
    body: match[2]
  };
}

function serializeCampaignFile({ campaignId, version, body }) {
  return `---\ncampaign_id: ${campaignId}\nversion: ${version}\n---\n${body}`;
}

function extractChronicleName(body) {
  const match = /^#\s+(.+)$/m.exec(body);
  return match ? match[1].trim() : 'Untitled Chronicle';
}

const TRACKED_RESOURCE_RE = /^Tracked Resource:\s*(.+)$/i;
const TRAIT_LABEL_RE = /^Trait Label:\s*(.+)$/i;

// Every "### X" heading nested directly under the "## Species" section is
// one selectable species - collected up to the next "## " section or EOF.
// A species' body may contain a "Tracked Resource: <name>" line, which
// names its splat-specific dot pool (Blood Pool, Rage, Swarm, ...) -
// trackedResource is null when a species doesn't define one. It may also
// contain a "Trait Label: <name>" line renaming the sheet's supernatural
// trait list (default "Features") to something like Disciplines or Gifts -
// traitLabel is null when a species doesn't rename it.
function extractSpeciesList(body) {
  const lines = body.split(/\r?\n/);
  const speciesHeadingIdx = lines.findIndex((line) => /^##\s+Species\s*$/i.test(line));
  if (speciesHeadingIdx === -1) return [];

  const species = [];
  let current = null;
  for (let i = speciesHeadingIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const headingMatch = /^###\s+(.+)$/.exec(line);
    if (headingMatch) {
      current = { name: headingMatch[1].trim(), trackedResource: null, traitLabel: null };
      species.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    const resourceMatch = TRACKED_RESOURCE_RE.exec(trimmed);
    if (resourceMatch) current.trackedResource = resourceMatch[1].trim();
    const traitMatch = TRAIT_LABEL_RE.exec(trimmed);
    if (traitMatch) current.traitLabel = traitMatch[1].trim();
  }
  return species;
}

module.exports = { parseCampaignFile, serializeCampaignFile, extractChronicleName, extractSpeciesList };
