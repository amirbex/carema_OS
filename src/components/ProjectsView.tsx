import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import 'react-multi-date-picker/styles/backgrounds/bg-dark.css';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Download,
  FileText,
  Filter,
  Globe2,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  PanelRightOpen,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Table2,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { describeError } from '../lib/errorHandlers';
import {
  createProject,
  createTask,
  deleteProjectCascade,
  isProjectOwner,
  normalizeEmail,
  shareProject,
  subscribeProjects,
  subscribeTasks,
  updateTask,
  PRIORITIES,
  TASK_STATUSES,
  type Project,
  type Task,
} from '../lib/appData';
import TaskDetailSidebar from './TaskDetailSidebar';
import ProjectFilesView from './ProjectFilesView';
import InlineSubtasks from './InlineSubtasks';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useFocus } from '../context/FocusContext';
import { logActivity } from '../lib/activityLogger';
import { daysUntil, downloadTextFile, initials, percent, safeFileName, toCsv, toDate } from '../lib/format';

type ViewMode = 'table' | 'kanban' | 'dashboard' | 'files';

const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-gray-500',
  IN_PROGRESS: 'bg-blue-500',
  REVIEW: 'bg-purple-500',
  DONE: 'bg-emerald-500',
};

const PRIORITY_CLASS: Record<string, string> = {
  Low: 'text-gray-300 bg-gray-500/10 border-gray-500/20',
  Medium: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  High: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  Critical: 'text-red-300 bg-red-500/10 border-red-500/20',
};

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case 'TODO':
      return t('todo');
    case 'IN_PROGRESS':
      return t('inProgress');
    case 'REVIEW':
      return t('review');
    case 'DONE':
      return t('done');
    case 'BLOCKED':
      return t('blocked');
    default:
      return status;
  }
}

interface AddTaskRowProps {
  placeholder: string;
  onAdd: (title: string) => Promise<boolean>;
  compact?: boolean;
}

/** Each composer owns its draft — the old shared state leaked between columns. */
const AddTaskForm: React.FC<AddTaskRowProps> = ({ placeholder, onAdd, compact }) => {
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim() || isSaving) return;
    setIsSaving(true);
    const ok = await onAdd(value);
    setIsSaving(false);
    if (ok) setValue('');
  };

  return (
    <form onSubmit={submit} className={compact ? 'pt-2' : 'w-full'}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={`w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors ${
            compact ? 'pe-9' : 'max-w-md'
          }`}
        />
        <button
          type="submit"
          disabled={!value.trim() || isSaving}
          aria-label="add"
          className={`absolute end-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 disabled:opacity-40 ${
            compact ? '' : 'hidden'
          }`}
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
    </form>
  );
};

/* -------------------------------------------------------------------------- */
/* Main view                                                                  */
/* -------------------------------------------------------------------------- */

