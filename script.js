import { ALL_WORDS, normalizeWord, TARGET_SEQUENCE } from './lock-helper.js';

const KEY_PHRASE = 'atlas';
const STORAGE_KEY = 'atlasOK';
const SIGIL_STORAGE_KEY = 'atlasSigilComplete';
const VIEW_STORAGE_KEY = 'atlasActiveView';
const VIEW_ORDER = ['landing', 'map', 'clue', 'reward'];
const PROMPT_MESSAGE = 'Offer your moonlit password to begin your half-birthday adventure.';
const SUCCESS_MESSAGE = 'The moon gate shimmers open for you.';
const FAILURE_MESSAGE = 'The gate glows dim. Share the true moonlit password.';
const EMPTY_MESSAGE = 'A hush falls over the gate. Whisper the password first.';
const STORED_SUCCESS_MESSAGE = 'The moon gate already stands open for this celebration.';
const SUCCESS_OVERLAY_DELAY = 1400;
const TREASURE_STORAGE_KEY = 'atlasTreasureOpen';
const TREASURE_DEFAULT_MESSAGE =
  'Trace the star chart ledger and enter each celebration value to coax the cache awake.';
const TREASURE_INCOMPLETE_MESSAGE =
  'Every celebration moment needs a value before the cache will respond.';
const TREASURE_INVALID_MESSAGE =
  'Celebration values must be numbers drawn from the star chart.';
const TREASURE_FAILURE_MESSAGE = 'The cache hums uncertainly. Adjust the celebration sequence and try again.';
const TREASURE_SUCCESS_MESSAGE = 'Starlight flares as the celebration cache unlocks!';
const TREASURE_STORED_SUCCESS_MESSAGE = 'The celebration cache remains open, treasures aglow.';
const TARGET_NORMALIZED = TARGET_SEQUENCE.map((word) => normalizeWord(word));

let gateUnlocked = false;
let sigilComplete = false;
let successTimer = null;
let chestUnlocked = false;

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

function setGateState({ gate, board, gateForm }, isOpen) {
  if (!gate) {
    return;
  }
  gate.classList.toggle('gate--open', isOpen);
  gate.classList.toggle('gate--closed', !isOpen);
  if (gateForm) {
    gateForm.hidden = isOpen;
  }
  if (board) {
    board.classList.toggle('sigil-board--locked', !isOpen);
  }
  gateUnlocked = isOpen;
}

function updateRewardState(rewardSection, isComplete) {
  if (!rewardSection) return;
  rewardSection.classList.toggle('reward--revealed', isComplete);
  rewardSection.classList.toggle('reward--sealed', !isComplete);
}

function computeSigilValue(word) {
  const normalized = normalizeWord(word);
  let total = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    if (code >= 97 && code <= 122) {
      total += code - 96;
    }
  }
  return total;
}

function shuffleArray(values) {
  const array = [...values];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function updateTreasureMessage(element, message, variant) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('treasure-message--error', 'treasure-message--success');
  if (variant === 'error') {
    element.classList.add('treasure-message--error');
  } else if (variant === 'success') {
    element.classList.add('treasure-message--success');
  }
  element.dataset.variant = variant ?? '';
}

