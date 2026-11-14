import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { playChime } from '../lib/audioUtils';
import { logActivity } from '../lib/activityLogger';
import { useI18n } from './I18nContext';
import { useToast } from './ToastContext';

export type PomodoroMode = 'focus' | 'break';

interface FocusContextType {
  isActive: boolean;
  mode: PomodoroMode;
  timeLeft: number;
  taskTitle: string | null;
  completedSessions: number;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  toggleTimer: () => void;
  setMode: (mode: PomodoroMode) => void;
  setTaskForFocus: (title: string | null) => void;
  formatTime: (seconds: number) => string;
}

const FocusContext = createContext<FocusContextType | null>(null);

export const FOCUS_DURATION = 25 * 60;
export const BREAK_DURATION = 5 * 60;
const STORAGE_KEY = 'carema_focus_sessions';

function durationFor(mode: PomodoroMode): number {
  return mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
}

/** Completed-session counter that resets each calendar day. */
function loadSessions(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date?: string; count?: number };
    const today = new Date().toISOString().slice(0, 10);
    return parsed.date === today && typeof parsed.count === 'number' ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function saveSessions(count: number): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: new Date().toISOString().slice(0, 10), count })
    );
  } catch {
    /* ignore */
  }
}

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  const [mode, setModeState] = useState<PomodoroMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(FOCUS_DURATION);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<number>(loadSessions);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Absolute end timestamp keeps the countdown accurate even when the tab is
  // throttled in the background (the old code drifted by ~1s per minute and
  // recreated its interval on every tick).
  const endAtRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  useEffect(() => {
    saveSessions(completedSessions);
  }, [completedSessions]);

  const handleComplete = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    playChime();

    if (mode === 'focus') {
      setCompletedSessions((prev) => prev + 1);
      showToast({ message: t('focusComplete'), type: 'success' });
      logActivity(
        lang === 'fa' ? 'جلسه تمرکز کامل شد' : 'Focus session completed',
        taskTitle ?? undefined,
        'focus'
      );
      setModeState('break');
      setTimeLeft(BREAK_DURATION);
    } else {
      showToast({ message: t('breakComplete'), type: 'info' });
      setModeState('focus');
      setTimeLeft(FOCUS_DURATION);
    }

    setIsActive(false);
    endAtRef.current = null;
    // Allow the next completion cycle.
    setTimeout(() => {
      completingRef.current = false;
    }, 0);
  }, [mode, t, lang, taskTitle, showToast]);

  useEffect(() => {
    if (!isActive) return;

    if (endAtRef.current === null) {
      endAtRef.current = Date.now() + timeLeft * 1000;
    }

    const tick = () => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        endAtRef.current = null;
        handleComplete();
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
    // `timeLeft` is intentionally not a dependency: the interval reads the end
    // timestamp, so it never needs to be recreated on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, handleComplete]);

  const startTimer = useCallback(() => {
    if (timeLeft <= 0) setTimeLeft(durationFor(mode));
    endAtRef.current = Date.now() + Math.max(1, timeLeft) * 1000;
    setIsActive(true);
  }, [mode, timeLeft]);

  const pauseTimer = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt !== null) {
      setTimeLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }
    endAtRef.current = null;
    setIsActive(false);
  }, []);

  const toggleTimer = useCallback(() => {
    setIsActive((prev) => {
      if (prev) {
        const endAt = endAtRef.current;
        if (endAt !== null) setTimeLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
        endAtRef.current = null;
        return false;
      }
      endAtRef.current = Date.now() + Math.max(1, timeLeft) * 1000;
      return true;
    });
  }, [timeLeft]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    endAtRef.current = null;
    completingRef.current = false;
    setTimeLeft(durationFor(mode));
  }, [mode]);

  const setMode = useCallback((next: PomodoroMode) => {
    setIsActive(false);
    endAtRef.current = null;
    completingRef.current = false;
    setModeState(next);
    setTimeLeft(durationFor(next));
  }, []);

  const setTaskForFocus = useCallback(
    (title: string | null) => {
      setTaskTitle(title);
      if (title && !isActive) setIsModalOpen(true);
    },
    [isActive]
  );

  const formatTime = useCallback((seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const value = useMemo(
    () => ({
      isActive,
      mode,
      timeLeft,
      taskTitle,
      completedSessions,
      isModalOpen,
      setIsModalOpen,
      startTimer,
      pauseTimer,
      resetTimer,
      toggleTimer,
      setMode,
      setTaskForFocus,
      formatTime,
    }),
    [
      isActive,
      mode,
      timeLeft,
      taskTitle,
      completedSessions,
      isModalOpen,
      startTimer,
      pauseTimer,
      resetTimer,
      toggleTimer,
      setMode,
      setTaskForFocus,
      formatTime,
    ]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
};

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within FocusProvider');
  }
  return context;
};
