export function normalizeLookupSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function formatUnqInput(value: unknown): string {
  const normalized = normalizeLookupSlug(value);
  const letters = normalized.replace(/[^A-Z]/g, '').slice(0, 3);
  const digits = normalized.replace(/\D/g, '').slice(0, 3);
  if (letters.length < 3) {
    return letters;
  }
  return `${letters}${digits}`;
}

export function isCompleteUnq(value: unknown): boolean {
  return /^[A-Z]{3}\d{3}$/.test(String(value ?? '').trim().toUpperCase());
}

export function hasLookupSlug(value: unknown): boolean {
  return normalizeLookupSlug(value).length > 0;
}
