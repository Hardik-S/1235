(function () {
  const KEY_PHRASE = 'atlas';
  const STORAGE_KEY = 'atlasOK';
  const LOCK_STORAGE_KEY = 'atlasLockIndex';
  const LOCK_WORDS = [
    { word: 'ember', icon: '🔥', label: 'Ember Sigil' },
    { word: 'tide', icon: '🌊', label: 'Tide Sigil' },
    { word: 'gale', icon: '💨', label: 'Gale Sigil' },
    { word: 'stone', icon: '🪨', label: 'Stone Sigil' },
  ];
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

  function setGateState({ gate, chest, gateForm, map }, isOpen) {
    if (!gate || !chest) {
      return;
    }

    gate.classList.toggle('gate--open', isOpen);
    gate.classList.toggle('gate--closed', !isOpen);
    if (gateForm) {
      gateForm.hidden = isOpen;
    }
    if (map) {
      map.hidden = !isOpen;
    }
    chest.classList.toggle('chest--locked', !isOpen);
    chest.classList.toggle('chest--unlocked', isOpen);
  }

  function setLockMessage(element, message, variant) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('lock-message--error', 'lock-message--success');
    if (variant === 'error') {
      element.classList.add('lock-message--error');
    } else if (variant === 'success') {
      element.classList.add('lock-message--success');
    }
  }

  function syncRewardVisibility(chestSection, rewardSection, index, totalLocks) {
    if (!chestSection || !rewardSection) return;
    const isComplete = index >= totalLocks;
    chestSection.classList.toggle('view-card--hidden', isComplete);
    rewardSection.classList.toggle('reward--revealed', isComplete);
    rewardSection.classList.toggle('reward--sealed', !isComplete);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function focusMapHeading(heading) {
    if (!heading) return;
    heading.focus({ preventScroll: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const atlasInput = document.getElementById('atlas');
    const atlasBtn = document.getElementById('atlasBtn');
    const gateMsg = document.getElementById('gateMsg');
    const gateSection = document.getElementById('gate');
    const chestSection = document.getElementById('chest');
    const rewardSection = document.getElementById('reward');
    const gateMap = document.getElementById('gateMap');
    const gateMapHeading = document.getElementById('gateMapHeading');
    const gateFormContainer = document.getElementById('gateFormContainer');
    const atlasForm = document.getElementById('atlasForm');
    const lockGrid = document.getElementById('lockGrid');
    const lockProgress = document.getElementById('lockProgress');
    const lockForm = document.getElementById('lockForm');
    const lockInput = document.getElementById('lockInput');
    const lockBtn = document.getElementById('lockBtn');
    const lockMessage = document.getElementById('lockMessage');
    const resetBtn = document.getElementById('resetBtn');

    if (!atlasInput || !atlasBtn || !gateMsg || !gateSection || !chestSection || !atlasForm) {
      return;
    }

    const sections = { gate: gateSection, chest: chestSection, gateForm: gateFormContainer, map: gateMap };

    const storedUnlock = window.localStorage.getItem(STORAGE_KEY) === 'true';
    setGateState(sections, storedUnlock);
    if (storedUnlock) {
      updateGateMessage(gateMsg, STORED_SUCCESS_MESSAGE, 'success');
      setTimeout(() => focusMapHeading(gateMapHeading), 120);
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
        setTimeout(() => focusMapHeading(gateMapHeading), 160);
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

    if (!lockGrid || !lockProgress || !lockForm || !lockInput || !lockBtn || !lockMessage) {
      return;
    }

    const totalLocks = LOCK_WORDS.length;

    function parseStoredLockIndex() {
      const stored = window.localStorage.getItem(LOCK_STORAGE_KEY);
      if (stored == null) return 0;
      const parsed = Number.parseInt(stored, 10);
      if (Number.isNaN(parsed)) return 0;
      return clamp(parsed, 0, totalLocks);
    }

    function persistLockIndex(index) {
      window.localStorage.setItem(LOCK_STORAGE_KEY, String(index));
    }

    function updateLockProgress(index) {
      lockProgress.textContent = `Sigils aligned: ${Math.min(index, totalLocks)} / ${totalLocks}`;
    }

    function syncLockTiles(index) {
      const tiles = lockGrid.querySelectorAll('.lock-tile');
      tiles.forEach((tile) => {
        const tileIndex = Number.parseInt(tile.dataset.index || '', 10);
        if (Number.isNaN(tileIndex)) return;
        const unlocked = tileIndex < index;
        const isActive = tileIndex === index;
        tile.classList.toggle('unlocked', unlocked);
        tile.classList.toggle('lock-tile--active', isActive && !unlocked);
        const state = unlocked ? 'unlocked' : isActive ? 'active' : 'locked';
        tile.setAttribute('data-state', state);
        if (isActive && !unlocked) {
          tile.setAttribute('aria-current', 'step');
        } else {
          tile.removeAttribute('aria-current');
        }
        const status = tile.querySelector('.lock-tile__status');
        if (status) {
          status.textContent = unlocked ? 'Unlocked' : isActive ? 'Next sigil' : 'Locked';
        }
      });
    }

    function renderLockTiles() {
      lockGrid.textContent = '';
      LOCK_WORDS.forEach((lock, index) => {
        const tile = document.createElement('li');
        tile.className = 'lock-tile';
        tile.dataset.index = String(index);

        const icon = document.createElement('span');
        icon.className = 'lock-tile__icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = lock.icon;

        const label = document.createElement('span');
        label.className = 'lock-tile__label';
        label.textContent = lock.label;

        const status = document.createElement('span');
        status.className = 'sr-only lock-tile__status';
        status.textContent = 'Locked';

        tile.append(icon, label, status);
        lockGrid.appendChild(tile);
      });
    }

    function setCompletionState(isComplete) {
      lockInput.disabled = isComplete;
      lockBtn.disabled = isComplete;
    }

    renderLockTiles();

    let currentLockIndex = parseStoredLockIndex();
    if (currentLockIndex === 0) {
      window.localStorage.removeItem(LOCK_STORAGE_KEY);
    } else {
      persistLockIndex(currentLockIndex);
    }
    updateLockProgress(currentLockIndex);
    syncLockTiles(currentLockIndex);
    setCompletionState(currentLockIndex >= totalLocks);

    if (currentLockIndex >= totalLocks) {
      setLockMessage(lockMessage, 'Chest unlocked!', 'success');
    } else {
      setLockMessage(lockMessage, 'Type the next sigil.');
    }

    syncRewardVisibility(chestSection, rewardSection, currentLockIndex, totalLocks);

    lockForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (currentLockIndex >= totalLocks) {
        return;
      }

      const guess = normalizeInput(lockInput.value);
      if (!guess) {
        setLockMessage(lockMessage, 'Enter a sigil.', 'error');
        lockInput.focus({ preventScroll: true });
        return;
      }

      const target = normalizeInput(LOCK_WORDS[currentLockIndex].word);
      if (guess === target) {
        currentLockIndex += 1;
        persistLockIndex(currentLockIndex);
        lockInput.value = '';
        syncLockTiles(currentLockIndex);
        updateLockProgress(currentLockIndex);

        if (currentLockIndex >= totalLocks) {
          setCompletionState(true);
          setLockMessage(lockMessage, 'Chest unlocked!', 'success');
        } else {
          setLockMessage(lockMessage, 'Sigil unlocked.', 'success');
        }

        syncRewardVisibility(chestSection, rewardSection, currentLockIndex, totalLocks);
      } else {
        setLockMessage(lockMessage, 'Wrong sigil. Retry.', 'error');
        lockInput.focus({ preventScroll: true });
        lockInput.select();
      }
    });

    function resetExperience() {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LOCK_STORAGE_KEY);
      currentLockIndex = 0;
      setGateState(sections, false);
      updateGateMessage(gateMsg, PROMPT_MESSAGE);
      atlasInput.value = '';
      lockInput.value = '';
      setLockMessage(lockMessage, 'Type the next sigil.');
      updateLockProgress(currentLockIndex);
      syncLockTiles(currentLockIndex);
      setCompletionState(false);
      syncRewardVisibility(chestSection, rewardSection, currentLockIndex, totalLocks);
      atlasInput.focus({ preventScroll: true });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetExperience();
      });
    }
  });
})();
