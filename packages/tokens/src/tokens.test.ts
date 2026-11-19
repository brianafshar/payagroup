import { describe, expect, it } from 'vitest';
import { buildCss, colors, contrast, themeNames } from './index';

describe('tokens', () => {
  it('emits a block for every theme in both modes', () => {
    const css = buildCss();
    for (const t of themeNames) {
      if (t === 'base') continue;
      expect(css).toContain(`[data-theme="${t}"] {`);
      expect(css).toContain(`:root[data-mode="dark"] [data-theme="${t}"]`);
    }
  });

  it('keeps the platform orange in both modes', () => {
    expect(colors('brand', 'light')['brand-primary'].toLowerCase()).toBe('#ff9a1f');
    expect(colors('brand', 'dark')['brand-primary'].toLowerCase()).toBe('#ff9a1f');
  });

  it('keeps brand text at AA contrast on dark surfaces for every white-label theme', () => {
    for (const t of themeNames) {
      const c = colors(t, 'dark');
      expect(contrast(c['brand-primary-text'], c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c['text-primary'], c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c['text-muted'], c.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
