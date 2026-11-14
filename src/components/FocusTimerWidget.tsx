import React from 'react';
import { useFocus, BREAK_DURATION, FOCUS_DURATION } from '../context/FocusContext';
import { useI18n } from '../context/I18nContext';
import { Modal } from './ui/Modal';
import { Clock, Coffee, Minimize2, Pause, Play, RotateCcw, Target, X } from 'lucide-react';

export const FocusTimerModal: React.FC = () => {
  const { isActive, mode, timeLeft, taskTitle, completedSessions, isModalOpen, setIsModalOpen, toggleTimer, resetTimer, setMode, formatTime } =
    useFocus();
  const { t } = useI18n();

  const totalDuration = mode === 'focus' ? FOCUS_DURATION : BREAK_DURATION;
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));
  const statusLabel = isActive ? (mode === 'focus' ? t('sessionInProgress') : t('resting')) : t('readyToStart');

  return (
    <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} labelledBy="focus-timer-title" className="max-w-md">
      <div className="bg-gray-900/95 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Clock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 id="focus-timer-title" className="text-base font-semibold text-gray-100">
              {t('focusTimer')}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            aria-label={t('close')}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-gray-950 rounded-xl my-5 border border-gray-800/80" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'focus'}
            onClick={() => setMode('focus')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'focus' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Target className="w-4 h-4" aria-hidden="true" />
            <span>{t('focusSession')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'break'}
            onClick={() => setMode('break')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
              mode === 'break' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Coffee className="w-4 h-4" aria-hidden="true" />
            <span>{t('shortBreak')}</span>
          </button>
        </div>

        {taskTitle && (
          <div className="mb-4 px-3.5 py-2.5 bg-gray-950/70 border border-gray-800 rounded-xl flex items-center gap-2.5 text-xs text-gray-300">
            <span className="text-gray-500 shrink-0">{t('focusingOn')}</span>
            <span className="font-medium text-emerald-400 truncate">{taskTitle}</span>
          </div>
        )}

        <div className="py-6 flex flex-col items-center justify-center">
          <div
            className="text-6xl font-mono tabular-nums font-bold tracking-tight text-gray-100"
            role="timer"
            aria-live="off"
            aria-label={`${t('focusTimer')} ${formatTime(timeLeft)}`}
          >
            {formatTime(timeLeft)}
          </div>
          <p className="text-xs text-gray-500 mt-2">{statusLabel}</p>

          <div className="w-full bg-gray-950 rounded-full h-1.5 mt-5 overflow-hidden border border-gray-800">
            <div
              className={`h-full transition-all duration-500 ease-out ${mode === 'focus' ? 'bg-emerald-400' : 'bg-sky-400'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={toggleTimer}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
              isActive ? 'bg-amber-500 hover:bg-amber-600 text-gray-950' : 'bg-emerald-500 hover:bg-emerald-400 text-gray-950'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>{t('pause')}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>{t('startFocus')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={resetTimer}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700/60"
            aria-label={t('reset')}
            title={t('reset')}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors border border-gray-700/60"
            aria-label={t('minimize')}
            title={t('minimize')}
          >
            <Minimize2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>{t('completedSessions')}</span>
          <span className="font-mono tabular-nums font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
            {completedSessions}
          </span>
        </div>
      </div>
    </Modal>
  );
};

export const FocusHeaderWidget: React.FC = () => {
  const { isActive, mode, timeLeft, setIsModalOpen, formatTime } = useFocus();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setIsModalOpen(true)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono tabular-nums transition-colors ${
        isActive
          ? mode === 'focus'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
            : 'bg-sky-500/15 border-sky-500/40 text-sky-400'
          : 'bg-gray-900/60 border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-gray-200'
      }`}
      title={t('focusTimer')}
      aria-label={`${t('focusTimer')} ${formatTime(timeLeft)}`}
    >
      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{formatTime(timeLeft)}</span>
      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" aria-hidden="true" />}
    </button>
  );
};
