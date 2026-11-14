import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Bot, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { handleFirestoreError, OperationType, describeError } from '../lib/errorHandlers';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { extractTasksFromFile } from '../lib/aiClient';
import { createEvent, createTask, type Priority } from '../lib/appData';
import { toDate } from '../lib/format';

interface ProjectFile {
  id: string;
  name: string;
  content: string;
  createdAt?: unknown;
}

interface ProjectFilesViewProps {
  projectId: string;
}

const MAX_FILE_BYTES = 500 * 1024; // Firestore documents cap at ~1 MB; keep headroom.
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|log|json)$/i;

export default function ProjectFilesView({ projectId }: ProjectFilesViewProps) {
  const { t, lang, locale } = useI18n();
  const { showToast } = useToast();
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadError(null);
    const unsubscribe = onSnapshot(
      collection(db, 'projects', projectId, 'files'),
      (snapshot) => {
        const next = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as ProjectFile[];
        next.sort((a, b) => (toDate(b.createdAt)?.getTime() ?? 0) - (toDate(a.createdAt)?.getTime() ?? 0));
        setFiles(next);
      },
      (error) => setLoadError(handleFirestoreError(error, OperationType.GET, 'projects/files'))
    );
    return () => unsubscribe();
  }, [projectId]);

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      showToast({ message: t('fileTooLarge'), type: 'error' });
      resetInput();
      return;
    }
    if (!TEXT_EXTENSIONS.test(file.name) && !file.type.startsWith('text/')) {
      showToast({ message: lang === 'fa' ? 'فقط فایل متنی مجاز است.' : 'Only text files are supported.', type: 'error' });
      resetInput();
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onerror = () => {
      showToast({ message: describeError(reader.error), type: 'error' });
      setIsUploading(false);
      resetInput();
    };
    reader.onload = async (loadEvent) => {
      try {
        await addDoc(collection(db, 'projects', projectId, 'files'), {
          name: file.name,
          content: String(loadEvent.target?.result ?? ''),
          size: file.size,
          uploadedBy: auth.currentUser?.email ?? '',
          createdAt: serverTimestamp(),
        });
        showToast({ message: t('fileUploaded'), type: 'success' });
      } catch (error) {
        showToast({ message: handleFirestoreError(error, OperationType.CREATE, 'projects/files'), type: 'error' });
      } finally {
        setIsUploading(false);
        resetInput();
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = async (file: ProjectFile) => {
    if (!window.confirm(t('deleteFileConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'files', file.id));
      showToast({ message: t('fileDeleted'), type: 'info' });
    } catch (error) {
      showToast({ message: handleFirestoreError(error, OperationType.DELETE, 'projects/files'), type: 'error' });
    }
  };

  const extractTasks = async (file: ProjectFile) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setProcessingId(file.id);
    try {
      const { tasks, events } = await extractTasksFromFile(file.content);

      for (const task of tasks) {
        await createTask({ projectId, title: task.title, priority: task.priority as Priority });
      }
      for (const event of events) {
        await createEvent({
          uid,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          projectId,
        });
      }

      showToast({
        message: t('extractedSummary', { tasks: tasks.length, events: events.length }),
        type: 'success',
      });
    } catch (error) {
      showToast({ message: describeError(error), type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto py-6 px-2 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-100 mb-2">{t('projectFiles')}</h2>
          <p className="text-gray-400 text-sm max-w-2xl">{t('projectFilesBody')}</p>
        </div>
        <div className="shrink-0 w-full sm:w-auto">
          <label
            className={`flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-emerald-900/20 w-full sm:w-auto ${
              isUploading ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
            {t('uploadFile')}
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.markdown,.csv,.log,.json,text/plain"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{loadError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-12">
        {files.map((file) => (
          <div
            key={file.id}
            className="bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl p-5 flex flex-col group transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 bg-gray-800 rounded-lg text-emerald-400 shrink-0">
                  <FileText className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-medium text-gray-200 truncate" title={file.name}>
                  {file.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(file)}
                aria-label={t('deleteFile')}
                className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 mb-4">
              <p className="text-xs text-gray-500 line-clamp-3 bg-gray-950 p-3 rounded-lg font-mono break-words">
                {file.content || '—'}
              </p>
            </div>

            <div className="mt-auto border-t border-gray-800/50 pt-4 flex justify-between items-center gap-2">
              <span className="text-xs text-gray-500 tabular-nums">
                {(file.content?.length ?? 0).toLocaleString(locale)} {t('chars')}
              </span>
              <button
                type="button"
                onClick={() => extractTasks(file)}
                disabled={processingId === file.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {processingId === file.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                {processingId === file.id ? t('extracting') : t('extractData')}
              </button>
            </div>
          </div>
        ))}

        {files.length === 0 && !isUploading && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-gray-500" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">{t('noFiles')}</h3>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">{t('noFilesBody')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
