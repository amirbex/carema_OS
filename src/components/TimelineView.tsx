import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { Calendar, Clock, MapPin, Video, Globe2, ChevronLeft, ChevronRight, CheckSquare, AlignLeft } from 'lucide-react';
import { format as formatGregorian, startOfMonth as startOfMonthG, endOfMonth as endOfMonthG, eachDayOfInterval as eachDayOfIntervalG, getDay as getDayG, addMonths as addMonthsG, subMonths as subMonthsG, isSameDay as isSameDayG, isSameMonth as isSameMonthG } from 'date-fns';
import { format as formatJalali, startOfMonth as startOfMonthJ, endOfMonth as endOfMonthJ, eachDayOfInterval as eachDayOfIntervalJ, getDay as getDayJ, addMonths as addMonthsJ, subMonths as subMonthsJ, isSameDay as isSameDayJ, isSameMonth as isSameMonthJ } from 'date-fns-jalali';
import { useI18n } from '../context/I18nContext';

interface TimelineItem {
  id: string;
  type: 'event' | 'task';
  title: string;
  time: string; // Unified time field (startTime or dueDate)
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  status?: string;
  priority?: string;
}

export default function TimelineView() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isJalali, setIsJalali] = useState(lang === 'fa');
  const [currentDate, setCurrentDate] = useState(new Date());
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    
    const fetchTimelineData = async () => {
      try {
        // Fetch events
        const eventsSnap = await getDocs(query(collection(db, 'calendarEvents'), where('userId', '==', userId)));
        const eventsData: TimelineItem[] = eventsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'event',
            title: data.title,
            time: data.startTime,
            endTime: data.endTime,
            location: data.location,
            meetingLink: data.meetingLink,
            agenda: data.agenda
          };
        });

        // Fetch projects & tasks
        const email = auth.currentUser?.email || '';
        const projectsSnap = await getDocs(query(collection(db, 'projects'), where('members', 'array-contains', email)));
        
        let tasksData: TimelineItem[] = [];
        for (const p of projectsSnap.docs) {
          const tasksSnap = await getDocs(collection(db, 'projects', p.id, 'tasks'));
          const pTasks = tasksSnap.docs
            .map(t => {
              const data = t.data();
              return {
                id: t.id,
                type: 'task' as const,
                title: data.title,
                time: data.dueDate,
                status: data.status,
                priority: data.priority
              };
            })
            .filter(t => t.time); // Only tasks with a due date
          tasksData.push(...pTasks);
        }

        const combined = [...eventsData, ...tasksData].sort((a, b) => {
          return new Date(a.time).getTime() - new Date(b.time).getTime();
        });

        setItems(combined);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'timeline');
      }
    };

    fetchTimelineData();
    // Setting up a basic interval to refresh (in a real app, we'd use better listeners or React Query)
    const interval = setInterval(fetchTimelineData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isJalali) {
        return formatJalali(date, 'yyyy/MM/dd HH:mm');
      }
      return formatGregorian(date, 'MMM d, yyyy h:mm a');
    } catch {
      return dateString;
    }
  };

  // Calendar Logic
  const startOfMonth = isJalali ? startOfMonthJ : startOfMonthG;
  const endOfMonth = isJalali ? endOfMonthJ : endOfMonthG;
  const eachDayOfInterval = isJalali ? eachDayOfIntervalJ : eachDayOfIntervalG;
  const getDay = isJalali ? getDayJ : getDayG;
  const addMonths = isJalali ? addMonthsJ : addMonthsG;
  const subMonths = isJalali ? subMonthsJ : subMonthsG;
  const format = isJalali ? formatJalali : formatGregorian;
  const isSameDay = isJalali ? isSameDayJ : isSameDayG;

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = monthStart;
  const endDate = monthEnd;

  const dateFormat = isJalali ? 'MMMM yyyy' : 'MMMM yyyy';
  const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const weekDays = isJalali 
    ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let startDayIndex = getDay(monthStart);
  if (isJalali) {
     startDayIndex = (startDayIndex + 1) % 7;
  }

  const renderCells = () => {
    const rows = [];
    let days = [];

    for (let i = 0; i < startDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8 md:w-10 md:h-10"></div>);
    }

    daysInMonth.forEach(d => {
      const formattedDate = format(d, 'd');
      const dayItems = items.filter(e => e.time && isSameDay(new Date(e.time), d));
      const hasEvent = dayItems.some(i => i.type === 'event');
      const hasTask = dayItems.some(i => i.type === 'task');
      const isToday = isSameDay(d, new Date());
      
      let indicatorClass = 'text-gray-300 hover:bg-gray-800';
      if (isToday) indicatorClass = 'bg-blue-600 text-white font-bold ring-2 ring-blue-500/50';
      else if (hasEvent && hasTask) indicatorClass = 'bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30';
      else if (hasEvent) indicatorClass = 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30';
      else if (hasTask) indicatorClass = 'bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30';

      days.push(
        <div 
          key={d.toString()} 
          className={`w-8 h-8 md:w-10 md:h-10 flex flex-col items-center justify-center rounded-full text-sm transition-colors cursor-pointer relative ${indicatorClass}`}
          title={`${dayItems.length} items`}
        >
          {formattedDate}
        </div>
      );
    });

    return days;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-4 border-b border-gray-800 shrink-0 bg-gray-900/50">
        <h1 className="text-xl font-semibold text-gray-100 flex items-center gap-2 shrink-0">
          {t('timeline')}
        </h1>
        <button
          onClick={() => setIsJalali(!isJalali)}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md text-sm font-medium transition-colors shrink-0"
        >
          <Globe2 className="w-4 h-4" />
          <span>{isJalali ? t('calendarToggleJalali') : t('calendarToggleGregorian')}</span>
        </button>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
          
          {/* Calendar Widget */}
          <div className="lg:w-[350px] shrink-0">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 sticky top-0 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-200">
                  {format(currentDate, dateFormat)}
                </h2>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextMonth} className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-500">
                {weekDays.map(day => (
                  <div key={day} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 place-items-center">
                {renderCells()}
              </div>
              
              <div className="mt-8 flex flex-col gap-2 text-xs text-gray-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div> Event</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500/20 border border-orange-500/50"></div> Deadline</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-500/50"></div> Both</div>
              </div>
            </div>
          </div>

          {/* Timeline View */}
          <div className="flex-1">
            {items.length === 0 ? (
              <div className="text-center text-gray-500 mt-20 bg-gray-900/30 border border-gray-800 rounded-2xl p-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg mb-2">No upcoming items.</p>
                <p className="text-sm">Ask the AI assistant to schedule a meeting or set task deadlines.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-800 before:to-transparent">
                {items.map((item) => {
                  const isTask = item.type === 'task';
                  return (
                    <div key={item.id} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active`}>
                      {/* Icon */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border bg-gray-900 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${isTask ? 'border-orange-500/30 text-orange-400' : 'border-emerald-500/30 text-emerald-400'}`}>
                        {isTask ? <CheckSquare className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                      </div>
                      
                      {/* Card */}
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border border-gray-800 bg-gray-900/40 hover:bg-gray-900 transition-colors shadow-lg shadow-black/20">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-100 text-lg leading-tight">{item.title}</h3>
                          {isTask && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 px-2 py-1 rounded border border-orange-500/20 shrink-0 ml-3">
                              Deadline
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mt-3">
                          <div className="flex items-center gap-2 bg-gray-950 px-2.5 py-1 rounded-md border border-gray-800">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span className={isJalali ? 'font-mono text-xs text-gray-300' : 'text-gray-300 text-xs'}>{formatDate(item.time)}</span>
                          </div>
                          {item.priority && (
                             <div className="text-xs font-medium text-gray-500">Priority: <span className="text-gray-300">{item.priority}</span></div>
                          )}
                        </div>
                        
                        {item.agenda && (
                           <div className="mt-4 pt-4 border-t border-gray-800/50">
                             <div className="flex items-start gap-2 text-sm text-gray-400">
                               <AlignLeft className="w-4 h-4 text-gray-500 mt-0.5" />
                               <p className="leading-relaxed">{item.agenda}</p>
                             </div>
                           </div>
                        )}

                        {(item.location || item.meetingLink) && (
                          <div className="mt-4 pt-4 border-t border-gray-800/50 flex flex-col sm:flex-row sm:items-center gap-3">
                            {item.location && (
                              <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-800">
                                <MapPin className="w-4 h-4 text-gray-500" /> {item.location}
                              </div>
                            )}
                            {item.meetingLink && (
                              <a href={item.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-colors border border-emerald-500/20">
                                <Video className="w-4 h-4" /> Join Meeting
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
