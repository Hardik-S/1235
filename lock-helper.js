const diacriticPattern = /\p{Diacritic}/gu;
const alphaPattern = /[a-z]/;

export const ALL_WORDS = [
  'Arbre',
  'Nazareth',
  'Nodal',
  'Alea',
  'Ymagier',
  'Anchor',
  'Pencil',
  'Heater',
  'Moon',
  'Siella',
  'Lingerie',
  'Western',
];

export const TARGET_SEQUENCE = ['Arbre', 'Nazareth', 'Alea', 'Nodal', 'Ymagier', 'Anchor'];

export function normalizeWord(value) {
  const stringValue = typeof value === 'string' ? value : String(value ?? '');
  return stringValue
    .normalize('NFD')
    .replace(diacriticPattern, '')
    .trim()
    .toLowerCase();
}

function shuffle(values) {
  const array = [...values];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }
  return array;
}

function createTile(word, index) {
  return {
    id: `tile-${index}`,
    word,
    normalized: normalizeWord(word),
  };
}

export class SigilBoardHelper extends EventTarget {
  constructor(words = ALL_WORDS, target = TARGET_SEQUENCE) {
    super();
    this.words = [...words];
    this.targetWords = [...target];
    this.targetNormalized = this.targetWords.map((word) => normalizeWord(word));
    this.tiles = new Map();
    this.locations = new Map();
    this.state = {
      source: [],
      staging: new Array(this.targetWords.length).fill(null),
      final: new Array(this.targetWords.length).fill(null),
    };
    this.successAchieved = false;
    this.initializeTiles();
  }

  initializeTiles() {
    this.tiles.clear();
    this.locations.clear();
    this.state.source = [];
    this.state.staging = new Array(this.targetWords.length).fill(null);
    this.state.final = new Array(this.targetWords.length).fill(null);

    const ordered = shuffle(this.words);
    ordered.forEach((word, index) => {
      const tile = createTile(word, index);
      this.tiles.set(tile.id, tile);
      this.state.source.push(tile.id);
      this.locations.set(tile.id, { area: 'source', index: null });
    });
    this.successAchieved = false;
  }

  getState() {
    return this.createSnapshot();
  }

  reset() {
    this.initializeTiles();
    this.emitState({ suppressSuccess: true });
  }

  createSnapshot() {
    const describe = (id) => {
      if (!id) return null;
      const tile = this.tiles.get(id);
      const location = this.locations.get(id);
      return tile
        ? {
            id: tile.id,
            word: tile.word,
            normalized: tile.normalized,
            location: location?.area ?? 'source',
            index: location?.index ?? null,
          }
        : null;
    };

    return {
      source: this.state.source.map((id) => describe(id)).filter((tile) => tile != null),
      staging: this.state.staging.map((id, index) => {
        const tile = describe(id);
        return tile ? { ...tile, index } : null;
      }),
      final: this.state.final.map((id, index) => {
        const tile = describe(id);
        return tile ? { ...tile, index } : null;
      }),
    };
  }

  emitState(options = {}) {
    const snapshot = this.createSnapshot();
    this.dispatchEvent(
      new CustomEvent('statechange', {
        detail: snapshot,
      }),
    );
    const success = this.checkSuccess();
    if (success && !this.successAchieved && !options.suppressSuccess) {
      this.successAchieved = true;
      this.dispatchEvent(
        new CustomEvent('success', {
          detail: snapshot,
        }),
      );
    } else {
      this.successAchieved = success;
    }
  }

  checkSuccess() {
    const finalWords = this.state.final.map((id) => {
      if (!id) return null;
      const tile = this.tiles.get(id);
      return tile ? tile.normalized : null;
    });
    if (finalWords.some((value) => value == null)) {
      return false;
    }
    return finalWords.every((value, index) => value === this.targetNormalized[index]);
  }

  removeFromSource(tileId) {
    const index = this.state.source.indexOf(tileId);
    if (index !== -1) {
      this.state.source.splice(index, 1);
    }
  }

  moveTileToSource(tileId) {
    if (!this.tiles.has(tileId)) return false;
    const location = this.locations.get(tileId);
    if (location?.area === 'staging') {
      this.state.staging[location.index] = null;
    } else if (location?.area === 'final') {
      this.state.final[location.index] = null;
    } else if (location?.area === 'source') {
      return true;
    }
    this.removeFromSource(tileId);
    this.state.source.push(tileId);
    this.locations.set(tileId, { area: 'source', index: null });
    this.emitState();
    return true;
  }

  placeTileInStaging(tileId, slotIndex = null) {
    if (!this.tiles.has(tileId)) return false;
    const targetSlot =
      slotIndex != null && slotIndex >= 0 && slotIndex < this.state.staging.length
        ? slotIndex
        : this.state.staging.findIndex((entry) => entry == null);
    if (targetSlot === -1) {
      return false;
    }

    const location = this.locations.get(tileId);
    if (location?.area === 'staging' && location.index === targetSlot) {
      return true;
    }

    if (location?.area === 'final') {
      this.state.final[location.index] = null;
    }
    if (location?.area === 'staging') {
      this.state.staging[location.index] = null;
    }
    this.removeFromSource(tileId);

    if (this.state.staging[targetSlot] && this.state.staging[targetSlot] !== tileId) {
      return false;
    }

    this.state.staging[targetSlot] = tileId;
    this.locations.set(tileId, { area: 'staging', index: targetSlot });
    this.emitState();
    return true;
  }

  promoteStagingTile(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.state.staging.length) return false;
    const tileId = this.state.staging[slotIndex];
    if (!tileId) return false;
    const occupying = this.state.final[slotIndex];
    if (occupying && occupying !== tileId) {
      return false;
    }
    this.state.staging[slotIndex] = null;
    this.state.final[slotIndex] = tileId;
    this.locations.set(tileId, { area: 'final', index: slotIndex });
    this.emitState();
    return true;
  }

  returnFinalToStaging(columnIndex) {
    if (columnIndex < 0 || columnIndex >= this.state.final.length) return false;
    const tileId = this.state.final[columnIndex];
    if (!tileId) return false;
    if (this.state.staging[columnIndex]) {
      return false;
    }
    this.state.final[columnIndex] = null;
    this.state.staging[columnIndex] = tileId;
    this.locations.set(tileId, { area: 'staging', index: columnIndex });
    this.emitState();
    return true;
  }

  completeImmediately() {
    this.initializeTiles();
    const used = new Set();
    this.targetNormalized.forEach((normalized, index) => {
      const match = Array.from(this.tiles.values()).find(
        (tile) => tile.normalized === normalized && !used.has(tile.id),
      );
      if (!match) {
        return;
      }
      used.add(match.id);
      this.removeFromSource(match.id);
      this.state.final[index] = match.id;
      this.locations.set(match.id, { area: 'final', index });
    });
    this.successAchieved = this.checkSuccess();
    this.emitState({ suppressSuccess: true });
  }
}
