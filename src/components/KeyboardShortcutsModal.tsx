import React from 'react';
import { useI18n } from '../context/I18nContext';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t, lang } = useI18n();

  if (!isOpen) return null;

  const shortcuts = [
    {
      keys: ['Ctrl', 'K'],
      macKeys: ['⌘', 'K'],
      label: lang === 'fa' ? 'باز کردن پالت دستورات سراسری' : 'Open Global Command Palette',
    },
    {
      keys: ['?'],
      macKeys: ['?'],
      label: lang === 'fa' ? 'نمایش این راهنمای میانبرها' : 'Show Keyboard Shortcuts',
    },
    {
      keys: ['Alt', 'F'],
      macKeys: ['⌥', 'F'],
      label: lang === 'fa' ? 'شروع / باز کردن تایمر تمرکز' : 'Open Focus / Pomodoro Timer',
    },
    {
      keys: ['Alt', 'L'],
      macKeys: ['⌥', 'L'],
      label: lang === 'fa' ? 'تغییر زبان (فارسی / English)' : 'Toggle Language (Persian / English)',
    },
    {
      keys: ['Alt', 'A'],
      macKeys: ['⌥', 'A'],
      label: lang === 'fa' ? 'مشاهده سوابق و فعالیت‌ها' : 'Open Activity Log Feed',
    },
    {
      keys: ['Esc'],
      macKeys: ['Esc'],
      label: lang === 'fa' ? 'بستن پنجره‌ها و مودال‌ها' : 'Close active modal / drawer',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2 text-emerald-400">
            <Keyboard className="w-5 h-5" />
            <h3 className="text-base font-semibold text-gray-100">{t('shortcuts')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="divide-y divide-gray-800/80 my-4">
          {shortcuts.map((item, index) => (
            <div key={index} className="flex items-center justify-between py-3 text-xs">
              <span className="text-gray-300 font-medium">{item.label}</span>
              <div className="flex items-center gap-1 font-mono">
                {item.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-1 bg-gray-950 border border-gray-800 rounded text-gray-400 shadow-inner font-semibold text-[11px]"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          >
            {t('toClose')}
          </button>
        </div>
      </div>
    </div>
  );
};
