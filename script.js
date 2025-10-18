import { LockPlaneHelper, normalizeWord } from './lock-helper.js';

const KEY_PHRASE = 'atlas';
const STORAGE_KEY = 'atlasOK';
const LOCK_SEQUENCE_STORAGE_KEY = 'atlasLockSequence';
const LOCK_VALUES_COUNT = 6;
const VALUE_TOLERANCE = 0.0005;
const PROMPT_MESSAGE = 'Speak the key phrase to pass through the gate.';
const SUCCESS_MESSAGE = 'The gatekeeper bows as the gate swings open.';
const FAILURE_MESSAGE = 'The sentry remains unmoved. Whisper the correct key phrase.';
const EMPTY_MESSAGE = 'Offer a phrase before seeking passage.';
const STORED_SUCCESS_MESSAGE = 'The gate already stands open for you.';

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

function setLockMessage(element, message, variant, form) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove('lock-message--error', 'lock-message--success');
  if (form) {
    form.classList.remove('lock-form--error', 'lock-form--success');
  }
  if (variant === 'error') {
    element.classList.add('lock-message--error');
    if (form) {
      form.classList.add('lock-form--error');
    }
  } else if (variant === 'success') {
    element.classList.add('lock-message--success');
    if (form) {
      form.classList.add('lock-form--success');
    }
  }
}

function syncRewardVisibility(chestSection, rewardSection, isComplete) {
  if (!chestSection || !rewardSection) return;
  chestSection.classList.toggle('view-card--hidden', isComplete);
  rewardSection.classList.toggle('reward--revealed', isComplete);
  rewardSection.classList.toggle('reward--sealed', !isComplete);
}

function focusMapHeading(heading) {
  if (!heading) return;
  heading.focus({ preventScroll: false });
}

