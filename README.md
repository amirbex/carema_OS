# CaReMa OS

**سیستم مدیریت حرفه و پژوهش** — داشبورد پروژه‌ها (جدول/کانبان/آمار)، تایم‌لاین و تقویم (شمسی/میلادی)، دستیار هوش مصنوعی متنی و صوتی، تایمر تمرکز، و پایگاه دانش پروژه.

> Career & Research Manager Operating System — React 19 + TypeScript + Vite + Tailwind 4 + Firebase (Auth/Firestore) + Gemini (server-side).

---

## ۱) اجرای سریع

```bash
npm install
cp .env.example .env        # GEMINI_API_KEY را وارد کنید
npm run dev                 # http://localhost:3000
```

ساخت و اجرای نسخهٔ تولیدی:

```bash
npm run build     # dist/ (کلاینت) + dist/server.cjs (سرور)
npm start         # PORT پیش‌فرض ۳۰۰۰
```

### متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | برای چت و دستیار صوتی. بدون آن بقیهٔ برنامه کار می‌کند و APIها خطای شفاف ۵۰۳ می‌دهند. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | مدل متنی |
| `GEMINI_LIVE_MODEL` | `gemini-2.0-flash-live-001` | مدل گفتگوی صوتی (Live API) |
| `PORT` | `3000` | پورت سرور |
| `VITE_ENABLE_DEMO_LOGIN` | `true` | با `false` دکمهٔ اکانت دمو مخفی می‌شود |

### اسکریپت‌ها

| دستور | کار |
| --- | --- |
| `npm run dev` | اجرای Express + Vite (middleware) |
| `npm run build` | بیلد کلاینت و باندل سرور |
| `npm start` | اجرای بیلد تولیدی |
| `npm run typecheck` / `npm run lint` | بررسی تایپ‌ها (strict) |
| `npm test` | تست‌های واحد helperهای خالص |

---

## ۲) معماری

```
server.ts                  Express + Vite middleware + Gemini + WebSocket /live
src/
  App.tsx                  مسیرها، احراز هویت، ErrorBoundary، lazy loading
  lib/
    firebase.ts            مقداردهی Firebase + probe اتصال
    appData.ts             لایهٔ داده (پروژه/وظیفه/رویداد/فایل/کانتکست AI)
    aiClient.ts            کلاینت API با timeout/abort و خطاهای نوع‌دار
    format.ts              توابع خالص (تاریخ، CSV، ایمن‌سازی نام فایل…)
    errorHandlers.ts       پیام‌های دوستانه + لاگ بدون دادهٔ شخصی
    audioUtils.ts          PcmPlayer برای پخش بدون وقفهٔ صدا + افکت
    activityLogger.ts      تاریخچهٔ فعالیت‌ها (localStorage)
  context/                 I18n (fa/en + RTL)، Toast، Focus (پومودورو)
  hooks/useSubtasks.ts     منطق مشترک زیرتسک‌ها (منبع واحد حقیقت)
  components/              نماها و مودال‌های دسترس‌پذیر
tests/                     تست‌های node:test
```

### مدل داده (Firestore)

```
users/{uid}
projects/{projectId}                       ownerId, members[], name, category…
  tasks/{taskId}                           status, priority, dueDate…
    subtasks/{subtaskId}
    notes/{noteId}
  files/{fileId}                           محتوای متنی برای زمینهٔ AI
calendarEvents/{eventId}                   userId
```

قوانین امنیتی در `firestore.rules` تعریف شده‌اند (deploy: `firebase deploy --only firestore:rules`).

### API

| مسیر | توضیح |
| --- | --- |
| `GET /api/health` | وضعیت سرور و پیکربندی AI |
| `POST /api/ai/process` | پاسخ/پیشنهاد اقدام با تاریخچهٔ گفتگو (JSON) |
| `POST /api/ai/extract-tasks` | استخراج وظیفه/رویداد از متن فایل |
| `WS /live` | جلسهٔ صوتی Gemini Live (PCM 16-bit) |

