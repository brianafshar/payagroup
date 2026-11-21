// All page copy (sample text, replace later). Every string has fa + en.
export type Bi = { fa: string; en: string };
const b = (fa: string, en: string): Bi => ({ fa, en });

export const HOME = {
  about: {
    title: b("درباره‌ی پایا", "About Paya"),
    p1: b(
      "پایا گروپ از سال ۲۰۰۷ جایی بوده برای کسانی که تمرین را جدی می‌گیرند. ما بسکتبال و بدنسازی را زیر یک سقف جمع کرده‌ایم تا ورزشکار بتواند هم مهارت بسازد، هم قدرت.",
      "Since 2007 Paya Group has been home to people who take training seriously. We bring basketball and bodybuilding under one roof so athletes can build skill and strength in the same place.",
    ),
    p2: b(
      "مربی‌های ما برای هر نفر برنامه‌ی شخصی می‌نویسند، پیشرفتش را پیگیری می‌کنند و با اپلیکیشن پایا هر جلسه را ثبت می‌کنیم تا هیچ تمرینی بی‌نتیجه نماند. (متن نمونه)",
      "Our coaches write a personal program for every member, track progress, and log each session in the Paya app so no workout goes to waste. (sample text)",
    ),
    values: [
      { t: b("انضباط", "Discipline"), d: b("تمرین منظم، هدف مشخص.", "Regular training, clear goals.") },
      { t: b("جمع", "Community"), d: b("کنار هم قوی‌تر می‌شویم.", "We get stronger together.") },
      { t: b("پیشرفت", "Progress"), d: b("هر هفته قدمی جلوتر.", "A step further every week.") },
    ],
  },
  stats: [
    { n: "2007", l: b("سال تأسیس", "Founded") },
    { n: "2", l: b("رشته‌ی ورزشی", "Disciplines") },
    { n: "20+", l: b("مربی", "Coaches") },
    { n: "500+", l: b("ورزشکار فعال", "Active athletes") },
  ],
  journeyTitle: b("مسیر ما", "Our journey"),
  timeline: [
    { y: "2007", t: b("تأسیس باشگاه پایا", "Paya club founded") },
    { y: "2012", t: b("شروع کلاس‌های بسکتبال", "Basketball classes begin") },
    { y: "2018", t: b("گسترش سالن بدنسازی", "Gym expanded") },
    { y: "2024", t: b("راه‌اندازی اپلیکیشن پایا", "Paya app launched") },
    { y: "2026", t: b("وب‌سایت جدید", "New website") },
  ],
  discTitle: b("رشته‌ها", "Disciplines"),
  soon: b("به‌زودی: استخر", "Coming soon: Pool"),
  explore: b("مشاهده", "Explore"),
  basketballSub: b("از مینی‌بسکت تا تیم رقابتی", "From mini-basketball to competitive squads"),
  bodybuildingSub: b("قدرت، حجم و آمادگی با برنامه‌ی شخصی", "Strength, size and fitness with a personal plan"),
  whyTitle: b("چرا پایا؟", "Why Paya?"),
  why: [
    { t: b("مربی‌های باتجربه", "Experienced coaches"), d: b("مربیانی با سابقه‌ی تمرین و مسابقه که برای هر سطح برنامه دارند.", "Coaches with playing and training backgrounds, with plans for every level.") },
    { t: b("برنامه‌ی شخصی در اپ", "Personal program in the app"), d: b("برنامه‌ات را در اپ ببین، هر ست را ثبت کن و پیشرفتت را دنبال کن.", "See your program in the app, log every set and follow your progress.") },
    { t: b("ویدیوی آموزشی هر حرکت", "A video for every move"), d: b("روی اسم هر حرکت در برنامه بزن تا آموزش تصویری‌اش را ببینی.", "Tap any exercise name in your program to watch its tutorial.") },
    { t: b("فضای حرفه‌ای", "Professional space"), d: b("سالن مجهز، تجهیزات استاندارد و محیطی برای تمرکز.", "A well-equipped hall, standard gear and a focused environment.") },
  ],
  exTitle: b("جدیدترین آموزش‌ها", "Latest tutorials"),
  exAll: b("همه‌ی حرکات", "All exercises"),
  plansTitle: b("عضویت", "Membership"),
  plans: [
    { t: b("یک رشته", "Single discipline"), d: b("عضویت در بسکتبال یا بدنسازی با برنامه‌ی گروهی.", "Join basketball or bodybuilding with a group program."), f: [b("دسترسی به کلاس‌ها", "Class access"), b("برنامه در اپ", "Program in the app")] },
    { t: b("هر دو رشته", "Both disciplines"), d: b("ترکیب تمرین بسکتبال و بدنسازی؛ مناسب ورزشکاران رقابتی.", "Combine basketball and bodybuilding; ideal for competitive athletes."), f: [b("همه‌ی کلاس‌ها", "All classes"), b("برنامه‌ی ترکیبی", "Combined program"), b("ارزیابی ماهانه", "Monthly assessment")] },
    { t: b("مربی اختصاصی", "Private coaching"), d: b("جلسات یک‌به‌یک با مربی و برنامه‌ی کاملاً شخصی.", "One-on-one sessions with a coach and a fully personal plan."), f: [b("جلسات خصوصی", "Private sessions"), b("پیگیری هفتگی", "Weekly follow-up")] },
  ],
  plansNote: b("برای قیمت‌ها و ثبت‌نام با ما تماس بگیرید. (نمونه)", "Contact us for prices and sign-up. (sample)"),
  voicesTitle: b("حرف ورزشکارها", "Athletes say"),
  voices: [
    { q: b("برنامه‌ی شخصی و ویدیوهای آموزشی باعث شد فرمم خیلی بهتر شود.", "The personal program and tutorial videos improved my form a lot."), a: b("ورزشکار نمونه ۱", "Sample athlete 1") },
    { q: b("کلاس‌های بسکتبال هم جدی بودند و هم دوستانه.", "Basketball classes are serious and friendly at once."), a: b("ورزشکار نمونه ۲", "Sample athlete 2") },
    { q: b("ثبت تمرین‌ها در اپ انگیزه‌ام را بالا برد.", "Logging workouts in the app keeps me motivated."), a: b("ورزشکار نمونه ۳", "Sample athlete 3") },
  ],
  appTitle: b("اپلیکیشن پایا", "The Paya app"),
  appText: b(
    "برنامه‌ی تمرینی‌ات را در اپ ببین، هر ست را ثبت کن و روی اسم هر حرکت بزن تا ویدیوی آموزشی‌اش را در همین سایت ببینی. مربی هم پیشرفتت را لحظه‌ای دنبال می‌کند.",
    "See your training plan in the app, log every set and tap any exercise name to open its video on this site. Your coach follows your progress in real time.",
  ),
  appPoints: [b("برنامه‌ی هفتگی", "Weekly plan"), b("ثبت ست و وزنه", "Set & weight logging"), b("ویدیوی آموزشی", "Video tutorials"), b("پیگیری مربی", "Coach tracking")],
  contactTitle: b("بیایید تمرین کنیم", "Let’s train"),
  contactText: b("برای بازدید، ثبت‌نام یا هر سؤالی با ما در تماس باشید.", "Get in touch for a visit, sign-up or any question."),
  hours: b("ساعت کاری: همه‌ی روزها ۶:۰۰ تا ۲۲:۰۰ (نمونه)", "Hours: every day 6:00–22:00 (sample)"),
  email: "info@payagroup.org",
};

