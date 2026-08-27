// Small reusable interactive-form-field widgets used throughout the sheet.
// Each factory renders into an existing container element and re-renders
// itself on every state change (simple, no virtual DOM needed at this scale).

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// A row of N clickable dots. Clicking dot i sets the value to i+1, unless
// that dot is already the highest filled one, in which case it drops back
// to i (clamped to min) -- this is what lets you reduce a rating by
// re-clicking its current top dot, matching standard CoD sheet UX.
function createDotRow(container, { max, min = 0, getValue, setValue, className = '' }) {
  function render() {
    clearEl(container);
    container.classList.add('dot-row');
    if (className) container.classList.add(className);
    const value = getValue();
    for (let i = 0; i < max; i += 1) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot' + (i < value ? ' filled' : '');
      dot.setAttribute('aria-label', `${i + 1}`);
      dot.addEventListener('click', () => {
        const next = value === i + 1 ? Math.max(min, i) : i + 1;
        setValue(Math.max(min, Math.min(max, next)));
        render();
      });
      container.appendChild(dot);
    }
  }
  render();
  return { render };
}

// A row of N simple checkbox-style boxes (binary, independent of order),
// used for Beats / Group Beats / Risked-style trackers.
function createCheckRow(container, { max, getValue, setValue }) {
  function render() {
    clearEl(container);
    container.classList.add('check-row');
    const value = getValue();
    for (let i = 0; i < max; i += 1) {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'check-box' + (i < value ? ' filled' : '');
      box.addEventListener('click', () => {
        const next = value === i + 1 ? i : i + 1;
        setValue(Math.max(0, Math.min(max, next)));
        render();
      });
      container.appendChild(box);
    }
  }
  render();
  return { render };
}

const HEALTH_STATES = ['empty', 'bashing', 'lethal', 'aggravated'];
const HEALTH_GLYPH = { empty: '', bashing: '/', lethal: 'X', aggravated: '★' };

// Health track: N boxes, each cycling empty -> bashing -> lethal -> aggravated -> empty.
function createHealthTrack(container, { getCount, getBoxes, setBoxes }) {
  function render() {
    clearEl(container);
    container.classList.add('health-row');
    const count = getCount();
    const boxes = getBoxes();
    for (let i = 0; i < count; i += 1) {
      const state = boxes[i] || 'empty';
      const box = document.createElement('button');
      box.type = 'button';
      box.className = `health-box ${state}`;
      box.textContent = HEALTH_GLYPH[state];
      box.addEventListener('click', () => {
        const newBoxes = boxes.slice(0, count);
        while (newBoxes.length < count) newBoxes.push('empty');
        const currentIndex = HEALTH_STATES.indexOf(newBoxes[i] || 'empty');
        newBoxes[i] = HEALTH_STATES[(currentIndex + 1) % HEALTH_STATES.length];
        setBoxes(newBoxes);
        render();
      });
      container.appendChild(box);
    }
  }
  render();
  return { render };
}

// Integrity ladder: a vertical list of ratings 10..1, one active marker.
function createIntegrityLadder(container, { getValue, setValue }) {
  function render() {
    clearEl(container);
    container.classList.add('integrity-ladder');
    const value = getValue();
    for (let n = 10; n >= 1; n -= 1) {
      const row = document.createElement('div');
      row.className = 'integrity-row';

      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'integrity-marker' + (n === value ? ' filled' : '');
      marker.addEventListener('click', () => {
        setValue(n);
        render();
      });

      const label = document.createElement('span');
      label.className = 'integrity-number';
      label.textContent = n;

      row.appendChild(label);
      row.appendChild(marker);
      container.appendChild(row);
    }
  }
  render();
  return { render };
}

export { createDotRow, createCheckRow, createHealthTrack, createIntegrityLadder };
