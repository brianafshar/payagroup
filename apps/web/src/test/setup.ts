import { buildCss } from '@baseline/tokens';

const style = document.createElement('style');
style.textContent = buildCss();
document.head.appendChild(style);

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
