import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

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

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(({ message, type, undoAction, duration = 4000 }: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message, type, undoAction, duration };

    setToasts(prev => [...prev.slice(-4), newToast]); // keep max 5

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Render Area */}
      <div className="fixed bottom-6 end-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 transform translate-y-0 ${
                isSuccess
                  ? 'bg-gray-900/90 border-emerald-500/30 text-emerald-300'
                  : isError
                  ? 'bg-gray-900/90 border-rose-500/30 text-rose-300'
                  : 'bg-gray-900/90 border-sky-500/30 text-sky-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {!isSuccess && !isError && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
                <span className="text-xs font-medium text-gray-200 truncate">{toast.message}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.undoAction && (
                  <button
                    onClick={() => {
                      toast.undoAction?.();
                      removeToast(toast.id);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                )}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-gray-400 hover:text-gray-200 p-1 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
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
