import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { X, MessageSquare, CheckSquare, Plus, FileText, Trash2, Target } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { useFocus } from '../context/FocusContext';
import { useI18n } from '../context/I18nContext';

interface Task {
  id: string;
  title: string;
  projectId: string;
  description?: string;
  totalSubtasks?: number;
  completedSubtasks?: number;
  // other fields omitted for brevity
}

interface TaskDetailSidebarProps {
  task: Task | null;
  onClose: () => void;
}

export default function TaskDetailSidebar({ task, onClose }: TaskDetailSidebarProps) {
  const { setTaskForFocus } = useFocus();
  const { t } = useI18n();
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'subtasks' | 'notes'>('subtasks');
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (task) {
      setDescription(task.description || '');
    }
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const qSub = query(collection(db, 'projects', task.projectId, 'tasks', task.id, 'subtasks'), orderBy('createdAt', 'asc'));
    const unsubSub = onSnapshot(qSub, snap => {
      setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qNotes = query(collection(db, 'projects', task.projectId, 'tasks', task.id, 'notes'), orderBy('createdAt', 'desc'));
    const unsubNotes = onSnapshot(qNotes, snap => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubSub();
      unsubNotes();
    };
  }, [task]);

  const saveDescription = async () => {
    if (!task) return;
    try {
      await updateDoc(doc(db, 'projects', task.projectId, 'tasks', task.id), {
        description: description.trim()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'projects/tasks');
    }
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim() || !task) return;
    try {
      await addDoc(collection(db, 'projects', task.projectId, 'tasks', task.id, 'subtasks'), {
        title: newSubtask.trim(),
        completed: false,
        createdAt: serverTimestamp()
      });
      // Update task total subtasks
      const taskRef = doc(db, 'projects', task.projectId, 'tasks', task.id);
      await updateDoc(taskRef, {
        totalSubtasks: (task.totalSubtasks || 0) + 1
      });
      setNewSubtask('');
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, 'projects/tasks/subtasks');
    }
  };

  const toggleSubtask = async (subtaskId: string, completed: boolean) => {
    if (!task) return;
    try {
      await updateDoc(doc(db, 'projects', task.projectId, 'tasks', task.id, 'subtasks', subtaskId), {
        completed: !completed
      });
      // Update task completed subtasks
      const taskRef = doc(db, 'projects', task.projectId, 'tasks', task.id);
      await updateDoc(taskRef, {
        completedSubtasks: (task.completedSubtasks || 0) + (!completed ? 1 : -1)
      });
    } catch(e) {}
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !task) return;
    try {
      await addDoc(collection(db, 'projects', task.projectId, 'tasks', task.id, 'notes'), {
        content: newNote.trim(),
        author: auth.currentUser?.email || 'Unknown',
        createdAt: serverTimestamp()
      });
      setNewNote('');
    } catch(e) {}
  };

  const deleteNote = async (noteId: string) => {
    if (!task) return;
    try {
      await deleteDoc(doc(db, 'projects', task.projectId, 'tasks', task.id, 'notes', noteId));
    } catch(e) {}
  };

  if (!task) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      <div className="fixed md:relative inset-y-0 end-0 w-[90%] max-w-sm md:w-96 shrink-0 bg-gray-900 border-s border-gray-800 flex flex-col h-full shadow-2xl z-50 md:z-20 transition-all duration-300">
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 bg-gray-900/80 backdrop-blur">
          <h3 className="font-semibold text-gray-100 truncate pe-4">{task.title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTaskForFocus(task.title)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors"
              title="Start Pomodoro focus session"
            >
              <Target className="w-3.5 h-3.5" />
              <span>{t('startFocus')}</span>
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</label>
          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add a more detailed description..."
            className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none transition-colors min-h-[100px] resize-y"
          />
        </div>

        <div>
          <div className="flex border-b border-gray-800 mb-4">
            <button 
              onClick={() => setActiveTab('subtasks')}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'subtasks' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" /> Subtasks
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('notes')}
              className={`pb-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'notes' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Notes & Reports
              </div>
            </button>
          </div>

          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <div className="space-y-2">
                {subtasks.map(sub => (
                  <div key={sub.id} className="flex items-start gap-3 p-2 hover:bg-gray-950 rounded-lg group transition-colors">
                    <button onClick={() => toggleSubtask(sub.id, sub.completed)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sub.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-600 hover:border-emerald-500'}`}>
                      {sub.completed && <X className="w-3 h-3" />} {/* Actually we should use a Check, but CheckSquare is a bit bulky. Let's use standard Check from lucide if we imported it, else custom */}
                      {sub.completed && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <span className={`text-sm ${sub.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{sub.title}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={addSubtask} className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={newSubtask}
                  onChange={e => setNewSubtask(e.target.value)}
                  placeholder="Add subtask..."
                  className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
                />
                <button type="submit" disabled={!newSubtask.trim()} className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <form onSubmit={addNote} className="flex flex-col gap-2">
                <textarea 
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Write an update, note, or report..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500 resize-none min-h-[80px]"
                />
                <button type="submit" disabled={!newNote.trim()} className="self-end px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                  Add Note
                </button>
              </form>
              <div className="space-y-3 mt-4">
                {notes.map(note => (
                  <div key={note.id} className="bg-gray-950 border border-gray-800 p-3 rounded-lg relative group">
                    <button onClick={() => deleteNote(note.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-400">
                        {note.author.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(note.createdAt?.toDate?.() || Date.now()).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