function focusElement(element) {
  if (!element) return;
  element.focus({ preventScroll: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const atlasInput = document.getElementById('atlas');
  const atlasBtn = document.getElementById('atlasBtn');
  const gateMsg = document.getElementById('gateMsg');
  const gateSection = document.getElementById('gate');
  const sigilBoardSection = document.getElementById('sigilBoard');
  const gateFormContainer = document.getElementById('gateFormContainer');
  const atlasForm = document.getElementById('atlasForm');
  const topNav = document.querySelector('.top-nav');
  const navBack = document.getElementById('navBack');
  const navForward = document.getElementById('navForward');
  const mapViewHeading = document.getElementById('mapViewHeading');
  const sigilHeading = document.getElementById('sigilBoardHeading');
  const rewardHeading = document.getElementById('reward-heading');
  const sigilCache = document.getElementById('sigilCache');
  const sigilSolution = document.getElementById('sigilSolution');
  const sigilStatus = document.getElementById('sigilStatus');
  const successOverlay = document.getElementById('sigilSuccess');
  const resetBtn = document.getElementById('resetBtn');
  const rewardSection = document.getElementById('reward');
  const rewardSequence = document.getElementById('rewardSequence');
  const treasureChest = document.getElementById('treasureChest');
  const treasureForm = document.getElementById('treasureForm');
  const treasureMessage = document.getElementById('treasureMessage');
  const treasureSubmit = treasureForm?.querySelector('.treasure-form__submit') ?? null;
  const treasureInputs = treasureForm
    ? Array.from(treasureForm.querySelectorAll('.treasure-input'))
    : [];
  const viewElements = new Map(
    Array.from(document.querySelectorAll('[data-view]')).map((element) => [element.dataset.view, element]),
  );

  if (!atlasInput || !atlasBtn || !gateMsg || !gateSection || !atlasForm) {
    return;
  }

  const sections = { gate: gateSection, board: sigilBoardSection, gateForm: gateFormContainer };

  const treasureDetails = TARGET_SEQUENCE.map((word, index) => ({
    word,
    value: computeSigilValue(word),
    index,
  }));
  const treasureValues = treasureDetails.map((detail) => detail.value);

  if (rewardSequence) {
    rewardSequence.textContent = '';
    treasureDetails.forEach((detail) => {
      const item = document.createElement('li');
      item.className = 'reward-sequence__item';

      const indexBadge = document.createElement('span');
      indexBadge.className = 'reward-sequence__index';
      indexBadge.textContent = String(detail.index + 1);

      const wordLabel = document.createElement('span');
      wordLabel.className = 'reward-sequence__word';
      wordLabel.textContent = detail.word;

      const valueLabel = document.createElement('span');
      valueLabel.className = 'reward-sequence__value';
      valueLabel.textContent = String(detail.value);

      item.append(indexBadge, wordLabel, valueLabel);
      rewardSequence.appendChild(item);
    });
  }

  let chestShakeTimer = null;

  const applyTreasureState = (isOpen, { preserveValues = false, store = true, updateMessage = true } = {}) => {
    chestUnlocked = isOpen;
    if (store) {
      try {
        if (isOpen) {
          window.localStorage.setItem(TREASURE_STORAGE_KEY, 'open');
        } else {
          window.localStorage.removeItem(TREASURE_STORAGE_KEY);
        }
      } catch (error) {
        // Ignore storage errors
      }
    }

    if (treasureChest) {
      treasureChest.classList.toggle('treasure-chest--open', isOpen);
      treasureChest.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
      if (!isOpen) {
        treasureChest.classList.remove('treasure-chest--shake');
      }
    }

    if (treasureForm) {
      treasureForm.setAttribute('aria-disabled', isOpen ? 'true' : 'false');
      treasureForm.classList.toggle('treasure-form--complete', isOpen);
    }

    if (treasureSubmit) {
      treasureSubmit.disabled = isOpen;
    }

    treasureInputs.forEach((input) => {
      input.disabled = isOpen;
      if (!isOpen && !preserveValues) {
        input.value = '';
      }
      input.removeAttribute('aria-invalid');
    });

    if (rewardSection) {
      rewardSection.classList.toggle('reward--loot-open', isOpen);
    }

    if (updateMessage && treasureMessage) {
      if (isOpen) {
        updateTreasureMessage(treasureMessage, TREASURE_SUCCESS_MESSAGE, 'success');
      } else {
        updateTreasureMessage(treasureMessage, TREASURE_DEFAULT_MESSAGE);
      }
    }
  };

  const triggerChestShake = () => {
    if (!treasureChest) {
      return;
    }
    treasureChest.classList.remove('treasure-chest--shake');
    void treasureChest.offsetWidth;
    treasureChest.classList.add('treasure-chest--shake');
    window.clearTimeout(chestShakeTimer);
    chestShakeTimer = window.setTimeout(() => {
      treasureChest.classList.remove('treasure-chest--shake');
    }, 420);
  };

  chestUnlocked = window.localStorage.getItem(TREASURE_STORAGE_KEY) === 'open';
  applyTreasureState(chestUnlocked, { preserveValues: true, store: false, updateMessage: false });
  if (treasureMessage) {
    if (chestUnlocked) {
      updateTreasureMessage(treasureMessage, TREASURE_STORED_SUCCESS_MESSAGE, 'success');
    } else {
      updateTreasureMessage(treasureMessage, TREASURE_DEFAULT_MESSAGE);
    }
  }

  treasureInputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.removeAttribute('aria-invalid');
      if (!chestUnlocked && treasureMessage && treasureMessage.dataset.variant === 'error') {
        updateTreasureMessage(treasureMessage, TREASURE_DEFAULT_MESSAGE);
      }
    });
  });

  if (treasureForm) {
    treasureForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (chestUnlocked) {
        return;
      }

      const values = treasureInputs.map((input) => input.value.trim());
      const firstEmptyIndex = values.findIndex((value) => value === '');
      if (firstEmptyIndex !== -1) {
        updateTreasureMessage(treasureMessage, TREASURE_INCOMPLETE_MESSAGE, 'error');
        const emptyInput = treasureInputs[firstEmptyIndex];
        if (emptyInput) {
          emptyInput.setAttribute('aria-invalid', 'true');
          emptyInput.focus({ preventScroll: true });
        }
        triggerChestShake();
        return;
      }

      const numericValues = values.map((value) => Number.parseInt(value, 10));
      const invalidIndex = numericValues.findIndex((value) => Number.isNaN(value));
      if (invalidIndex !== -1) {
        updateTreasureMessage(treasureMessage, TREASURE_INVALID_MESSAGE, 'error');
        const invalidInput = treasureInputs[invalidIndex];
        if (invalidInput) {
          invalidInput.setAttribute('aria-invalid', 'true');
          invalidInput.focus({ preventScroll: true });
          invalidInput.select?.();
        }
        triggerChestShake();
        return;
      }

      const mismatches = numericValues.reduce((accumulator, value, index) => {
        if (value !== treasureValues[index]) {
          accumulator.push(index);
        }
        return accumulator;
      }, []);

      if (mismatches.length === 0) {
        applyTreasureState(true);
        return;
      }

      const mismatchSet = new Set(mismatches);
      treasureInputs.forEach((input, index) => {
        if (mismatchSet.has(index)) {
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.removeAttribute('aria-invalid');
        }
      });

      const firstMismatchInput = treasureInputs[mismatches[0]];
      if (firstMismatchInput) {
        firstMismatchInput.focus({ preventScroll: true });
        firstMismatchInput.select?.();
      }

      updateTreasureMessage(treasureMessage, TREASURE_FAILURE_MESSAGE, 'error');
      triggerChestShake();
    });
  }

  if (topNav) {
    let lastKnownScrollY = window.scrollY || window.pageYOffset || 0;
    let navTicking = false;

    const syncNavVisibility = () => {
      if (lastKnownScrollY > 0) {
        topNav.classList.add('top-nav--hidden');
      } else {
        topNav.classList.remove('top-nav--hidden');
      }
      navTicking = false;
    };

    const requestNavUpdate = () => {
      if (!navTicking) {
        navTicking = true;
        window.requestAnimationFrame(syncNavVisibility);
      }
    };

    window.addEventListener(
      'scroll',
      () => {
        lastKnownScrollY = window.scrollY || window.pageYOffset || 0;
        requestNavUpdate();
      },
      { passive: true },
    );

    topNav.addEventListener('focusin', () => {
      topNav.classList.remove('top-nav--hidden');
    });

    syncNavVisibility();
  }

  const storedUnlock = window.localStorage.getItem(STORAGE_KEY) === 'true';
  setGateState(sections, storedUnlock);

  sigilComplete = window.localStorage.getItem(SIGIL_STORAGE_KEY) === 'complete';
  updateRewardState(rewardSection, sigilComplete);

  let activeView = 'landing';

  const canAccessView = (view) => {
    if (!viewElements.has(view)) {
      return false;
    }
    if (view === 'landing') {
      return true;
    }
    if (view === 'map' || view === 'clue') {
      return gateUnlocked;
    }
    if (view === 'reward') {
      return gateUnlocked && sigilComplete;
    }
    return false;
  };

  const persistView = (view) => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch (error) {
      // Ignore storage errors
    }
  };

  const updateViewVisibility = (view) => {
    viewElements.forEach((element, key) => {
      const isActive = key === view;
      element.hidden = !isActive;
      element.classList.toggle('view--active', isActive);
    });
  };

  const findPrevView = () => {
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      const candidate = VIEW_ORDER[index];
      if (canAccessView(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const findNextView = () => {
    const currentIndex = VIEW_ORDER.indexOf(activeView);
    for (let index = currentIndex + 1; index < VIEW_ORDER.length; index += 1) {
      const candidate = VIEW_ORDER[index];
      if (canAccessView(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const updateNavButtons = () => {
    if (navBack) {
      const previous = findPrevView();
      navBack.disabled = !previous;
      navBack.setAttribute('aria-disabled', navBack.disabled ? 'true' : 'false');
      navBack.dataset.target = previous ?? '';
    }
    if (navForward) {
      const next = findNextView();
      navForward.disabled = !next;
      navForward.setAttribute('aria-disabled', navForward.disabled ? 'true' : 'false');
      navForward.dataset.target = next ?? '';
    }
  };

  const setActiveView = (view, { store = true } = {}) => {
    if (!canAccessView(view)) {
      return false;
    }
    activeView = view;
    updateViewVisibility(view);
    if (store) {
      persistView(view);
    }
    updateNavButtons();
    return true;
  };

  if (navBack) {
    navBack.addEventListener('click', () => {
      const target = findPrevView();
      if (!target) return;
      const changed = setActiveView(target);
      if (changed) {
        if (target === 'landing') {
          atlasInput.focus({ preventScroll: true });
        } else if (target === 'map') {
          setTimeout(() => focusElement(mapViewHeading), 120);
        } else if (target === 'clue') {
          setTimeout(() => focusElement(sigilHeading), 120);
        }
      }
    });
  }

  if (navForward) {
    navForward.addEventListener('click', () => {
      const target = findNextView();
      if (!target) return;
      const changed = setActiveView(target);
      if (changed) {
        if (target === 'map') {
          setTimeout(() => focusElement(mapViewHeading), 120);
        } else if (target === 'clue') {
          setTimeout(() => focusElement(sigilHeading), 120);
        } else if (target === 'reward') {
          setTimeout(() => focusElement(rewardHeading), 120);
        }
      }
    });
  }

  const storedView = window.localStorage.getItem(VIEW_STORAGE_KEY);
  let defaultView = storedUnlock ? 'map' : 'landing';
  if (sigilComplete && storedUnlock) {
    defaultView = 'reward';
  }
  const initialView = storedView && canAccessView(storedView) ? storedView : defaultView;

  if (storedUnlock) {
    updateGateMessage(gateMsg, STORED_SUCCESS_MESSAGE, 'success');
  } else {
    updateGateMessage(gateMsg, PROMPT_MESSAGE);
  }

  setActiveView(initialView, { store: false });

  if (!storedUnlock && initialView === 'landing') {
    atlasInput.focus({ preventScroll: true });
  } else if (initialView === 'map') {
    setTimeout(() => focusElement(mapViewHeading), 120);
  } else if (initialView === 'clue') {
    setTimeout(() => focusElement(sigilHeading), 120);
  } else if (initialView === 'reward') {
    setTimeout(() => focusElement(rewardHeading), 120);
  }

  atlasForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const normalized = normalizeWord(atlasInput.value);

    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY);
      setGateState(sections, false);
      updateGateMessage(gateMsg, EMPTY_MESSAGE, 'error');
      atlasInput.focus({ preventScroll: true });
      setActiveView('landing');
      return;
    }

    if (normalized === KEY_PHRASE) {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
      } catch (error) {
        // Ignore storage errors
      }
      setGateState(sections, true);
      updateGateMessage(gateMsg, SUCCESS_MESSAGE, 'success');
      atlasInput.value = '';
      if (setActiveView('map')) {
        setTimeout(() => focusElement(mapViewHeading), 160);
      }
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      setGateState(sections, false);
      updateGateMessage(gateMsg, FAILURE_MESSAGE, 'error');
      atlasInput.focus({ preventScroll: true });
      atlasInput.select();
      setActiveView('landing');
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

  const solution = new Array(TARGET_SEQUENCE.length).fill(null);
  let wordPool = [];
  const usedWordIds = new Set();
  const solutionSlots = [];

  const defaultStatusMessage = 'Collect six clues to choreograph the celebration sequence.';
  const fullStatusMessage = 'All six celebration moments are placed. Remove one to reshape the sequence.';
  const incorrectStatusMessage = 'The celebration stumbles. Rearrange the clues.';
  const successStatusMessage = 'Celebration sequence complete! The half-birthday cache awaits.';

  const setStatus = (message = '', variant = 'default') => {
    if (!sigilStatus) {
      return;
    }
    sigilStatus.textContent = message;
    sigilStatus.classList.remove('sigil-status--success', 'sigil-status--error');
    if (variant === 'success') {
      sigilStatus.classList.add('sigil-status--success');
    } else if (variant === 'error') {
      sigilStatus.classList.add('sigil-status--error');
    }
  };

  const buildSolutionSlots = () => {
    if (!sigilSolution) {
      return;
    }
    sigilSolution.textContent = '';
    solutionSlots.length = 0;
    for (let index = 0; index < TARGET_SEQUENCE.length; index += 1) {
      const slot = document.createElement('li');
      slot.className = 'sigil-solution__slot';
      slot.dataset.index = String(index + 1);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sigil-solution__button';
      button.textContent = `Sequence slot ${index + 1}`;
      button.disabled = true;
      button.setAttribute('aria-label', `Celebration slot ${index + 1} empty`);
      button.addEventListener('click', () => {
        if (sigilComplete) {
          return;
        }
        clearSlot(index);
      });

      slot.appendChild(button);
      sigilSolution.appendChild(slot);
      solutionSlots.push({ slot, button });
    }
  };

  const renderCache = () => {
    if (!sigilCache) {
      return;
    }
    sigilCache.textContent = '';
    wordPool.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'sigil-cache__item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sigil-cache__button';
      button.textContent = entry.word;
      const used = usedWordIds.has(entry.id);
      button.disabled = sigilComplete || used;
      button.setAttribute('aria-pressed', used ? 'true' : 'false');
      button.setAttribute(
        'aria-label',
        used ? `${entry.word} already placed` : `Send ${entry.word} into the celebration sequence`,
      );
      button.title = used || sigilComplete ? '' : 'Send to the celebration sequence';
      if (!used && !sigilComplete) {
        button.addEventListener('click', () => {
          fillSlot(entry);
        });
      }

      item.appendChild(button);
      sigilCache.appendChild(item);
    });
  };

  const renderSolution = ({ highlightMatches = false, highlightIncorrect = false } = {}) => {
    if (solutionSlots.length === 0) {
      return;
    }
    solutionSlots.forEach(({ slot, button }, index) => {
      const entry = solution[index];
      slot.classList.remove(
        'sigil-solution__slot--filled',
        'sigil-solution__slot--correct',
        'sigil-solution__slot--incorrect',
      );
      if (entry) {
        slot.classList.add('sigil-solution__slot--filled');
        const isCorrect = entry.normalized === TARGET_NORMALIZED[index];
        if (sigilComplete || (highlightMatches && isCorrect)) {
          slot.classList.add('sigil-solution__slot--correct');
        } else if (highlightIncorrect && !isCorrect) {
          slot.classList.add('sigil-solution__slot--incorrect');
        }
        button.disabled = sigilComplete;
        button.textContent = entry.word;
        button.setAttribute('aria-label', `Remove ${entry.word} from celebration slot ${index + 1}`);
        button.title = sigilComplete ? '' : 'Tap to release this clue';
      } else {
        button.disabled = true;
        button.textContent = `Sequence slot ${index + 1}`;
        button.setAttribute('aria-label', `Celebration slot ${index + 1} empty`);
        button.title = '';
      }
    });
  };

  const syncPuzzleState = ({ highlightIncorrect = false } = {}) => {
    if (!sigilCache || !sigilSolution) {
      return;
    }
    renderCache();
    const filledCount = solution.reduce((count, entry) => (entry ? count + 1 : count), 0);
    const allFilled = filledCount === TARGET_SEQUENCE.length;
    const matches =
      allFilled && solution.every((entry, index) => entry?.normalized === TARGET_NORMALIZED[index]);
    const highlightMatches = sigilComplete || allFilled;
    renderSolution({ highlightMatches, highlightIncorrect: highlightIncorrect || (allFilled && !matches) });

    if (sigilComplete) {
      setStatus(successStatusMessage, 'success');
      return;
    }
    if (matches) {
      handleSigilSuccess();
      return;
    }
    if (allFilled) {
      setStatus(incorrectStatusMessage, 'error');
      return;
    }
    if (filledCount === 0) {
      setStatus(defaultStatusMessage);
      return;
    }
    const remaining = TARGET_SEQUENCE.length - filledCount;
    setStatus(
      `Place ${remaining} more ${remaining === 1 ? 'clue' : 'clues'} to complete the celebration.`,
    );
  };

  function clearSlot(index) {
    const entry = solution[index];
    if (!entry) {
      return;
    }
    solution[index] = null;
    usedWordIds.delete(entry.id);
    syncPuzzleState();
  }

  function fillSlot(entry) {
    const emptyIndex = solution.findIndex((value) => value == null);
    if (emptyIndex === -1) {
      setStatus(fullStatusMessage, 'error');
      renderSolution({ highlightMatches: true, highlightIncorrect: true });
      return;
    }
    solution[emptyIndex] = entry;
    usedWordIds.add(entry.id);
    syncPuzzleState();
  }

  const initializePuzzle = () => {
    wordPool = shuffleArray(ALL_WORDS).map((word, index) => ({
      id: `word-${index}`,
      word,
      normalized: normalizeWord(word),
    }));
    solution.fill(null);
    usedWordIds.clear();
    buildSolutionSlots();
    if (sigilComplete) {
      TARGET_NORMALIZED.forEach((normalizedWord, index) => {
        const entry = wordPool.find((candidate) => candidate.normalized === normalizedWord);
        if (entry) {
          solution[index] = entry;
          usedWordIds.add(entry.id);
        }
      });
    }
    syncPuzzleState();
    if (!sigilComplete) {
      setStatus(defaultStatusMessage);
    }
  };

  function handleSigilSuccess() {
    if (sigilComplete) {
      setStatus(successStatusMessage, 'success');
      renderCache();
      renderSolution({ highlightMatches: true });
      return;
    }
    sigilComplete = true;
    try {
      window.localStorage.setItem(SIGIL_STORAGE_KEY, 'complete');
    } catch (error) {
      // Ignore storage errors
    }
    updateRewardState(rewardSection, true);
    updateNavButtons();
    renderCache();
    renderSolution({ highlightMatches: true });
    setStatus(successStatusMessage, 'success');
    if (successOverlay) {
      successOverlay.hidden = false;
      successOverlay.classList.remove('sigil-success--visible');
      void successOverlay.offsetHeight;
      successOverlay.classList.add('sigil-success--visible');
    }
    window.clearTimeout(successTimer);
    successTimer = window.setTimeout(() => {
      if (successOverlay) {
        successOverlay.hidden = true;
        successOverlay.classList.remove('sigil-success--visible');
      }
      if (setActiveView('reward')) {
        setTimeout(() => focusElement(rewardHeading), 160);
      }
    }, SUCCESS_OVERLAY_DELAY);
  }

  initializePuzzle();

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SIGIL_STORAGE_KEY);
      window.localStorage.removeItem(VIEW_STORAGE_KEY);
      window.localStorage.removeItem(TREASURE_STORAGE_KEY);
      sigilComplete = false;
      chestUnlocked = false;
      setGateState(sections, false);
      updateRewardState(rewardSection, false);
      window.clearTimeout(successTimer);
      if (successOverlay) {
        successOverlay.hidden = true;
        successOverlay.classList.remove('sigil-success--visible');
      }
      initializePuzzle();
      applyTreasureState(false, { preserveValues: false, store: false, updateMessage: false });
      if (treasureMessage) {
        updateTreasureMessage(treasureMessage, TREASURE_DEFAULT_MESSAGE);
      }
      updateGateMessage(gateMsg, PROMPT_MESSAGE);
      setActiveView('landing', { store: false });
      updateNavButtons();
      atlasInput.focus({ preventScroll: true });
    });
  }
});
