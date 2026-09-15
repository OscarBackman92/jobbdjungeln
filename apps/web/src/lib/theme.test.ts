import { describe, expect, it } from 'vitest';
import { migrateStoredTheme, normalizeThemeStorage } from './theme.ts';

describe('migrateStoredTheme', () => {
  it('keeps known values', () => {
    expect(migrateStoredTheme('light')).toBe('light');
    expect(migrateStoredTheme('dark')).toBe('dark');
    expect(migrateStoredTheme('system')).toBe('system');
  });

  it('maps daylight to light and unknowns to system', () => {
    expect(migrateStoredTheme('daylight')).toBe('light');
    expect(migrateStoredTheme('sepia')).toBe('system');
    expect(migrateStoredTheme(null)).toBe('system');
    expect(migrateStoredTheme(undefined)).toBe('system');
  });
});

describe('normalizeThemeStorage', () => {
  it('rewrites daylight in storage', () => {
    const store = new Map<string, string>([['theme', 'daylight']]);
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(normalizeThemeStorage(storage)).toBe('light');
    expect(store.get('theme')).toBe('light');
  });
});