export interface SportContent {
  sport: string;
  n: string;
  title: Bi;
  lead: Bi;
  overviewTitle: Bi;
  p1: Bi;
  p2: Bi;
  highlights: { n: string; l: Bi }[];
  levelsTitle: Bi;
  levels: { t: Bi; age: Bi; d: Bi }[];
  scheduleTitle: Bi;
  schedule: { d: Bi; t: Bi; l: Bi }[];
  coachesTitle: Bi;
  coaches: { n: Bi; r: Bi }[];
  methodTitle: Bi;
  method: { t: Bi; d: Bi }[];
  facilitiesTitle: Bi;
  facilities: Bi[];
  faqTitle: Bi;
  faq: { q: Bi; a: Bi }[];
  ctaTitle: Bi;
  ctaText: Bi;
}

export const BASKETBALL: SportContent = {
  sport: "basketball",
  n: "01",
  title: b("بسکتبال", "Basketball"),
  lead: b("مهارت، سرعت و کار تیمی؛ از اولین دریبل تا بازی رسمی.", "Skill, speed and teamwork; from your first dribble to match day."),
  overviewTitle: b("درباره‌ی بسکتبال پایا", "About Paya basketball"),
  p1: b(
    "کلاس‌های بسکتبال پایا برای همه‌ی سطح‌ها برگزار می‌شود. در هر جلسه گرم‌کردن اصولی، تمرین مهارت‌های فردی، تمرین تاکتیکی و بازی داریم.",
    "Paya basketball runs classes for every level. Each session has a proper warm-up, individual skill work, tactical drills and game play.",
  ),
  p2: b(
    "علاوه بر زمین، تمرین‌های آمادگی جسمانی و پرش هم در برنامه است و ویدیوی هر تمرین در بخش آموزش حرکات همین سایت قرار دارد. (متن نمونه)",
    "Beyond the court, conditioning and jump work are part of the plan, and every drill has a video in the exercise tutorials section. (sample text)",
  ),
  highlights: [
    { n: "3", l: b("سطح تمرینی", "Training levels") },
    { n: "5", l: b("مربی", "Coaches") },
    { n: "12", l: b("جلسه در هفته", "Sessions a week") },
    { n: "4", l: b("تیم رقابتی", "Competitive teams") },
  ],
  levelsTitle: b("سطح‌ها", "Levels"),
  levels: [
    { t: b("مینی‌بسکت", "Mini-basketball"), age: b("۶ تا ۹ سال", "Ages 6–9"), d: b("یادگیری با بازی: هماهنگی، توپ‌گیری و علاقه به ورزش.", "Learning through play: coordination, ball feel and a love for the game.") },
    { t: b("نوجوانان", "Juniors"), age: b("۱۰ تا ۱۶ سال", "Ages 10–16"), d: b("اصول دریبل، پاس، شوت و دفاع و آشنایی با قوانین و بازی تیمی.", "Fundamentals of dribbling, passing, shooting and defense, plus rules and team play.") },
    { t: b("بزرگسالان و رقابتی", "Adults & competitive"), age: b("۱۷ سال به بالا", "Ages 17+"), d: b("تمرین تاکتیکی، بازی‌های تدارکاتی و آمادگی مسابقات.", "Tactical training, scrimmages and competition prep.") },
  ],
  scheduleTitle: b("برنامه‌ی هفتگی (نمونه)", "Weekly schedule (sample)"),
  schedule: [
    { d: b("شنبه و دوشنبه", "Sat & Mon"), t: b("۱۶:۰۰ – ۱۷:۳۰", "4:00 – 5:30 PM"), l: b("مینی‌بسکت", "Mini-basketball") },
    { d: b("شنبه و دوشنبه", "Sat & Mon"), t: b("۱۷:۳۰ – ۱۹:۳۰", "5:30 – 7:30 PM"), l: b("نوجوانان", "Juniors") },
    { d: b("یکشنبه و سه‌شنبه", "Sun & Tue"), t: b("۱۹:۳۰ – ۲۱:۳۰", "7:30 – 9:30 PM"), l: b("بزرگسالان", "Adults") },
    { d: b("پنجشنبه", "Thursday"), t: b("۱۸:۰۰ – ۲۰:۰۰", "6:00 – 8:00 PM"), l: b("بازی تدارکاتی", "Scrimmage") },
  ],
  coachesTitle: b("مربی‌ها (نمونه)", "Coaches (sample)"),
  coaches: [
    { n: b("مربی نمونه ۱", "Coach Sample 1"), r: b("سرمربی", "Head coach") },
    { n: b("مربی نمونه ۲", "Coach Sample 2"), r: b("مربی نوجوانان", "Juniors coach") },
    { n: b("مربی نمونه ۳", "Coach Sample 3"), r: b("مربی آمادگی جسمانی", "Conditioning coach") },
  ],
  methodTitle: b("روش تمرین", "How we train"),
  method: [
    { t: b("ارزیابی", "Assess"), d: b("تست مهارت و آمادگی در جلسه‌ی اول.", "Skill and fitness check in the first session.") },
    { t: b("برنامه", "Plan"), d: b("تعیین سطح و هدف و نوشتن برنامه‌ی تمرین.", "Placement, goals and a written plan.") },
    { t: b("تمرین", "Train"), d: b("مهارت، تاکتیک و آمادگی جسمانی هفته‌به‌هفته.", "Skills, tactics and conditioning week by week.") },
    { t: b("پیگیری", "Track"), d: b("ثبت تمرین‌ها در اپ و بازبینی ماهانه.", "Sessions logged in the app and reviewed monthly.") },
  ],
  facilitiesTitle: b("امکانات", "Facilities"),
  facilities: [
    b("سالن سرپوشیده با کف مناسب بسکتبال", "Indoor hall with a proper basketball floor"),
    b("تابلو و حلقه‌های استاندارد", "Standard backboards and rims"),
    b("توپ و تجهیزات تمرینی کافی", "Plenty of balls and training gear"),
    b("رختکن و کمد", "Locker rooms"),
    b("دسترسی به سالن بدنسازی برای آمادگی جسمانی", "Access to the gym for conditioning"),
  ],
  faqTitle: b("سؤال‌های رایج", "FAQ"),
  faq: [
    { q: b("برای شروع تجربه‌ی قبلی لازم است؟", "Do I need prior experience?"), a: b("نه. در جلسه‌ی اول سطح شما مشخص می‌شود و در گروه مناسب قرار می‌گیرید.", "No. Your level is set in the first session and you join the right group.") },
    { q: b("چه وسایلی لازم است؟", "What should I bring?"), a: b("لباس و کفش ورزشی مخصوص سالن و بطری آب. توپ را باشگاه تأمین می‌کند.", "Indoor sports shoes, sportswear and a water bottle. The club provides balls.") },
    { q: b("جلسه‌ی آزمایشی دارید؟", "Is there a trial session?"), a: b("بله، برای اطلاع از زمان آن با ما تماس بگیرید. (نمونه)", "Yes, contact us for the next trial slot. (sample)") },
    { q: b("ویدیوی تمرین‌ها را از کجا ببینم؟", "Where can I watch the drills?"), a: b("در بخش آموزش حرکات همین سایت یا با زدن روی اسم حرکت در برنامه‌ی PDF.", "In the exercise tutorials section, or by tapping an exercise name in your PDF program.") },
  ],
  ctaTitle: b("به تیم بپیوند", "Join the team"),
  ctaText: b("برای جلسه‌ی آزمایشی و ثبت‌نام با ما تماس بگیرید.", "Contact us for a trial session and sign-up."),
};