function formatPlaneValue(value) {
  return value % 1 === 0 ? value.toString() : value.toFixed(3);
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
  const lockProgress = document.getElementById('lockProgress');
  const lockForm = document.getElementById('lockForm');
  const lockBtn = document.getElementById('lockBtn');
  const lockMessage = document.getElementById('lockMessage');
  const lockValueInputs = Array.from(document.querySelectorAll('.lock-code__input'));
  const resetBtn = document.getElementById('resetBtn');
  const planeList = document.getElementById('lockPlanes');
  const planeSummary = document.getElementById('lockPlanesSummary');
  const planeValues = document.getElementById('lockPlaneValues');

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
    const normalized = normalizeWord(atlasInput.value);

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

  let lockSequenceComplete = false;
  let planeHelper = null;
  if (planeList) {
    planeHelper = new LockPlaneHelper();
    planeHelper.mount(planeList);

    const syncPlaneOutputs = (order) => {
      const data = order && Array.isArray(order) && order.length ? order : planeHelper.getPlaneSummaries();
      const formattedValues = data.map((entry) => formatPlaneValue(entry.value));
      const numericValues = data.map((entry) => entry.value);
      planeList.dataset.order = data.map((entry) => entry.word).join(',');
      planeList.dataset.normalized = data.map((entry) => entry.normalized).join(',');
      planeList.dataset.values = formattedValues.join(',');
      planeList.dataset.numericValues = numericValues.join(',');
      if (planeSummary) {
        planeSummary.textContent = `Current order: ${data.map((entry) => entry.word).join(' → ')}`;
      }
      if (planeValues) {
        planeValues.textContent = '';
        data.forEach((entry) => {
          const dt = document.createElement('dt');
          dt.textContent = entry.word;
          const dd = document.createElement('dd');
          dd.textContent = formatPlaneValue(entry.value);
          planeValues.append(dt, dd);
        });
      }
      window.lockPlaneOutputs = {
        order: data.map((entry) => entry.word),
        normalized: data.map((entry) => entry.normalized),
        values: formattedValues,
        numericValues,
      };
    };

    syncPlaneOutputs();
    planeHelper.addEventListener('orderchange', (event) => {
      syncPlaneOutputs(event.detail?.order);
      if (
        !lockSequenceComplete &&
        lockForm &&
        lockMessage &&
        lockProgress &&
        lockValueInputs.length === LOCK_VALUES_COUNT
      ) {
        clearInputs();
        clearInputErrors();
        updateLockProgress(false);
        setLockMessage(lockMessage, 'Enter the sigil values in order.', undefined, lockForm);
      }
    });
  }

  if (!lockProgress || !lockForm || !lockBtn || !lockMessage || lockValueInputs.length !== LOCK_VALUES_COUNT) {
    return;
  }
  function parseNumericValue(value) {
    const stringValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!stringValue) return null;
    const normalized = stringValue.replace(/[,\s]+/g, '');
    if (!normalized) return null;
    if (!/^[-]?\d+(?:\.\d{1,3})?$/.test(normalized)) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getExpectedSequence() {
    const dataset = planeList?.dataset?.numericValues || '';
    return dataset
      .split(',')
      .map((entry) => parseNumericValue(entry))
      .filter((entry) => entry != null);
  }

  function updateLockProgress(isComplete) {
    const confirmed = isComplete ? LOCK_VALUES_COUNT : 0;
    lockProgress.textContent = `Sigil values confirmed: ${confirmed} / ${LOCK_VALUES_COUNT}`;
  }

  function setCompletionState(isComplete) {
    lockValueInputs.forEach((input) => {
      input.disabled = isComplete;
    });
    lockBtn.disabled = isComplete;
  }

  function fillInputs(sequence) {
    if (!Array.isArray(sequence)) return;
    lockValueInputs.forEach((input, index) => {
      const value = sequence[index];
      if (typeof value === 'number' && Number.isFinite(value)) {
        input.value = formatPlaneValue(value);
      }
    });
  }

  function clearInputs() {
    lockValueInputs.forEach((input) => {
      input.value = '';
    });
  }

  function clearInputErrors() {
    lockValueInputs.forEach((input) => {
      input.classList.remove('lock-code__input--error');
    });
    lockForm.classList.remove('lock-form--error', 'lock-form--success');
  }

  function storeSequenceStatus(sequence) {
    try {
      const payload = { status: 'complete', values: sequence };
      window.localStorage.setItem(LOCK_SEQUENCE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage errors
    }
  }

  function readStoredSequenceStatus() {
    const stored = window.localStorage.getItem(LOCK_SEQUENCE_STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.status === 'complete') {
        const values = Array.isArray(parsed.values) ? parsed.values : [];
        return { status: 'complete', values: values.map((value) => parseNumericValue(value)).filter((value) => value != null) };
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function clearSequenceStatus() {
    try {
      window.localStorage.removeItem(LOCK_SEQUENCE_STORAGE_KEY);
    } catch (error) {
      // Ignore storage errors
    }
  }

  function sequencesMatch(expected, received) {
    if (!Array.isArray(expected) || !Array.isArray(received)) return false;
    if (expected.length !== received.length) return false;
    return expected.every((value, index) => Math.abs(value - received[index]) <= VALUE_TOLERANCE);
  }

  const storedSequence = readStoredSequenceStatus();
  if (storedSequence?.status === 'complete' && storedSequence.values.length === LOCK_VALUES_COUNT) {
    lockSequenceComplete = true;
    fillInputs(storedSequence.values);
  } else if (storedSequence?.status === 'complete') {
    clearSequenceStatus();
  }

  setCompletionState(lockSequenceComplete);
  updateLockProgress(lockSequenceComplete);
  if (lockSequenceComplete) {
    setLockMessage(lockMessage, 'Chest unlocked!', 'success', lockForm);
  } else {
    setLockMessage(lockMessage, 'Enter the sigil values in order.', undefined, lockForm);
  }

  syncRewardVisibility(chestSection, rewardSection, lockSequenceComplete);

  lockValueInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const sanitized = input.value.replace(/[^0-9.\-]/g, '');
      if (sanitized !== input.value) {
        input.value = sanitized;
      }
      input.classList.remove('lock-code__input--error');
      lockForm.classList.remove('lock-form--error');
    });

    input.addEventListener('focus', () => {
      input.select();
      input.classList.remove('lock-code__input--error');
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        const previous = lockValueInputs[index - 1];
        previous.focus({ preventScroll: true });
        previous.select();
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (typeof lockForm.requestSubmit === 'function') {
          lockForm.requestSubmit(lockBtn);
        } else {
          lockForm.submit();
        }
      }
    });
  });

  lockForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (lockSequenceComplete) {
      return;
    }

    clearInputErrors();

    const expectedSequence = getExpectedSequence();
    if (expectedSequence.length !== LOCK_VALUES_COUNT) {
      setLockMessage(
        lockMessage,
        'Align all six planes before entering the values.',
        'error',
        lockForm,
      );
      return;
    }

    const userSequence = lockValueInputs.map((input) => parseNumericValue(input.value));
    const invalidIndex = userSequence.findIndex((value) => value == null);
    if (invalidIndex !== -1) {
      lockValueInputs.forEach((input, index) => {
        if (userSequence[index] == null) {
          input.classList.add('lock-code__input--error');
        }
      });
      const focusTarget = lockValueInputs[invalidIndex];
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
        focusTarget.select();
      }
      setLockMessage(lockMessage, 'Provide numeric values for all six sigils.', 'error', lockForm);
      return;
    }

    if (!sequencesMatch(expectedSequence, userSequence)) {
      lockValueInputs.forEach((input) => {
        input.classList.add('lock-code__input--error');
      });
      const firstInput = lockValueInputs[0];
      if (firstInput) {
        firstInput.focus({ preventScroll: true });
        firstInput.select();
      }
      setLockMessage(lockMessage, 'The sequence falters. Recheck the sigil values.', 'error', lockForm);
      return;
    }

    lockSequenceComplete = true;
    storeSequenceStatus(expectedSequence);
    fillInputs(expectedSequence);
    setCompletionState(true);
    updateLockProgress(true);
    setLockMessage(lockMessage, 'Chest unlocked!', 'success', lockForm);
    syncRewardVisibility(chestSection, rewardSection, true);
  });

  function resetExperience() {
    window.localStorage.removeItem(STORAGE_KEY);
    clearSequenceStatus();
    lockSequenceComplete = false;
    setGateState(sections, false);
    updateGateMessage(gateMsg, PROMPT_MESSAGE);
    atlasInput.value = '';
    clearInputs();
    clearInputErrors();
    setCompletionState(false);
    updateLockProgress(false);
    setLockMessage(lockMessage, 'Enter the sigil values in order.', undefined, lockForm);
    syncRewardVisibility(chestSection, rewardSection, false);
    if (planeHelper) {
      planeHelper.reset();
    }
    atlasInput.focus({ preventScroll: true });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetExperience();
    });
  }
});
