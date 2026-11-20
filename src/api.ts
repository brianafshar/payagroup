import type { Exercise } from "./types";
import { MOCK_EXERCISES } from "./data/mock";

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

let cache: Promise<Exercise[]> | null = null;

function absolutize(url: string | undefined): string {
  if (!url) return "";
  if (/^https?:\/\//.test(url) || !API) return url;
  const origin = new URL(API).origin;
  return url.startsWith("/") ? origin + url : url;
}

function normalize(e: Exercise): Exercise {
  return { ...e, video_url: absolutize(e.video_url), image_url: absolutize(e.image_url) };
}

/** All public exercises that have a video. Cached for the session. */
export function loadExercises(): Promise<Exercise[]> {
  if (!cache) {
    cache = (async () => {
      if (!API) return MOCK_EXERCISES;
      const res = await fetch(`${API}/public/exercises/`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const list: Exercise[] = Array.isArray(data) ? data : data.results ?? [];
      return list.map(normalize);
    })().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

export async function loadExercise(id: number): Promise<Exercise | null> {
  const all = await loadExercises();
  return all.find((e) => e.id === id) ?? null;
}

/** `/exercises/42-barbell-squat` → 42 */
export function parseSlug(slug: string | undefined): number | null {
  const n = parseInt(slug ?? "", 10);
  return Number.isFinite(n) ? n : null;
}

export function exerciseSlug(e: Exercise): string {
  const words = (e.name_en ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return words ? `${e.id}-${words}` : String(e.id);
}
