import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/I18nContext';
import { getStoredActivities, subscribeToActivities, ActivityEvent } from '../lib/activityLogger';
import { History, X, PlusCircle, CheckCircle2, Trash2, Clock, Trash } from 'lucide-react';

interface ActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({ isOpen, onClose }) => {
  const { t, lang } = useI18n();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    setActivities(getStoredActivities());
    const unsub = subscribeToActivities(setActivities);
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const clearHistory = () => {
    localStorage.removeItem('carema_recent_activities');
    setActivities([]);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 end-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-gray-900 border-s border-gray-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <History className="w-4 h-4" />
              <span className="text-sm font-semibold text-gray-100">{t('activityFeed')}</span>
            </div>
            <div className="flex items-center gap-2">
              {activities.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="p-1.5 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-gray-800 transition-colors"
                  title="Clear history"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-100 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activities.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-xs">
                {lang === 'fa' ? 'هنوز فعالیتی ثبت نشده است.' : 'No activity logged yet.'}
              </div>
            ) : (
              activities.map(item => {
                const isCreate = item.type === 'create';
                const isDelete = item.type === 'delete';
                const isFocus = item.type === 'focus';

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-gray-950/60 rounded-xl border border-gray-800/80 text-xs text-gray-300"
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCreate && <PlusCircle className="w-4 h-4 text-emerald-400" />}
                      {isDelete && <Trash2 className="w-4 h-4 text-rose-400" />}
                      {isFocus && <Clock className="w-4 h-4 text-sky-400" />}
                      {!isCreate && !isDelete && !isFocus && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200">{item.action}</div>
                      {item.details && (
                        <div className="text-gray-400 text-[11px] truncate mt-0.5">
                          {item.details}
                        </div>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-gray-500 shrink-0">
                      {formatTimestamp(item.timestamp)}
                    </span>
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
