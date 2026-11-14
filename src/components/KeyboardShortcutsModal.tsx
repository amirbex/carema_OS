import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useI18n } from '../context/I18nContext';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const { t, lang } = useI18n();

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  const shortcuts = [
    {
      keys: isMac ? ['⌘', 'K'] : ['Ctrl', 'K'],
      label: lang === 'fa' ? 'باز کردن پالت دستورات سراسری' : 'Open global command palette',
    },
    { keys: ['?'], label: lang === 'fa' ? 'نمایش این راهنمای میانبرها' : 'Show keyboard shortcuts' },
    {
      keys: isMac ? ['⌥', 'F'] : ['Alt', 'F'],
      label: lang === 'fa' ? 'شروع / باز کردن تایمر تمرکز' : 'Open focus / Pomodoro timer',
    },
    {
      keys: isMac ? ['⌥', 'L'] : ['Alt', 'L'],
      label: lang === 'fa' ? 'تغییر زبان (فارسی / English)' : 'Toggle language (Persian / English)',
    },
    {
      keys: isMac ? ['⌥', 'A'] : ['Alt', 'A'],
      label: lang === 'fa' ? 'مشاهده سوابق فعالیت‌ها' : 'Open activity log',
    },
    {
      keys: ['Enter'],
      label: lang === 'fa' ? 'ارسال پیام / افزودن وظیفه' : 'Send message / add task',
    },
    {
      keys: ['Shift', 'Enter'],
      label: lang === 'fa' ? 'خط جدید در پیام' : 'New line in message',
    },
    { keys: ['Esc'], label: lang === 'fa' ? 'بستن پنجره‌ها' : 'Close active modal / drawer' },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} labelledBy="shortcuts-title" className="max-w-md">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2 text-emerald-400">
            <Keyboard className="w-5 h-5" aria-hidden="true" />
            <h3 id="shortcuts-title" className="text-base font-semibold text-gray-100">
              {t('shortcuts')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="p-1.5 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="divide-y divide-gray-800/80 my-4">
          {shortcuts.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 py-3 text-xs">
              <dt className="text-gray-300 font-medium">{item.label}</dt>
              <dd className="flex items-center gap-1 font-mono shrink-0">
                {item.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-2 py-1 bg-gray-950 border border-gray-800 rounded text-gray-400 font-semibold text-[11px]"
                  >
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="pt-3 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-medium rounded-lg transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
