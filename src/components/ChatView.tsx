import React, { useState, useRef, useEffect } from 'react';
import { addDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router';
import { db, auth } from '../lib/firebase';
import { Send, Bot, User, Check, X, Mic, ArrowLeft, MicOff, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { pcmToBase64, playAudioChunk } from '../lib/audioUtils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useI18n } from '../context/I18nContext';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  proposedActions?: any[];
  isConfirmation?: boolean;
}

export default function ChatView() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'agent',
      content: lang === 'fa' 
        ? 'سلام! من CaReMa OS، دستیار هوشمند اجرایی شما هستم. چه کمکی از دست من ساخته است؟' 
        : 'Hello! I am CaReMa OS, your executive assistant. How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  
  // Audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const userId = auth.currentUser?.uid;
  const navigate = useNavigate();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const startLiveSession = async () => {
    if (isLiveActive || isLiveLoading || !userId) return;
    setIsLiveLoading(true);

    try {
      // Gather user context for the Live API
      const eventsSnap = await getDocs(query(collection(db, 'calendarEvents'), where('userId', '==', userId)));
      const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const projectsSnap = await getDocs(query(collection(db, 'projects'), where('members', 'array-contains', auth.currentUser?.email || 'no-email')));
      const projects = await Promise.all(projectsSnap.docs.map(async d => {
        const p = { id: d.id, ...d.data() };
        const tasksSnap = await getDocs(collection(db, 'projects', d.id, 'tasks'));
        
        let files = [];
        try {
           const filesSnap = await getDocs(collection(db, 'projects', d.id, 'files'));
           files = filesSnap.docs.map(f => {
             const fileData = f.data();
             return { id: f.id, name: fileData.name, content: fileData.content?.substring(0, 5000) };
           });
        } catch(e) {}
        
        return { ...p, tasks: tasksSnap.docs.map(t => ({ id: t.id, ...t.data() })), files };
      }));
      
      const app_context = {
        calendarEvents: events,
        projects: projects
      };

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      let isSessionReady = false;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputAudioCtx;
      outputAudioCtxRef.current = outputAudioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(inputAudioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN && isSessionReady) {
           const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
           ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'setup', app_context }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
           isSessionReady = true;
           setIsLiveActive(true);
           setIsLiveLoading(false);
           setMessages(prev => [...prev, {
             id: Date.now().toString(),
             type: 'system',
             content: 'Live audio session started. Start speaking.'
           }]);
        }
        if (msg.audio) {
           playAudioChunk(outputAudioCtx, msg.audio);
        }
        if (msg.toolCall) {
           // Live API sent a tool call
           const action = {
             function: msg.toolCall.name,
             parameters: msg.toolCall.args,
             description: `Voice Action: ${msg.toolCall.args.action_type?.replace('_', ' ')}`
           };
           setMessages(prev => [...prev, {
             id: Date.now().toString(),
             type: 'agent',
             content: 'Here is what I prepared based on what you said.',
             proposedActions: [action],
             isConfirmation: true
           }]);
        }
        if (msg.interrupted) {
           // Interrupted state
        }
      };

      ws.onclose = () => {
        stopLiveSession();
      };

      ws.onerror = () => {
        stopLiveSession();
        setIsLiveLoading(false);
      };

    } catch (err) {
      console.error('Failed to start live session', err);
      setIsLiveLoading(false);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    
    if (isLiveActive) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: 'Live audio session ended.'
      }]);
    }
    setIsLiveActive(false);
    setIsLiveLoading(false);
  };

  const toggleLiveSession = () => {
    if (isLiveActive) {
      stopLiveSession();
    } else {
      startLiveSession();
    }
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    if (!input.trim() || !userId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      // Gather user context to pass to the AI
      const eventsSnap = await getDocs(query(collection(db, 'calendarEvents'), where('userId', '==', userId)));
      const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const projectsSnap = await getDocs(query(collection(db, 'projects'), where('members', 'array-contains', auth.currentUser?.email || 'no-email')));
      const projects = await Promise.all(projectsSnap.docs.map(async d => {
        const p = { id: d.id, ...d.data() };
        const tasksSnap = await getDocs(collection(db, 'projects', d.id, 'tasks'));
        
        let files = [];
        try {
           const filesSnap = await getDocs(collection(db, 'projects', d.id, 'files'));
           files = filesSnap.docs.map(f => {
             const fileData = f.data();
             return { id: f.id, name: fileData.name, content: fileData.content?.substring(0, 5000) };
           });
        } catch(e) {}
        
        return { ...p, tasks: tasksSnap.docs.map(t => ({ id: t.id, ...t.data() })), files };
      }));
      
      const app_context = {
        calendarEvents: events,
        projects: projects
      };

      // Send to our backend AI router
      const response = await fetch('/api/ai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          input_type: 'text',
          input_content: userMsg.content,
          conversation_history: messages,
          app_context: app_context
        })
      });

      const data = await response.json();
      
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: 'agent',
        content: data.display_text || 'No response',
        proposedActions: data.proposed_actions,
        isConfirmation: data.status === 'PROPOSAL'
      };

      setMessages(prev => [...prev, agentMsg]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: 'Failed to process request.'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const executeProposal = async (action: any, msgId: string) => {
    if (!userId) return;
    
    // Simulate updating the message to accepted
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isConfirmation: false, content: m.content + " (Approved)" } : m));
    
    try {
      // Direct execution based on AI proposed action
      let funcName = action.function;
      let params = action.parameters;

      // Unpack Live API tool call if present
      if (funcName === 'propose_action') {
        funcName = params.action_type.toLowerCase(); // 'create_project', 'create_task', 'schedule_meeting'
        try {
           params = JSON.parse(params.payload);
        } catch(e) {}
      }

      if (funcName === 'create_project') {
        const docRef = await addDoc(collection(db, 'projects'), {
          name: params.name || 'New Project',
          category: params.category || 'General',
          status: 'ACTIVE',
          ownerId: userId,
          members: [auth.currentUser?.email],
          createdAt: serverTimestamp()
        });

        if (params.tasks && Array.isArray(params.tasks)) {
           for (const task of params.tasks) {
              await addDoc(collection(db, 'projects', docRef.id, 'tasks'), {
                title: task.title,
                status: 'TODO',
                projectId: docRef.id,
                createdAt: serverTimestamp()
              });
           }
        }
      } else if (funcName === 'create_task') {
        const projectId = params.project_id || params.projectId;
        if(projectId) {
           await addDoc(collection(db, 'projects', projectId, 'tasks'), {
            title: params.title,
            status: 'TODO',
            projectId: projectId,
            createdAt: serverTimestamp()
          });
        }
      } else if (funcName === 'create_event' || funcName === 'schedule_meeting') {
        await addDoc(collection(db, 'calendarEvents'), {
          title: params.title,
          startTime: params.startTime,
          endTime: params.endTime,
          location: params.location || '',
          userId: userId,
          createdAt: serverTimestamp()
        });
      }
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `Executed: ${action.description}`
      }]);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'firebase');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `Failed to execute: ${action.description}`
      }]);
    }
  };

  const declineProposal = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isConfirmation: false, content: m.content + " (Declined)" } : m));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950">
      <header className="h-16 flex items-center px-6 border-b border-gray-800 shrink-0 bg-gray-900/50 justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard/projects')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors md:hidden"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            {t('chat')}
          </h1>
          <span className="hidden sm:inline-block ml-4 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
            Gemini Flash
          </span>
          {isLiveActive && (
            <span className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> Live Session
            </span>
          )}
        </div>
        <button 
          onClick={() => navigate('/dashboard/projects')}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          title="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-4 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.type === 'user' ? 'bg-blue-600' : 
                msg.type === 'system' ? 'bg-gray-800' : 'bg-emerald-600'
              }`}>
                {msg.type === 'user' ? <User className="w-5 h-5 text-white" /> : 
                 msg.type === 'system' ? <span className="text-white text-xs font-bold">SYS</span> :
                 <Bot className="w-5 h-5 text-white" />}
              </div>
              
              <div className={`flex flex-col gap-2 max-w-[80%] ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-3.5 rounded-2xl ${
                  msg.type === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : msg.type === 'system'
                    ? 'bg-gray-900 border border-gray-800 text-gray-400 text-sm italic rounded-tl-sm'
                    : 'bg-gray-800 text-gray-100 rounded-tl-sm'
                }`}>
                  <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 max-w-none text-[15px]">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                  </div>
                </div>
                
                {msg.isConfirmation && msg.proposedActions && msg.proposedActions.length > 0 && (
                  <div className="bg-gray-900 border border-emerald-500/30 rounded-xl w-full mt-3 shadow-xl ring-1 ring-emerald-500/10 overflow-hidden">
                    <div className="bg-emerald-500/10 px-5 py-3 border-b border-emerald-500/20 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        AI Action Proposal
                      </h4>
                    </div>
                    <div className="p-5 space-y-4">
                      {msg.proposedActions.map((action, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-200">{action.description}</p>
                            <div className="mt-2 bg-gray-950 rounded-lg p-3 border border-gray-800 text-xs text-gray-400 overflow-x-auto">
                              <pre><code>{JSON.stringify(action.parameters, null, 2)}</code></pre>
                            </div>
                          </div>
                          <div className="flex gap-3 shrink-0 self-end sm:self-auto">
                            <button 
                              onClick={() => declineProposal(msg.id)}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-gray-700 hover:border-red-500/30"
                            >
                              <X className="w-4 h-4" /> Decline
                            </button>
                            <button 
                              onClick={() => executeProposal(action, msg.id)}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg shadow-emerald-900/20"
                            >
                              <Check className="w-4 h-4" /> Approve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isProcessing && (
            <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-white" />
               </div>
               <div className="px-4 py-4 rounded-2xl bg-gray-800 rounded-tl-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
               </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-end">
          <button 
            type="button" 
            onClick={toggleLiveSession}
            disabled={isLiveLoading}
            className={`absolute left-3 bottom-3 p-2 rounded-lg transition-colors ${
              isLiveActive ? 'text-white bg-red-500 hover:bg-red-600' : 'text-gray-500 hover:text-emerald-400'
            }`}
            title={isLiveActive ? "Stop Live Session" : "Start Live Audio Session"}
          >
            {isLiveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLiveActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />)}
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLiveActive ? "Speaking live..." : "Ask CaReMa OS to create a project, schedule an event (Shift+Enter for newline)..."}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-14 pr-14 py-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none min-h-[56px] max-h-32"
            rows={Math.min(4, input.split('\n').length || 1)}
            disabled={isProcessing || isLiveActive}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing || isLiveActive}
            className="absolute right-3 bottom-3 p-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
