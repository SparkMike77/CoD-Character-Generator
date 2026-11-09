import { renderMarkdown } from './markdown.js';
import { DEFAULT_SYSTEM_RULES, DEFAULT_SYSTEM_RULES_FILENAME } from './default-system-rules.js';
import { GAME_SETTINGS, DEFAULT_GAME_SETTING_ID } from './default-game-setting.js';
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

// The Game Setting tab shows one of the bundled settings (Modern,
// Apocalypse), following the open campaign's "Setting:" line, or picked by
// hand; "Load Markdown File..." can still show any other file in its place.
function showGameSetting(id) {
  const setting = GAME_SETTINGS.find((s) => s.id === id) || GAME_SETTINGS.find((s) => s.id === DEFAULT_GAME_SETTING_ID);
  document.getElementById('game-setting-choice').value = setting.id;
  document.getElementById('game-setting-filename').textContent = `${setting.filename} (built-in)`;
  document.getElementById('game-setting-content').innerHTML = renderMarkdown(setting.content);
}

// setting: the campaign's extractSetting() value, or null (tab left as is).
function applyCampaignSetting(setting) {
  if (!setting) return;
  const match = GAME_SETTINGS.find((s) => s.id === setting || s.label.toLowerCase() === setting);
  if (match) showGameSetting(match.id);
}

function initGameSettingPane() {
  const select = document.getElementById('game-setting-choice');
  GAME_SETTINGS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => showGameSetting(select.value));
  showGameSetting(DEFAULT_GAME_SETTING_ID);
  initRulesPane('game-setting');
  if (window.referencesApi) {
    window.referencesApi.getCampaignSetting().then(applyCampaignSetting);
    window.referencesApi.onCampaignSetting(applyCampaignSetting);
  }
}

initTabs();
initRulesPane('system-rules', { filename: DEFAULT_SYSTEM_RULES_FILENAME, content: DEFAULT_SYSTEM_RULES });
initGameSettingPane();
initRulesPane('combat-rules', { filename: DEFAULT_COMBAT_RULES_FILENAME, content: DEFAULT_COMBAT_RULES });
