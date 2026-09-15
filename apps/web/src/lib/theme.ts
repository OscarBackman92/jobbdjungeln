export const THEME_VALUES = ['light', 'dark', 'system'] as const;
export type ThemeValue = (typeof THEME_VALUES)[number];

/** Map legacy / unknown stored values onto the three radios the UI exposes. */
export function migrateStoredTheme(value: string | null | undefined): ThemeValue {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  if (value === 'daylight') return 'light';
  return 'system';
}

/**
 * Read `localStorage.theme`, migrate unknown values, and write back when needed.
 * Failures are ignored — private mode must not break the page.
 */
export function normalizeThemeStorage(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined = globalThis.localStorage,
  key = 'theme',
): ThemeValue {
  if (!storage) return 'system';
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return 'system';
  }
  const next = migrateStoredTheme(raw);
  if (raw !== next) {
    try {
      storage.setItem(key, next);
    } catch {
      // Ignore quota / private-mode errors.
    }
  }
  return next;
}
