export interface ActivityEvent {
  id: string;
  action: string;
  details?: string;
  timestamp: string;
  type: 'create' | 'update' | 'delete' | 'focus';
}

const STORAGE_KEY = 'carema_recent_activities';

type Listener = (activities: ActivityEvent[]) => void;
const listeners: Set<Listener> = new Set();

export function getStoredActivities(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Provide some initial helpful history
      return [
        {
          id: 'init-1',
          action: 'سیستم آماده به کار است',
          details: 'خوش آمدید به CaReMa OS',
          timestamp: new Date().toISOString(),
          type: 'info' as any,
        },
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function logActivity(
  action: string,
  details?: string,
  type: 'create' | 'update' | 'delete' | 'focus' = 'update'
) {
  const current = getStoredActivities();
  const newEvent: ActivityEvent = {
    id: Math.random().toString(36).substring(2, 9),
    action,
    details,
    timestamp: new Date().toISOString(),
    type,
  };

  const updated = [newEvent, ...current.slice(0, 49)]; // keep latest 50
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to store activity', e);
  }

  listeners.forEach(cb => cb(updated));
}

export function subscribeToActivities(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
