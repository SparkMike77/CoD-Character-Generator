let renameTimer = null;

function renderState(state) {
  const nameInput = document.getElementById('session-name-input');
  if (document.activeElement !== nameInput) nameInput.value = state.name;

  const pinDisplay = document.getElementById('pin-display');
  pinDisplay.innerHTML = '';
  for (const digit of state.pin) {
    const box = document.createElement('span');
    box.className = 'pin-digit';
    box.textContent = digit;
    pinDisplay.appendChild(box);
  }

  document.getElementById('status-address').textContent = `${state.lanAddress}:${state.port}`;
  document.getElementById('status-paired').textContent = state.pairedCount;
}

function openAboutModal() {
  document.getElementById('about-modal').classList.remove('hidden');
}

function closeAboutModal() {
  document.getElementById('about-modal').classList.add('hidden');
}

function initAboutModal() {
  const overlay = document.getElementById('about-modal');
  const closeBtn = document.getElementById('about-close');
  if (!overlay || !closeBtn) return;

  closeBtn.addEventListener('click', closeAboutModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAboutModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeAboutModal();
  });
}

async function init() {
  const state = await window.gmApi.getSession();
  renderState(state);

  window.gmApi.onSessionUpdate(renderState);

  document.getElementById('session-name-input').addEventListener('input', (e) => {
    clearTimeout(renameTimer);
    const value = e.target.value;
    renameTimer = setTimeout(() => window.gmApi.renameSession(value), 500);
  });

  document.getElementById('rotate-pin-btn').addEventListener('click', () => {
    window.gmApi.rotatePin();
  });

  initAboutModal();
  window.gmApi.onMenuAction((action) => {
    if (action === 'about') openAboutModal();
  });
}

init();
