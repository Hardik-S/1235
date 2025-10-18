import { SigilBoardHelper, normalizeWord, TARGET_SEQUENCE } from './lock-helper.js';

const KEY_PHRASE = 'atlas';
const STORAGE_KEY = 'atlasOK';
const SIGIL_STORAGE_KEY = 'atlasSigilComplete';
const VIEW_STORAGE_KEY = 'atlasActiveView';
const VIEW_ORDER = ['landing', 'map', 'clue', 'reward'];
const PROMPT_MESSAGE = 'Speak the key phrase to pass through the gate.';
const SUCCESS_MESSAGE = 'The gatekeeper bows as the gate swings open.';
const FAILURE_MESSAGE = 'The sentry remains unmoved. Whisper the correct key phrase.';
const EMPTY_MESSAGE = 'Offer a phrase before seeking passage.';
const STORED_SUCCESS_MESSAGE = 'The gate already stands open for you.';
const SUCCESS_OVERLAY_DELAY = 1400;

let gateUnlocked = false;
let sigilComplete = false;
let sigilHelper = null;
let successTimer = null;

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
  const sigilScreens = {
    source: sigilBoardSection?.querySelector('.sigil-screen--source') ?? null,
    staging: sigilBoardSection?.querySelector('.sigil-screen--staging') ?? null,
    final: sigilBoardSection?.querySelector('.sigil-screen--final') ?? null,
  };
  const sigilSource = sigilScreens.source?.querySelector('#sigilSource') ?? null;
  const sigilStaging = sigilScreens.staging?.querySelector('#sigilStaging') ?? null;
  const sigilFinal = sigilScreens.final?.querySelector('#sigilFinal') ?? null;
  const successOverlay = document.getElementById('sigilSuccess');
  const resetBtn = document.getElementById('resetBtn');
  const rewardSection = document.getElementById('reward');
  const viewElements = new Map(
    Array.from(document.querySelectorAll('[data-view]')).map((element) => [element.dataset.view, element]),
  );

  if (!atlasInput || !atlasBtn || !gateMsg || !gateSection || !atlasForm) {
    return;
  }

  const sections = { gate: gateSection, board: sigilBoardSection, gateForm: gateFormContainer };

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

  const stagingCells = [];
  const finalColumns = [];

  if (sigilStaging) {
    sigilStaging.textContent = '';
    for (let index = 0; index < TARGET_SEQUENCE.length; index += 1) {
      const cell = document.createElement('div');
      cell.className = 'staging-cell';
      cell.dataset.index = String(index);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Staging slot ${index + 1}`);
      stagingCells.push(cell);
      sigilStaging.appendChild(cell);
    }
  }

  if (sigilFinal) {
    sigilFinal.textContent = '';
    for (let index = 0; index < TARGET_SEQUENCE.length; index += 1) {
      const column = document.createElement('div');
      column.className = 'final-column';
      column.dataset.index = String(index);
      column.dataset.label = `Column ${index + 1}`;
      column.setAttribute('aria-label', `Alignment column ${index + 1}`);
      finalColumns.push(column);
      sigilFinal.appendChild(column);
    }
  }

  const buildSourceTile = (tile) => {
    const item = document.createElement('li');
    item.className = 'word-tile';
    item.dataset.location = 'source';

    const label = document.createElement('p');
    label.className = 'word-tile__label';
    label.textContent = tile.word;

    const controls = document.createElement('div');
    controls.className = 'word-tile__controls';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'word-tile__button';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', `Send ${tile.word} to the staging grid`);
    addBtn.addEventListener('click', () => {
      if (sigilHelper) {
        sigilHelper.placeTileInStaging(tile.id);
      }
    });

    controls.appendChild(addBtn);
    item.append(label, controls);
    return item;
  };

  const buildStagingTile = (tile, index) => {
    const container = document.createElement('div');
    container.className = 'word-tile';
    container.dataset.location = 'staging';

    const label = document.createElement('p');
    label.className = 'word-tile__label';
    label.textContent = tile.word;

    const advanceControls = document.createElement('div');
    advanceControls.className = 'word-tile__controls';

    const advanceBtn = document.createElement('button');
    advanceBtn.type = 'button';
    advanceBtn.className = 'word-tile__button word-tile__button--secondary';
    advanceBtn.textContent = '+';
    advanceBtn.setAttribute('aria-label', `Move ${tile.word} to alignment column ${index + 1}`);
    advanceBtn.addEventListener('click', () => {
      if (sigilHelper) {
        sigilHelper.promoteStagingTile(index);
      }
    });

    const returnControls = document.createElement('div');
    returnControls.className = 'word-tile__controls word-tile__controls--bottom';

    const returnBtn = document.createElement('button');
    returnBtn.type = 'button';
    returnBtn.className = 'word-tile__button word-tile__button--danger';
    returnBtn.textContent = '−';
    returnBtn.setAttribute('aria-label', `Return ${tile.word} to the word cache`);
    returnBtn.addEventListener('click', () => {
      if (sigilHelper) {
        sigilHelper.moveTileToSource(tile.id);
      }
    });

    advanceControls.appendChild(advanceBtn);
    returnControls.appendChild(returnBtn);
    container.append(label, advanceControls, returnControls);
    return container;
  };

  const buildFinalTile = (tile, index) => {
    const container = document.createElement('div');
    container.className = 'word-tile word-tile--final';
    container.dataset.location = 'final';

    const label = document.createElement('p');
    label.className = 'word-tile__label';
    label.textContent = tile.word;

    const returnControls = document.createElement('div');
    returnControls.className = 'word-tile__controls word-tile__controls--bottom';

    const returnBtn = document.createElement('button');
    returnBtn.type = 'button';
    returnBtn.className = 'word-tile__button word-tile__button--danger';
    returnBtn.textContent = '−';
    returnBtn.setAttribute('aria-label', `Send ${tile.word} back to staging column ${index + 1}`);
    returnBtn.addEventListener('click', () => {
      if (sigilHelper) {
        sigilHelper.returnFinalToStaging(index);
      }
    });

    returnControls.appendChild(returnBtn);
    container.append(label, returnControls);
    return container;
  };

  const renderSigilState = (state) => {
    if (sigilScreens.source) {
      sigilScreens.source.classList.toggle('sigil-screen--has-tiles', state.source.length > 0);
    }
    if (sigilScreens.staging) {
      const hasStaging = state.staging.some((tile) => tile != null);
      sigilScreens.staging.classList.toggle('sigil-screen--has-tiles', hasStaging);
    }
    if (sigilScreens.final) {
      const hasFinal = state.final.some((tile) => tile != null);
      sigilScreens.final.classList.toggle('sigil-screen--has-tiles', hasFinal);
    }

    if (sigilSource) {
      sigilSource.textContent = '';
      state.source.forEach((tile) => {
        sigilSource.appendChild(buildSourceTile(tile));
      });
    }

    state.staging.forEach((tile, index) => {
      const cell = stagingCells[index];
      if (!cell) return;
      cell.textContent = '';
      cell.classList.toggle('staging-cell--active', Boolean(tile));
      if (tile) {
        cell.appendChild(buildStagingTile(tile, index));
      }
    });

    state.final.forEach((tile, index) => {
      const column = finalColumns[index];
      if (!column) return;
      column.textContent = '';
      column.classList.toggle('final-column--active', Boolean(tile));
      if (tile) {
        column.appendChild(buildFinalTile(tile, index));
      }
    });
  };

  sigilHelper = new SigilBoardHelper();
  sigilHelper.addEventListener('statechange', (event) => {
    renderSigilState(event.detail);
  });

  sigilHelper.addEventListener('success', () => {
    if (sigilComplete) {
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
  });

  if (sigilComplete) {
    sigilHelper.completeImmediately();
  } else {
    renderSigilState(sigilHelper.getState());
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SIGIL_STORAGE_KEY);
      window.localStorage.removeItem(VIEW_STORAGE_KEY);
      sigilComplete = false;
      setGateState(sections, false);
      updateRewardState(rewardSection, false);
      sigilHelper.reset();
      updateGateMessage(gateMsg, PROMPT_MESSAGE);
      setActiveView('landing', { store: false });
      updateNavButtons();
      atlasInput.focus({ preventScroll: true });
    });
  }
});
