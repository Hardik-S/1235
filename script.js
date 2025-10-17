(function () {
  const KEY_PHRASE = 'atlas';
  const STORAGE_KEY = 'atlasOK';
  const PROMPT_MESSAGE = 'Speak the key phrase to pass through the gate.';
  const SUCCESS_MESSAGE = 'The gatekeeper bows as the gate swings open.';
  const FAILURE_MESSAGE = 'The sentry remains unmoved. Whisper the correct key phrase.';
  const EMPTY_MESSAGE = 'Offer a phrase before seeking passage.';
  const STORED_SUCCESS_MESSAGE = 'The gate already stands open for you.';

  const diacriticPattern = /\p{Diacritic}/gu;

  function normalizeInput(value) {
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    return stringValue
      .normalize('NFD')
      .replace(diacriticPattern, '')
      .trim()
      .toLowerCase();
  }

  function updateGateMessage(element, message, variant) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('gate-message--error', 'gate-message--success');
    if (variant === 'error') {
      element.classList.add('gate-message--error');
    } else if (variant === 'success') {
      element.classList.add('gate-message--success');
    }
  }

  function setGateState({ gate, chest }, isOpen) {
    if (!gate || !chest) {
      return;
    }

    gate.classList.toggle('gate--open', isOpen);
    gate.classList.toggle('gate--closed', !isOpen);
    chest.classList.toggle('chest--locked', !isOpen);
    chest.classList.toggle('chest--unlocked', isOpen);
  }

  function focusChestHeading(heading) {
    if (!heading) return;
    heading.focus({ preventScroll: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const atlasInput = document.getElementById('atlas');
    const atlasBtn = document.getElementById('atlasBtn');
    const gateMsg = document.getElementById('gateMsg');
    const gateSection = document.getElementById('gate');
    const chestSection = document.getElementById('chest');
    const chestHeading = document.getElementById('chest-heading');
    const atlasForm = document.getElementById('atlasForm');

    if (!atlasInput || !atlasBtn || !gateMsg || !gateSection || !chestSection || !atlasForm) {
      return;
    }

    const sections = { gate: gateSection, chest: chestSection };

    const storedUnlock = window.localStorage.getItem(STORAGE_KEY) === 'true';
    setGateState(sections, storedUnlock);
    if (storedUnlock) {
      updateGateMessage(gateMsg, STORED_SUCCESS_MESSAGE, 'success');
      setTimeout(() => focusChestHeading(chestHeading), 120);
    } else {
      updateGateMessage(gateMsg, PROMPT_MESSAGE);
      atlasInput.focus({ preventScroll: true });
    }

    atlasForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const normalized = normalizeInput(atlasInput.value);

      if (!normalized) {
        window.localStorage.removeItem(STORAGE_KEY);
        setGateState(sections, false);
        updateGateMessage(gateMsg, EMPTY_MESSAGE, 'error');
        atlasInput.focus({ preventScroll: true });
        return;
      }

      if (normalized === KEY_PHRASE) {
        window.localStorage.setItem(STORAGE_KEY, 'true');
        setGateState(sections, true);
        updateGateMessage(gateMsg, SUCCESS_MESSAGE, 'success');
        atlasInput.value = '';
        setTimeout(() => focusChestHeading(chestHeading), 140);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        setGateState(sections, false);
        updateGateMessage(gateMsg, FAILURE_MESSAGE, 'error');
        atlasInput.focus({ preventScroll: true });
        atlasInput.select();
      }
    });

    atlasInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (typeof atlasForm.requestSubmit === 'function') {
          atlasForm.requestSubmit(atlasBtn);
        } else {
          atlasForm.submit();
        }
      }
    });
  });
})();