export default function ProjectsView() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const { setTaskForFocus } = useFocus();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  // Track the selection by id, not by object: Firestore snapshots create new
  // task objects, so holding a stale object left the detail sidebar showing
  // outdated status/priority after an edit.
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isJalali, setIsJalali] = useState(lang === 'fa');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const [shareEmail, setShareEmail] = useState('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const userId = auth.currentUser?.uid;
  const userEmail = auth.currentUser?.email ?? null;

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const canManage = isProjectOwner(activeProject ?? {}, userId);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  useEffect(() => {
    setIsJalali(lang === 'fa');
  }, [lang]);

  /* ------------------------------- projects ------------------------------- */
  useEffect(() => {
    if (!userId) return;
    setIsLoadingProjects(true);
    const unsubscribe = subscribeProjects(
      userId,
      userEmail,
      (next) => {
        setProjects(next);
        setIsLoadingProjects(false);
        setProjectError(null);
      },
      (message) => {
        setIsLoadingProjects(false);
        setProjectError(message);
        showToast({ message, type: 'error' });
      }
    );
    return unsubscribe;
  }, [userId, userEmail, showToast]);

  // Keep the selection valid without re-subscribing on every selection change
  // (the previous dependency array caused a full Firestore re-listen per click).
  useEffect(() => {
    if (projects.length === 0) {
      setActiveProjectId(null);
      return;
    }
    const fromUrl = searchParams.get('project');
    if (fromUrl && projects.some((project) => project.id === fromUrl)) {
      setActiveProjectId(fromUrl);
      return;
    }
    setActiveProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : projects[0].id
    );
  }, [projects, searchParams]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setIsCreatingProject(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectProject = useCallback(
    (id: string) => {
      setActiveProjectId(id);
      setSelectedTaskId(null);
      const next = new URLSearchParams(searchParams);
      next.set('project', id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  /* -------------------------------- tasks --------------------------------- */
  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      return;
    }
    setIsLoadingTasks(true);
    const unsubscribe = subscribeTasks(
      activeProjectId,
      (next) => {
        setTasks(next);
        setIsLoadingTasks(false);
      },
      (message) => {
        setIsLoadingTasks(false);
        showToast({ message, type: 'error' });
      }
    );
    return unsubscribe;
  }, [activeProjectId, showToast]);

  // Close the export menu on outside click / Escape.
  useEffect(() => {
    if (!isExportOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setIsExportOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsExportOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [isExportOpen]);

  /* ------------------------------- actions -------------------------------- */
  const handleCreateProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name || !userId || isSavingProject) return;

    setIsSavingProject(true);
    try {
      const id = await createProject({ name, uid: userId, email: userEmail });
      setNewProjectName('');
      setIsCreatingProject(false);
      selectProject(id);
      logActivity(
        lang === 'fa' ? `پروژه جدید ایجاد شد: ${name}` : `Created project: ${name}`,
        undefined,
        'create'
      );
      showToast({ message: t('projectCreated'), type: 'success' });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProjectId || !activeProject) return;
    if (!canManage) {
      showToast({ message: t('errorOccurred'), type: 'error' });
      return;
    }
    if (!window.confirm(t('deleteConfirm'))) return;

    const name = activeProject.name;
    try {
      await deleteProjectCascade(activeProjectId);
      logActivity(lang === 'fa' ? `پروژه حذف شد: ${name}` : `Deleted project: ${name}`, undefined, 'delete');
      showToast({ message: t('projectDeleted'), type: 'info' });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const handleShare = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProjectId || !canManage) return;
    const email = normalizeEmail(shareEmail);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast({ message: t('shareInvalid'), type: 'error' });
      return;
    }
    try {
      await shareProject(activeProjectId, email);
      setShareEmail('');
      setIsShareOpen(false);
      showToast({ message: t('shared'), type: 'success' });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const addTaskTo = useCallback(
    async (title: string, status: string): Promise<boolean> => {
      if (!activeProjectId) return false;
      try {
        await createTask({ projectId: activeProjectId, title, status });
        logActivity(lang === 'fa' ? `وظیفه اضافه شد: ${title}` : `Added task: ${title}`, undefined, 'create');
        showToast({ message: t('taskCreated'), type: 'success' });
        return true;
      } catch (error) {
        showToast({ message: describeError(error), type: 'error' });
        return false;
      }
    },
    [activeProjectId, lang, showToast, t]
  );

  const updateStatus = async (task: Task, status: string) => {
    if (!activeProjectId || task.status === status) return;
    const previous = task.status;
    try {
      await updateTask(activeProjectId, task.id, { status });
      showToast({
        message: t('taskUpdated'),
        type: 'info',
        undoAction: previous ? () => void updateTask(activeProjectId, task.id, { status: previous }) : undefined,
      });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const updatePriority = async (task: Task, priority: string) => {
    if (!activeProjectId) return;
    try {
      await updateTask(activeProjectId, task.id, { priority: priority || null });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const updateDueDate = async (task: Task, date: any) => {
    if (!activeProjectId) return;
    let iso: string | null = null;
    try {
      iso = date ? date.toDate().toISOString() : null;
    } catch {
      iso = null;
    }
    try {
      await updateTask(activeProjectId, task.id, { dueDate: iso });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const updateTitle = async (task: Task, title: string) => {
    const trimmed = title.trim();
    if (!activeProjectId || !trimmed || trimmed === task.title) return;
    try {
      await updateTask(activeProjectId, task.id, { title: trimmed });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const deleteTask = async (task: Task) => {
    if (!activeProjectId) return;
    if (!window.confirm(t('deleteTaskConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProjectId, 'tasks', task.id));
      showToast({ message: t('taskDeleted'), type: 'info' });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    }
  };

  const seedSampleData = async () => {
    if (!userId || isSeeding) return;
    setIsSeeding(true);
    try {
      const projectId = await createProject({
        name: lang === 'fa' ? 'طراحی مجدد وب‌سایت' : 'Website Redesign',
        uid: userId,
        email: userEmail,
        category: 'Development',
      });
      const seeds: Array<{ title: string; status: string; priority: string; dueOffset: number | null }> = [
        {
          title: lang === 'fa' ? 'طراحی موکاپ و وایرفریم‌ها' : 'Design mockups & wireframes',
          status: 'DONE',
          priority: 'High',
          dueOffset: -2,
        },
        {
          title: lang === 'fa' ? 'پیاده‌سازی فرانت‌اند ری‌اکت' : 'Implement React frontend',
          status: 'IN_PROGRESS',
          priority: 'Critical',
          dueOffset: 3,
        },
        {
          title: lang === 'fa' ? 'نوشتن تست‌های یکپارچگی' : 'Write integration tests',
          status: 'TODO',
          priority: 'Low',
          dueOffset: null,
        },
        {
          title: lang === 'fa' ? 'بازبینی طراحی با تیم' : 'Design review with the team',
          status: 'REVIEW',
          priority: 'Medium',
          dueOffset: 1,
        },
      ];

      for (const seed of seeds) {
        await createTask({
          projectId,
          title: seed.title,
          status: seed.status,
          priority: seed.priority,
          dueDate:
            seed.dueOffset === null
              ? null
              : new Date(Date.now() + seed.dueOffset * 86_400_000).toISOString(),
        });
      }

      selectProject(projectId);
      logActivity(lang === 'fa' ? 'داده نمونه اضافه شد' : 'Sample data seeded', undefined, 'create');
      showToast({ message: t('sampleDataCreated'), type: 'success' });
    } catch (error) {
      showToast({ message: t('sampleDataFailed'), type: 'error' });
    } finally {
      setIsSeeding(false);
    }
  };

  /* -------------------------------- derived -------------------------------- */
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (query) {
        const haystack = `${task.title} ${task.assignedTo ?? ''} ${task.description ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
      if (overdueOnly) {
        const delta = daysUntil(task.dueDate ?? null);
        if (task.status === 'DONE' || delta === null || delta >= 0) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, overdueOnly]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === 'DONE').length;
    const critical = tasks.filter((task) => task.priority === 'Critical').length;
    const overdue = tasks.filter((task) => {
      const delta = daysUntil(task.dueDate ?? null);
      return task.status !== 'DONE' && delta !== null && delta < 0;
    }).length;
    return { total, done, critical, overdue, progress: percent(done, total) };
  }, [tasks]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || overdueOnly;

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setOverdueOnly(false);
  };

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  /* -------------------------------- exports -------------------------------- */
  const exportCsv = () => {
    const rows = tasks.map((task) => [
      task.title,
      statusLabel(t, task.status),
      task.priority ?? '',
      task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      task.assignedTo ?? '',
    ]);
    const csv = toCsv(['Title', 'Status', 'Priority', 'Due date', 'Assignee'], rows);
    downloadTextFile(
      `${safeFileName(activeProject?.name ?? 'project')}_tasks_${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${csv}`,
      'text/csv;charset=utf-8;'
    );
    showToast({ message: t('exported'), type: 'success' });
    setIsExportOpen(false);
  };

  const exportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      project: activeProject,
      tasks,
    };
    downloadTextFile(
      `${safeFileName(activeProject?.name ?? 'project')}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast({ message: t('exported'), type: 'success' });
    setIsExportOpen(false);
  };

  const renderTaskRow = (task: Task) => {
    const delta = daysUntil(task.dueDate ?? null);
    const overdue = task.status !== 'DONE' && delta !== null && delta < 0;
    const members = (activeProject?.members ?? []).filter(Boolean);

    return (
      <React.Fragment key={task.id}>
        <div className="flex items-center px-3 sm:px-4 py-2 hover:bg-gray-800/30 transition-colors group">
          <div className="w-8 shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={() => toggleExpanded(task.id)}
              aria-expanded={expandedTasks.has(task.id)}
              aria-label={t('subtasks')}
              className="p-0.5 text-gray-500 hover:text-gray-300 rounded transition-colors"
            >
              {expandedTasks.has(task.id) ? (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="flex-1 min-w-0 font-medium text-xs text-gray-200 pe-2">
            <input
              type="text"
              defaultValue={task.title}
              key={task.title}
              onBlur={(event) => updateTitle(task, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  event.currentTarget.value = task.title;
                  event.currentTarget.blur();
                }
              }}
              aria-label={t('taskTitle')}
              className="w-full bg-transparent border border-transparent hover:border-gray-700/80 focus:border-emerald-500 focus:bg-gray-900 rounded-md px-2 py-1 outline-none transition-colors"
            />
          </div>

          <div className="w-24 hidden sm:flex justify-center px-1">
            <select
              value={task.assignedTo ?? ''}
              onChange={(event) => updateTask(activeProjectId!, task.id, { assignedTo: event.target.value || null })}
              aria-label={t('assignee')}
              title={task.assignedTo || t('unassigned')}
              className="w-full bg-gray-900 border border-gray-800 rounded-md px-1.5 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{t('unassigned')}</option>
              {members.map((member) => (
                <option key={member} value={member}>
                  {initials(member)} · {member}
                </option>
              ))}
            </select>
          </div>

          <div className="w-28 px-1">
            <select
              value={task.status}
              onChange={(event) => updateStatus(task, event.target.value)}
              aria-label={t('status')}
              className={`w-full py-1 rounded-md text-[10px] font-bold text-white shadow-sm border-0 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                STATUS_COLORS[task.status] ?? 'bg-gray-600'
              }`}
            >
              {(TASK_STATUSES.includes(task.status as any)
                ? TASK_STATUSES
                : ([task.status, ...TASK_STATUSES] as string[])
              ).map((status) => (
                <option key={status} value={status} className="bg-gray-900 text-gray-200 font-normal">
                  {statusLabel(t, status)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-24 px-1">
            <select
              value={task.priority ?? ''}
              onChange={(event) => updatePriority(task, event.target.value)}
              aria-label={t('priority')}
              className={`w-full py-1 rounded-md text-[10px] font-bold border text-center focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                task.priority ? PRIORITY_CLASS[task.priority] ?? 'bg-gray-800' : 'bg-gray-800 text-gray-400 border-gray-700'
              }`}
            >
              <option value="" className="bg-gray-900 text-gray-300">
                {t('setPriority')}
              </option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority} className="bg-gray-900 text-gray-200">
                  {t(priority.toLowerCase())}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32 hidden md:flex justify-center items-center gap-1">
            <DatePicker
              value={toDate(task.dueDate) ?? undefined}
              onChange={(dateObject: any) => {
                void updateDueDate(task, dateObject);
              }}
              calendar={isJalali ? persian : undefined}
              locale={isJalali ? persian_fa : undefined}
              format={isJalali ? 'YYYY/MM/DD' : 'YYYY-MM-DD'}
              className="bg-dark"
              portal
              inputClass={`bg-transparent text-[11px] focus:outline-none border rounded px-1.5 py-1 text-center w-full cursor-pointer font-mono tabular-nums ${
                overdue
                  ? 'text-amber-300 border-amber-500/30 hover:border-amber-500/60'
                  : 'text-gray-400 border-transparent hover:border-gray-700 hover:text-gray-200'
              }`}
              placeholder={t('setDate')}
            />
          </div>

          <div className="w-20 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => setTaskForFocus(task.title)}
              className="p-1.5 text-gray-400 hover:text-sky-400 hover:bg-gray-800 rounded transition-colors"
              title={t('startFocus')}
              aria-label={t('startFocus')}
            >
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedTaskId(task.id)}
              className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
              title={t('details')}
              aria-label={t('details')}
            >
              <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => deleteTask(task)}
              className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              title={t('deleteTask')}
              aria-label={t('deleteTask')}
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {expandedTasks.has(task.id) && activeProjectId && (
          <InlineSubtasks task={{ id: task.id, title: task.title }} projectId={activeProjectId} />
        )}
      </React.Fragment>
    );
  };

  const renderTable = () => (
    <div className="w-full flex flex-col gap-5 pb-12">
      {TASK_STATUSES.map((status) => {
        const groupTasks = filteredTasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            aria-label={statusLabel(t, status)}
            className="min-w-[720px] w-full bg-gray-900/30 border border-gray-800/80 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900/70 border-b border-gray-800/80">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded ${STATUS_COLORS[status] ?? 'bg-gray-600'}`} aria-hidden="true" />
                <h3 className="text-xs font-bold tracking-wide uppercase text-gray-200">{statusLabel(t, status)}</h3>
                <span className="text-xs font-mono tabular-nums text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                  {groupTasks.length}
                </span>
              </div>
            </div>

            <div className="flex items-center px-3 sm:px-4 py-2 bg-gray-950/40 border-b border-gray-800/60 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              <div className="w-8 shrink-0" />
              <div className="flex-1">{t('taskTitle')}</div>
              <div className="w-24 hidden sm:block text-center">{t('assignee')}</div>
              <div className="w-28 text-center">{t('status')}</div>
              <div className="w-24 text-center">{t('priority')}</div>
              <div className="w-32 hidden md:block text-center">{t('dueDate')}</div>
              <div className="w-20 text-center">{t('actions')}</div>
            </div>

            <div className="divide-y divide-gray-800/40">
              {groupTasks.length === 0 && (
                <p className="px-4 py-3 text-[11px] text-gray-600">{t('noTasksInStage')}</p>
              )}
              {groupTasks.map(renderTaskRow)}
              <div className="flex items-center px-4 py-1.5 hover:bg-gray-800/20 transition-colors">
                <div className="w-8 shrink-0 flex items-center">
                  <div className={`w-1 h-5 rounded-full opacity-60 ${STATUS_COLORS[status] ?? 'bg-gray-600'}`} aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <AddTaskForm placeholder={`+ ${t('addTaskPlaceholder')}`} onAdd={(title) => addTaskTo(title, status)} />
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );

  const renderKanban = () => (
    <div className="flex gap-4 sm:gap-6 h-full min-w-max pb-12">
      {TASK_STATUSES.map((status) => {
        const columnTasks = filteredTasks.filter((task) => task.status === status);
        return (
          <section key={status} aria-label={statusLabel(t, status)} className="w-80 flex flex-col bg-gray-900/40 rounded-xl border border-gray-800/80 overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-gray-800/80 bg-gray-900/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-500'}`} aria-hidden="true" />
                <h3 className="text-xs font-semibold text-gray-200">{statusLabel(t, status)}</h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                {columnTasks.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[140px]">
              {columnTasks.length === 0 && (
                <p className="text-center py-6 text-xs text-gray-600 font-medium border border-dashed border-gray-800 rounded-lg">
                  {t('noTasksInStage')}
                </p>
              )}

              {columnTasks.map((task) => (
                <article
                  key={task.id}
                  className="bg-gray-900/90 p-3.5 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors group flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-200 flex-1 break-words">{task.title}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setTaskForFocus(task.title)}
                        className="p-1 text-gray-400 hover:text-sky-400 hover:bg-gray-800 rounded transition-colors"
                        title={t('startFocus')}
                        aria-label={t('startFocus')}
                      >
                        <Target className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                        title={t('details')}
                        aria-label={t('details')}
                      >
                        <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        task.priority ? PRIORITY_CLASS[task.priority] ?? 'border-gray-700' : 'border-gray-800 text-gray-500'
                      }`}
                    >
                      {task.priority ? t(task.priority.toLowerCase()) : t('none')}
                    </span>
                    <div className="flex gap-1">
                      {TASK_STATUSES.filter((candidate) => candidate !== status).map((candidate) => (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => updateStatus(task, candidate)}
                          className="px-1.5 py-0.5 rounded bg-gray-800 text-[9px] uppercase font-bold text-gray-400 hover:text-emerald-400 hover:bg-gray-700 transition-colors"
                          title={`${t('moveTo')} ${statusLabel(t, candidate)}`}
                          aria-label={`${t('moveTo')} ${statusLabel(t, candidate)}`}
                        >
                          {statusLabel(t, candidate).slice(0, 1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}

              <AddTaskForm compact placeholder={t('addTaskPlaceholder')} onAdd={(title) => addTaskTo(title, status)} />
            </div>
          </section>
        );
      })}
    </div>
  );

  const renderDashboard = () => (
    <div className="w-full h-full max-w-5xl mx-auto space-y-6 pb-12">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: t('totalTasks'), value: stats.total, color: 'text-white' },
          { label: t('done'), value: stats.done, color: 'text-emerald-400' },
          { label: t('criticalTasks'), value: stats.critical, color: 'text-red-400' },
          { label: t('overdueTasks'), value: stats.overdue, color: 'text-amber-400' },
          { label: t('completionRate'), value: `${stats.progress}%`, color: 'text-sky-400' },
        ].map((card) => (
          <div key={card.label} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center shadow-lg">
            <span className="text-gray-400 text-[11px] font-medium mb-1 text-center">{card.label}</span>
            <span className={`text-2xl sm:text-3xl font-mono tabular-nums font-bold ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('filterByStatus')}</h3>
          <div className="space-y-4">
            {TASK_STATUSES.map((status) => {
              const count = tasks.filter((task) => task.status === status).length;
              const share = percent(count, stats.total);
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{statusLabel(t, status)}</span>
                    <span className="text-gray-400 font-mono tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                    <div className={`h-full ${STATUS_COLORS[status] ?? 'bg-gray-600'}`} style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('upcoming')}</h3>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-xs">{t('noTasksRecorded')}</p>
          ) : (
            <ul className="space-y-2.5">
              {[...tasks]
                .filter((task) => task.status !== 'DONE')
                .sort((a, b) => (toDate(a.dueDate)?.getTime() ?? Infinity) - (toDate(b.dueDate)?.getTime() ?? Infinity))
                .slice(0, 5)
                .map((task) => {
                  const delta = daysUntil(task.dueDate ?? null);
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-gray-950/70 rounded-xl border border-gray-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" aria-hidden="true" />
                        <span className="truncate text-gray-200">{task.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                        {delta === null
                          ? '—'
                          : delta < 0
                            ? `${Math.abs(delta)}${lang === 'fa' ? ' روز تأخیر' : 'd overdue'}`
                            : `${delta}${lang === 'fa' ? ' روز مانده' : 'd left'}`}
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  /* --------------------------------- render -------------------------------- */
  return (
    <div className="flex-1 flex h-full bg-gray-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="flex flex-col lg:flex-row lg:items-center gap-3 px-3 sm:px-6 py-3.5 border-b border-gray-800/80 shrink-0 bg-gray-900/60 backdrop-blur-md">
          <div className="flex gap-2 flex-1 overflow-x-auto pb-1 lg:pb-0 hide-scrollbar items-center">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => selectProject(project.id)}
                aria-current={project.id === activeProjectId}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  project.id === activeProjectId
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent'
                }`}
              >
                {project.name}
              </button>
            ))}

            {isCreatingProject ? (
              <form onSubmit={handleCreateProject} className="flex items-center gap-2 shrink-0 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder={t('projectName')}
                  aria-label={t('projectName')}
                  className="bg-transparent text-xs text-gray-200 focus:outline-none w-32 sm:w-40"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setNewProjectName('');
                      setIsCreatingProject(false);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || isSavingProject}
                  aria-label={t('save')}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  {isSavingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewProjectName('');
                    setIsCreatingProject(false);
                  }}
                  aria-label={t('cancel')}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingProject(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors shrink-0 border border-dashed border-gray-800"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>{t('newProject')}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center bg-gray-950/80 rounded-lg p-1 border border-gray-800/80" role="group" aria-label={t('tableView')}>
              {(
                [
                  ['table', Table2, t('tableView')],
                  ['kanban', KanbanSquare, t('kanbanView')],
                  ['dashboard', LayoutDashboard, t('dashboardView')],
                  ['files', FileText, t('filesView')],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  aria-label={label}
                  title={label}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === mode ? 'bg-gray-800 text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsJalali((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:bg-gray-800/60 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              title={isJalali ? t('calendarToggleJalali') : t('calendarToggleGregorian')}
            >
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline">{isJalali ? t('calendarToggleJalali') : t('calendarToggleGregorian')}</span>
            </button>

            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isExportOpen}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:bg-gray-800/60 text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('exportData')}</span>
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </button>
              {isExportOpen && (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 p-1.5"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportCsv}
                    disabled={tasks.length === 0}
                    className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 rounded-lg disabled:opacity-40"
                  >
                    {t('exportCsv')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportJson}
                    disabled={tasks.length === 0}
                    className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 rounded-lg disabled:opacity-40"
                  >
                    {t('exportJson')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsExportOpen(false);
                      window.print();
                    }}
                    className="w-full text-start px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 rounded-lg flex items-center gap-2"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" /> {t('printReport')}
                  </button>
                </div>
              )}
            </div>

            {projects.length === 0 && (
              <button
                type="button"
                onClick={seedSampleData}
                disabled={isSeeding}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{t('sampleData')}</span>
              </button>
            )}

            {activeProject && canManage && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsShareOpen((prev) => !prev)}
                  aria-haspopup="dialog"
                  aria-expanded={isShareOpen}
                  aria-label={t('shareProject')}
                  title={t('shareProject')}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:bg-gray-800/60 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>

                {isShareOpen && (
                  <div className="absolute end-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 p-3.5">
                    <h4 className="text-xs font-semibold text-gray-200 mb-2">{t('shareProject')}</h4>
                    <form onSubmit={handleShare} className="flex gap-2">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(event) => setShareEmail(event.target.value)}
                        placeholder={t('sharePlaceholder')}
                        aria-label={t('sharePlaceholder')}
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        {t('add')}
                      </button>
                    </form>
                    {(activeProject.members ?? []).length > 0 && (
                      <ul className="mt-3 space-y-1 text-[11px] text-gray-400">
                        {activeProject.members?.map((member) => (
                          <li key={member} className="truncate flex items-center gap-1.5">
                            <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {member}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeProject && canManage && (
              <button
                type="button"
                onClick={handleDeleteProject}
                className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition-colors"
                title={t('deleteProject')}
                aria-label={t('deleteProject')}
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>

        {projectError && (
          <div className="px-4 sm:px-6 py-2 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-300">{projectError}</div>
        )}

        {/* Stats */}
        <div className="px-3 sm:px-6 py-2.5 bg-gray-900/40 border-b border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{t('completionRate')}:</span>
              <div className="w-20 bg-gray-950 border border-gray-800 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full transition-all duration-500 ease-out" style={{ width: `${stats.progress}%` }} />
              </div>
              <span className="font-mono tabular-nums font-semibold text-emerald-400">{stats.progress}%</span>
            </div>

            <div className="flex items-center gap-1.5 text-gray-400">
              <span>{t('totalTasks')}:</span>
              <span className="font-mono tabular-nums font-semibold text-gray-200">{stats.total}</span>
            </div>

            <div className="flex items-center gap-1.5 text-gray-400">
              <span>{t('done')}:</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-400">{stats.done}</span>
            </div>

            {stats.critical > 0 && (
              <div className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                <span>{t('criticalTasks')}:</span>
                <span className="font-mono tabular-nums font-bold">{stats.critical}</span>
              </div>
            )}

            {stats.overdue > 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <span>{t('overdueTasks')}:</span>
                <span className="font-mono tabular-nums font-bold">{stats.overdue}</span>
              </div>
            )}
          </div>

          {activeProject && (
            <div className="text-[11px] text-gray-500 hidden lg:block truncate max-w-[320px]" title={activeProject.id}>
              {t('projectId')}: {activeProject.id.slice(0, 8)}…
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="px-3 sm:px-6 py-2.5 bg-gray-950/70 border-b border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md bg-gray-900/80 border border-gray-800/80 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchTasks')}
              aria-label={t('searchTasks')}
              className="bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-none w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('clearFilters')}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-500 hidden sm:block" aria-hidden="true" />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label={t('filterByStatus')}
              className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">
                {t('filterByStatus')}: {t('all')}
              </option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(t, status)}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              aria-label={t('filterByPriority')}
              className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">
                {t('filterByPriority')}: {t('all')}
              </option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {t(priority.toLowerCase())}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setOverdueOnly((prev) => !prev)}
              aria-pressed={overdueOnly}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                overdueOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-gray-900/60 text-gray-400 border-gray-800 hover:text-gray-200'
              }`}
            >
              {t('onlyOverdue')}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-gray-400 hover:text-rose-400 px-2 py-1 transition-colors text-xs"
                title={t('clearFilters')}
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>{t('clearFilters')}</span>
              </button>
            )}

            {hasActiveFilters && (
              <span className="text-[11px] text-gray-500 tabular-nums">
                {t('filteredOf', { shown: filteredTasks.length, total: tasks.length })}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto p-3 sm:p-6 pb-24">
          {isLoadingProjects ? (
            <div className="space-y-3" aria-busy="true" aria-label={t('loading')}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-24 rounded-xl bg-gray-900/40 border border-gray-800 animate-pulse" />
              ))}
            </div>
          ) : !activeProjectId ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3 py-16">
              <LayoutDashboard className="w-10 h-10 opacity-30" aria-hidden="true" />
              <p className="text-sm font-medium">{t('noProjects')}</p>
              <p className="text-xs text-gray-500 max-w-sm">{t('noProjectsBody')}</p>
              <button
                type="button"
                onClick={() => setIsCreatingProject(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> {t('newProject')}
              </button>
            </div>
          ) : viewMode === 'files' ? (
            <ProjectFilesView projectId={activeProjectId} />
          ) : (
            <>
              {isLoadingTasks && (
                <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> {t('loading')}
                </div>
              )}
              {viewMode === 'table' ? renderTable() : viewMode === 'kanban' ? renderKanban() : renderDashboard()}
            </>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          projectId={activeProjectId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
}
