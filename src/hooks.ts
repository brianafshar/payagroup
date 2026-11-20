import { useEffect, useState } from "react";
import { useLang } from "./i18n";
import type { Exercise } from "./types";
import { loadExercises } from "./api";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — Paya` : "Paya Group";
  }, [title]);
}

export function useExercises() {
  const [data, setData] = useState<Exercise[] | null>(null);
  const [error, setError] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setError(false);
    loadExercises().then((d) => live && setData(d), () => live && setError(true));
    return () => { live = false; };
  }, [n]);
  return { data, error, retry: () => setN((x) => x + 1) };
}

export function useLocalized() {
  const lang = useLang();
  return {
    name: (e: Exercise) => (lang === "en" && e.name_en) || e.name,
    desc: (e: Exercise) => (lang === "en" && e.description_en) || e.description,
    steps: (e: Exercise) => (lang === "en" && e.steps_en?.length ? e.steps_en : e.steps) ?? [],
    tips: (e: Exercise) => (lang === "en" && e.tips_en?.length ? e.tips_en : e.tips) ?? [],
  };
}
