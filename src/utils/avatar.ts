const GRADIENTS = [
  ['#1A1A1A', '#0F0F0F'],
  ['#262626', '#141414'],
  ['#2F2F2F', '#1A1A1A'],
  ['#3A3A3A', '#1F1F1F'],
  ['#E8DFC8', '#CFC1A2'],
  ['#D7CCB3', '#BFB197'],
  ['#4A4A4A', '#2A2A2A'],
  ['#5B5B5B', '#333333'],
] as const;

function hash(input: string): number {
  let value = 0;
  for (let i = 0; i < input.length; i += 1) {
    value = (value << 5) - value + input.charCodeAt(i);
    value |= 0;
  }
  return Math.abs(value);
}

export function getAvatarGradient(seed?: string): readonly [string, string] {
  const safeSeed = (seed || 'UNQX').trim().toUpperCase();
  const index = hash(safeSeed) % GRADIENTS.length;
  return GRADIENTS[index];
}

export function formatSlug(raw?: string): string {
  const value = String(raw || '').toUpperCase().trim();
  if (!value) return 'UNQ · 000';

  const clean = value.replace(/[^A-Z0-9]/g, '');
  const letters = clean.replace(/[^A-Z]/g, '').slice(0, 3);
  const digits = clean.replace(/\D/g, '').slice(0, 3);
  if (letters && digits) {
    return `${letters} · ${digits}`;
  }
  if (clean.length > 3) {
    return `${clean.slice(0, 3)} · ${clean.slice(3)}`;
  }
  return clean;
}
