import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../context/I18nContext';
import { useFocus } from '../context/FocusContext';
import {
  Search,
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Clock,
  Globe,
  Keyboard,
  History,
  ArrowRight,
  FolderPlus,
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenShortcuts: () => void;
  onOpenActivity: () => void;
  projects?: Array<{ id: string; name: string }>;
  onSelectProject?: (id: string) => void;
  onNewProject?: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onOpenShortcuts,
  onOpenActivity,
  projects = [],
  onSelectProject,
  onNewProject,
}) => {
  const { t, lang, toggleLang } = useI18n();
  const { setIsModalOpen: openFocusModal } = useFocus();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const baseCommands = [
    {
      id: 'nav-projects',
      title: lang === 'fa' ? 'رفتن به صفحه پروژه‌ها' : 'Go to Projects',
      icon: LayoutDashboard,
      action: () => {
        navigate('/dashboard/projects');
        onClose();
      },
    },
    {
      id: 'nav-timeline',
      title: lang === 'fa' ? 'رفتن به تایم‌لاین و تقویم' : 'Go to Timeline & Calendar',
      icon: Calendar,
      action: () => {
        navigate('/dashboard/timeline');
        onClose();
      },
    },
    {
      id: 'nav-chat',
      title: lang === 'fa' ? 'رفتن به دستیار هوش مصنوعی' : 'Go to AI Assistant',
      icon: MessageSquare,
      action: () => {
        navigate('/dashboard/chat');
        onClose();
      },
    },
    {
      id: 'action-focus',
      title: lang === 'fa' ? 'باز کردن تایمر تمرکز (Pomodoro)' : 'Open Focus / Pomodoro Timer',
      icon: Clock,
      action: () => {
        onClose();
        openFocusModal(true);
      },
    },
    {
      id: 'action-lang',
      title: lang === 'fa' ? 'تغییر زبان به انگلیسی (Switch to English)' : 'تغییر زبان به فارسی (Switch to Persian)',
      icon: Globe,
      action: () => {
        toggleLang();
        onClose();
      },
    },
    {
      id: 'action-activity',
      title: lang === 'fa' ? 'مشاهده سوابق و تاریخچه فعالیت‌ها' : 'Open Activity Feed & Audit Trail',
      icon: History,
      action: () => {
        onClose();
        onOpenActivity();
      },
    },
    {
      id: 'action-shortcuts',
      title: lang === 'fa' ? 'راهنمای کلیدهای میانبر' : 'View Keyboard Shortcuts (?)',
      icon: Keyboard,
      action: () => {
        onClose();
        onOpenShortcuts();
      },
    },
  ];

  if (onNewProject) {
    baseCommands.push({
      id: 'action-new-project',
      title: lang === 'fa' ? 'ایجاد پروژه جدید' : 'Create New Project',
      icon: FolderPlus,
      action: () => {
        onClose();
        onNewProject();
      },
    });
  }

  // Include project search matches
  const projectCommands = projects.map(p => ({
    id: `project-${p.id}`,
    title: `${lang === 'fa' ? 'پروژه: ' : 'Project: '} ${p.name}`,
    icon: LayoutDashboard,
    action: () => {
      onSelectProject?.(p.id);
      navigate('/dashboard/projects');
      onClose();
    },
  }));

  const allItems = [...projectCommands, ...baseCommands];

  const filtered = allItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="relative w-full max-w-xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-[70vh]">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800 bg-gray-950/60">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-800 border border-gray-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-800/40">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">{t('noResults')}</div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs transition-colors text-start ${
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                      : 'text-gray-300 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 opacity-0 transition-opacity ${
                      isSelected ? 'opacity-100 text-emerald-400' : ''
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="p-2.5 px-4 border-t border-gray-800/80 bg-gray-950/80 text-[11px] text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ {t('toNavigate')}</span>
            <span>↵ {t('toSelect')}</span>
          </div>
          <span>ESC {t('toClose')}</span>
        </div>
      </div>
    </div>
  );
};
