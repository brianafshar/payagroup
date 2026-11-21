import { createContext, useContext } from "react";
import type { Lang } from "./types";

export const LangContext = createContext<Lang>("fa");
export const useLang = () => useContext(LangContext);

type Str = { fa: string; en: string };

export const S = {
  nav: {
    home: { fa: "خانه", en: "Home" },
    basketball: { fa: "بسکتبال", en: "Basketball" },
    bodybuilding: { fa: "بدنسازی", en: "Bodybuilding" },
    exercises: { fa: "آموزش حرکات", en: "Exercises" },
    contact: { fa: "تماس", en: "Contact" },
    menu: { fa: "منو", en: "Menu" },
    close: { fa: "بستن", en: "Close" },
    switchTo: { fa: "English", en: "فارسی" },
  },
  hint: {
    home: { fa: "باشگاه پایا", en: "The Paya club" },
    basketball: { fa: "کلاس‌ها و تمرین‌های تیمی", en: "Classes and team training" },
    bodybuilding: { fa: "قدرت، حجم، آمادگی", en: "Strength, size, fitness" },
    exercises: { fa: "ویدیوی آموزشی هر حرکت", en: "A tutorial video for every move" },
    contact: { fa: "آدرس و ارتباط با ما", en: "Find and reach us" },
  },
  home: {
    kicker: { fa: "از ۲۰۰۷", en: "Since 2007" },
    tagline: { fa: "باشگاهی برای کسانی که جدی تمرین می‌کنند.", en: "A club for people who train with intent." },
    scroll: { fa: "اسکرول کنید", en: "Scroll" },
    aboutTitle: { fa: "درباره‌ی پایا", en: "About Paya" },
    aboutText: {
      fa: "پایا گروپ یک مجموعه‌ی ورزشی است که بسکتبال و بدنسازی را در یک مکان کنار هم می‌آورد. مربی‌های باتجربه، برنامه‌ی تمرینی شخصی و اپلیکیشن اختصاصی، همه برای اینکه هر تمرین به نتیجه برسد. (متن نمونه)",
      en: "Paya Group is a sports club bringing basketball and bodybuilding under one roof. Experienced coaches, personal programs and a dedicated app, all so every session counts. (sample text)",
    },
    stats: [
      { n: "2007", l: { fa: "سال تأسیس", en: "Founded" } },
      { n: "2", l: { fa: "رشته‌ی ورزشی", en: "Disciplines" } },
      { n: "20+", l: { fa: "مربی", en: "Coaches" } },
      { n: "500+", l: { fa: "ورزشکار", en: "Athletes" } },
    ] as { n: string; l: Str }[],
    disciplines: { fa: "رشته‌ها", en: "Disciplines" },
    soon: { fa: "به‌زودی: استخر", en: "Coming soon: Pool" },
    explore: { fa: "مشاهده", en: "Explore" },
    exTitle: { fa: "جدیدترین آموزش‌ها", en: "Latest tutorials" },
    exAll: { fa: "همه‌ی حرکات", en: "All exercises" },
    appTitle: { fa: "اپلیکیشن پایا", en: "The Paya app" },
    appText: {
      fa: "برنامه‌ی تمرینی‌ات را در اپ ببین، هر ست را ثبت کن و روی اسم هر حرکت بزن تا ویدیوی آموزشی‌اش را ببینی.",
      en: "Follow your program in the app, log every set, and tap any exercise name to watch its tutorial.",
    },
  },
  sport: {
    about: { fa: "درباره‌ی این بخش", en: "About this program" },
    schedule: { fa: "برنامه‌ی هفتگی (نمونه)", en: "Weekly schedule (sample)" },
    coaches: { fa: "مربی‌ها (نمونه)", en: "Coaches (sample)" },
    related: { fa: "حرکات آموزشی", en: "Tutorial videos" },
    seeAll: { fa: "مشاهده‌ی همه", en: "See all" },
    join: { fa: "عضویت در این بخش", en: "Join this program" },
  },
  ex: {
    title: { fa: "آموزش حرکات", en: "Exercise tutorials" },
    sub: {
      fa: "ویدیو، نحوه‌ی اجرا و نکات هر حرکت. هر حرکتی که مربی‌ها در اپ ویدیو برایش بارگذاری کنند، اینجا ظاهر می‌شود.",
      en: "Video, technique and tips for every move. Any exercise a coach uploads a video for in the app appears here.",
    },
    search: { fa: "جستجوی حرکت…", en: "Search exercises…" },
    all: { fa: "همه", en: "All" },
    sport: { fa: "رشته", en: "Sport" },
    category: { fa: "دسته‌بندی", en: "Category" },
    empty: { fa: "حرکتی پیدا نشد.", en: "No exercises found." },
    loading: { fa: "در حال بارگذاری…", en: "Loading…" },
    error: { fa: "خطا در دریافت حرکات.", en: "Couldn’t load exercises." },
    retry: { fa: "تلاش دوباره", en: "Try again" },
    back: { fa: "بازگشت به همه‌ی حرکات", en: "Back to all exercises" },
    how: { fa: "نحوه‌ی اجرا", en: "How to perform" },
    tips: { fa: "نکات", en: "Tips" },
    primary: { fa: "عضلات اصلی", en: "Primary muscles" },
    secondary: { fa: "عضلات کمکی", en: "Secondary muscles" },
    equipment: { fa: "وسیله", en: "Equipment" },
    level: { fa: "سطح", en: "Level" },
    noVideo: { fa: "ویدیو به‌زودی", en: "Video coming soon" },
    notFound: { fa: "این حرکت پیدا نشد.", en: "Exercise not found." },
  },
  footer: {
    contact: { fa: "تماس با ما", en: "Contact us" },
    address: { fa: "آدرس: تهران، مجموعه ورزشی گلبانگ", en: "Address: Golbang Sport Complex, Tehran" },
    openMap: { fa: "مسیریابی در گوگل‌مپ", en: "Open in Google Maps" },
    phone: { fa: "تلفن: ۰۲۱-۰۰۰۰۰۰۰۰", en: "Phone: +98 21 0000 0000" },
    rights: { fa: "تمامی حقوق محفوظ است.", en: "All rights reserved." },
  },
} as const;

export function tr(s: Str, lang: Lang): string {
  return s[lang];
}
