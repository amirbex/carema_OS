import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Check, CheckSquare, Loader2, MessageSquare, Plus, Target, Trash2, X } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { useFocus } from '../context/FocusContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { useSubtasks } from '../hooks/useSubtasks';
import { initials, toDate } from '../lib/format';
import { PRIORITIES, TASK_STATUSES } from '../lib/appData';

interface SidebarTask {
  id: string;
  title: string;
  projectId?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string | null;
}

interface TaskDetailSidebarProps {
  task: SidebarTask | null;
  /** Parent project id; falls back to the task's own projectId. */
  projectId?: string | null;
  onClose: () => void;
}

interface Note {
  id: string;
  content?: string;
  author?: string;
  createdAt?: unknown;
}

export default function TaskDetailSidebar({ task, projectId, onClose }: TaskDetailSidebarProps) {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const { setTaskForFocus } = useFocus();

  const resolvedProjectId = projectId ?? task?.projectId ?? null;

  const [description, setDescription] = useState('');
  const [savedDescription, setSavedDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'subtasks' | 'notes'>('subtasks');
  const [notes, setNotes] = useState<Note[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const { subtasks, addSubtask, toggleSubtask, removeSubtask, progress, loading: subtasksLoading } = useSubtasks(
    resolvedProjectId,
    task?.id
  );

  // Reset the editor only when a different task is opened. Depending on
  // `task.description` as well would overwrite whatever the user is typing as
  // soon as the Firestore snapshot echoed the previous save back.
  useEffect(() => {
    setDescription(task?.description ?? '');
    setSavedDescription(task?.description ?? '');
  }, [task?.id]);

  // Escape closes the panel (mobile and desktop alike).
  useEffect(() => {
    if (!task) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [task, onClose]);

  useEffect(() => {
    if (!task || !resolvedProjectId) return;
    const notesQuery = query(
      collection(db, 'projects', resolvedProjectId, 'tasks', task.id, 'notes'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      notesQuery,
      (snapshot) => setNotes(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Note[]),
      (error) => showToast({ message: handleFirestoreError(error, OperationType.LIST, 'tasks/notes'), type: 'error' })
    );
    return () => unsubscribe();
  }, [task, resolvedProjectId, showToast]);

  const patchTask = async (patch: Record<string, unknown>) => {
    if (!task || !resolvedProjectId) return;
    try {
      await updateDoc(doc(db, 'projects', resolvedProjectId, 'tasks', task.id), patch as Record<string, any>);
    } catch (error) {
      showToast({ message: handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks'), type: 'error' });
    }
  };

  const saveDescription = async () => {
    if (!task || description === savedDescription) return;
    setIsSavingDescription(true);
    await patchTask({ description: description.trim() });
    setSavedDescription(description);
    setIsSavingDescription(false);
  };

  const submitSubtask = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await addSubtask(newSubtask);
    if (ok) setNewSubtask('');
  };

  const submitNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newNote.trim() || !task || !resolvedProjectId) return;
    setIsSavingNote(true);
    try {
      await addDoc(collection(db, 'projects', resolvedProjectId, 'tasks', task.id, 'notes'), {
        content: newNote.trim(),
        author: auth.currentUser?.email || 'Unknown',
        createdAt: serverTimestamp(),
      });
      setNewNote('');
    } catch (error) {
      showToast({ message: handleFirestoreError(error, OperationType.CREATE, 'tasks/notes'), type: 'error' });
    } finally {
      setIsSavingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!task || !resolvedProjectId) return;
    try {
      await deleteDoc(doc(db, 'projects', resolvedProjectId, 'tasks', task.id, 'notes', noteId));
    } catch (error) {
      showToast({ message: handleFirestoreError(error, OperationType.DELETE, 'tasks/notes'), type: 'error' });
    }
  };

  const locale = lang === 'fa' ? 'fa-IR' : 'en-US';
  const dueDateValue = useMemo(() => {
    const date = toDate(task?.dueDate);
    return date ? date.toISOString().slice(0, 10) : '';
  }, [task?.dueDate]);

  if (!task) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        aria-label={t('taskDetails')}
        className="fixed md:relative inset-y-0 end-0 w-[92%] max-w-sm md:w-96 shrink-0 bg-gray-900 border-s border-gray-800 flex flex-col h-full shadow-2xl z-50 md:z-20"
      >
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 sm:px-6 gap-2 shrink-0 bg-gray-900/80 backdrop-blur">
          <h3 className="font-semibold text-gray-100 truncate">{task.title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTaskForFocus(task.title)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
              title={t('startFocus')}
            >
              <Target className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('startFocus')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Quick fields */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-400">
              <span className="block mb-1 font-semibold uppercase tracking-wider">{t('status')}</span>
              <select
                value={task.status ?? 'TODO'}
                onChange={(event) => patchTask({ status: event.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === 'TODO'
                      ? t('todo')
                      : status === 'IN_PROGRESS'
                        ? t('inProgress')
                        : status === 'REVIEW'
                          ? t('review')
                          : t('done')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-400">
              <span className="block mb-1 font-semibold uppercase tracking-wider">{t('priority')}</span>
              <select
                value={task.priority ?? ''}
                onChange={(event) => patchTask({ priority: event.target.value || null })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">{t('none')}</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(priority.toLowerCase())}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-400 col-span-2">
              <span className="block mb-1 font-semibold uppercase tracking-wider">{t('dueDate')}</span>
              <input
                type="date"
                value={dueDateValue}
                onChange={(event) =>
                  patchTask({ dueDate: event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null })
                }
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="task-description" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('description')}
              </label>
              {isSavingDescription && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" aria-hidden="true" />}
            </div>
            <textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={saveDescription}
              placeholder={t('descriptionPlaceholder')}
              className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-colors min-h-[100px] resize-y"
            />
          </div>

          <div>
            <div className="flex border-b border-gray-800 mb-4" role="tablist" aria-label={t('taskDetails')}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'subtasks'}
                onClick={() => setActiveTab('subtasks')}
                className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'subtasks'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" aria-hidden="true" /> {t('subtasks')}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'notes'}
                onClick={() => setActiveTab('notes')}
                className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'notes'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" aria-hidden="true" /> {t('notes')}
                </span>
              </button>
            </div>

            {activeTab === 'subtasks' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex-1 h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="tabular-nums">{progress}%</span>
                </div>

                {subtasks.length === 0 && !subtasksLoading && (
                  <p className="text-xs text-gray-600">{t('noSubtasks')}</p>
                )}

                <ul className="space-y-1">
                  {subtasks.map((sub) => (
                    <li key={sub.id} className="flex items-start gap-3 p-2 hover:bg-gray-950 rounded-lg group transition-colors">
                      <button
                        type="button"
                        onClick={() => toggleSubtask(sub.id, Boolean(sub.completed))}
                        aria-pressed={Boolean(sub.completed)}
                        aria-label={sub.title}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          sub.completed
                            ? 'bg-emerald-500 border-emerald-500 text-gray-950'
                            : 'border-gray-600 hover:border-emerald-500'
                        }`}
                      >
                        {sub.completed && <Check className="w-3 h-3" aria-hidden="true" />}
                      </button>
                      <span className={`text-sm flex-1 ${sub.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                        {sub.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(sub.id)}
                        aria-label={t('delete')}
                        className="text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>

                <form onSubmit={submitSubtask} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    placeholder={t('addSubtaskPlaceholder')}
                    aria-label={t('addSubtaskPlaceholder')}
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={!newSubtask.trim()}
                    aria-label={t('add')}
                    className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-4">
                <form onSubmit={submitNote} className="flex flex-col gap-2">
                  <textarea
                    value={newNote}
                    onChange={(event) => setNewNote(event.target.value)}
                    placeholder={t('addNotePlaceholder')}
                    aria-label={t('addNotePlaceholder')}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500 resize-none min-h-[80px]"
                  />
                  <button
                    type="submit"
                    disabled={!newNote.trim() || isSavingNote}
                    className="self-end px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {t('addNote')}
                  </button>
                </form>

                <div className="space-y-3">
                  {notes.length === 0 && <p className="text-xs text-gray-600">{lang === 'fa' ? 'یادداشتی نیست.' : 'No notes yet.'}</p>}
                  {notes.map((note) => {
                    const created = toDate(note.createdAt);
                    return (
                      <div key={note.id} className="bg-gray-950 border border-gray-800 p-3 rounded-lg relative group">
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          aria-label={t('delete')}
                          className="absolute top-2 end-2 text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">
                            {initials(note.author)}
                          </div>
                          <span className="text-xs text-gray-500">
                            {created ? created.toLocaleDateString(locale) : ''}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
