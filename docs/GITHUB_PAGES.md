# پیش‌نمایش استاتیک روی GitHub Pages

هدف: دیدن کامل رابط کاربری CaReMa OS روی `https://amirbex.github.io/carema_OS/` **بدون** سرور، **بدون** `GEMINI_API_KEY` و **بدون** نیاز به ورود واقعی Firebase.

---

## ۱) چرا نسخهٔ قبلی کار نمی‌کرد؟

| مشکل | نتیجه |
| --- | --- |
| منبع Pages روی «Deploy from a branch → `/docs`» تنظیم شده بود، ولی در `docs/` هیچ `index.html`ی نبود | خطای ۴۰۴ |
| اگر ریشهٔ مخزن هم منتشر می‌شد، `index.html` به `/src/main.tsx` اشاره می‌کند و Pages فایل TSX را ترجمه نمی‌کند | صفحهٔ سفید |
| در `vite.config.ts` گزینهٔ `base` تعریف نشده بود | دارایی‌ها از `https://amirbex.github.io/assets/...` درخواست می‌شدند (به‌جای `/carema_OS/assets/...`) → صفحهٔ سفید |
| فایل `404.html` وجود نداشت | لینک‌های عمیق (مثل `/dashboard/timeline`) روی صفحهٔ ۴۰۴ گیت‌هاب می‌افتادند |
| برنامه به Firebase Auth/Firestore و `/api/*` و `WS /live` وابسته بود | فقط صفحهٔ لاگین دیده می‌شد (و ورود گوگل هم دامنهٔ `github.io` را مجاز نمی‌داند) |

## ۲) راه‌حل پیاده‌سازی‌شده

1. **`base` قابل تنظیم** — در `vite.config.ts` مقدار `base` از `process.env.VITE_BASE` (پیش‌فرض `/`) خوانده می‌شود.
2. **حالت دمو (`VITE_DEMO_MODE=true`)**
   - `src/lib/firebase.ts`: اگر حالت دمو فعال باشد هیچ `initializeApp`/`getAuth`/`getFirestore` اجرا نمی‌شود و `db`/`auth` مقدار `null` می‌گیرند.
   - `src/lib/demoStore.ts`: یک پایگاه دادهٔ نمونه (۲ پروژه، ۶ وظیفه، زیرکار، یادداشت، فایل متنی، ۳ رویداد) که در `localStorage` ذخیره می‌شود.
   - `src/lib/appData.ts`: همان API قبلی (`subscribeProjects`، `createTask`، `updateTask`، `deleteTask`، `subscribeSubTasks`، `subscribeNotes`، `subscribeProjectFiles`، …) اما در حالت دمو از `demoStore` می‌خواند و می‌نویسد؛ هیچ‌جا `auth.currentUser` خوانده نمی‌شود.
   - `src/App.tsx`: احراز هویت با کاربر ساختگی `demo@carema.app` رد می‌شود؛ `BrowserRouter` با `basename={import.meta.env.BASE_URL}` کار می‌کند.
   - `src/components/DemoBanner.tsx`: نوار «حالت پیش‌نمایش — بدون سرور و بدون Firebase» + دکمهٔ بازنشانی داده‌ها.
3. **چت و صدا**
   - `src/lib/demoAssistant.ts`: پاسخ‌های محلی قاعده‌محور (ساخت پروژه/وظیفه/رویداد، خلاصهٔ وضعیت). پیشنهادها واقعاً روی دادهٔ دمو اعمال می‌شوند.
   - `src/lib/localExtraction.ts`: «استخراج داده» از فایل‌های متنی به‌صورت آفلاین (چک‌باکس‌های `- [ ]`، خطوط `TODO:`، لیست‌های شماره‌دار).
   - دستیار صوتی زنده (WebSocket `/live`) در حالت دمو غیرفعال است و پیام «این قابلیت به سرور نیاز دارد…» نمایش داده می‌شود.
4. **CI/CD**: `.github/workflows/deploy-pages.yml` با `npm ci` → `npm run build:pages` → آپلود `dist` → انتشار روی Pages.
5. **SPA**: در `scripts/build-pages.mjs` فایل `dist/index.html` به `dist/404.html` کپی و `.nojekyll` ساخته می‌شود.

