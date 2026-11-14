import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';

interface Translations {
  [key: string]: {
    fa: string;
    en: string;
  };
}

export const translations: Translations = {
  // Navigation
  projects: { fa: 'پروژه‌ها', en: 'Projects' },
  timeline: { fa: 'تایم‌لاین و رویدادها', en: 'Timeline' },
  chat: { fa: 'دستیار هوش مصنوعی', en: 'AI Assistant' },
  settings: { fa: 'تنظیمات', en: 'Settings' },
  signOut: { fa: 'خروج از حساب', en: 'Sign Out' },
  searchPlaceholder: { fa: 'جستجو در پروژه‌ها و دستورات (Ctrl+K)...', en: 'Search projects & commands (Ctrl+K)...' },

  // Command Palette & Modals
  commandPalette: { fa: 'پالت دستورات سراسری', en: 'Command Palette' },
  shortcuts: { fa: 'میانبرهای صفحه کلید', en: 'Keyboard Shortcuts' },
  focusTimer: { fa: 'تایمر تمرکز (پومودورو)', en: 'Focus Timer' },
  activityFeed: { fa: 'سوابق فعالیت‌ها', en: 'Activity Feed' },
  noResults: { fa: 'موردی یافت نشد', en: 'No results found' },
  pressKey: { fa: 'کلید', en: 'Press' },
  toNavigate: { fa: 'برای جابجایی', en: 'to navigate' },
  toSelect: { fa: 'برای انتخاب', en: 'to select' },
  toClose: { fa: 'برای بستن', en: 'to close' },

  // Projects View
  allProjects: { fa: 'همه پروژه‌ها', en: 'All Projects' },
  newProject: { fa: 'پروژه جدید', en: 'New Project' },
  projectName: { fa: 'نام پروژه', en: 'Project Name' },
  deleteProject: { fa: 'حذف پروژه', en: 'Delete Project' },
  deleteConfirm: { fa: 'آیا از حذف این پروژه اطمینان دارید؟ تمامی تسک‌ها حذف خواهند شد.', en: 'Are you sure you want to delete this project? All tasks will be lost.' },
  calendarToggleJalali: { fa: 'تقویم شمسی', en: 'Jalali Calendar' },
  calendarToggleGregorian: { fa: 'تقویم میلادی', en: 'Gregorian Calendar' },
  tableView: { fa: 'نمای جدول', en: 'Table View' },
  kanbanView: { fa: 'نمای کانبان', en: 'Kanban View' },
  dashboardView: { fa: 'نمای آمار', en: 'Dashboard View' },
  filesView: { fa: 'فایل‌های پروژه', en: 'Project Files' },

  // Tasks & Columns
  taskTitle: { fa: 'عنوان وظیفه', en: 'Task Title' },
  addTaskPlaceholder: { fa: 'عنوان تسک جدید را وارد کرده و Enter بزنید...', en: 'Type task title and press Enter...' },
  status: { fa: 'وضعیت', en: 'Status' },
  priority: { fa: 'اولویت', en: 'Priority' },
  dueDate: { fa: 'موعد تحویل', en: 'Due Date' },
  actions: { fa: 'عملیات', en: 'Actions' },
  todo: { fa: 'در انتظار', en: 'To Do' },
  inProgress: { fa: 'در حال انجام', en: 'In Progress' },
  done: { fa: 'تکمیل شده', en: 'Done' },
  low: { fa: 'پایین', en: 'Low' },
  medium: { fa: 'متوسط', en: 'Medium' },
  high: { fa: 'بالا', en: 'High' },
  critical: { fa: 'بحرانی', en: 'Critical' },

  // Productivity & Analytics
  productivity: { fa: 'بهره‌وری و پیشرفت', en: 'Productivity & Progress' },
  completionRate: { fa: 'نرخ تکمیل', en: 'Completion Rate' },
  overdueTasks: { fa: 'عقب‌افتاده', en: 'Overdue' },
  criticalTasks: { fa: 'تسک‌های بحرانی', en: 'Critical Tasks' },
  totalTasks: { fa: 'کل وظایف', en: 'Total Tasks' },

  // Filtering & Search
  filterByStatus: { fa: 'فیلتر وضعیت', en: 'Filter by Status' },
  filterByPriority: { fa: 'فیلتر اولویت', en: 'Filter by Priority' },
  all: { fa: 'همه', en: 'All' },
  onlyOverdue: { fa: 'فقط عقب‌افتاده', en: 'Overdue Only' },
  searchTasks: { fa: 'جستجوی آنی در تسک‌ها...', en: 'Search tasks live...' },
  clearFilters: { fa: 'پاک کردن فیلترها', en: 'Clear Filters' },

  // Export
  exportData: { fa: 'استخراج داده', en: 'Export' },
  exportCsv: { fa: 'خروجی اکسل / CSV', en: 'Export CSV' },
  exportJson: { fa: 'خروجی داده JSON', en: 'Export JSON' },
  printReport: { fa: 'چاپ گزارش تمیز', en: 'Print Report' },

  // Focus Timer
  startFocus: { fa: 'شروع تمرکز', en: 'Start Focus' },
  pause: { fa: 'توقف موقت', en: 'Pause' },
  resume: { fa: 'ادامه', en: 'Resume' },
  reset: { fa: 'بازنشانی', en: 'Reset' },
  focusSession: { fa: 'جلسه تمرکز عمیق (۲۵ دقیقه)', en: 'Deep Focus (25m)' },
  shortBreak: { fa: 'استراحت کوتاه (۵ دقیقه)', en: 'Short Break (5m)' },
  completedSessions: { fa: 'جلسات تکمیل شده', en: 'Completed Sessions' },
  focusingOn: { fa: 'در حال کار روی:', en: 'Focusing on:' },

  // Toasts
  taskCreated: { fa: 'تسک با موفقیت اضافه شد', en: 'Task added successfully' },
  taskUpdated: { fa: 'تسک به‌روزرسانی شد', en: 'Task updated' },
  taskDeleted: { fa: 'تسک حذف شد', en: 'Task deleted' },
  undo: { fa: 'لغو (Undo)', en: 'Undo' },
  copied: { fa: 'کپی شد!', en: 'Copied!' },
};

interface I18nContextType {
  lang: Language;
  dir: Direction;
  toggleLang: () => void;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('carema_lang');
    return (saved === 'en' || saved === 'fa') ? saved : 'fa';
  });

  const dir: Direction = lang === 'fa' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('carema_lang', lang);
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  }, [lang, dir]);

  const toggleLang = () => {
    setLangState(prev => (prev === 'fa' ? 'en' : 'fa'));
  };

  const setLang = (newLang: Language) => {
    setLangState(newLang);
  };

  const t = (key: string): string => {
    if (translations[key] && translations[key][lang]) {
      return translations[key][lang];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ lang, dir, toggleLang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
