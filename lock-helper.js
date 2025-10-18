const diacriticPattern = /\p{Diacritic}/gu;

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
