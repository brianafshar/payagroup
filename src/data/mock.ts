import type { Exercise } from "../types";

// Sample data used when VITE_API_URL is not set. Replace by the real API (see docs/API-CONTRACT.md).
const base = { video_url: "", duration: "0:45" };

export const MOCK_EXERCISES: Exercise[] = [
  {
    ...base, id: 1, name: "پرس سینه هالتر", name_en: "Barbell Bench Press",
    description: "حرکت پایه سینه با هالتر روی نیمکت صاف.",
    description_en: "The foundational chest lift with a barbell on a flat bench.",
    category: "chest", sport: "fitness", equipment: "barbell", difficulty: "intermediate",
    steps: ["روی نیمکت بخواب و کتف‌ها را جمع کن.", "هالتر را تا وسط سینه پایین بیاور.", "به بالا پرس کن."],
    steps_en: ["Lie on the bench and pull your shoulder blades together.", "Lower the bar to mid-chest.", "Press back up."],
    tips: ["آرنج‌ها حدود ۴۵ درجه از بدن فاصله داشته باشند."],
    tips_en: ["Keep elbows at about 45° from your body."],
  },
  {
    ...base, id: 2, name: "اسکوات هالتر", name_en: "Barbell Squat",
    description: "حرکت پایه پا با هالتر روی شانه.",
    description_en: "The classic leg builder with the bar on your back.",
    category: "legs", sport: "fitness", equipment: "barbell", difficulty: "intermediate",
    steps: ["هالتر را روی کتف‌ها بگذار.", "تا موازی زمین پایین برو.", "از پاشنه فشار بده و بالا بیا."],
    steps_en: ["Set the bar on your upper back.", "Squat to parallel.", "Drive through your heels to stand."],
  },
  {
    ...base, id: 3, name: "ددلیفت", name_en: "Deadlift",
    description: "بلند کردن هالتر از زمین با کمر صاف.",
    description_en: "Lift the bar from the floor with a neutral spine.",
    category: "back", sport: "fitness", equipment: "barbell", difficulty: "advanced",
  },
  {
    ...base, id: 4, name: "جلو بازو دمبل", name_en: "Dumbbell Curl",
    description: "تمرین ایزوله برای جلو بازو.",
    description_en: "An isolation move for the biceps.",
    category: "arms", sport: "fitness", equipment: "dumbbell", difficulty: "beginner",
  },
  {
    ...base, id: 5, name: "دریبل دو توپ", name_en: "Two-Ball Dribbling",
    description: "تمرین کنترل توپ با هر دو دست.",
    description_en: "Ball-handling drill using both hands at once.",
    category: "dribbling", sport: "basketball", equipment: "ball", difficulty: "intermediate",
  },
  {
    ...base, id: 6, name: "شوت از زیر سبد", name_en: "Close-Range Shooting Form",
    description: "اصلاح فرم شوت نزدیک سبد.",
    description_en: "Perfect your shooting form close to the rim.",
    category: "shooting", sport: "basketball", equipment: "ball", difficulty: "beginner",
  },
  {
    ...base, id: 7, name: "پرش جعبه", name_en: "Box Jump",
    description: "تمرین قدرت انفجاری پا.",
    description_en: "Explosive leg power training.",
    category: "power", sport: "basketball", equipment: "none", difficulty: "intermediate",
  },
  {
    ...base, id: 8, name: "پلانک", name_en: "Plank",
    description: "تمرین ایستا برای میان‌تنه.",
    description_en: "A static hold for core strength.",
    category: "core", sport: "fitness", equipment: "bodyweight", difficulty: "beginner",
  },
];
