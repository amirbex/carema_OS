import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe2,
  MapPin,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  addMonths as addMonthsG,
  eachDayOfInterval as eachDayOfIntervalG,
  endOfMonth as endOfMonthG,
  format as formatGregorian,
  getDay as getDayG,
  isSameDay as isSameDayG,
  startOfMonth as startOfMonthG,
  subMonths as subMonthsG,
} from 'date-fns';
import {
  addMonths as addMonthsJ,
  eachDayOfInterval as eachDayOfIntervalJ,
  endOfMonth as endOfMonthJ,
  format as formatJalali,
  getDay as getDayJ,
  isSameDay as isSameDayJ,
  startOfMonth as startOfMonthJ,
  subMonths as subMonthsJ,
} from 'date-fns-jalali';
import { getCurrentUser } from '../lib/firebase';
import { subscribeEvents, subscribeProjects, subscribeTasks, deleteEvent, type CalendarEvent, type Project, type Task } from '../lib/appData';
import { describeError } from '../lib/errorHandlers';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import AddEventModal from './AddEventModal';

interface TimelineItem {
  id: string;
  type: 'event' | 'task';
  title: string;
  time: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  status?: string;
  priority?: string;
  projectName?: string;
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export default function TimelineView() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [isJalali, setIsJalali] = useState(lang === 'fa');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const taskUnsubs = useRef(new Map<string, () => void>());

  const currentUser = getCurrentUser();
  const userId = currentUser?.uid;
  const email = currentUser?.email ?? null;

  // Keep the calendar flavour in sync with the UI language.
  useEffect(() => {
    setIsJalali(lang === 'fa');
  }, [lang]);