---

## ۳) اصلاحات مهم انجام‌شده

### باگ‌های بحرانی
- **مسیرهای SPA در تولید ۴۰۴ می‌شدند**: الگوی `app.get('*all')` در Express 4 معنا ندارد؛ با fallback سازگار با Express 4/5 جایگزین شد.
- **نشت داده بین کاربران**: قوانین Firestore به هر کاربر لاگین‌شده اجازهٔ خواندن/حذف *همهٔ* پروژه‌ها را می‌داد. اکنون دسترسی به `ownerId` و `members` محدود شده است.
- **دستیار حافظه نداشت**: `conversation_history` ارسال می‌شد ولی سرور آن را نادیده می‌گرفت؛ حالا تاریخچه به مدل داده می‌شود.
- **حذف پروژه، داده یتیم می‌گذاشت**: Firestore زیرمجموعه‌ها را حذف نمی‌کند؛ حذف آبشاری وظیفه/زیرتسک/یادداشت/فایل اضافه شد.
- **تایمر تمرکز drift داشت و در هر ثانیه interval جدید می‌ساخت**: به شمارش مبتنی بر timestamp تغییر کرد و وضعیت در تب پس‌زمینه درست می‌ماند.
- **خطای بدون catch در همهٔ `catch`ها**: `handleFirestoreError` قبلاً throw می‌کرد (با ایمیل کاربر داخل پیام) و باعث unhandled rejection می‌شد؛ حالا پیام دوستانه برمی‌گرداند.
- **سرویس AI بدون محافظت**: محدودیت حجم ورودی/تاریخچه، rate limit، تایم‌اوت، پیام خطای عمومی (بدون نشت جزئیات) و پارس امن JSON اضافه شد.
- **مدل نامعتبر Live API** (`gemini-3.1-flash-live-preview`) باعث شکست جلسهٔ صوتی می‌شد؛ اکنون قابل پیکربندی با پیش‌فرض معتبر.
- **خطایی که به کاربر نمی‌رسید**: خطاهای چت/فایل فقط در کنسول بود؛ اکنون Toast + پیام قابل retry.
- **صفحهٔ سفید در خطای رندر**: `ErrorBoundary` اضافه شد؛ مسیر ۴۰۴ و ریدایرکت `/dashboard` هم اضافه شد.
- **کرش `note.author.substring`** و شمارنده‌های منفی زیرتسک‌ها برطرف شد.

### بهبود تجربه و کیفیت
- i18n کامل (فارسی/انگلیسی) برای متن‌هایی که هاردکد شده بودند؛ استخراج کلیدها با پارامتر (`{count}`).
- مودال‌های دسترس‌پذیر: `role="dialog"`، `aria-modal`، Escape، trap فوکوس، قفل اسکرول، بازگشت فوکوس.
- فهرست بلند `aria-label`/`aria-pressed` برای دکمه‌های آیکونی، skip-link، `role="progressbar"`، `aria-live` برای Toast.
- کدسپلیت بر اساس مسیر + `manualChunks` (باندل ۱.۳۹MB تکه‌تکه شد).
- `hide-scrollbar` که در UI استفاده می‌شد ولی تعریف نشده بود، به همراه انیمیشن‌های `animate-in` (پلاگین نصب‌نشده) با CSS خودکفا پیاده شد.
- ساخت رویداد تقویم به‌صورت دستی (قبلاً فقط با AI ممکن بود) + فیلتر روز در تقویم + بخش «گذشته/پیش‌رو».
- تایم‌لاین از polling هر ۳۰ ثانیه به `onSnapshot` زنده تغییر کرد.
- جستجوی پروژه در پالت دستورات (که همیشه خالی بود) اکنون به دادهٔ واقعی وصل است.
- کوئری پروژه‌ها حالا هم `ownerId` و هم `members` را می‌شنود (پروژه‌های بدون `members` گم نمی‌شدند).
- پاک‌کردن تاریخچهٔ فعالیت دیگر پیام خوش‌آمد را برنمی‌گرداند؛ نوع `'info'` هم در تایپ‌ها درست شد.
- `PcmPlayer` جای `nextStartTime` سراسری را گرفت (پخش/قطع صدای Live درست شد) و `AudioContext`ها بسته می‌شوند.
- فرم ورود: نقشهٔ خطاهای Firebase، نمایش/مخفی‌کردن رمز، «فراموشی رمز»، حالت loading و جلوگیری از ارسال دوباره.
- تایپ‌استریکت + `noUnusedLocals` + افزودن `@types/react-dom` (که نبودش باعث `any` ضمنی می‌شد) + ۲۰ تست واحد.

