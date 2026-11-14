import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../context/I18nContext';
import { useFocus } from '../context/FocusContext';
import { Modal } from './ui/Modal';
import {
  ArrowRight,
  Calendar,
  Clock,
  FolderPlus,
  Globe,
  History,
  Keyboard,
  LayoutDashboard,
  MessageSquare,
  Search,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  group: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  keywords?: string;
  action: () => void;
}

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
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const navigation: CommandItem[] = [
      {
        id: 'nav-projects',
        title: t('goToProjects'),
        group: t('commandGroupNavigation'),
        icon: LayoutDashboard,
        keywords: 'projects dashboard',
        action: () => {
          navigate('/dashboard/projects');
          onClose();
        },
      },
      {
        id: 'nav-timeline',
        title: t('goToTimeline'),
        group: t('commandGroupNavigation'),
        icon: Calendar,
        keywords: 'timeline calendar events',
        action: () => {
          navigate('/dashboard/timeline');
          onClose();
        },
      },
      {
        id: 'nav-chat',
        title: t('goToChat'),
        group: t('commandGroupNavigation'),
        icon: MessageSquare,
        keywords: 'ai assistant chat',
        action: () => {
          navigate('/dashboard/chat');
          onClose();
        },
      },
    ];

    const actions: CommandItem[] = [
      {
        id: 'action-focus',
        title: t('openFocus'),
        group: t('commandGroupActions'),
        icon: Clock,
        keywords: 'pomodoro focus timer',
        action: () => {
          onClose();
          openFocusModal(true);
        },
      },
      {
        id: 'action-lang',
        title: t('language') + ': ' + (lang === 'fa' ? 'English' : 'فارسی'),
        group: t('commandGroupActions'),
        icon: Globe,
        keywords: 'language translate',
        action: () => {
          toggleLang();
          onClose();
        },
      },
      {
        id: 'action-activity',
        title: t('openActivity'),
        group: t('commandGroupActions'),
        icon: History,
        keywords: 'activity audit log',
        action: () => {
          onClose();
          onOpenActivity();
        },
      },
      {
        id: 'action-shortcuts',
        title: t('shortcuts'),
        group: t('commandGroupActions'),
        icon: Keyboard,
        keywords: 'keyboard shortcuts help',
        action: () => {
          onClose();
          onOpenShortcuts();
        },
      },
    ];

    if (onNewProject) {
      actions.unshift({
        id: 'action-new-project',
        title: t('createNewProject'),
        group: t('commandGroupActions'),
        icon: FolderPlus,
        keywords: 'new project create',
        action: () => {
          onClose();
          onNewProject();
        },
      });
    }

    const projectItems: CommandItem[] = projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      group: t('commandGroupProjects'),
      icon: LayoutDashboard,
      action: () => {
        onSelectProject?.(project.id);
        navigate('/dashboard/projects');
        onClose();
      },
    }));

    return [...navigation, ...actions, ...projectItems];
  }, [t, lang, projects, navigate, onClose, openFocusModal, onOpenActivity, onOpenShortcuts, onNewProject, onSelectProject, toggleLang]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.title} ${item.keywords ?? ''} ${item.group}`.toLowerCase().includes(needle)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep the highlighted row scrolled into view when navigating with arrows.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ item: CommandItem; index: number }>>();
    filtered.forEach((item, index) => {
      const bucket = map.get(item.group) ?? [];
      bucket.push({ item, index });
      map.set(item.group, bucket);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      filtered[selectedIndex]?.action();
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} labelledBy="command-palette-title" className="max-w-xl">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-[70vh]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800 bg-gray-950/60">
          <Search className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
          <h2 id="command-palette-title" className="sr-only">
            {t('commandPalette')}
          </h2>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('searchPlaceholder')}
            aria-label={t('commandPalette')}
            autoFocus
            className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-800 border border-gray-700 rounded">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">{t('noResults')}</div>
          ) : (
            grouped.map(([group, entries]) => (
              <div key={group} className="mb-1">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{group}</div>
                {entries.map(({ item, index }) => {
                  const isSelected = index === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-index={index}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-colors text-start ${
                        isSelected ? 'bg-emerald-500/15 text-emerald-300 font-medium' : 'text-gray-300 hover:bg-gray-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-gray-400'}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.title}</span>
                      </span>
                      <ArrowRight
                        className={`w-3.5 h-3.5 shrink-0 rtl:rotate-180 ${isSelected ? 'opacity-100 text-emerald-400' : 'opacity-0'}`}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 px-4 border-t border-gray-800/80 bg-gray-950/80 text-[11px] text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>↑↓ {t('toNavigate')}</span>
            <span>↵ {t('toSelect')}</span>
          </div>
          <span>ESC {t('toClose')}</span>
        </div>
      </div>
    </Modal>
  );
};
