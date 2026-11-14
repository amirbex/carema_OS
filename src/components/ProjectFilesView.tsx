import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { FileText, Upload, Trash2, Bot, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

interface ProjectFile {
  id: string;
  name: string;
  content: string;
  createdAt: any;
}

interface ProjectFilesViewProps {
  projectId: string;
}

export default function ProjectFilesView({ projectId }: ProjectFilesViewProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const filesRef = collection(db, 'projects', projectId, 'files');
    const unsubscribe = onSnapshot(query(filesRef), (snapshot) => {
      setFiles(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProjectFile)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'projects/files'));
    return () => unsubscribe();
  }, [projectId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        await addDoc(collection(db, 'projects', projectId, 'files'), {
          name: file.name,
          content: content,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'projects/files');
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    // clear input
    e.target.value = '';
  };

  const handleDelete = async (fileId: string) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'files', fileId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects/files');
    }
  };

  const extractTasks = async (file: ProjectFile) => {
    setIsProcessing(file.id);
    try {
      const response = await fetch('/api/ai/extract-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId,
          fileContent: file.content,
          fileName: file.name,
          userId: auth.currentUser?.uid
        })
      });
      const data = await response.json();
      
      let countTasks = 0;
      let countEvents = 0;

      if (data.tasks && Array.isArray(data.tasks)) {
         for (const t of data.tasks) {
           await addDoc(collection(db, 'projects', projectId, 'tasks'), {
             title: t.title,
             status: 'TODO',
             projectId: projectId,
             priority: t.priority || 'Medium',
             createdAt: serverTimestamp()
           });
           countTasks++;
         }
      }
      
      if (data.events && Array.isArray(data.events) && auth.currentUser?.uid) {
         for (const e of data.events) {
           await addDoc(collection(db, 'calendarEvents'), {
             title: e.title,
             startTime: e.startTime,
             endTime: e.endTime || e.startTime,
             location: e.location || '',
             userId: auth.currentUser.uid,
             createdAt: serverTimestamp()
           });
           countEvents++;
         }
      }

      alert(`Successfully extracted ${countTasks} tasks and ${countEvents} events!`);
    } catch (err) {
      console.error(err);
      alert("Failed to extract content.");
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto py-8 px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-100 mb-2">Project Files & Knowledge Base</h2>
          <p className="text-gray-400 text-sm">Upload meeting notes, specs, or logs. AI will use this content as context (RAG) and can extract tasks automatically.</p>
        </div>
        <div className="shrink-0 w-full sm:w-auto">
          <label className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-emerald-900/20 w-full sm:w-auto">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Text File
            <input type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-12">
        {files.map(file => (
          <div key={file.id} className="bg-gray-900/60 border border-gray-800 hover:border-gray-700 rounded-xl p-5 flex flex-col group transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-2.5 bg-gray-800 rounded-lg text-emerald-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-gray-200 truncate">{file.name}</h3>
              </div>
              <button onClick={() => handleDelete(file.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 mb-4">
              <p className="text-xs text-gray-500 line-clamp-3 bg-gray-950 p-3 rounded-lg font-mono">
                {file.content}
              </p>
            </div>
            <div className="mt-auto border-t border-gray-800/50 pt-4 flex justify-between items-center">
               <span className="text-xs text-gray-500">
                 {file.content.length} chars
               </span>
               <button 
                 onClick={() => extractTasks(file)}
                 disabled={isProcessing === file.id}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-emerald-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
               >
                 {isProcessing === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                 Extract Data
               </button>
            </div>
          </div>
        ))}

        {files.length === 0 && !isUploading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/20">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
               <Upload className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">No files uploaded yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto">Upload plain text or markdown files to extract action items and add context to your AI assistant.</p>
          </div>
        )}
      </div>
    </div>
  );
}
