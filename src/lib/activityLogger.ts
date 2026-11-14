import { createId } from './format';

export type ActivityType = 'create' | 'update' | 'delete' | 'focus' | 'info';

export interface ActivityEvent {
  id: string;
  action: string;
  details?: string;
  timestamp: string;
  type: ActivityType;
}

const STORAGE_KEY = 'carema_recent_activities';
const CLEARED_KEY = 'carema_activities_cleared';
const MAX_ENTRIES = 50;

type Listener = (activities: ActivityEvent[]) => void;
const listeners = new Set<Listener>();

function welcomeEvent(): ActivityEvent {
  return {
    id: 'welcome',
    action: 'سیستم آماده به کار است',
    details: 'خوش آمدید به CaReMa OS',
    timestamp: new Date().toISOString(),
    type: 'info',
  };
}

export function getStoredActivities(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Only show the welcome entry on a genuinely fresh install — clearing the
      // history used to resurrect it on the next open.
      return localStorage.getItem(CLEARED_KEY) ? [] : [welcomeEvent()];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ActivityEvent =>
        Boolean(item) && typeof item.id === 'string' && typeof item.action === 'string' && typeof item.timestamp === 'string'
    );
  } catch {
    return [];
  }
}

function persist(activities: ActivityEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  } catch (error) {
    console.error('Failed to store activity', error);
  }
  listeners.forEach((listener) => listener(activities));
}

export function logActivity(action: string, details?: string, type: ActivityType = 'update'): void {
  const current = getStoredActivities();
  const event: ActivityEvent = {
    id: createId('act'),
    action,
    details,
    timestamp: new Date().toISOString(),
    type,
  };
  persist([event, ...current].slice(0, MAX_ENTRIES));
}

export function clearActivities(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(CLEARED_KEY, '1');
  } catch {
    /* storage unavailable (private mode) */
  }
  listeners.forEach((listener) => listener([]));
}

export function subscribeToActivities(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
