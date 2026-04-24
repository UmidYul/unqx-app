export function normalizeLookupSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function hasLookupSlug(value: unknown): boolean {
  return normalizeLookupSlug(value).length > 0;
}
