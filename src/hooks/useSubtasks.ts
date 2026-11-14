import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { useToast } from '../context/ToastContext';

export interface Subtask {
  id: string;
  title: string;
  completed?: boolean;
  createdAt?: unknown;
}

/**
 * Single source of truth for a task's checklist.
 *
 * `TaskDetailSidebar` and `InlineSubtasks` each had their own copy of this
 * logic and both incremented/decremented manual counters, which drifted
 * (negative "completed" counts, stale totals after deletes). Now the counters
 * are always derived from the live subtask documents.
 */
export function useSubtasks(projectId?: string | null, taskId?: string | null) {
  const { showToast } = useToast();
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(false);

  const collectionPath = useMemo(() => {
    if (!projectId || !taskId) return null;
    return ['projects', projectId, 'tasks', taskId, 'subtasks'] as const;
  }, [projectId, taskId]);

  useEffect(() => {
    if (!collectionPath) {
      setSubtasks([]);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(
      query(collection(db, ...collectionPath), orderBy('createdAt', 'asc')),
      (snapshot) => {
        setSubtasks(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Subtask[]);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        showToast({ message: handleFirestoreError(error, OperationType.LIST, 'tasks/subtasks'), type: 'error' });
      }
    );
    return () => unsubscribe();
  }, [collectionPath, showToast]);

  const syncCounters = useCallback(
    async (next: Subtask[]) => {
      if (!projectId || !taskId) return;
      try {
        await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
          totalSubtasks: next.length,
          completedSubtasks: next.filter((s) => s.completed).length,
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks');
      }
    },
    [projectId, taskId]
  );

  const addSubtask = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed || !collectionPath) return false;
      try {
        await addDoc(collection(db, ...collectionPath), {
          title: trimmed,
          completed: false,
          createdAt: serverTimestamp(),
        });
        await syncCounters([...subtasks, { id: 'pending', title: trimmed, completed: false }]);
        return true;
      } catch (error) {
        showToast({ message: handleFirestoreError(error, OperationType.CREATE, 'tasks/subtasks'), type: 'error' });
        return false;
      }
    },
    [collectionPath, subtasks, syncCounters, showToast]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: string, completed: boolean) => {
      if (!collectionSpec(collectionPath)) return;
      try {
        await updateDoc(doc(db, 'projects', projectId!, 'tasks', taskId!, 'subtasks', subtaskId), {
          completed: !completed,
        });
        const next = subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !completed } : s));
        await syncCounters(next);
      } catch (error) {
        showToast({ message: handleFirestoreError(error, OperationType.UPDATE, 'tasks/subtasks'), type: 'error' });
      }
    },
    [collectionPath, projectId, taskId, subtasks, syncCounters, showToast]
  );

  const removeSubtask = useCallback(
    async (subtaskId: string) => {
      if (!projectId || !taskId) return;
      try {
        await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId, 'subtasks', subtaskId));
        const next = subtasks.filter((s) => s.id !== subtaskId);
        await syncCounters(next);
      } catch (error) {
        showToast({ message: handleFirestoreError(error, OperationType.DELETE, 'tasks/subtasks'), type: 'error' });
      }
    },
    [projectId, taskId, subtasks, syncCounters, showToast]
  );

  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { subtasks, loading, addSubtask, toggleSubtask, removeSubtask, total, completed, progress };
}

function collectionSpec(spec: readonly string[] | null): boolean {
  return Array.isArray(spec) && spec.length > 0;
}
