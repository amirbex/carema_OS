import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { Plus, X, Check } from 'lucide-react';

interface InlineSubtasksProps {
  task: any; // Using any for simplicity here to access totalSubtasks etc.
  projectId: string;
}

export default function InlineSubtasks({ task, projectId }: InlineSubtasksProps) {
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  useEffect(() => {
    if (!task || !projectId) return;
    const qSub = query(collection(db, 'projects', projectId, 'tasks', task.id, 'subtasks'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(qSub, snap => {
      setSubtasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [task, projectId]);

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim() || !task) return;
    try {
      await addDoc(collection(db, 'projects', projectId, 'tasks', task.id, 'subtasks'), {
        title: newSubtask.trim(),
        completed: false,
        createdAt: serverTimestamp()
      });
      const taskRef = doc(db, 'projects', projectId, 'tasks', task.id);
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
      await updateDoc(doc(db, 'projects', projectId, 'tasks', task.id, 'subtasks', subtaskId), {
        completed: !completed
      });
      const taskRef = doc(db, 'projects', projectId, 'tasks', task.id);
      await updateDoc(taskRef, {
        completedSubtasks: (task.completedSubtasks || 0) + (!completed ? 1 : -1)
      });
    } catch(e) {}
  };

  const progress = task.totalSubtasks ? Math.round(((task.completedSubtasks || 0) / task.totalSubtasks) * 100) : 0;

  return (
    <div className="bg-gray-950/50 border-t border-gray-800/50 p-4 pl-14">
      <div className="flex items-center gap-4 mb-4">
         <div className="flex-1 max-w-sm h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
         </div>
         <span className="text-xs font-medium text-gray-500">{progress}% Completed</span>
      </div>
      <div className="space-y-2 mb-3">
        {subtasks.map(sub => (
          <div key={sub.id} className="flex items-start gap-3 p-1.5 hover:bg-gray-800/30 rounded-lg group transition-colors">
            <button onClick={() => toggleSubtask(sub.id, sub.completed)} className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sub.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-600 hover:border-emerald-500'}`}>
              {sub.completed && <Check className="w-3 h-3" />}
            </button>
            <span className={`text-sm ${sub.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{sub.title}</span>
          </div>
        ))}
      </div>
      <form onSubmit={addSubtask} className="flex items-center gap-2 max-w-sm">
        <input 
          type="text" 
          value={newSubtask}
          onChange={e => setNewSubtask(e.target.value)}
          placeholder="Add a new subtask..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        />
        <button type="submit" disabled={!newSubtask.trim()} className="p-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
