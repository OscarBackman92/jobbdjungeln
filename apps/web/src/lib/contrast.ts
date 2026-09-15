/**
 * WCAG 2.1 relative-luminance helpers for design-token contrast checks.
 * Values are the sRGB hex approximations of the CSS tokens we ship.
 */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((part) => part + part)
          .join('')
      : raw;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Token pairs that must clear WCAG AA (4.5:1) for body / help text. */
export const CONTRAST_PAIRS = {
  light: [
    { name: 'text on surface', fg: '#3a382f', bg: '#fbfbf9' },
    { name: 'muted on surface', fg: '#6b6a63', bg: '#fbfbf9' },
    { name: 'subtle on surface', fg: '#73726a', bg: '#fbfbf9' },
    { name: 'muted on raised', fg: '#6b6a63', bg: '#ffffff' },
    { name: 'subtle on raised', fg: '#73726a', bg: '#ffffff' },
  ],
  dark: [
    { name: 'text on surface', fg: '#f0f1f3', bg: '#23252b' },
    { name: 'muted on surface', fg: '#b0b7bf', bg: '#23252b' },
    { name: 'subtle on surface', fg: '#a4abb4', bg: '#23252b' },
    { name: 'muted on raised', fg: '#b0b7bf', bg: '#2c2f37' },
    { name: 'subtle on raised', fg: '#a4abb4', bg: '#2c2f37' },
  ],
} as const;
