import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export type Language = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';

type Entry = { fa: string; en: string };

export const translations: Record<string, Entry> = {
  /* Navigation & shell */
  appName: { fa: 'کاِرما او‌اس', en: 'CaReMa OS' },
  tagline: { fa: 'سیستم مدیریت حرفه و پژوهش', en: 'Career & Research Manager OS' },
  projects: { fa: 'پروژه‌ها', en: 'Projects' },
  timeline: { fa: 'تایم‌لاین و رویدادها', en: 'Timeline' },
  chat: { fa: 'دستیار هوش مصنوعی', en: 'AI Assistant' },
  settings: { fa: 'تنظیمات', en: 'Settings' },
  signOut: { fa: 'خروج از حساب', en: 'Sign Out' },
  searchPlaceholder: { fa: 'جستجو در پروژه‌ها و دستورات (Ctrl+K)...', en: 'Search projects & commands (Ctrl+K)...' },
  skipToContent: { fa: 'پرش به محتوای اصلی', en: 'Skip to main content' },
  switchToEnglish: { fa: 'تغییر زبان به انگلیسی', en: 'Switch to Persian' },
  switchToPersian: { fa: 'تغییر زبان به فارسی', en: 'Switch to English' },
  language: { fa: 'زبان', en: 'Language' },
  loading: { fa: 'در حال بارگذاری...', en: 'Loading...' },
  retry: { fa: 'تلاش دوباره', en: 'Retry' },
  close: { fa: 'بستن', en: 'Close' },
  cancel: { fa: 'انصراف', en: 'Cancel' },
  save: { fa: 'ذخیره', en: 'Save' },
  add: { fa: 'افزودن', en: 'Add' },
  delete: { fa: 'حذف', en: 'Delete' },
  edit: { fa: 'ویرایش', en: 'Edit' },
  today: { fa: 'امروز', en: 'Today' },
  all: { fa: 'همه', en: 'All' },
  none: { fa: 'هیچ‌کدام', en: 'None' },
  notFoundTitle: { fa: 'صفحه پیدا نشد', en: 'Page not found' },
  notFoundBody: { fa: 'نشانی وارد شده وجود ندارد یا جابجا شده است.', en: 'The address does not exist or has moved.' },
  backToDashboard: { fa: 'بازگشت به داشبورد', en: 'Back to dashboard' },
  unexpectedError: { fa: 'خطای غیرمنتظره', en: 'Unexpected error' },
  unexpectedErrorBody: {
    fa: 'مشکلی پیش آمد. صفحه را دوباره بارگذاری کنید.',
    en: 'Something went wrong. Please reload the page.',
  },
  reload: { fa: 'بارگذاری دوباره', en: 'Reload' },

  /* Auth */
  authSubtitle: {
    fa: 'مدیریت پروژه‌ها، وظایف و تقویم با کمک یک دستیار هوشمند.',
    en: 'Manage projects, tasks and calendar with an AI copilot.',
  },
  signIn: { fa: 'ورود', en: 'Sign In' },
  signUp: { fa: 'ساخت حساب', en: 'Sign Up' },
  email: { fa: 'ایمیل', en: 'Email address' },
  password: { fa: 'رمز عبور', en: 'Password' },
  orContinueWith: { fa: 'یا ادامه با', en: 'Or continue with' },
  google: { fa: 'گوگل', en: 'Google' },
  demoAccount: { fa: 'ورود سریع با اکانت دمو', en: 'Quick demo account login' },
  demoCredentials: { fa: 'اطلاعات ورود تستی', en: 'Demo credentials' },
  forgotPassword: { fa: 'رمز عبور را فراموش کرده‌اید؟', en: 'Forgot your password?' },
  resetEmailSent: { fa: 'لینک بازیابی رمز به ایمیل شما ارسال شد.', en: 'A password reset link has been emailed to you.' },
  noAccount: { fa: 'حساب ندارید؟ ثبت‌نام کنید', en: "Don't have an account? Sign up" },
  haveAccount: { fa: 'قبلاً ثبت‌نام کرده‌اید؟ وارد شوید', en: 'Already have an account? Sign in' },
  signingIn: { fa: 'در حال ورود...', en: 'Signing in...' },
  showPassword: { fa: 'نمایش رمز عبور', en: 'Show password' },
  hidePassword: { fa: 'پنهان کردن رمز عبور', en: 'Hide password' },

  /* Command palette & modals */
  commandPalette: { fa: 'پالت دستورات سراسری', en: 'Command Palette' },
  shortcuts: { fa: 'میانبرهای صفحه کلید', en: 'Keyboard Shortcuts' },
  focusTimer: { fa: 'تایمر تمرکز (پومودورو)', en: 'Focus Timer' },
  activityFeed: { fa: 'سوابق فعالیت‌ها', en: 'Activity Feed' },
  noResults: { fa: 'موردی یافت نشد', en: 'No results found' },
  pressKey: { fa: 'کلید', en: 'Press' },
  toNavigate: { fa: 'برای جابجایی', en: 'to navigate' },
  toSelect: { fa: 'برای انتخاب', en: 'to select' },
  toClose: { fa: 'برای بستن', en: 'to close' },
  goToProjects: { fa: 'رفتن به صفحه پروژه‌ها', en: 'Go to Projects' },
  goToTimeline: { fa: 'رفتن به تایم‌لاین و تقویم', en: 'Go to Timeline & Calendar' },
  goToChat: { fa: 'رفتن به دستیار هوش مصنوعی', en: 'Go to AI Assistant' },
  openFocus: { fa: 'باز کردن تایمر تمرکز', en: 'Open Focus / Pomodoro Timer' },
  openActivity: { fa: 'مشاهده سوابق فعالیت‌ها', en: 'Open Activity Feed' },
  createNewProject: { fa: 'ایجاد پروژه جدید', en: 'Create New Project' },
  commandGroupNavigation: { fa: 'پیمایش', en: 'Navigation' },
  commandGroupProjects: { fa: 'پروژه‌ها', en: 'Projects' },
  commandGroupActions: { fa: 'دستورات', en: 'Actions' },
  clearHistory: { fa: 'پاک کردن تاریخچه', en: 'Clear history' },
  noActivity: { fa: 'هنوز فعالیتی ثبت نشده است.', en: 'No activity logged yet.' },
  activityCleared: { fa: 'تاریخچه پاک شد', en: 'History cleared' },

  /* Projects */
  allProjects: { fa: 'همه پروژه‌ها', en: 'All Projects' },
  newProject: { fa: 'پروژه جدید', en: 'New Project' },
  projectName: { fa: 'نام پروژه', en: 'Project Name' },
  deleteProject: { fa: 'حذف پروژه', en: 'Delete Project' },
  deleteConfirm: {
    fa: 'آیا از حذف این پروژه اطمینان دارید؟ تمامی تسک‌ها، زیرتسک‌ها و فایل‌های آن نیز حذف می‌شوند.',
    en: 'Delete this project? All of its tasks, subtasks and files will be deleted too.',
  },
  projectDeleted: { fa: 'پروژه حذف شد', en: 'Project deleted' },
  projectCreated: { fa: 'پروژه ساخته شد', en: 'Project created' },
  calendarToggleJalali: { fa: 'تقویم شمسی', en: 'Jalali Calendar' },
  calendarToggleGregorian: { fa: 'تقویم میلادی', en: 'Gregorian Calendar' },
  tableView: { fa: 'نمای جدول', en: 'Table View' },
  kanbanView: { fa: 'نمای کانبان', en: 'Kanban View' },
  dashboardView: { fa: 'نمای آمار', en: 'Dashboard View' },
  filesView: { fa: 'فایل‌های پروژه', en: 'Project Files' },
  noProjects: { fa: 'هنوز پروژه‌ای ندارید', en: 'No projects yet' },
  noProjectsBody: {
    fa: 'اولین پروژه خود را بسازید یا داده نمونه را بارگذاری کنید.',
    en: 'Create your first project or load sample data to explore.',
  },
  noProjectSelected: {
    fa: 'پروژه‌ای انتخاب نشده است. از نوار بالا یک پروژه بسازید یا انتخاب کنید.',
    en: 'No project selected. Create or pick one from the bar above.',
  },
  sampleData: { fa: 'داده نمونه', en: 'Sample Data' },
  sampleDataCreated: { fa: 'اطلاعات نمونه ایجاد شد', en: 'Sample data created' },
  sampleDataFailed: { fa: 'ایجاد داده نمونه ناموفق بود', en: 'Failed to seed sample data' },
  shareProject: { fa: 'اشتراک‌گذاری پروژه', en: 'Share Project' },
  sharePlaceholder: { fa: 'ایمیل همکار', en: 'colleague@example.com' },
  shared: { fa: 'پروژه به اشتراک گذاشته شد', en: 'Project shared' },
  shareInvalid: { fa: 'یک ایمیل معتبر وارد کنید', en: 'Enter a valid email address' },
  owner: { fa: 'مسئول', en: 'Owner' },
  projectId: { fa: 'شناسه پروژه', en: 'Project ID' },
  taskCount: { fa: 'تعداد وظایف', en: 'tasks' },

  /* Tasks */
  taskTitle: { fa: 'عنوان وظیفه', en: 'Task Title' },
  addTaskPlaceholder: { fa: 'عنوان تسک جدید را وارد کرده و Enter بزنید...', en: 'Type a task title and press Enter...' },
  status: { fa: 'وضعیت', en: 'Status' },
  priority: { fa: 'اولویت', en: 'Priority' },
  dueDate: { fa: 'موعد تحویل', en: 'Due Date' },
  actions: { fa: 'عملیات', en: 'Actions' },
  todo: { fa: 'در انتظار', en: 'To Do' },
  inProgress: { fa: 'در حال انجام', en: 'In Progress' },
  review: { fa: 'بازبینی', en: 'Review' },
  done: { fa: 'تکمیل شده', en: 'Done' },
  blocked: { fa: 'متوقف', en: 'Blocked' },
  low: { fa: 'پایین', en: 'Low' },
  medium: { fa: 'متوسط', en: 'Medium' },
  high: { fa: 'بالا', en: 'High' },
  critical: { fa: 'بحرانی', en: 'Critical' },
  setPriority: { fa: 'انتخاب', en: 'Set' },
  setDate: { fa: 'تعیین تاریخ', en: 'Set Date' },
  unassigned: { fa: 'بدون مسئول', en: 'Unassigned' },
  assignee: { fa: 'مسئول', en: 'Assignee' },
  details: { fa: 'جزئیات', en: 'Details' },
  deleteTask: { fa: 'حذف وظیفه', en: 'Delete Task' },
  deleteTaskConfirm: { fa: 'این وظیفه حذف شود؟', en: 'Delete this task?' },
  noTasksInStage: { fa: 'وظیفه‌ای در این ستون نیست', en: 'No tasks in this stage' },
  moveTo: { fa: 'انتقال به', en: 'Move to' },
  noTasksRecorded: { fa: 'وظیفه‌ای ثبت نشده است.', en: 'No tasks recorded yet.' },
  taskDetails: { fa: 'جزئیات وظیفه', en: 'Task details' },
  description: { fa: 'توضیحات', en: 'Description' },
  descriptionPlaceholder: {
    fa: 'توضیحات کامل‌تری برای این وظیفه بنویسید...',
    en: 'Add a more detailed description...',
  },
  subtasks: { fa: 'زیرتسک‌ها', en: 'Subtasks' },
  addSubtaskPlaceholder: { fa: 'افزودن زیرتسک...', en: 'Add subtask...' },
  notes: { fa: 'یادداشت‌ها و گزارش‌ها', en: 'Notes & Reports' },
  addNotePlaceholder: { fa: 'یک یادداشت، به‌روزرسانی یا گزارش بنویسید...', en: 'Write an update, note, or report...' },
  addNote: { fa: 'افزودن یادداشت', en: 'Add Note' },
  completed: { fa: 'تکمیل شده', en: 'completed' },
  progress: { fa: 'پیشرفت', en: 'Progress' },
  noSubtasks: { fa: 'زیرتسکی وجود ندارد', en: 'No subtasks yet' },

  /* Analytics & filters */
  productivity: { fa: 'بهره‌وری و پیشرفت', en: 'Productivity & Progress' },
  completionRate: { fa: 'نرخ تکمیل', en: 'Completion Rate' },
  overdueTasks: { fa: 'عقب‌افتاده', en: 'Overdue' },
  criticalTasks: { fa: 'تسک‌های بحرانی', en: 'Critical Tasks' },
  totalTasks: { fa: 'کل وظایف', en: 'Total Tasks' },
  filterByStatus: { fa: 'فیلتر وضعیت', en: 'Filter by Status' },
  filterByPriority: { fa: 'فیلتر اولویت', en: 'Filter by Priority' },
  onlyOverdue: { fa: 'فقط عقب‌افتاده', en: 'Overdue Only' },
  searchTasks: { fa: 'جستجوی آنی در تسک‌ها...', en: 'Search tasks live...' },
  clearFilters: { fa: 'پاک کردن فیلترها', en: 'Clear Filters' },
  filteredOf: { fa: 'نمایش {shown} از {total}', en: 'Showing {shown} of {total}' },

  /* Export */
  exportData: { fa: 'استخراج داده', en: 'Export' },
  exportCsv: { fa: 'خروجی اکسل / CSV', en: 'Export CSV' },
  exportJson: { fa: 'خروجی داده JSON', en: 'Export JSON' },
  printReport: { fa: 'چاپ گزارش تمیز', en: 'Print Report' },
  exported: { fa: 'فایل دانلود شد', en: 'File downloaded' },

  /* Timeline */
  upcoming: { fa: 'پیش‌رو', en: 'Upcoming' },
  past: { fa: 'گذشته', en: 'Past' },
  noEvents: { fa: 'موردی برای نمایش نیست', en: 'Nothing scheduled yet' },
  noEventsBody: {
    fa: 'یک رویداد بسازید یا از دستیار هوشمند بخواهید جلسه‌ای تنظیم کند.',
    en: 'Create an event or ask the AI assistant to schedule a meeting.',
  },
  newEvent: { fa: 'رویداد جدید', en: 'New Event' },
  eventTitle: { fa: 'عنوان رویداد', en: 'Event title' },
  startsAt: { fa: 'زمان شروع', en: 'Starts at' },
  endsAt: { fa: 'زمان پایان', en: 'Ends at' },
  location: { fa: 'مکان', en: 'Location' },
  meetingLink: { fa: 'لینک جلسه', en: 'Meeting link' },
  agenda: { fa: 'دستور جلسه', en: 'Agenda' },
  addEvent: { fa: 'افزودن رویداد', en: 'Add Event' },
  eventCreated: { fa: 'رویداد اضافه شد', en: 'Event created' },
  deleteEvent: { fa: 'حذف رویداد', en: 'Delete event' },
  eventDeleted: { fa: 'رویداد حذف شد', en: 'Event deleted' },
  joinMeeting: { fa: 'ورود به جلسه', en: 'Join Meeting' },
  deadline: { fa: 'موعد تحویل', en: 'Deadline' },
  event: { fa: 'رویداد', en: 'Event' },
  both: { fa: 'هر دو', en: 'Both' },
  filterDayActive: { fa: 'فقط رویدادهای {day}', en: 'Showing only {day}' },
  clearDayFilter: { fa: 'نمایش همه روزها', en: 'Show all days' },
  invalidTimeRange: { fa: 'زمان پایان باید بعد از شروع باشد', en: 'End time must be after start time' },
  titleRequired: { fa: 'عنوان الزامی است', en: 'A title is required' },

  /* Chat */
  assistantBadge: { fa: 'مدل Gemini', en: 'Gemini Flash' },
  liveSession: { fa: 'جلسه صوتی', en: 'Live Session' },
  startLive: { fa: 'شروع جلسه صوتی', en: 'Start live audio session' },
  stopLive: { fa: 'پایان جلسه صوتی', en: 'Stop live session' },
  liveStarted: { fa: 'جلسه صوتی آغاز شد. صحبت کنید.', en: 'Live audio session started. Start speaking.' },
  liveEnded: { fa: 'جلسه صوتی پایان یافت.', en: 'Live audio session ended.' },
  micDenied: {
    fa: 'دسترسی به میکروفون داده نشد. آن را در تنظیمات مرورگر فعال کنید.',
    en: 'Microphone access was denied. Enable it in your browser settings.',
  },
  liveUnsupported: { fa: 'مرورگر شما از جلسه صوتی پشتیبانی نمی‌کند.', en: 'Your browser does not support live audio.' },
  chatWelcome: {
    fa: 'سلام! من CaReMa OS هستم، دستیار هوشمند اجرایی شما. چه کاری برایتان انجام دهم؟',
    en: 'Hello! I am CaReMa OS, your executive assistant. What can I do for you?',
  },
  chatPlaceholder: {
    fa: 'از دستیار بخواهید پروژه بسازد یا جلسه تنظیم کند... (Shift+Enter برای خط جدید)',
    en: 'Ask CaReMa OS to create a project or schedule an event (Shift+Enter for newline)...',
  },
  send: { fa: 'ارسال', en: 'Send' },
  thinking: { fa: 'در حال پردازش...', en: 'Thinking...' },
  proposalTitle: { fa: 'پیشنهاد اقدام هوش مصنوعی', en: 'AI Action Proposal' },
  approve: { fa: 'تأیید', en: 'Approve' },
  decline: { fa: 'رد', en: 'Decline' },
  approved: { fa: 'تأیید شد', en: 'Approved' },
  declined: { fa: 'رد شد', en: 'Declined' },
  executed: { fa: 'انجام شد', en: 'Executed' },
  executionFailed: { fa: 'اجرا ناموفق بود', en: 'Failed to execute' },
  retryMessage: { fa: 'ارسال دوباره', en: 'Retry' },
  clearChat: { fa: 'پاک کردن گفتگو', en: 'Clear conversation' },
  chatCleared: { fa: 'گفتگو پاک شد', en: 'Conversation cleared' },
  aiUnavailable: { fa: 'دستیار در دسترس نیست', en: 'Assistant unavailable' },
  voiceAction: { fa: 'اقدام صوتی', en: 'Voice Action' },
  voiceActionIntro: {
    fa: 'بر اساس صحبت شما این پیشنهاد آماده شد:',
    en: 'Here is what I prepared from what you said.',
  },
  noProjectForTask: {
    fa: 'برای ساخت وظیفه ابتدا یک پروژه ایجاد کنید.',
    en: 'Create a project before adding tasks.',
  },

  /* Focus timer */
  startFocus: { fa: 'شروع تمرکز', en: 'Start Focus' },
  pause: { fa: 'توقف موقت', en: 'Pause' },
  resume: { fa: 'ادامه', en: 'Resume' },
  reset: { fa: 'بازنشانی', en: 'Reset' },
  minimize: { fa: 'کوچک کردن', en: 'Minimize' },
  focusSession: { fa: 'جلسه تمرکز عمیق (۲۵ دقیقه)', en: 'Deep Focus (25m)' },
  shortBreak: { fa: 'استراحت کوتاه (۵ دقیقه)', en: 'Short Break (5m)' },
  completedSessions: { fa: 'جلسات تکمیل شده', en: 'Completed Sessions' },
  focusingOn: { fa: 'در حال کار روی:', en: 'Focusing on:' },
  readyToStart: { fa: 'آماده شروع', en: 'Ready to start' },
  sessionInProgress: { fa: 'جلسه در حال اجراست...', en: 'Session in progress...' },
  resting: { fa: 'در حال استراحت...', en: 'Resting...' },
  focusComplete: { fa: 'جلسه تمرکز کامل شد! وقت استراحت است.', en: 'Focus session complete! Time for a break.' },
  breakComplete: { fa: 'استراحت تمام شد. آماده تمرکز بعدی هستید؟', en: 'Break is over. Ready for the next focus session?' },

  /* Toasts */
  taskCreated: { fa: 'تسک با موفقیت اضافه شد', en: 'Task added successfully' },
  taskUpdated: { fa: 'تسک به‌روزرسانی شد', en: 'Task updated' },
  taskDeleted: { fa: 'تسک حذف شد', en: 'Task deleted' },
  undo: { fa: 'لغو (Undo)', en: 'Undo' },
  copied: { fa: 'کپی شد!', en: 'Copied!' },
  errorOccurred: { fa: 'خطایی رخ داد', en: 'Something went wrong' },
  notifications: { fa: 'اعلان‌ها', en: 'Notifications' },

  /* Files */
  projectFiles: { fa: 'فایل‌ها و پایگاه دانش پروژه', en: 'Project Files & Knowledge Base' },
  projectFilesBody: {
    fa: 'یادداشت جلسات، مستندات یا گزارش‌ها را بارگذاری کنید. هوش مصنوعی از آن‌ها به‌عنوان زمینه استفاده می‌کند و می‌تواند وظایف را استخراج کند.',
    en: 'Upload meeting notes, specs or logs. The AI uses them as context and can extract tasks automatically.',
  },
  uploadFile: { fa: 'بارگذاری فایل متنی', en: 'Upload Text File' },
  extractData: { fa: 'استخراج داده', en: 'Extract Data' },
  extracting: { fa: 'در حال استخراج...', en: 'Extracting...' },
  noFiles: { fa: 'هنوز فایلی بارگذاری نشده', en: 'No files uploaded yet' },
  noFilesBody: {
    fa: 'فایل‌های متنی یا Markdown را بارگذاری کنید تا وظایف استخراج شوند و دستیار زمینه بیشتری داشته باشد.',
    en: 'Upload plain text or markdown files to extract action items and give the assistant more context.',
  },
  fileTooLarge: { fa: 'حجم فایل بیش از حد مجاز است (حداکثر ۵۰۰ کیلوبایت).', en: 'This file is too large (500 KB max).' },
  fileUploaded: { fa: 'فایل بارگذاری شد', en: 'File uploaded' },
  fileDeleted: { fa: 'فایل حذف شد', en: 'File deleted' },
  extractedSummary: {
    fa: '{tasks} وظیفه و {events} رویداد استخراج شد.',
    en: 'Extracted {tasks} tasks and {events} events.',
  },
  chars: { fa: 'کاراکتر', en: 'chars' },
  deleteFile: { fa: 'حذف فایل', en: 'Delete file' },
  deleteFileConfirm: { fa: 'این فایل حذف شود؟', en: 'Delete this file?' },
};

interface I18nContextType {
  lang: Language;
  dir: Direction;
  locale: string;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  /** Translate a key, with optional `{placeholder}` interpolation. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'carema_lang';

function readInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'fa') return saved;
  } catch {
    /* storage disabled */
  }
  return 'fa';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(readInitialLanguage);

  const dir: Direction = lang === 'fa' ? 'rtl' : 'ltr';
  const locale = lang === 'fa' ? 'fa-IR' : 'en-US';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang, dir]);

  const setLang = useCallback((next: Language) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'fa' ? 'en' : 'fa')), []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const entry = translations[key];
      let text = entry ? entry[lang] : key;
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, dir, locale, toggleLang, setLang, t }),
    [lang, dir, locale, toggleLang, setLang, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
