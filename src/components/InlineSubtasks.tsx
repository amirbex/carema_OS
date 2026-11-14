import React, { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { useSubtasks } from '../hooks/useSubtasks';
import { useI18n } from '../context/I18nContext';

interface InlineSubtasksProps {
  task: { id: string; title?: string };
  projectId: string;
}

/** Compact checklist rendered under a task row in the table view. */
export default function InlineSubtasks({ task, projectId }: InlineSubtasksProps) {
  const { t } = useI18n();
  const { subtasks, addSubtask, toggleSubtask, removeSubtask, progress, loading } = useSubtasks(projectId, task.id);
  const [newSubtask, setNewSubtask] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSubtask.trim() || isSaving) return;
    setIsSaving(true);
    const ok = await addSubtask(newSubtask);
    setIsSaving(false);
    if (ok) setNewSubtask('');
  };

  return (
    <div className="bg-gray-950/50 border-t border-gray-800/50 p-4 ps-14">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="flex-1 max-w-sm h-1.5 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('progress')}
        >
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-400 tabular-nums">
          {loading ? t('loading') : `${progress}% ${t('completed')}`}
        </span>
      </div>

      <ul className="space-y-2 mb-3">
        {subtasks.length === 0 && !loading && <li className="text-xs text-gray-600">{t('noSubtasks')}</li>}
        {subtasks.map((sub) => (
          <li key={sub.id} className="flex items-start gap-3 p-1.5 hover:bg-gray-800/30 rounded-lg group transition-colors">
            <button
              type="button"
              onClick={() => toggleSubtask(sub.id, Boolean(sub.completed))}
              aria-pressed={Boolean(sub.completed)}
              aria-label={sub.title}
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                sub.completed ? 'bg-emerald-500 border-emerald-500 text-gray-950' : 'border-gray-600 hover:border-emerald-500'
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

      <form onSubmit={submit} className="flex items-center gap-2 max-w-sm">
        <input
          type="text"
          value={newSubtask}
          onChange={(event) => setNewSubtask(event.target.value)}
          placeholder={t('addSubtaskPlaceholder')}
          aria-label={t('addSubtaskPlaceholder')}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!newSubtask.trim() || isSaving}
          aria-label={t('add')}
          className="p-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