  // Live events (the old view polled every 30s — stale UI and wasted reads).
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeEvents(
      userId,
      (next) => {
        setEvents(next);
        setIsLoading(false);
      },
      (message) => {
        setIsLoading(false);
        showToast({ message, type: 'error' });
      }
    );
    return unsubscribe;
  }, [userId, showToast]);

  useEffect(() => {
    if (!userId) return;
    return subscribeProjects(userId, email, setProjects, (message) => showToast({ message, type: 'error' }));
  }, [userId, email, showToast]);

  // One live listener per project, kept in sync as projects come and go.
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  useEffect(() => {
    const active = taskUnsubs.current;
    const wanted = new Set(projectIds);

    for (const [id, unsubscribe] of active) {
      if (!wanted.has(id)) {
        unsubscribe();
        active.delete(id);
      }
    }

    for (const id of projectIds) {
      if (active.has(id)) continue;
      const unsubscribe = subscribeTasks(
        id,
        (tasks) => setTasksByProject((prev) => ({ ...prev, [id]: tasks })),
        (message) => showToast({ message, type: 'error' })
      );
      active.set(id, unsubscribe);
    }
  }, [projectIds, showToast]);

  useEffect(() => {
    const active = taskUnsubs.current;
    return () => {
      active.forEach((unsubscribe) => unsubscribe());
      active.clear();
    };
  }, []);

  const items = useMemo<TimelineItem[]>(() => {
    const eventItems: TimelineItem[] = events
      .filter((event) => Boolean(event.startTime))
      .map((event) => ({
        id: `event-${event.id}`,
        type: 'event',
        title: event.title,
        time: event.startTime,
        endTime: event.endTime,
        location: event.location,
        meetingLink: event.meetingLink,
        agenda: event.agenda,
      }));

    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const taskItems: TimelineItem[] = Object.values(tasksByProject)
      .flat()
      .filter((task) => Boolean(task.dueDate))
      .map((task) => ({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        time: task.dueDate as string,
        status: task.status,
        priority: task.priority,
        projectName: projectNames.get(task.projectId),
      }));

    return [...eventItems, ...taskItems].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }, [events, tasksByProject, projects]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return isJalali
      ? formatJalali(date, 'yyyy/MM/dd HH:mm')
      : formatGregorian(date, 'MMM d, yyyy h:mm a');
  };

  /* ------------------------------ calendar math ----------------------------- */
  const startOfMonth = isJalali ? startOfMonthJ : startOfMonthG;
  const endOfMonth = isJalali ? endOfMonthJ : endOfMonthG;
  const eachDayOfInterval = isJalali ? eachDayOfIntervalJ : eachDayOfIntervalG;
  const getDay = isJalali ? getDayJ : getDayG;
  const addMonths = isJalali ? addMonthsJ : addMonthsG;
  const subMonths = isJalali ? subMonthsJ : subMonthsG;
  const format = isJalali ? formatJalali : formatGregorian;
  const isSameDay = isJalali ? isSameDayJ : isSameDayG;

  const monthStart = startOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: endOfMonth(monthStart) });
  const startDayIndex = isJalali ? (getDay(monthStart) + 1) % 7 : getDay(monthStart);

  const weekDays = isJalali
    ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const itemsByDay = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const item of items) {
      const key = dayKey(new Date(item.time));
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return map;
  }, [items]);

  const visibleItems = selectedDay
    ? (itemsByDay.get(dayKey(selectedDay)) ?? [])
    : items;

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const upcoming = visibleItems.filter((item) => new Date(item.time).getTime() >= todayStart.getTime());
  const past = visibleItems.filter((item) => new Date(item.time).getTime() < todayStart.getTime()).reverse();

  const handleDeleteEvent = async (item: TimelineItem) => {
    if (item.type !== 'event') return;
    const id = item.id.replace(/^event-/, '');
    if (!window.confirm(t('deleteEvent') + '?')) return;
    try {
      await deleteEvent(id);
      showToast({ message: t('eventDeleted'), type: 'info' });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const renderCard = (item: TimelineItem) => {
    const isTask = item.type === 'task';
    return (
      <div
        key={item.id}
        className="relative flex items-start gap-4 md:gap-6 group"
      >
        <div
          className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full border bg-gray-900 shadow shrink-0 z-10 ${
            isTask ? 'border-orange-500/30 text-orange-400' : 'border-emerald-500/30 text-emerald-400'
          }`}
          aria-hidden="true"
        >
          {isTask ? <CheckSquare className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0 p-4 sm:p-5 rounded-2xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900 transition-colors shadow-lg shadow-black/20">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-gray-100 text-base sm:text-lg leading-tight break-words">{item.title}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                  isTask
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {isTask ? t('deadline') : t('event')}
              </span>
              {!isTask && (
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(item)}
                  aria-label={t('deleteEvent')}
                  className="p-1 text-gray-500 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mt-3">
            <div className="flex items-center gap-2 bg-gray-950 px-2.5 py-1 rounded-md border border-gray-800">
              <Clock className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
              <span className="text-gray-300 text-xs tabular-nums">{formatDate(item.time)}</span>
            </div>
            {item.projectName && (
              <div className="text-xs text-gray-500 truncate max-w-[220px]" title={item.projectName}>
                {item.projectName}
              </div>
            )}
            {item.priority && (
              <div className="text-xs font-medium text-gray-500">
                {t('priority')}: <span className="text-gray-300">{item.priority}</span>
              </div>
            )}
            {isTask && item.status && (
              <div className="text-xs font-medium text-gray-500">
                {t('status')}: <span className="text-gray-300">{item.status}</span>
              </div>
            )}
          </div>

          {item.agenda && (
            <p className="mt-3 pt-3 border-t border-gray-800/50 text-sm text-gray-400 leading-relaxed">{item.agenda}</p>
          )}

          {(item.location || item.meetingLink) && (
            <div className="mt-3 pt-3 border-t border-gray-800/50 flex flex-col sm:flex-row sm:items-center gap-2">
              {item.location && (
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
                  <MapPin className="w-4 h-4 text-gray-500" aria-hidden="true" /> {item.location}
                </div>
              )}
              {item.meetingLink && (
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/20"
                >
                  <Video className="w-4 h-4" aria-hidden="true" /> {t('joinMeeting')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-3 border-b border-gray-800 shrink-0 bg-gray-900/50">
        <h1 className="text-lg sm:text-xl font-semibold text-gray-100">{t('timeline')}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJalali((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md text-xs font-medium transition-colors"
          >
            <Globe2 className="w-4 h-4" aria-hidden="true" />
            <span>{isJalali ? t('calendarToggleJalali') : t('calendarToggleGregorian')}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('newEvent')}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          {/* Calendar */}
          <div className="lg:w-[340px] shrink-0">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 sm:p-6 lg:sticky lg:top-0 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-gray-200">{format(currentDate, 'MMMM yyyy')}</h2>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                    aria-label={lang === 'fa' ? 'ماه قبل' : 'Previous month'}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                    aria-label={lang === 'fa' ? 'ماه بعد' : 'Next month'}
                    className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-[11px] font-medium text-gray-500">
                {weekDays.map((day) => (
                  <div key={day} className="h-8 flex items-center justify-center">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 place-items-center">
                {Array.from({ length: startDayIndex }).map((_, index) => (
                  <div key={`empty-${index}`} className="w-9 h-9" aria-hidden="true" />
                ))}
                {daysInMonth.map((day) => {
                  const dayItems = itemsByDay.get(dayKey(day)) ?? [];
                  const hasEvent = dayItems.some((item) => item.type === 'event');
                  const hasTask = dayItems.some((item) => item.type === 'task');
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDay ? isSameDay(selectedDay, day) : false;

                  let tone = 'text-gray-300 hover:bg-gray-800';
                  if (hasEvent && hasTask) tone = 'bg-purple-500/20 text-purple-300 border border-purple-500/40';
                  else if (hasEvent) tone = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                  else if (hasTask) tone = 'bg-orange-500/20 text-orange-300 border border-orange-500/40';

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))}
                      aria-pressed={isSelected}
                      aria-label={`${format(day, 'yyyy/MM/dd')} — ${dayItems.length}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-xs tabular-nums transition-colors ${tone} ${
                        isToday ? 'ring-2 ring-blue-500' : ''
                      } ${isSelected ? 'outline outline-2 outline-emerald-400' : ''}`}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-col gap-1.5 text-[11px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" /> {t('event')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500/20 border border-orange-500/50" /> {t('deadline')}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-500/50" /> {t('both')}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDay(null);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                >
                  {t('today')}
                </button>
                {selectedDay && (
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" aria-hidden="true" /> {t('clearDayFilter')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Timeline list */}
          <div className="flex-1 min-w-0">
            {selectedDay && (
              <p className="mb-4 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 inline-block">
                {t('filterDayActive', { day: format(selectedDay, 'yyyy/MM/dd') })}
              </p>
            )}

            {isLoading ? (
              <div className="space-y-4" aria-busy="true" aria-label={t('loading')}>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-24 rounded-2xl bg-gray-900/40 border border-gray-800 animate-pulse" />
                ))}
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="text-center text-gray-400 mt-10 bg-gray-900/30 border border-gray-800 rounded-2xl p-10">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" aria-hidden="true" />
                <p className="text-base font-medium mb-1">{t('noEvents')}</p>
                <p className="text-sm text-gray-500">{t('noEventsBody')}</p>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" /> {t('newEvent')}
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {upcoming.length > 0 && (
                  <section aria-label={t('upcoming')}>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">{t('upcoming')}</h2>
                    <div className="space-y-4 relative before:absolute before:inset-y-0 before:start-[18px] before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-800 before:to-transparent">
                      {upcoming.map(renderCard)}
                    </div>
                  </section>
                )}
                {past.length > 0 && (
                  <section aria-label={t('past')} className="opacity-80">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">{t('past')}</h2>
                    <div className="space-y-4">{past.map(renderCard)}</div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {userId && (
        <AddEventModal
          open={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          uid={userId}
          defaultDate={selectedDay ? selectedDay.toISOString().slice(0, 10) : undefined}
        />
      )}
    </div>
  );
}
