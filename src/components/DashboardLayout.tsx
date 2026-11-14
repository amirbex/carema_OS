import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Search,
  History,
  Keyboard,
  Globe,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useI18n } from '../context/I18nContext';
import { FocusHeaderWidget, FocusTimerModal } from './FocusTimerWidget';
import { CommandPaletteModal } from './CommandPaletteModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ActivityDrawer } from './ActivityDrawer';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, toggleLang } = useI18n();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Global Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea (except for Ctrl+K/Cmd+K)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
        return;
      }

      // Alt+F -> Focus Timer
      if (e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        // Trigger Focus Modal
        document.querySelector<HTMLButtonElement>('[title*="Focus"]')?.click();
        return;
      }

      // Alt+L -> Toggle Language
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleLang();
        return;
      }

      // Alt+A -> Activity Log
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsActivityOpen(prev => !prev);
        return;
      }

      // ? -> Shortcuts modal (only when not inside an input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLang]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard/projects', icon: LayoutDashboard, label: t('projects') },
    { to: '/dashboard/timeline', icon: Calendar, label: t('timeline') },
    { to: '/dashboard/chat', icon: MessageSquare, label: t('chat') },
  ];

  const getPageTitle = () => {
    if (location.pathname.includes('/projects')) return t('projects');
    if (location.pathname.includes('/timeline')) return t('timeline');
    if (location.pathname.includes('/chat')) return t('chat');
    return 'CaReMa OS';
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden select-none">
      {/* Sidebar overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 border-e border-gray-800 bg-gray-900/95 backdrop-blur-xl flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen
            ? 'translate-x-0'
            : lang === 'fa'
            ? 'translate-x-full md:translate-x-0'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800/80 shrink-0">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 bg-emerald-500/15 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span>CaReMa OS</span>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-gray-800/80 space-y-1 bg-gray-950/40">
          {/* Language Switch */}
          <button
            onClick={toggleLang}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 w-full transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'fa' ? 'تغییر زبان به انگلیسی' : 'Switch to Persian'}</span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
              {lang === 'fa' ? 'EN' : 'فا'}
            </span>
          </button>

          {/* Shortcuts Info */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 w-full transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Keyboard className="w-4 h-4 text-sky-400" />
              <span>{t('shortcuts')}</span>
            </div>
            <kbd className="text-[10px] font-mono bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">?</kbd>
          </button>

          {/* Sign Out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Glass Header */}
        <header className="h-16 border-b border-gray-800/80 bg-gray-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <span className="text-gray-500 hidden sm:inline">CaReMa</span>
              <span className="text-gray-600 hidden sm:inline">/</span>
              <span className="text-emerald-400">{getPageTitle()}</span>
            </div>
          </div>

          {/* Interactive Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Button (Cmd+K) */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:border-gray-700 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">{t('commandPalette')}</span>
              <kbd className="ms-2 px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 border border-gray-700 rounded text-gray-400">
                ⌘K
              </kbd>
            </button>

            {/* Focus Widget */}
            <FocusHeaderWidget />

            {/* Activity History Trigger */}
            <button
              onClick={() => setIsActivityOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 rounded-lg transition-colors border border-gray-800/80 bg-gray-950/40"
              title={t('activityFeed')}
            >
              <History className="w-4 h-4" />
            </button>

            {/* Quick Language Switcher */}
            <button
              onClick={toggleLang}
              className="px-2.5 py-1.5 rounded-lg border border-gray-800/80 bg-gray-950/40 hover:bg-gray-800/60 text-xs font-medium text-gray-300 transition-colors flex items-center gap-1.5"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-[11px] font-semibold">{lang === 'fa' ? 'FA' : 'EN'}</span>
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Global Interactive Modals */}
      <FocusTimerModal />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
      <ActivityDrawer
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />
    </div>
  );
}
