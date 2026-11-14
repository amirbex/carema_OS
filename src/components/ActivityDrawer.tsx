import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, History, PlusCircle, Trash, Trash2, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { clearActivities, getStoredActivities, subscribeToActivities, type ActivityEvent } from '../lib/activityLogger';
import { relativeTime } from '../lib/format';

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({ isOpen, onClose }) => {
  const { t, lang, locale } = useI18n();
  const { showToast } = useToast();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setActivities(getStoredActivities());
    const unsubscribe = subscribeToActivities(setActivities);
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleClear = () => {
    clearActivities();
    setActivities([]);
    showToast({ message: t('activityCleared'), type: 'info' });
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 end-0 max-w-full flex">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-title"
          className="w-screen max-w-sm bg-gray-900 border-s border-gray-800 shadow-2xl flex flex-col drawer-enter"
        >
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <History className="w-4 h-4" aria-hidden="true" />
              <h2 id="activity-title" className="text-sm font-semibold text-gray-100">
                {t('activityFeed')}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {activities.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-gray-800 transition-colors"
                  title={t('clearHistory')}
                  aria-label={t('clearHistory')}
                >
                  <Trash className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">{t('noActivity')}</div>
            ) : (
              activities.map((item) => {
                const isCreate = item.type === 'create';
                const isDelete = item.type === 'delete';
                const isFocus = item.type === 'focus';
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-gray-950/60 rounded-xl border border-gray-800/80 text-xs text-gray-300"
                  >
                    <div className="mt-0.5 shrink-0" aria-hidden="true">
                      {isCreate && <PlusCircle className="w-4 h-4 text-emerald-400" />}
                      {isDelete && <Trash2 className="w-4 h-4 text-rose-400" />}
                      {isFocus && <Clock className="w-4 h-4 text-sky-400" />}
                      {!isCreate && !isDelete && !isFocus && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200 break-words">{item.action}</div>
                      {item.details && (
                        <div className="text-gray-400 text-[11px] truncate mt-0.5" title={item.details}>
                          {item.details}
                        </div>
                      )}
                    </div>
                    <time
                      className="font-mono tabular-nums text-[11px] text-gray-500 shrink-0"
                      dateTime={item.timestamp}
                      title={new Date(item.timestamp).toLocaleString(locale)}
                    >
                      {relativeTime(item.timestamp, new Date(), lang === 'fa' ? 'fa' : 'en')}
                    </time>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
