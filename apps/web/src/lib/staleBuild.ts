/**
 * After a deploy the screens' JS chunks get new file names. A tab opened before the deploy still asks for the
 * old ones, they're gone, and the screen fails to load (#86) — a refresh fixes it. So when a chunk fails, the
 * page reloads itself once (fetching the new index.html); a second failure within a minute is a real error.
 */
const KEY = 'indow-chunk-reload';

export function isChunkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  return /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|Unable to preload CSS/i.test(msg);
}

/** Reload once to pick up the new build; false when we just did (then show the error instead). */
export function reloadForNewBuild(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) || 0);
  } catch {
    /* storage blocked */
  }
  if (Date.now() - last < 60_000) return false;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked */
  }
  window.location.reload();
  return true;
}

/** Vite reports a failed chunk preload with this event before the import rejects. */
export function watchStaleBuild(): void {
  window.addEventListener('vite:preloadError', (e) => {
    if (reloadForNewBuild()) e.preventDefault();
  });
}
