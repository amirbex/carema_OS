import React from 'react';
import { useFocus } from '../context/FocusContext';
import { useI18n } from '../context/I18nContext';
import { Play, Pause, RotateCcw, Clock, Coffee, Target, X, Minimize2 } from 'lucide-react';

export const FocusTimerModal: React.FC = () => {
  const {
    isActive,
    mode,
    timeLeft,
    taskTitle,
    completedSessions,
    isModalOpen,
    setIsModalOpen,
    toggleTimer,
    resetTimer,
    setMode,
    formatTime,
  } = useFocus();
  const { t } = useI18n();

  if (!isModalOpen) return null;

  const totalDuration = mode === 'focus' ? 25 * 60 : 5 * 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-gray-900/95 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-gray-100">{t('focusTimer')}</h3>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex gap-2 p-1 bg-gray-950 rounded-xl my-5 border border-gray-800/80">
          <button
            onClick={() => setMode('focus')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'focus'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>{t('focusSession')}</span>
          </button>
          <button
            onClick={() => setMode('break')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'break'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Coffee className="w-4 h-4" />
            <span>{t('shortBreak')}</span>
          </button>
        </div>

        {/* Active Task Context */}
        {taskTitle && (
          <div className="mb-4 px-3.5 py-2.5 bg-gray-950/70 border border-gray-800 rounded-xl flex items-center gap-2.5 text-xs text-gray-300">
            <span className="text-gray-500 shrink-0">{t('focusingOn')}</span>
            <span className="font-medium text-emerald-400 truncate">{taskTitle}</span>
          </div>
        )}

        {/* Big Display Clock */}
        <div className="py-6 flex flex-col items-center justify-center">
          <div className="text-6xl font-mono tabular-nums font-bold tracking-tight text-gray-100 drop-shadow">
            {formatTime(timeLeft)}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {isActive ? (mode === 'focus' ? 'Session in progress...' : 'Resting...') : 'Ready to start'}
          </p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-950 rounded-full h-1.5 mt-5 overflow-hidden border border-gray-800">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                mode === 'focus' ? 'bg-emerald-400' : 'bg-sky-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={toggleTimer}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-lg ${
              isActive
                ? 'bg-amber-500 hover:bg-amber-600 text-gray-950 font-semibold'
                : 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>{t('pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{t('startFocus')}</span>
              </>
            )}
          </button>

          <button
            onClick={resetTimer}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700/60"
            title={t('reset')}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsModalOpen(false)}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700/60"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Completed count */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>{t('completedSessions')}</span>
          <span className="font-mono tabular-nums font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {completedSessions}
          </span>
        </div>
      </div>
    </div>
  );
};

export const FocusHeaderWidget: React.FC = () => {
  const { isActive, mode, timeLeft, setIsModalOpen, formatTime } = useFocus();
  const { t } = useI18n();

  return (
    <button
      onClick={() => setIsModalOpen(true)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono tabular-nums transition-colors ${
        isActive
          ? mode === 'focus'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 animate-pulse'
            : 'bg-sky-500/15 border-sky-500/40 text-sky-400'
          : 'bg-gray-900/60 border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-gray-200'
      }`}
      title={t('focusTimer')}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <span>{formatTime(timeLeft)}</span>
      {isActive && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
      )}
    </button>
  );
};
