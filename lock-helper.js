const diacriticPattern = /\p{Diacritic}/gu;
const alphaPattern = /[a-z]/;

export const LOCK_PLANE_WORDS = ['Arbre', 'Nazareth', 'Alea', 'Nodal', 'Ymagier', 'Anchor'];

export function normalizeWord(value) {
  const stringValue = typeof value === 'string' ? value : String(value ?? '');
  return stringValue
    .normalize('NFD')
    .replace(diacriticPattern, '')
    .trim()
    .toLowerCase();
}

export function calculateWordValue(word) {
  const normalized = normalizeWord(word);
  let sum = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (!alphaPattern.test(char)) {
      continue;
    }
    const alphabetPosition = char.charCodeAt(0) - 96;
    const weight = index + 7;
    sum += alphabetPosition * weight;
  }

  const modulo = 23.5;
  const remainder = ((sum % modulo) + modulo) % modulo;
  return Number.isInteger(remainder) ? remainder : Number.parseFloat(remainder.toFixed(3));
}

function createPlaneData(word, index) {
  const normalized = normalizeWord(word);
  return {
    id: `plane-${index}`,
    word,
    normalized,
    value: calculateWordValue(word),
  };
}

export class LockPlaneHelper extends EventTarget {
  constructor(words = LOCK_PLANE_WORDS) {
    super();
    this.planes = words.map((word, index) => createPlaneData(word, index));
    this.order = [...this.planes];
    this.container = null;
    this.draggedElement = null;
    this.handleDragStart = this.handleDragStart.bind(this);
    this.handleDragOver = this.handleDragOver.bind(this);
    this.handleDrop = this.handleDrop.bind(this);
    this.handleDragEnd = this.handleDragEnd.bind(this);
  }

  getPlaneSummaries() {
    return this.order.map((plane, index) => ({
      index,
      word: plane.word,
      normalized: plane.normalized,
      value: calculateWordValue(plane.word),
    }));
  }

  mount(container) {
    if (!container) return;
    this.container = container;
    this.render();
    this.finalizeOrder();
    container.addEventListener('dragover', this.handleDragOver);
    container.addEventListener('drop', this.handleDrop);
  }

  reset() {
    this.order = [...this.planes];
    this.render();
    this.draggedElement = null;
    this.finalizeOrder();
  }

  unmount() {
    if (!this.container) return;
    this.container.removeEventListener('dragover', this.handleDragOver);
    this.container.removeEventListener('drop', this.handleDrop);
    this.container.querySelectorAll('.lock-plane').forEach((planeEl) => {
      planeEl.removeEventListener('dragstart', this.handleDragStart);
      planeEl.removeEventListener('dragend', this.handleDragEnd);
    });
    this.container = null;
  }

  render() {
    if (!this.container) return;
    this.container.textContent = '';
    const fragment = document.createDocumentFragment();
    this.order.forEach((plane, index) => {
      fragment.appendChild(this.createPlaneElement(plane, index));
    });
    this.container.appendChild(fragment);
  }

  createPlaneElement(plane, index) {
    const item = document.createElement('li');
    item.className = 'lock-plane';
    item.draggable = true;
    item.dataset.id = plane.id;
    item.dataset.index = String(index);
    item.tabIndex = 0;
    item.setAttribute('aria-grabbed', 'false');

    const handle = document.createElement('span');
    handle.className = 'lock-plane__handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';

    const name = document.createElement('span');
    name.className = 'lock-plane__name';
    name.textContent = plane.word;

    const value = document.createElement('span');
    value.className = 'lock-plane__value';
    value.textContent = this.formatValueDisplay(plane);

    item.append(handle, name, value);
    item.addEventListener('dragstart', this.handleDragStart);
    item.addEventListener('dragend', this.handleDragEnd);
    return item;
  }

  formatValueDisplay(plane) {
    const numericValue = calculateWordValue(plane.word);
    const padded = numericValue % 1 === 0 ? numericValue.toString() : numericValue.toFixed(3);
    return `↯ ${padded}`;
  }

  handleDragStart(event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    this.draggedElement = target;
    target.classList.add('lock-plane--dragging');
    target.setAttribute('aria-grabbed', 'true');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', target.dataset.id || '');
    }
  }

  handleDragOver(event) {
    event.preventDefault();
    if (!this.container || !this.draggedElement) return;
    const target = event.target instanceof HTMLElement ? event.target.closest('.lock-plane') : null;
    if (!target || target === this.draggedElement || !(target instanceof HTMLElement)) {
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const isBefore = event.clientY < targetRect.top + targetRect.height / 2;
    const referenceNode = isBefore ? target : target.nextElementSibling;
    if (referenceNode !== this.draggedElement) {
      this.container.insertBefore(this.draggedElement, referenceNode);
    }
  }

  handleDrop(event) {
    event.preventDefault();
    this.finalizeOrder();
  }

  handleDragEnd() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove('lock-plane--dragging');
      this.draggedElement.setAttribute('aria-grabbed', 'false');
    }
    this.draggedElement = null;
    this.finalizeOrder();
  }

  finalizeOrder() {
    if (!this.container) return;
    const planeElements = Array.from(this.container.querySelectorAll('.lock-plane'));
    const nextOrder = [];
    planeElements.forEach((element) => {
      const plane = this.planes.find((item) => item.id === element.dataset.id);
      if (plane) {
        nextOrder.push(plane);
      }
    });
    this.order = nextOrder;
    planeElements.forEach((element, index) => {
      element.dataset.index = String(index);
    });
    this.dispatchEvent(
      new CustomEvent('orderchange', {
        detail: {
          order: this.getPlaneSummaries(),
        },
      }),
    );
  }
}
