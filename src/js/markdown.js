// Minimal, dependency-free Markdown -> HTML renderer for the System Rules /
// Campaign Rules panes. Covers the subset that reference/rulebook content
// actually uses (headings, lists, tables, blockquotes, code fences, basic
// emphasis/links) rather than the full CommonMark spec. Raw HTML in the
// source is always escaped first, so loaded files can't inject markup.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Code spans are pulled out before other inline rules run (so markdown
// syntax inside `like this` isn't touched) and restored at the end via a
// control-character sentinel that escaped HTML text can never contain -
// unlike a plain-space placeholder, which could collide with ordinary
// numbers in the surrounding text (e.g. "Roll 0 dice").
const SENTINEL = String.fromCharCode(0);

function renderInline(escaped) {
  const codeSpans = [];
  let text = escaped.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `${SENTINEL}${codeSpans.length - 1}${SENTINEL}`;
  });

  // Titles are matched against &quot; rather than " because escapeHtml()
  // has already run on this text by the time these rules apply.
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g,
    (_, alt, url, title) => `<img alt="${alt}" src="${url}"${title ? ` title="${title}"` : ''} />`
  );
  text = text.replace(
    /\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g,
    (_, label, url, title) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${label}</a>`
  );

  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');

  text = text.replace(
    new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'),
    (_, i) => `<code>${codeSpans[Number(i)]}</code>`
  );
  return text;
}

const HR_RE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const ATX_RE = /^ {0,3}(#{1,6}) +(.*?) *#*$/;
const UL_RE = /^ {0,3}[-*+] +(.*)$/;
const OL_RE = /^ {0,3}\d+\. +(.*)$/;
const BQ_RE = /^ {0,3}> ?(.*)$/;
const FENCE_RE = /^ {0,3}```/;
const TABLE_SEP_RE = /^ {0,3}\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

export function renderMarkdown(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { type: 'ul' | 'ol', items: string[] }

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${renderInline(escapeHtml(para.join(' ')))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join('');
      out.push(`<${list.type}>${items}</${list.type}>`);
      list = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (FENCE_RE.test(line)) {
      flushPara();
      flushList();
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (line.trim() === '') {
      flushPara();
      flushList();
      i++;
      continue;
    }

    if (HR_RE.test(line) && !ATX_RE.test(line)) {
      flushPara();
      flushList();
      out.push('<hr />');
      i++;
      continue;
    }

    const atx = line.match(ATX_RE);
    if (atx) {
      flushPara();
      flushList();
      const level = atx[1].length;
      out.push(`<h${level}>${renderInline(escapeHtml(atx[2]))}</h${level}>`);
      i++;
      continue;
    }

    if (BQ_RE.test(line)) {
      flushPara();
      flushList();
      const bqLines = [];
      while (i < lines.length && BQ_RE.test(lines[i])) {
        bqLines.push(lines[i].match(BQ_RE)[1]);
        i++;
      }
      out.push(`<blockquote>${renderInline(escapeHtml(bqLines.join(' ')))}</blockquote>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      flushPara();
      flushList();
      const headerCells = splitTableRow(line);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headerCells
        .map((cell) => `<th>${renderInline(escapeHtml(cell))}</th>`)
        .join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(escapeHtml(cell))}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    const ul = line.match(UL_RE);
    const ol = line.match(OL_RE);
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul || ol)[1]);
      i++;
      continue;
    }

    flushList();
    para.push(line.trim());
    i++;
  }

  flushPara();
  flushList();

  return out.join('\n');
}
