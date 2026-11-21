export type Lang = "fa" | "en";
export const LANGS: Lang[] = ["fa", "en"];

export interface Exercise {
  id: number;
  name: string;
  name_en?: string;
  description: string;
  description_en?: string;
  category: string;
  sport: string;
  equipment: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration?: string;
  video_url: string;
  image_url?: string;
  steps?: string[];
  steps_en?: string[];
  tips?: string[];
  tips_en?: string[];
  muscles_primary?: string[];
  muscles_secondary?: string[];
  updated_at?: string;
}
