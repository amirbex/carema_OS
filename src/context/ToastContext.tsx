import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from 'lucide-react';
import { createId } from '../lib/format';
import { useI18n } from './I18nContext';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  undoAction?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);
const MAX_TOASTS = 4;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type, undoAction, duration = 4_500 }: Omit<ToastItem, 'id'>) => {
      const id = createId('toast');
      const toast: ToastItem = { id, message, type, undoAction, duration };

      setToasts((prev) => [...prev, toast].slice(-MAX_TOASTS));

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => removeToast(id), duration)
        );
      }
      return id;
    },
    [removeToast]
  );

  // Never leave timers (or state updates) behind after unmount.
  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((timer) => clearTimeout(timer));
      current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-6 end-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4"
        role="region"
        aria-live="polite"
        aria-atomic="false"
        aria-label={t('notifications')}
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md toast-enter ${
                isSuccess
                  ? 'bg-gray-900/95 border-emerald-500/30 text-emerald-300'
                  : isError
                    ? 'bg-gray-900/95 border-rose-500/30 text-rose-300'
                    : 'bg-gray-900/95 border-sky-500/30 text-sky-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />}
                {!isSuccess && !isError && <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />}
                <span className="text-xs font-medium text-gray-200 break-words">{toast.message}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.undoAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.undoAction?.();
                      removeToast(toast.id);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>{t('undo')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  aria-label={t('close')}
                  className="text-gray-400 hover:text-gray-200 p-1 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
