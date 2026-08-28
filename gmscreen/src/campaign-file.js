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

// Every "### X" heading nested directly under the "## Species" section is
// one selectable species - collected up to the next "## " section or EOF.
function extractSpeciesList(body) {
  const lines = body.split(/\r?\n/);
  const speciesHeadingIdx = lines.findIndex((line) => /^##\s+Species\s*$/i.test(line));
  if (speciesHeadingIdx === -1) return [];

  const names = [];
  for (let i = speciesHeadingIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const match = /^###\s+(.+)$/.exec(line);
    if (match) names.push(match[1].trim());
  }
  return names;
}

module.exports = { parseCampaignFile, serializeCampaignFile, extractChronicleName, extractSpeciesList };
