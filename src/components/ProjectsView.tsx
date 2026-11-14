import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import {
  Plus,
  GripVertical,
  CheckCircle2,
  Circle,
  Users,
  Share2,
  LayoutDashboard,
  KanbanSquare,
  Table2,
  Calendar as CalendarIcon,
  PanelRightOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Globe2,
  Trash2,
  X,
  Search,
  Filter,
  Download,
  Printer,
  Target,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import TaskDetailSidebar from './TaskDetailSidebar';
import ProjectFilesView from './ProjectFilesView';
import InlineSubtasks from './InlineSubtasks';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import 'react-multi-date-picker/styles/backgrounds/bg-dark.css';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useFocus } from '../context/FocusContext';
import { logActivity } from '../lib/activityLogger';

interface Project {
  id: string;
  name: string;
  status?: string;
  category?: string;
  ownerId?: string;
  members?: string[];
}

interface Task {
  id: string;
  title: string;
  status: string; // TODO, IN_PROGRESS, REVIEW, DONE
  projectId: string;
  assignedTo?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  dueDate?: string;
  description?: string;
  totalSubtasks?: number;
  completedSubtasks?: number;
}

export default function ProjectsView() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const { setTaskForFocus } = useFocus();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'dashboard' | 'files'>('table');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [isJalali, setIsJalali] = useState(lang === 'fa');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Multi-facet Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  const userId = auth.currentUser?.uid;

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !userId) return;
    const name = newProjectName.trim();
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        category: 'General',
        ownerId: userId,
        members: [auth.currentUser?.email || ''],
        createdAt: serverTimestamp(),
      });
      setNewProjectName('');
      setIsCreatingProject(false);
      setActiveProject(docRef.id);
      logActivity(
        lang === 'fa' ? `پروژه جدید ایجاد شد: ${name}` : `Created project: ${name}`,
        undefined,
        'create'
      );
      showToast({
        message: lang === 'fa' ? `پروژه «${name}» ساخته شد` : `Project "${name}" created`,
        type: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const p = projects.find(item => item.id === projectId);
    const pName = p?.name || 'Project';
    if (!window.confirm(t('deleteConfirm'))) return;

    try {
      await deleteDoc(doc(db, 'projects', projectId));
      if (activeProject === projectId) {
        setActiveProject(projects.find(item => item.id !== projectId)?.id || null);
      }
      logActivity(
        lang === 'fa' ? `پروژه حذف شد: ${pName}` : `Deleted project: ${pName}`,
        undefined,
        'delete'
      );
      showToast({
        message: lang === 'fa' ? `پروژه «${pName}» حذف شد` : `Project "${pName}" deleted`,
        type: 'info',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects');
    }
  };

  const seedSampleData = async () => {
    if (!userId || !auth.currentUser?.email) return;
    setIsSeeding(true);
    try {
      const p1Ref = await addDoc(collection(db, 'projects'), {
        name: lang === 'fa' ? 'طراحی مجدد وب‌سایت' : 'Website Redesign',
        category: 'Development',
        ownerId: userId,
        members: [auth.currentUser.email],
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'projects', p1Ref.id, 'tasks'), {
        title: lang === 'fa' ? 'طراحی موکاپ و وایرفریم‌ها' : 'Design Mockups & Wireframes',
        status: 'DONE',
        projectId: p1Ref.id,
        priority: 'High',
        dueDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'projects', p1Ref.id, 'tasks'), {
        title: lang === 'fa' ? 'پیاده‌سازی فرانت‌اند ری‌اکت' : 'Implement Frontend React',
        status: 'IN_PROGRESS',
        projectId: p1Ref.id,
        priority: 'Critical',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'projects', p1Ref.id, 'tasks'), {
        title: lang === 'fa' ? 'نوشتن تست‌های یکپارچگی' : 'Write Integration Tests',
        status: 'TODO',
        projectId: p1Ref.id,
        priority: 'Low',
        createdAt: serverTimestamp(),
      });

      const p2Ref = await addDoc(collection(db, 'projects'), {
        name: lang === 'fa' ? 'کمپین بازاریابی بهاره' : 'Spring Marketing Campaign',
        category: 'Marketing',
        ownerId: userId,
        members: [auth.currentUser.email],
        createdAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'projects', p2Ref.id, 'tasks'), {
        title: lang === 'fa' ? 'نگارش متن تبلیغات و شعارها' : 'Write Ad Copy & Copywriting',
        status: 'TODO',
        projectId: p2Ref.id,
        priority: 'Medium',
        createdAt: serverTimestamp(),
      });

      setActiveProject(p1Ref.id);
      logActivity(
        lang === 'fa' ? 'داده‌های نمونه اولیه با موفقیت اضافه شدند' : 'Sample projects & tasks seeded',
        undefined,
        'create'
      );
      showToast({
        message: lang === 'fa' ? 'اطلاعات نمونه با موفقیت ایجاد شد' : 'Sample data created successfully',
        type: 'success',
      });
    } catch (err) {
      console.error(err);
      showToast({
        message: lang === 'fa' ? 'خطا در ایجاد داده‌های نمونه' : 'Failed to seed sample data',
        type: 'error',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail.trim() || !activeProject) return;
    try {
      await updateDoc(doc(db, 'projects', activeProject), {
        members: arrayUnion(shareEmail.trim()),
      });
      const email = shareEmail.trim();
      setShareEmail('');
      setIsSharing(false);
      logActivity(
        lang === 'fa' ? `پروژه با ${email} به اشتراک گذاشته شد` : `Project shared with ${email}`,
        undefined,
        'update'
      );
      showToast({
        message: lang === 'fa' ? 'پروژه با موفقیت به اشتراک گذاشته شد' : 'Project shared successfully',
        type: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects');
    }
  };

  useEffect(() => {
    if (!userId || !auth.currentUser?.email) return;

    const projectsRef = query(
      collection(db, 'projects'),
      where('members', 'array-contains', auth.currentUser.email || 'no-email')
    );
    const unsubscribeProjects = onSnapshot(
      projectsRef,
      snapshot => {
        const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        setProjects(p);
        if (p.length > 0 && !activeProject) {
          setActiveProject(p[0].id);
        }
      },
      error => handleFirestoreError(error, OperationType.GET, 'projects')
    );

    return () => unsubscribeProjects();
  }, [userId, activeProject]);

  useEffect(() => {
    if (!userId || !activeProject) {
      setTasks([]);
      return;
    }

    const tasksRef = collection(db, 'projects', activeProject, 'tasks');
    const unsubscribeTasks = onSnapshot(
      tasksRef,
      snapshot => {
        const t = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        setTasks(t);
      },
      error => handleFirestoreError(error, OperationType.GET, 'projects/tasks')
    );

    return () => unsubscribeTasks();
  }, [userId, activeProject]);

  const addTask = async (e: React.FormEvent, customStatus?: string) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || !userId || !activeProject) return;

    try {
      setNewTaskTitle('');
      const docRef = await addDoc(collection(db, 'projects', activeProject, 'tasks'), {
        title,
        status: customStatus || 'TODO',
        projectId: activeProject,
        createdAt: serverTimestamp(),
      });

      logActivity(
        lang === 'fa' ? `وظیفه اضافه شد: ${title}` : `Added task: ${title}`,
        undefined,
        'create'
      );

      showToast({
        message: t('taskCreated'),
        type: 'success',
        undoAction: async () => {
          try {
            await deleteDoc(doc(db, 'projects', activeProject, 'tasks', docRef.id));
            logActivity(`لغو ایجاد تسک: ${title}`, undefined, 'delete');
          } catch {}
        },
      });
    } catch (error) {
      console.error(error);
      setNewTaskTitle(title);
      handleFirestoreError(error, OperationType.CREATE, 'projects/tasks');
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    if (!userId || !activeProject) return;
    const task = tasks.find(item => item.id === taskId);
    const oldStatus = task?.status;
    try {
      await updateDoc(doc(db, 'projects', activeProject, 'tasks', taskId), {
        status: newStatus,
      });
      logActivity(
        lang === 'fa'
          ? `تغییر وضعیت «${task?.title}» به ${newStatus}`
          : `Updated status of "${task?.title}" to ${newStatus}`,
        undefined,
        'update'
      );
      showToast({
        message: t('taskUpdated'),
        type: 'info',
        undoAction: async () => {
          if (oldStatus) {
            await updateDoc(doc(db, 'projects', activeProject, 'tasks', taskId), {
              status: oldStatus,
            });
          }
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
    }
  };

  const deleteTask = async (task: Task) => {
    if (!userId || !activeProject) return;
    try {
      await deleteDoc(doc(db, 'projects', activeProject, 'tasks', task.id));
      logActivity(
        lang === 'fa' ? `وظیفه حذف شد: ${task.title}` : `Deleted task: ${task.title}`,
        undefined,
        'delete'
      );
      showToast({
        message: t('taskDeleted'),
        type: 'info',
        undoAction: async () => {
          try {
            await addDoc(collection(db, 'projects', activeProject, 'tasks'), {
              title: task.title,
              status: task.status,
              priority: task.priority || null,
              dueDate: task.dueDate || null,
              projectId: activeProject,
              createdAt: serverTimestamp(),
            });
            logActivity(`بازیابی وظیفه: ${task.title}`, undefined, 'create');
          } catch {}
        },
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects/tasks');
    }
  };

  const updateTaskTitle = async (taskId: string, newTitle: string) => {
    if (!userId || !activeProject || !newTitle.trim()) return;
    try {
      await updateDoc(doc(db, 'projects', activeProject, 'tasks', taskId), {
        title: newTitle.trim(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
    }
  };

  const updateTaskPriority = async (taskId: string, newPriority: string) => {
    if (!userId || !activeProject) return;
    try {
      await updateDoc(doc(db, 'projects', activeProject, 'tasks', taskId), {
        priority: newPriority,
      });
      logActivity(
        lang === 'fa' ? `تغییر اولویت به ${newPriority}` : `Priority set to ${newPriority}`,
        undefined,
        'update'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
    }
  };

  // Export functions
  const exportToCSV = () => {
    const activeP = projects.find(p => p.id === activeProject);
    const projectName = activeP?.name || 'Project';
    const headers = ['Title', 'Status', 'Priority', 'Due Date', 'Assignee'];
    const rows = tasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.status || ''}"`,
      `"${t.priority || ''}"`,
      `"${t.dueDate || ''}"`,
      `"${t.assignedTo || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_tasks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ message: t('exportCsv') + ' ✓', type: 'success' });
  };

  const exportToJSON = () => {
    const activeP = projects.find(p => p.id === activeProject);
    const data = {
      project: activeP,
      exportedAt: new Date().toISOString(),
      tasks,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeP?.name || 'project'}_data.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ message: t('exportJson') + ' ✓', type: 'success' });
  };

  const printCleanReport = () => {
    window.print();
  };

  const columns = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

  const statusColors: Record<string, string> = {
    TODO: 'bg-gray-500',
    IN_PROGRESS: 'bg-blue-500',
    REVIEW: 'bg-purple-500',
    DONE: 'bg-emerald-500',
  };

  const priorityColors: Record<string, string> = {
    Low: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    Medium: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    High: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    Critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  // Multi-facet filtering logic
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesAssignee = (t.assignedTo || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesAssignee) return false;
      }
      // Status Filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      // Priority Filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
        return false;
      }
      // Overdue Filter
      if (overdueOnly) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE';
        if (!isOverdue) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, overdueOnly]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || overdueOnly;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setOverdueOnly(false);
  };

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const critical = tasks.filter(t => t.priority === 'Critical').length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE').length;
    return { total, done, progress, critical, overdue };
  }, [tasks]);

  const currentProject = projects.find(p => p.id === activeProject);

  return (
    <div className="flex-1 flex h-full bg-gray-950 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Project Header Bar with Glass Styling */}
        <header className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-gray-800/80 shrink-0 bg-gray-900/60 backdrop-blur-md">
          {/* Projects Switcher Tabs */}
          <div className="flex gap-2 flex-1 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar items-center">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  activeProject === p.id
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold shadow-xs'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 border border-transparent'
                }`}
              >
                {p.name}
              </button>
            ))}

            {isCreatingProject ? (
              <form
                onSubmit={handleCreateProject}
                className="flex items-center gap-2 shrink-0 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1"
              >
                <input
                  type="text"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  placeholder={t('projectName')}
                  className="bg-transparent text-xs text-gray-200 focus:outline-none w-28 sm:w-36"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={() => setIsCreatingProject(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800/60 transition-colors shrink-0 border border-dashed border-gray-800"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('newProject')}</span>
              </button>
            )}
          </div>

          {/* Right Header Toolbar: Jalali, View Modes, Export & Delete */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* View Mode Segmented Control */}
            <div className="flex items-center bg-gray-950/80 rounded-lg p-1 border border-gray-800/80">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table' ? 'bg-gray-800 text-emerald-400 shadow-xs' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={t('tableView')}
              >
                <Table2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'kanban' ? 'bg-gray-800 text-emerald-400 shadow-xs' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={t('kanbanView')}
              >
                <KanbanSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'dashboard' ? 'bg-gray-800 text-emerald-400 shadow-xs' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={t('dashboardView')}
              >
                <LayoutDashboard className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('files')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'files' ? 'bg-gray-800 text-emerald-400 shadow-xs' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={t('filesView')}
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>

            {/* Jalali Calendar Toggle */}
            <button
              onClick={() => setIsJalali(!isJalali)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:bg-gray-800/60 text-gray-300 rounded-lg text-xs font-medium transition-colors"
            >
              <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">
                {isJalali ? t('calendarToggleJalali') : t('calendarToggleGregorian')}
              </span>
            </button>

            {/* Export Dropdown / Actions */}
            <div className="flex items-center bg-gray-950/70 border border-gray-800/80 rounded-lg p-0.5">
              <button
                onClick={exportToCSV}
                className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-gray-800/60 rounded transition-colors"
                title={t('exportCsv')}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={printCleanReport}
                className="p-1.5 text-gray-400 hover:text-sky-400 hover:bg-gray-800/60 rounded transition-colors"
                title={t('printReport')}
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Seed Sample Data Button (if no projects or empty) */}
            {projects.length <= 1 && (
              <button
                onClick={seedSampleData}
                disabled={isSeeding}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isSeeding ? '...' : (lang === 'fa' ? 'داده نمونه' : 'Sample Data')}</span>
              </button>
            )}

            {/* Share & Delete */}
            {activeProject && (
              <div className="relative">
                <button
                  onClick={() => setIsSharing(!isSharing)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-950/70 border border-gray-800/80 hover:bg-gray-800/60 text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                {isSharing && (
                  <div className="absolute end-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-40 p-3.5 backdrop-blur-xl">
                    <h4 className="text-xs font-semibold text-gray-200 mb-2">
                      {lang === 'fa' ? 'اشتراک‌گذاری پروژه' : 'Share Project'}
                    </h4>
                    <form onSubmit={handleShare} className="flex gap-2">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={e => setShareEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        {lang === 'fa' ? 'افزودن' : 'Add'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeProject && (
              <button
                onClick={() => handleDeleteProject(activeProject)}
                className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition-colors"
                title={t('deleteProject')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Feature: Productivity Insights & Analytics Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-900/40 border-b border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {/* Progress Bar Item */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400">{t('completionRate')}:</span>
              <div className="w-20 bg-gray-950 border border-gray-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full transition-all duration-500 ease-out"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
              <span className="font-mono tabular-nums font-semibold text-emerald-400">{stats.progress}%</span>
            </div>

            {/* Counts */}
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

          <div className="text-[11px] text-gray-500 font-mono hidden lg:block">
            {currentProject ? `Project ID: ${currentProject.id.substring(0, 8)}...` : ''}
          </div>
        </div>

        {/* Feature: Multi-Facet Live Filtering & Instant Search Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 bg-gray-950/70 border-b border-gray-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-gray-900/80 border border-gray-800/80 rounded-xl px-3 py-1.5 focus-within:border-emerald-500 transition-colors">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('searchTasks')}
              className="bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-gray-300">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">{t('filterByStatus')}: {t('all')}</option>
              <option value="TODO">{t('todo')}</option>
              <option value="IN_PROGRESS">{t('inProgress')}</option>
              <option value="DONE">{t('done')}</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="bg-gray-900/80 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">{t('filterByPriority')}: {t('all')}</option>
              <option value="Low">{t('low')}</option>
              <option value="Medium">{t('medium')}</option>
              <option value="High">{t('high')}</option>
              <option value="Critical">{t('critical')}</option>
            </select>

            {/* Overdue Only Filter */}
            <button
              onClick={() => setOverdueOnly(!overdueOnly)}
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
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-gray-400 hover:text-rose-400 px-2 py-1 transition-colors text-xs"
                title={t('clearFilters')}
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('clearFilters')}</span>
              </button>
            )}
          </div>
        </div>

        {/* View Content Port */}
        <div className="flex-1 overflow-x-auto p-4 sm:p-6 pb-48">
          {activeProject ? (
            viewMode === 'files' ? (
              <ProjectFilesView projectId={activeProject} />
            ) : viewMode === 'table' ? (
              <div className="w-full flex flex-col gap-6 pb-12">
                {columns.map(statusGroup => {
                  const groupTasks = filteredTasks.filter(t => t.status === statusGroup);
                  const groupColor = statusColors[statusGroup] || 'bg-gray-600';
                  const groupTextColor = groupColor.replace('bg-', 'text-');

                  return (
                    <div
                      key={statusGroup}
                      className="min-w-[800px] w-full bg-gray-900/30 border border-gray-800/80 rounded-xl shadow-xl overflow-hidden backdrop-blur-xs"
                    >
                      {/* Table Group Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/70 border-b border-gray-800/80">
                        <div className="flex items-center gap-3">
                          <div className={`w-3.5 h-3.5 rounded ${groupColor} shadow-sm shrink-0`} />
                          <h3 className={`text-xs font-bold tracking-wide uppercase ${groupTextColor}`}>
                            {statusGroup === 'TODO'
                              ? t('todo')
                              : statusGroup === 'IN_PROGRESS'
                              ? t('inProgress')
                              : statusGroup === 'DONE'
                              ? t('done')
                              : statusGroup.replace('_', ' ')}
                          </h3>
                          <span className="text-xs font-mono tabular-nums text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                            {groupTasks.length}
                          </span>
                        </div>
                      </div>

                      {/* Column Headers */}
                      <div className="flex items-center px-4 py-2 bg-gray-950/40 border-b border-gray-800/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        <div className="w-8 shrink-0" />
                        <div className="flex-1">{t('taskTitle')}</div>
                        <div className="w-28 text-center">{lang === 'fa' ? 'مسئول' : 'Owner'}</div>
                        <div className="w-36 text-center">{t('status')}</div>
                        <div className="w-28 text-center">{t('priority')}</div>
                        <div className="w-32 text-center">{t('dueDate')}</div>
                        <div className="w-24 text-center">{t('actions')}</div>
                      </div>

                      {/* Rows */}
                      <div className="divide-y divide-gray-800/40">
                        {groupTasks.map(task => (
                          <React.Fragment key={task.id}>
                            <div className="flex items-center px-4 py-2 hover:bg-gray-800/30 transition-colors group">
                              <div className="w-8 shrink-0 flex items-center justify-center">
                                <button
                                  onClick={() => toggleExpand(task.id)}
                                  className="p-0.5 text-gray-500 hover:text-gray-300 rounded transition-colors"
                                >
                                  {expandedTasks.has(task.id) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              </div>

                              {/* Title Input */}
                              <div className="flex-1 font-medium text-xs text-gray-200">
                                <input
                                  type="text"
                                  defaultValue={task.title}
                                  onBlur={e => {
                                    if (e.target.value !== task.title) {
                                      updateTaskTitle(task.id, e.target.value);
                                    }
                                  }}
                                  className="w-full bg-transparent border border-transparent hover:border-gray-700/80 focus:border-emerald-500 focus:bg-gray-900 rounded-md px-2 py-1 outline-none transition-colors"
                                />
                              </div>

                              {/* Assignee */}
                              <div className="w-28 px-2 flex justify-center">
                                <div className="relative group/owner cursor-pointer hover:z-40">
                                  <div
                                    className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 text-[10px] text-gray-300"
                                    title={task.assignedTo || 'Unassigned'}
                                  >
                                    {task.assignedTo ? (
                                      task.assignedTo.substring(0, 2).toUpperCase()
                                    ) : (
                                      <Users className="w-3 h-3 text-gray-500" />
                                    )}
                                  </div>
                                  {activeProject && projects.find(p => p.id === activeProject)?.members && (
                                    <div className="absolute top-full start-1/2 -translate-x-1/2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl hidden group-hover/owner:flex flex-col overflow-hidden z-40">
                                      {projects
                                        .find(p => p.id === activeProject)
                                        ?.members?.map(m => (
                                          <button
                                            key={m}
                                            onClick={async () => {
                                              if (!userId || !activeProject) return;
                                              try {
                                                await updateDoc(doc(db, 'projects', activeProject, 'tasks', task.id), {
                                                  assignedTo: m,
                                                });
                                              } catch (error) {
                                                handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
                                              }
                                            }}
                                            className="px-3 py-1.5 text-xs text-start text-gray-300 hover:bg-gray-800 transition-colors truncate"
                                          >
                                            {m}
                                          </button>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Status */}
                              <div className="w-36 px-2">
                                <div className="relative w-full group/status cursor-pointer hover:z-40">
                                  <div
                                    className={`w-full py-1 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                                      statusColors[task.status] || 'bg-gray-600'
                                    }`}
                                  >
                                    {task.status === 'TODO'
                                      ? t('todo')
                                      : task.status === 'IN_PROGRESS'
                                      ? t('inProgress')
                                      : task.status === 'DONE'
                                      ? t('done')
                                      : task.status.replace('_', ' ')}
                                  </div>
                                  <div className="absolute top-full start-0 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl hidden group-hover/status:flex flex-col overflow-hidden z-40">
                                    {columns.map(c => (
                                      <button
                                        key={c}
                                        onClick={() => updateTaskStatus(task.id, c)}
                                        className="px-3 py-1.5 text-xs text-start text-gray-300 hover:bg-gray-800 transition-colors"
                                      >
                                        {c === 'TODO' ? t('todo') : c === 'IN_PROGRESS' ? t('inProgress') : c === 'DONE' ? t('done') : c}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Priority */}
                              <div className="w-28 px-2 flex justify-center">
                                <div className="relative w-full group/priority cursor-pointer hover:z-40">
                                  <div
                                    className={`w-full py-1 rounded-md flex items-center justify-center text-[10px] font-bold border ${
                                      task.priority ? priorityColors[task.priority] : 'bg-gray-800 text-gray-400 border-gray-700'
                                    }`}
                                  >
                                    {task.priority || (lang === 'fa' ? 'انتخاب' : 'Set')}
                                  </div>
                                  <div className="absolute top-full start-0 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl hidden group-hover/priority:flex flex-col overflow-hidden z-40">
                                    {['Low', 'Medium', 'High', 'Critical'].map(p => (
                                      <button
                                        key={p}
                                        onClick={() => updateTaskPriority(task.id, p)}
                                        className="px-3 py-1.5 text-xs text-start text-gray-300 hover:bg-gray-800 transition-colors"
                                      >
                                        {p}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Date */}
                              <div className="w-32 flex justify-center">
                                <DatePicker
                                  value={task.dueDate ? new Date(task.dueDate) : null}
                                  onChange={(dateObject: any) => {
                                    if (!userId || !activeProject) return;
                                    updateDoc(doc(db, 'projects', activeProject, 'tasks', task.id), {
                                      dueDate: dateObject ? dateObject.toDate().toISOString() : null,
                                    }).catch(error => {
                                      handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
                                    });
                                  }}
                                  calendar={isJalali ? persian : undefined}
                                  locale={isJalali ? persian_fa : undefined}
                                  format={isJalali ? 'YYYY/MM/DD' : 'YYYY-MM-DD'}
                                  className="bg-dark"
                                  portal
                                  inputClass="bg-transparent text-[11px] text-gray-400 hover:text-gray-200 focus:outline-none border border-transparent hover:border-gray-700 rounded px-2 py-1 text-center w-full cursor-pointer font-mono tabular-nums"
                                  placeholder={lang === 'fa' ? 'تعیین تاریخ' : 'Set Date'}
                                />
                              </div>

                              {/* Action Buttons: Focus & Details & Delete */}
                              <div className="w-24 flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setTaskForFocus(task.title)}
                                  className="p-1 text-gray-400 hover:text-sky-400 hover:bg-gray-800 rounded transition-colors"
                                  title={t('startFocus')}
                                >
                                  <Target className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedTask(task)}
                                  className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                                  title="Details"
                                >
                                  <PanelRightOpen className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteTask(task)}
                                  className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete Task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {expandedTasks.has(task.id) && activeProject && (
                              <InlineSubtasks task={task} projectId={activeProject} />
                            )}
                          </React.Fragment>
                        ))}

                        {/* Add Row for Group */}
                        <div className="flex items-center px-4 py-1.5 hover:bg-gray-800/20 transition-colors">
                          <div className="w-8 shrink-0 flex items-center">
                            <div className={`w-1 h-5 rounded-full opacity-60 ${groupColor}`} />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder={`+ ${t('addTaskPlaceholder')}`}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const val = e.currentTarget.value.trim();
                                  if (!val || !userId || !activeProject) return;
                                  e.currentTarget.value = '';
                                  try {
                                    const docRef = await addDoc(collection(db, 'projects', activeProject, 'tasks'), {
                                      title: val,
                                      status: statusGroup,
                                      projectId: activeProject,
                                      createdAt: serverTimestamp(),
                                    });
                                    logActivity(
                                      lang === 'fa' ? `وظیفه جدید اضافه شد: ${val}` : `Added task: ${val}`,
                                      undefined,
                                      'create'
                                    );
                                    showToast({ message: t('taskCreated'), type: 'success' });
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.CREATE, 'projects/tasks');
                                  }
                                }
                              }}
                              className="w-full max-w-md bg-transparent border-none text-xs text-gray-400 focus:outline-none focus:text-gray-100 placeholder-gray-600 py-1"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'kanban' ? (
              <div className="flex gap-4 sm:gap-6 h-full min-w-max pb-12">
                {columns.map(status => {
                  const columnTasks = filteredTasks.filter(t => t.status === status);
                  return (
                    <div
                      key={status}
                      className="w-80 flex flex-col bg-gray-900/40 rounded-xl border border-gray-800/80 overflow-hidden shadow-lg backdrop-blur-xs"
                    >
                      <div className="px-4 py-3 border-b border-gray-800/80 bg-gray-900/70 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status] || 'bg-gray-500'}`} />
                          <h3 className="text-xs font-semibold text-gray-200">
                            {status === 'TODO'
                              ? t('todo')
                              : status === 'IN_PROGRESS'
                              ? t('inProgress')
                              : status === 'DONE'
                              ? t('done')
                              : status.replace('_', ' ')}
                          </h3>
                        </div>
                        <span className="text-xs font-mono tabular-nums text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-md">
                          {columnTasks.length}
                        </span>
                      </div>

                      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[140px]">
                        {columnTasks.length === 0 && (
                          <div className="text-center py-6 text-xs text-gray-600 font-medium border border-dashed border-gray-800 rounded-lg">
                            {lang === 'fa' ? 'وظیفه‌ای در این ستون نیست' : 'No tasks in this stage'}
                          </div>
                        )}
                        {columnTasks.map(task => (
                          <div
                            key={task.id}
                            className="bg-gray-900/90 p-3.5 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors group flex flex-col gap-2.5 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-gray-200 flex-1">{task.title}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setTaskForFocus(task.title)}
                                  className="p-1 text-gray-400 hover:text-sky-400 hover:bg-gray-800 rounded transition-colors"
                                  title={t('startFocus')}
                                >
                                  <Target className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setSelectedTask(task)}
                                  className="p-1 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded transition-colors"
                                  title="Details"
                                >
                                  <PanelRightOpen className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  task.priority ? priorityColors[task.priority] : 'border-gray-800 text-gray-500'
                                }`}
                              >
                                {task.priority || 'Normal'}
                              </span>

                              <div className="flex gap-1">
                                {columns
                                  .filter(c => c !== status)
                                  .map(c => (
                                    <button
                                      key={c}
                                      onClick={() => updateTaskStatus(task.id, c)}
                                      className="px-1.5 py-0.5 rounded bg-gray-800 text-[9px] uppercase font-bold text-gray-400 hover:text-emerald-400 hover:bg-gray-700 transition-colors"
                                      title={`Move to ${c}`}
                                    >
                                      {c.substring(0, 1)}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ))}

                        {status === 'TODO' && (
                          <form onSubmit={e => addTask(e, 'TODO')} className="pt-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder={t('addTaskPlaceholder')}
                                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 transition-colors pe-8"
                              />
                              <button
                                type="submit"
                                disabled={!newTaskTitle.trim()}
                                className="absolute end-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-400 disabled:opacity-50"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Dashboard View */
              <div className="w-full h-full max-w-5xl mx-auto space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-gray-400 text-xs font-medium mb-1">{t('totalTasks')}</span>
                    <span className="text-3xl font-mono tabular-nums font-bold text-white">{stats.total}</span>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-gray-400 text-xs font-medium mb-1">{t('done')}</span>
                    <span className="text-3xl font-mono tabular-nums font-bold text-emerald-400">{stats.done}</span>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-gray-400 text-xs font-medium mb-1">{t('critical')}</span>
                    <span className="text-3xl font-mono tabular-nums font-bold text-red-400">{stats.critical}</span>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg">
                    <span className="text-gray-400 text-xs font-medium mb-1">{t('overdueTasks')}</span>
                    <span className="text-3xl font-mono tabular-nums font-bold text-amber-400">{stats.overdue}</span>
                  </div>
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                    <span className="text-gray-400 text-xs font-medium mb-1 z-10">{t('completionRate')}</span>
                    <span className="text-3xl font-mono tabular-nums font-bold text-sky-400 z-10">{stats.progress}%</span>
                    <div
                      className="absolute bottom-0 start-0 h-1.5 bg-sky-500 transition-all duration-700"
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-lg">
                    <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('filterByStatus')}</h3>
                    <div className="space-y-4">
                      {columns.map(statusGroup => {
                        const count = tasks.filter(t => t.status === statusGroup).length;
                        const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                        const color = statusColors[statusGroup] || 'bg-gray-600';
                        return (
                          <div key={statusGroup}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-gray-300">
                                {statusGroup === 'TODO'
                                  ? t('todo')
                                  : statusGroup === 'IN_PROGRESS'
                                  ? t('inProgress')
                                  : statusGroup === 'DONE'
                                  ? t('done')
                                  : statusGroup.replace('_', ' ')}
                              </span>
                              <span className="text-gray-400 font-mono tabular-nums">{count}</span>
                            </div>
                            <div className="h-2 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 shadow-lg">
                    <h3 className="text-sm font-semibold text-gray-200 mb-4">{t('activityFeed')}</h3>
                    {tasks.length === 0 ? (
                      <p className="text-gray-500 text-xs">
                        {lang === 'fa' ? 'وظیفه‌ای ثبت نشده است.' : 'No tasks recorded yet.'}
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {tasks.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-2.5 bg-gray-950/70 rounded-xl border border-gray-800/80 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {task.status === 'DONE' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                              )}
                              <span
                                className={`truncate ${
                                  task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-200'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-900 text-gray-400 border border-gray-800 shrink-0">
                              {task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs">
              <p>{lang === 'fa' ? 'پروژه‌ای انتخاب نشده است. از نوار بالا یک پروژه جدید بسازید.' : 'No project selected. Create one above to get started.'}</p>
            </div>
          )}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailSidebar task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}