export const BODYBUILDING: SportContent = {
  sport: "fitness",
  n: "02",
  title: b("بدنسازی", "Bodybuilding"),
  lead: b("قدرت و حجم با برنامه‌ی شخصی و پیگیری هر ست.", "Strength and size with a personal plan and every set tracked."),
  overviewTitle: b("درباره‌ی بدنسازی پایا", "About Paya bodybuilding"),
  p1: b(
    "سالن بدنسازی پایا برای کسانی است که می‌خواهند اصولی و ایمن قوی‌تر شوند. هر عضو با ارزیابی شروع می‌کند و برنامه‌اش بر اساس هدفش نوشته می‌شود.",
    "Paya’s gym is for people who want to get stronger safely and properly. Every member starts with an assessment and gets a program built around their goal.",
  ),
  p2: b(
    "برنامه در اپ پایا است؛ هر حرکت ویدیوی آموزشی دارد و مربی می‌تواند وزنه‌ها و پیشرفت تو را ببیند و برنامه را به‌روز کند. (متن نمونه)",
    "Your program lives in the Paya app; each move has a tutorial video and your coach can see your weights and progress and update the plan. (sample text)",
  ),
  highlights: [
    { n: "6–22", l: b("ساعت کاری", "Open hours") },
    { n: "10+", l: b("مربی", "Coaches") },
    { n: "100+", l: b("حرکت آموزشی", "Tutorial moves") },
    { n: "1:1", l: b("برنامه‌ی شخصی", "Personal plans") },
  ],
  levelsTitle: b("مسیرهای تمرین", "Training tracks"),
  levels: [
    { t: b("شروع", "Starter"), age: b("مبتدی", "Beginner"), d: b("یادگیری حرکات پایه، فرم درست و عادت تمرین منظم.", "Learn the basic lifts, good form and a regular routine.") },
    { t: b("حجم و قدرت", "Size & strength"), age: b("متوسط", "Intermediate"), d: b("برنامه‌های تقسیم‌بندی‌شده با اضافه‌بار تدریجی.", "Split programs with progressive overload.") },
    { t: b("رقابتی", "Competitive"), age: b("پیشرفته", "Advanced"), d: b("آمادگی مسابقه با برنامه‌ی دقیق تمرین و پیگیری نزدیک.", "Contest prep with precise programming and close follow-up.") },
  ],
  scheduleTitle: b("ساعت‌های سالن (نمونه)", "Gym hours (sample)"),
  schedule: [
    { d: b("شنبه تا چهارشنبه", "Sat – Wed"), t: b("۶:۰۰ – ۲۲:۰۰", "6:00 AM – 10:00 PM"), l: b("سالن آزاد", "Open gym") },
    { d: b("پنجشنبه", "Thursday"), t: b("۸:۰۰ – ۲۰:۰۰", "8:00 AM – 8:00 PM"), l: b("سالن آزاد", "Open gym") },
    { d: b("جمعه", "Friday"), t: b("۹:۰۰ – ۱۳:۰۰", "9:00 AM – 1:00 PM"), l: b("سالن آزاد", "Open gym") },
    { d: b("شنبه و دوشنبه", "Sat & Mon"), t: b("۱۸:۰۰ – ۱۹:۰۰", "6:00 – 7:00 PM"), l: b("کلاس گروهی قدرت", "Group strength class") },
  ],
  coachesTitle: b("مربی‌ها (نمونه)", "Coaches (sample)"),
  coaches: [
    { n: b("مربی نمونه ۱", "Coach Sample 1"), r: b("سرمربی بدنسازی", "Head strength coach") },
    { n: b("مربی نمونه ۲", "Coach Sample 2"), r: b("مربی تغذیه و برنامه", "Nutrition & programming") },
    { n: b("مربی نمونه ۳", "Coach Sample 3"), r: b("مربی اصلاحی", "Corrective coach") },
  ],
  methodTitle: b("روش تمرین", "How we train"),
  method: [
    { t: b("ارزیابی", "Assess"), d: b("بررسی ترکیب بدن، حرکت‌پذیری و هدف.", "Body composition, mobility and goal check.") },
    { t: b("برنامه", "Plan"), d: b("برنامه‌ی هفتگی شخصی در اپ پایا.", "A personal weekly plan in the Paya app.") },
    { t: b("تمرین", "Train"), d: b("اجرای درست با ویدیوی آموزشی و کمک مربی.", "Correct execution with tutorial videos and coach support.") },
    { t: b("پیشرفت", "Progress"), d: b("ثبت ست‌ها و اضافه‌بار تدریجی هر هفته.", "Log sets and progressively overload every week.") },
  ],
  facilitiesTitle: b("امکانات", "Facilities"),
  facilities: [
    b("وزنه‌های آزاد، رک و نیمکت‌های متعدد", "Free weights, racks and plenty of benches"),
    b("دستگاه‌های پرس و کابل", "Press and cable machines"),
    b("بخش کاردیو", "Cardio area"),
    b("فضای کشش و تحرک‌پذیری", "Stretching and mobility zone"),
    b("رختکن، کمد و آبسردکن", "Lockers, changing rooms and water"),
  ],
  faqTitle: b("سؤال‌های رایج", "FAQ"),
  faq: [
    { q: b("مبتدی هستم؛ از کجا شروع کنم؟", "I’m a beginner; where do I start?"), a: b("با یک جلسه‌ی ارزیابی. مربی حرکات پایه را یادت می‌دهد و برنامه‌ی ساده می‌نویسد.", "With an assessment session. A coach teaches the basics and writes a simple plan.") },
    { q: b("برنامه‌ام را از کجا ببینم؟", "Where do I see my program?"), a: b("در اپلیکیشن پایا و به‌صورت PDF؛ اسم هر حرکت لینک آموزش آن است.", "In the Paya app or as a PDF; each exercise name links to its tutorial.") },
    { q: b("مربی اختصاصی دارید؟", "Do you offer private coaching?"), a: b("بله، برای اطلاعات بیشتر تماس بگیرید. (نمونه)", "Yes, contact us for details. (sample)") },
    { q: b("ویدیوها از کجا می‌آیند؟", "Where do the videos come from?"), a: b("مربی‌های پایا ویدیوها را در اپ بارگذاری می‌کنند و خودکار اینجا نمایش داده می‌شوند.", "Paya coaches upload them in the app and they appear here automatically.") },
  ],
  ctaTitle: b("شروع کن", "Get started"),
  ctaText: b("برای ارزیابی رایگان و ثبت‌نام با ما تماس بگیرید. (نمونه)", "Contact us for a free assessment and sign-up. (sample)"),
};
