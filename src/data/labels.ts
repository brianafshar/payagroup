import type { Lang } from "../types";

type Dict = Record<string, { fa: string; en: string }>;

export const CATEGORY: Dict = {
  chest: { fa: "سینه", en: "Chest" },
  back: { fa: "پشت", en: "Back" },
  legs: { fa: "پا", en: "Legs" },
  shoulders: { fa: "سرشانه", en: "Shoulders" },
  arms: { fa: "بازو", en: "Arms" },
  core: { fa: "میان‌تنه", en: "Core" },
  mobility: { fa: "تحرک‌پذیری", en: "Mobility" },
  power: { fa: "قدرت انفجاری", en: "Power" },
  conditioning: { fa: "آمادگی جسمانی", en: "Conditioning" },
  corrective: { fa: "اصلاحی", en: "Corrective" },
  drill: { fa: "تمرین مهارتی", en: "Drills" },
  run: { fa: "دویدن", en: "Running" },
  swim: { fa: "شنا", en: "Swimming" },
  ride: { fa: "دوچرخه", en: "Cycling" },
  shooting: { fa: "شوت", en: "Shooting" },
  dribbling: { fa: "دریبل", en: "Dribbling" },
};

export const SPORT: Dict = {
  fitness: { fa: "بدنسازی", en: "Bodybuilding" },
  basketball: { fa: "بسکتبال", en: "Basketball" },
  running: { fa: "دویدن", en: "Running" },
  swimming: { fa: "شنا", en: "Swimming" },
  cycling: { fa: "دوچرخه", en: "Cycling" },
};

export const EQUIPMENT: Dict = {
  barbell: { fa: "هالتر", en: "Barbell" },
  dumbbell: { fa: "دمبل", en: "Dumbbell" },
  machine: { fa: "دستگاه", en: "Machine" },
  cable: { fa: "کابل", en: "Cable" },
  bodyweight: { fa: "وزن بدن", en: "Bodyweight" },
  band: { fa: "کش", en: "Band" },
  ball: { fa: "توپ", en: "Ball" },
  none: { fa: "بدون وسیله", en: "No equipment" },
};

export const DIFFICULTY: Dict = {
  beginner: { fa: "مبتدی", en: "Beginner" },
  intermediate: { fa: "متوسط", en: "Intermediate" },
  advanced: { fa: "پیشرفته", en: "Advanced" },
};

export function label(dict: Dict, key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? key;
}
