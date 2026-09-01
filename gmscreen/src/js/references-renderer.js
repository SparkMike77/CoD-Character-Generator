import { renderMarkdown } from './markdown.js';
import { DEFAULT_SYSTEM_RULES, DEFAULT_SYSTEM_RULES_FILENAME } from './default-system-rules.js';
import { DEFAULT_GAME_SETTING, DEFAULT_GAME_SETTING_FILENAME } from './default-game-setting.js';
import { DEFAULT_COMBAT_RULES, DEFAULT_COMBAT_RULES_FILENAME } from './default-combat-rules.js';

function activateTab(pageId) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === pageId));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === pageId));
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn.dataset.page));
  });
}

function initRulesPane(prefix, defaultDoc) {
  const loadBtn = document.getElementById(`${prefix}-load`);
  const filenameEl = document.getElementById(`${prefix}-filename`);
  const contentEl = document.getElementById(`${prefix}-content`);
  if (!loadBtn || !filenameEl || !contentEl) return;

  if (defaultDoc) {
    filenameEl.textContent = `${defaultDoc.filename} (built-in)`;
    contentEl.innerHTML = renderMarkdown(defaultDoc.content);
  }

  loadBtn.addEventListener('click', async () => {
    if (!window.referencesApi) return;
    const result = await window.referencesApi.openMarkdownFile();
    if (!result) return;
    filenameEl.textContent = result.filePath.split(/[\\/]/).pop();
    contentEl.innerHTML = renderMarkdown(result.content);
  });
}

initTabs();
initRulesPane('system-rules', { filename: DEFAULT_SYSTEM_RULES_FILENAME, content: DEFAULT_SYSTEM_RULES });
initRulesPane('game-setting', { filename: DEFAULT_GAME_SETTING_FILENAME, content: DEFAULT_GAME_SETTING });
initRulesPane('combat-rules', { filename: DEFAULT_COMBAT_RULES_FILENAME, content: DEFAULT_COMBAT_RULES });
