import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  Calendar,
  Globe,
  History,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  X,
} from 'lucide-react';
import { getCurrentUser, IS_DEMO, signOutUser } from '../lib/firebase';
import { subscribeProjects, type Project } from '../lib/appData';
import { useI18n } from '../context/I18nContext';
import { useFocus } from '../context/FocusContext';
import { useToast } from '../context/ToastContext';
import { FocusHeaderWidget, FocusTimerModal } from './FocusTimerWidget';
import { CommandPaletteModal } from './CommandPaletteModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ActivityDrawer } from './ActivityDrawer';
import DemoBanner from './DemoBanner';
import { initials } from '../lib/format';
import { describeError } from '../lib/errorHandlers';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, toggleLang } = useI18n();
  const { setIsModalOpen: setFocusModalOpen } = useFocus();
  const { showToast } = useToast();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const user = getCurrentUser();

  // Projects feed the command palette (it previously received an empty array,
  // so "search projects" silently never matched anything).
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeProjects(
      user.uid,
      user.email,
      setProjects,
      (message) => showToast({ message, type: 'error' })
    );
  }, [user?.uid, user?.email, showToast]);

  const pageTitle = useMemo(() => {
    if (location.pathname.includes('/projects')) return t('projects');
    if (location.pathname.includes('/timeline')) return t('timeline');
    if (location.pathname.includes('/chat')) return t('chat');
    return 'CaReMa OS';
  }, [location.pathname, t]);

  useEffect(() => {
    document.title = `${pageTitle} · CaReMa OS`;
  }, [pageTitle]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);

      // Cmd/Ctrl+K toggles the command palette.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'f') {
          event.preventDefault();
          setFocusModalOpen(true);
          return;
        }
        if (key === 'l') {
          event.preventDefault();
          toggleLang();
          return;
        }
        if (key === 'a' && !isTyping) {
          event.preventDefault();
          setIsActivityOpen((prev) => !prev);
          return;
        }
      }

      if (event.key === '?' && !isTyping && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setFocusModalOpen, toggleLang]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      navigate('/', { replace: true });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const navItems = [
    { to: '/dashboard/projects', icon: LayoutDashboard, label: t('projects') },
    { to: '/dashboard/timeline', icon: Calendar, label: t('timeline') },
    { to: '/dashboard/chat', icon: MessageSquare, label: t('chat') },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[120] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg focus:text-sm"
      >
        {t('skipToContent')}
      </a>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar"
        aria-label={t('appName')}
        className={`fixed inset-y-0 start-0 z-50 w-64 border-e border-gray-800 bg-gray-900/95 backdrop-blur-xl flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : lang === 'fa' ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-gray-800/80 shrink-0">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span>CaReMa OS</span>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label={t('close')}
            className="md:hidden p-1 text-gray-400 hover:text-gray-100 rounded"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5" aria-label={t('appName')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {user?.email && (
          <div className="px-4 py-3 border-t border-gray-800/80 flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials(user.email)}
            </div>
            <span className="text-[11px] text-gray-400 truncate" title={user.email}>
              {user.email}
            </span>
          </div>
        )}

        <div className="p-3 border-t border-gray-800/80 space-y-1 bg-gray-950/40">
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 w-full transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>{lang === 'fa' ? t('switchToEnglish') : t('switchToPersian')}</span>
            </span>
            <span className="text-[10px] font-mono uppercase bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
              {lang === 'fa' ? 'EN' : 'فا'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsShortcutsOpen(true)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 w-full transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <Keyboard className="w-4 h-4 text-sky-400" aria-hidden="true" />
              <span>{t('shortcuts')}</span>
            </span>
            <kbd className="text-[10px] font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">?</kbd>
          </button>

          {IS_DEMO ? (
            <p className="px-3 py-2 text-[11px] leading-relaxed text-gray-500">{t('demoNoSignOut')}</p>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 w-full transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>{t('signOut')}</span>
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={t('appName')}
              aria-expanded={isMobileMenuOpen}
              aria-controls="sidebar"
              className="md:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="text-sm font-semibold text-gray-200 flex items-center gap-2 min-w-0">
              <span className="text-gray-500 hidden sm:inline">CaReMa</span>
              <span className="text-gray-600 hidden sm:inline">/</span>
              <span className="text-emerald-400 truncate">{pageTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="truncate max-w-[140px]">{t('commandPalette')}</span>
              <kbd className="ms-2 px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 border border-gray-700 rounded text-gray-400">
                ⌘K
              </kbd>
            </button>

            <FocusHeaderWidget />

            <button
              type="button"
              onClick={() => setIsActivityOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded-lg transition-colors border border-gray-800/80 bg-gray-950/40"
              aria-label={t('activityFeed')}
              title={t('activityFeed')}
            >
              <History className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-lg border border-gray-800/80 bg-gray-950/40 hover:bg-gray-800/60 text-xs font-medium text-gray-300 transition-colors flex items-center gap-1.5"
              aria-label={lang === 'fa' ? t('switchToEnglish') : t('switchToPersian')}
              title={lang === 'fa' ? t('switchToEnglish') : t('switchToPersian')}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="font-mono text-[11px] font-semibold">{lang === 'fa' ? 'FA' : 'EN'}</span>
            </button>
          </div>
        </header>

        {IS_DEMO && <DemoBanner />}

        <main id="main-content" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Outlet />
        </main>
      </div>

      <FocusTimerModal />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
        projects={projects}
        onSelectProject={(id) => navigate(`/dashboard/projects?project=${encodeURIComponent(id)}`)}
        onNewProject={() => navigate('/dashboard/projects?new=1')}
      />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <ActivityDrawer isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} />
    </div>
  );
}