## ۳) تنظیمات لازم در GitHub (فقط یک‌بار)

1. **Settings → Pages → Build and deployment → Source = GitHub Actions**
   - گزینه‌های «Deploy from a branch» و پوشهٔ `/docs` را انتخاب نکنید.
2. اگر سایت قبلاً منتشر شده و خطا می‌دهد: **Unpublish site** بزنید، سپس پس از اجرای موفق workflow دوباره منتشر کنید.
3. **Actions → Deploy preview to GitHub Pages → Run workflow** (یا هر push روی `main`) تا انتشار انجام شود.
4. آدرس نهایی: `https://amirbex.github.io/carema_OS/`

> اگر مخزن را fork/تغییر نام دادید، هیچ ویرایشی لازم نیست: مقدار `VITE_BASE` در workflow از `${{ github.event.repository.name }}` ساخته می‌شود.

## ۴) بررسی محلی

```bash
npm ci
npm run build:pages     # خروجی: dist/ (با base=/carema_OS/، حالت دمو، 404.html، .nojekyll)
npm run preview:pages   # http://localhost:4173/carema_OS/
npm run smoke:pages     # رندر واقعی نماها با jsdom و بررسی داده‌های نمونه
npm test                # ۱۷ تست (شامل تست‌های demoStore / localExtraction / demoAssistant)
npm run typecheck
```

`npm run preview:pages` عمداً مسیرها را مانند GitHub Pages سرو می‌کند تا رفتار `base` و `404.html` قبل از push بررسی شود.

## ۵) حالت دمو در حین توسعه

```bash
VITE_DEMO_MODE=true npm run dev   # اجرای کامل برنامه بدون Firebase/Gemini
```

- دادهٔ نمونه در `localStorage` با کلید `carema_demo_db_v2` نگهداری می‌شود؛ برای شروع مجدد: `localStorage.removeItem('carema_demo_db_v2')` یا دکمهٔ «بازنشانی داده‌ها».
- در حالت دمو، `VITE_ENABLE_DEMO_LOGIN` و صفحهٔ ورود اصلاً استفاده نمی‌شوند.

## ۶) عیب‌یابی

| نشانه | علت احتمالی | راه‌حل |
| --- | --- | --- |
| صفحهٔ سفید + خطای ۴۰۴ برای `/assets/...` | `base` اشتباه است | مطمئن شوید بیلد با `npm run build:pages` انجام شده (نه `npm run build`) |
| ۴۰۴ گیت‌هاب روی مسیرهای داخلی | `404.html` وجود ندارد | `npm run build:pages` را دوباره اجرا کنید؛ فایل باید در `dist/404.html` باشد |
| نوار «حالت پیش‌نمایش» دیده نمی‌شود | `VITE_DEMO_MODE` تنظیم نشده | در workflow مقدار `VITE_DEMO_MODE: "true"` ست شده است؛ برای بیلد دستی هم همان را export کنید |
| خطای «Missing or insufficient permissions» | بیلد در حالت دمو نیست و به Firestore وصل شده | `VITE_DEMO_MODE=true` را بررسی کنید |
| تغییرات در حالت دمو ذخیره نمی‌شوند | حالت ناشناس/مسدود بودن `localStorage` | از پنجرهٔ عادی مرورگر استفاده کنید |

## ۷) تفاوت با نسخهٔ کامل

| قابلیت | پیش‌نمایش Pages | نسخهٔ کامل (`npm run dev`) |
| --- | --- | --- |
| ورود/ثبت‌نام | کاربر ساختگی دمو | Firebase Auth (ایمیل/گوگل) |
| داده‌ها | `localStorage` (نمونه) | Firestore (واقعی، همگام بین کاربران) |
| چت هوش مصنوعی | پاسخ محلی قاعده‌محور | Gemini 2.5 Flash از طریق `/api/ai/process` |
| دستیار صوتی | غیرفعال + پیام شفاف | WebSocket `/live` + Gemini Live |
| استخراج داده از فایل | استخراج آفلاین قاعده‌محور | Gemini از طریق `/api/ai/extract-tasks` |
| بقیهٔ رابط کاربری (کانبان، تایم‌لاین، فایل‌ها، تایمر تمرکز، پالت دستور، میان‌برها، FA/EN + RTL) | کامل | کامل |
