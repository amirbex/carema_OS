import { useCallback, useEffect, useState } from 'react';
import {
  addSubtaskRecord,
  deleteSubtaskRecord,
  setSubtaskCompleted,
  subscribeSubtasks,
  updateTask,
  type Subtask,
} from '../lib/appData';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { useToast } from '../context/ToastContext';

export type { Subtask };

/**
 * Single source of truth for a task's checklist (Firestore or demo store).
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

  useEffect(() => {
    if (!projectId || !taskId) {
      setSubtasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeSubtasks(
      projectId,
      taskId,
      (next) => {
        setSubtasks(next);
        setLoading(false);
      },
      (message) => {
        setLoading(false);
        showToast({ message, type: 'error' });
      }
    );
    return () => unsubscribe();
  }, [projectId, taskId, showToast]);

  const syncCounters = useCallback(
    async (next: Subtask[]) => {
      if (!projectId || !taskId) return;
      try {
        await updateTask(projectId, taskId, {
          totalSubtasks: next.length,
          completedSubtasks: next.filter((subtask) => subtask.completed).length,
        });
      } catch (error) {
        showToast({ message: handleFirestoreError(error, OperationType.UPDATE, 'projects/tasks'), type: 'error' });
      }
    },
    [projectId, taskId, showToast]
  );

  const addSubtask = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed || !projectId || !taskId) return false;
      try {
        await addSubtaskRecord(projectId, taskId, trimmed);
        await syncCounters([...subtasks, { id: 'pending', title: trimmed, completed: false }]);
        return true;
      } catch (error) {
        showToast({
          message: handleFirestoreError(error, OperationType.CREATE, 'tasks/subtasks'),
          type: 'error',
        });
        return false;
      }
    },
    [projectId, taskId, subtasks, syncCounters, showToast]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: string, completed: boolean) => {
      if (!projectId || !taskId) return;
      try {
        await setSubtaskCompleted(projectId, taskId, subtaskId, !completed);
        await syncCounters(subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !completed } : s)));
      } catch (error) {
        showToast({
          message: handleFirestoreError(error, OperationType.UPDATE, 'tasks/subtasks'),
          type: 'error',
        });
      }
    },
    [projectId, taskId, subtasks, syncCounters, showToast]
  );

  const removeSubtask = useCallback(
    async (subtaskId: string) => {
      if (!projectId || !taskId) return;
      try {
        await deleteSubtaskRecord(projectId, taskId, subtaskId);
        await syncCounters(subtasks.filter((subtask) => subtask.id !== subtaskId));
      } catch (error) {
        showToast({
          message: handleFirestoreError(error, OperationType.DELETE, 'tasks/subtasks'),
          type: 'error',
        });
      }
    },
    [projectId, taskId, subtasks, syncCounters, showToast]
  );

  const completed = subtasks.filter((subtask) => subtask.completed).length;
  const total = subtasks.length;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { subtasks, loading, addSubtask, toggleSubtask, removeSubtask, total, completed, progress };
}