---

## ۴) محدودیت‌های فعلی

- Firestore در بستر اجرا باید در دسترس باشد؛ بدون شبکه، ورود و داده‌ها کار نمی‌کنند.
- اعتبارسنجی توکن Firebase در سرور انجام نمی‌شود (نیازمند `firebase-admin`)؛ برای محیط عمومی توصیه می‌شود.
- قوانین دسترسی زیرمجموعه‌های پروژه از `get()` روی سند والد استفاده می‌کنند (الگوی استاندارد و امن Firestore)، اما Firestore برای هر درخواست کوئری حداکثر ۲۰ فراخوانی `get()` را مجاز می‌داند. برای پروژه‌های بزرگ‌تر (بیش از ~۲۰ وظیفه در یک بار خواندن) بهتر است `ownerId`/`members` روی هر سند وظیفه denormalize و کوئری با `array-contains` فیلتر شود (نقشهٔ راه، مورد ۳).
- صدا با `ScriptProcessorNode` ضبط می‌شود (منسوخ)؛ `AudioWorklet` گزینهٔ بعدی است.
- تست‌ها فقط helperهای خالص را پوشش می‌دهند؛ تست کامپوننت/E2E وجود ندارد.

---

## ۵) نقشهٔ راه پیشنهادی

۱. **احراز هویت سمت سرور** با `firebase-admin` و توکن ID در هدر `Authorization`؛ اعتبارسنجی در `/api/ai/*` و `/live` + سهمیهٔ مصرف به‌ازای هر کاربر.
۲. **تست خودکار کامل**: Vitest + Testing Library برای کامپوننت‌ها، Playwright برای مسیرهای اصلی (ورود → ساخت پروژه → وظیفه → چت).
۳. **همکاری بلادرنگ**: حضور کاربر، کامنت‌های زنده، تاریخچهٔ تغییرات (audit trail) در Firestore به‌جای localStorage.
۴. **پیوست فایل واقعی**: Firebase Storage با آپلود مستقیم و استخراج متن سمت سرور (PDF/DOCX) به‌جای فایل متنی در سند Firestore.
۵. **Google Calendar / Outlook Sync** با OAuth و همگام‌سازی دوطرفهٔ رویدادها.
۶. **جستجوی سراسری واقعی**: ایندکس (Algolia/Typesense) روی پروژه/وظیفه/یادداشت + `Cmd+K` سریع.
۷. **PWA + آفلاین**: manifest، Service Worker، صف نوشتن آفلاین و نوتیفیکیشن یادآور وظایف.
۸. **گزارش‌ها و تحلیل**: نمودار burndown، زمان صرف‌شده، خروجی PDF با برندینگ و ایمیل خلاصهٔ هفتگی.
۹. **طراحی مجدد لایهٔ AI**: Function-calling واقعی با schema به‌جای JSON آزاد، اجرای چندمرحله‌ای، حالت «اجرای خودکار اقدامات کم‌ریسک».
۱۰. **زیرساخت و رصد**: Dockerfile، CI (typecheck/test/build)، Sentry، لاگ ساخت‌یافته، سنجه‌های مصرف Gemini و هشدار هزینه.
