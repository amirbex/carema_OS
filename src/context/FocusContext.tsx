import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

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

const FOCUS_DURATION = 25 * 60; // 25 minutes
const BREAK_DURATION = 5 * 60;  // 5 minutes

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<PomodoroMode>('focus');
  const [timeLeft, setTimeLeft] = useState<number>(FOCUS_DURATION);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [completedSessions, setCompletedSessions] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synthesize pleasant crystal chime using Web Audio API
  const playChime = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.3); // D6

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  const handleTimerComplete = useCallback(() => {
    playChime();
    setIsActive(false);

    if (mode === 'focus') {
      setCompletedSessions(prev => prev + 1);
      setModeState('break');
      setTimeLeft(BREAK_DURATION);
    } else {
      setModeState('focus');
      setTimeLeft(FOCUS_DURATION);
    }
  }, [mode, playChime]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, handleTimerComplete]);

  const startTimer = () => setIsActive(true);
  const pauseTimer = () => setIsActive(false);
  const toggleTimer = () => setIsActive(prev => !prev);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
  };

  const setMode = (newMode: PomodoroMode) => {
    setIsActive(false);
    setModeState(newMode);
    setTimeLeft(newMode === 'focus' ? FOCUS_DURATION : BREAK_DURATION);
  };

  const setTaskForFocus = (title: string | null) => {
    setTaskTitle(title);
    if (title && !isActive) {
      setIsModalOpen(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <FocusContext.Provider
      value={{
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
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocus must be used within FocusProvider');
  }
  return context;
};
