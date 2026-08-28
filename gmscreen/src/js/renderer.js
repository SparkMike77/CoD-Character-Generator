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
}

init();
