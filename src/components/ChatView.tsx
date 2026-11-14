import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  Bot,
  Check,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Square,
  Trash2,
  User,
  X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getCurrentUser, IS_DEMO } from '../lib/firebase';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { AiRequestError, requestAiReply, type AiProposalAction } from '../lib/aiClient';
import { createEvent, createProject, createTask, fetchWorkspaceContext, updateTask } from '../lib/appData';
import { buildDemoReply } from '../lib/demoAssistant';
import { pcmToBase64, PcmPlayer } from '../lib/audioUtils';
import { createId } from '../lib/format';
import { logActivity } from '../lib/activityLogger';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  proposedActions?: AiProposalAction[];
  isConfirmation?: boolean;
  failed?: boolean;
  retryText?: string;
}

const MAX_HISTORY = 20;

export default function ChatView() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const welcome = useCallback(
    (): Message => ({ id: 'welcome', type: 'agent', content: t('chatWelcome') }),
    [t]
  );

  const [messages, setMessages] = useState<Message[]>([welcome()]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Voice session refs
  const wsRef = useRef<WebSocket | null>(null);
  const liveActiveRef = useRef(false);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputPlayerRef = useRef<PcmPlayer | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const userId = getCurrentUser()?.uid;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isProcessing]);

  const stopLiveSession = useCallback(
    (reason?: 'ended' | 'error') => {
      liveActiveRef.current = false;

      wsRef.current?.close();
      wsRef.current = null;

      processorRef.current?.disconnect();
      processorRef.current = null;
      sourceRef.current?.disconnect();
      sourceRef.current = null;

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;

      inputCtxRef.current?.close().catch(() => {});
      inputCtxRef.current = null;

      outputPlayerRef.current?.close();
      outputPlayerRef.current = null;

      if (!isMountedRef.current) return;
      setIsLiveActive(false);
      setIsLiveLoading(false);

      if (reason === 'ended') {
        setMessages((prev) => [...prev, { id: createId('sys'), type: 'system', content: t('liveEnded') }]);
      }
    },
    [t]
  );

  useEffect(() => {
    return () => {
      liveActiveRef.current = false;
      wsRef.current?.close();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      inputCtxRef.current?.close().catch(() => {});
      outputPlayerRef.current?.close();
    };
  }, []);

  const startLiveSession = async () => {
    if (!userId || isLiveActive || isLiveLoading) return;

    if (IS_DEMO) {
      // The live voice bridge runs on the Express server (WebSocket + Gemini
      // Live API), which does not exist in the static preview.
      showToast({ message: t('demoFeatureDisabled'), type: 'info' });
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showToast({ message: t('liveUnsupported'), type: 'error' });
      return;
    }

    setIsLiveLoading(true);
    try {
      const context = await fetchWorkspaceContext(userId, getCurrentUser()?.email);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      const player = new PcmPlayer(24_000);
      outputPlayerRef.current = player;
      await player.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx: AudioContext = new Ctor();
      inputCtxRef.current = inputCtx;
      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputCtx.destination);

      let ready = false;
      const sampleRate = Math.round(inputCtx.sampleRate) || 16_000;

      processor.onaudioprocess = (event) => {
        if (!ready || ws.readyState !== WebSocket.OPEN) return;
        const channel = event.inputBuffer.getChannelData(0);
        ws.send(JSON.stringify({ audio: pcmToBase64(channel), sampleRate }));
      };

      ws.onopen = () => ws.send(JSON.stringify({ type: 'setup', app_context: context }));

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        let message: any;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.error) {
          showToast({ message, type: 'error' });
          stopLiveSession();
          return;
        }
        if (message.ready) {
          ready = true;
          liveActiveRef.current = true;
          setIsLiveActive(true);
          setIsLiveLoading(false);
          setMessages((prev) => [...prev, { id: createId('sys'), type: 'system', content: t('liveStarted') }]);
        }
        if (message.audio) {
          void player.play(message.audio);
        }
        if (message.toolCall && message.toolCall.args) {
          const args = message.toolCall.args;
          const action: AiProposalAction = {
            function: message.toolCall.name ?? 'propose_action',
            parameters: args,
            description: `${t('voiceAction')}: ${String(args.action_type ?? '').replace(/_/g, ' ')}`,
          };
          setMessages((prev) => [
            ...prev,
            {
              id: createId('agent'),
              type: 'agent',
              content: t('voiceActionIntro'),
              proposedActions: [action],
              isConfirmation: true,
            },
          ]);
        }
        if (message.closed) {
          stopLiveSession('ended');
        }
      };

      ws.onclose = () => {
        if (liveActiveRef.current) stopLiveSession('ended');
        else if (isMountedRef.current) setIsLiveLoading(false);
      };

      ws.onerror = () => {
        showToast({ message: t('aiUnavailable'), type: 'error' });
        stopLiveSession();
      };
    } catch (error) {
      const denied = (error as any)?.name === 'NotAllowedError' || (error as any)?.name === 'SecurityError';
      showToast({ message: denied ? t('micDenied') : t('liveUnsupported'), type: 'error' });
      stopLiveSession();
    }
  };

  const toggleLiveSession = () => {
    if (liveActiveRef.current) stopLiveSession('ended');
    else void startLiveSession();
  };

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || !userId || isProcessing) return;

    const userMessage: Message = { id: createId('user'), type: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const context = await fetchWorkspaceContext(userId, getCurrentUser()?.email);
      const history = [...messages, userMessage]
        .filter((message) => message.type !== 'system')
        .slice(-MAX_HISTORY)
        .map((message) => ({ role: message.type === 'user' ? ('user' as const) : ('agent' as const), content: message.content }));

      const reply = IS_DEMO
        ? buildDemoReply(content, context, lang)
        : await requestAiReply({
            uid: userId,
            input: content,
            history,
            context,
            signal: controller.signal,
          });

      if (!isMountedRef.current) return;

      setMessages((prev) => [
        ...prev,
        {
          id: reply.message_id || createId('agent'),
          type: 'agent',
          content: reply.display_text,
          proposedActions: reply.proposed_actions,
          isConfirmation: reply.status === 'PROPOSAL' && reply.proposed_actions.length > 0,
        },
      ]);
      logActivity(
        lang === 'fa' ? 'پیام به دستیار هوش مصنوعی' : 'Message to the AI assistant',
        content.slice(0, 120),
        'info'
      );
    } catch (error) {
      if (!isMountedRef.current) return;
      const message =
        error instanceof AiRequestError ? error.message : t('aiUnavailable');
      setMessages((prev) => [
        ...prev,
        { id: createId('err'), type: 'system', content: message, failed: true, retryText: content },
      ]);
      showToast({ message, type: 'error' });
    } finally {
      abortRef.current = null;
      if (isMountedRef.current) setIsProcessing(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const resolveParams = (action: AiProposalAction): { fn: string; params: Record<string, any> } => {
    let fn = action.function ?? '';
    let params: Record<string, any> = action.parameters ?? {};

    if (fn === 'propose_action') {
      fn = String(params.action_type ?? '').toLowerCase();
      if (typeof params.payload === 'string') {
        try {
          params = JSON.parse(params.payload);
        } catch {
          params = {};
        }
      }
    }
    return { fn, params };
  };

  const executeProposal = async (action: AiProposalAction, messageId: string) => {
    if (!userId) return;
    const { fn, params } = resolveParams(action);

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, isConfirmation: false, content: `${message.content} — ${t('approved')}` }
          : message
      )
    );

    try {
      if (fn === 'create_project') {
        const projectId = await createProject({
          name: params.name || 'New Project',
          uid: userId,
          email: getCurrentUser()?.email,
          category: params.category || 'General',
        });
        if (Array.isArray(params.tasks)) {
          for (const task of params.tasks) {
            if (!task?.title) continue;
            await createTask({ projectId, title: task.title, priority: task.priority ?? null });
          }
        }
      } else if (fn === 'create_task') {
        const projectId = params.project_id || params.projectId;
        if (!projectId) {
          showToast({ message: t('noProjectForTask'), type: 'error' });
          return;
        }
        await createTask({
          projectId,
          title: params.title || 'New task',
          priority: params.priority ?? null,
          dueDate: params.dueDate ?? null,
          description: params.description ?? undefined,
        });
      } else if (fn === 'update_task_status') {
        const projectId = params.project_id || params.projectId;
        if (projectId && params.task_id) {
          await updateTask(projectId, params.task_id, { status: params.status ?? 'DONE' });
        }
      } else if (fn === 'create_event' || fn === 'schedule_meeting') {
        if (!params.title || !params.startTime) {
          showToast({ message: t('executionFailed'), type: 'error' });
          return;
        }
        await createEvent({
          uid: userId,
          title: params.title,
          startTime: params.startTime,
          endTime: params.endTime,
          location: params.location,
          meetingLink: params.meetingLink,
          agenda: params.agenda,
        });
      } else {
        showToast({ message: t('executionFailed'), type: 'error' });
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: createId('sys'), type: 'system', content: `${t('executed')}: ${action.description ?? fn}` },
      ]);
      showToast({ message: t('executed'), type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('executionFailed');
      setMessages((prev) => [...prev, { id: createId('sys'), type: 'system', content: `${t('executionFailed')}: ${message}` }]);
      showToast({ message: t('executionFailed'), type: 'error' });
    }
  };

  const declineProposal = (messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, isConfirmation: false, content: `${message.content} — ${t('declined')}` }
          : message
      )
    );
  };

  const clearConversation = () => {
    setMessages([welcome()]);
    showToast({ message: t('chatCleared'), type: 'info' });
  };

  const headerBadge = useMemo(
    () => (
      <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
        {t('assistantBadge')}
      </span>
    ),
    [t]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-950 overflow-hidden">
      <header className="h-16 flex items-center px-4 sm:px-6 border-b border-gray-800 shrink-0 bg-gray-900/50 justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-gray-100 truncate">{t('chat')}</h1>
          {headerBadge}
          {isLiveActive && (
            <span className="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" aria-hidden="true" /> {t('liveSession')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearConversation}
            aria-label={t('clearChat')}
            title={t('clearChat')}
            className="p-2 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/projects')}
            aria-label={t('close')}
            title={t('close')}
            className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto w-full space-y-5" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 sm:gap-4 ${message.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${
                  message.type === 'user'
                    ? 'bg-blue-600'
                    : message.type === 'system'
                      ? message.failed
                        ? 'bg-rose-900/70'
                        : 'bg-gray-800'
                      : 'bg-emerald-600'
                }`}
                aria-hidden="true"
              >
                {message.type === 'user' ? (
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                ) : message.type === 'system' ? (
                  message.failed ? (
                    <AlertCircle className="w-4 h-4 text-rose-300" />
                  ) : (
                    <Check className="w-4 h-4 text-gray-400" />
                  )
                ) : (
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                )}
              </div>

              <div className={`flex flex-col gap-2 max-w-[85%] ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 sm:px-5 py-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white rounded-te-sm'
                      : message.type === 'system'
                        ? 'bg-gray-900 border border-gray-800 text-gray-400 text-sm rounded-ts-sm'
                        : 'bg-gray-800 text-gray-100 rounded-ts-sm'
                  }`}
                >
                  <div className="prose prose-invert prose-sm prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700 max-w-none break-words">
                    <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
                  </div>

                  {message.failed && message.retryText && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessages((prev) => prev.filter((item) => item.id !== message.id));
                        void sendMessage(message.retryText!);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> {t('retryMessage')}
                    </button>
                  )}
                </div>

                {message.isConfirmation && message.proposedActions && message.proposedActions.length > 0 && (
                  <div className="bg-gray-900 border border-emerald-500/30 rounded-xl w-full mt-1 shadow-xl ring-1 ring-emerald-500/10 overflow-hidden">
                    <div className="bg-emerald-500/10 px-4 py-3 border-b border-emerald-500/20 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <h4 className="text-sm font-semibold text-emerald-400">{t('proposalTitle')}</h4>
                    </div>
                    <div className="p-4 space-y-4">
                      {message.proposedActions.map((action, index) => (
                        <div key={`${message.id}-${index}`} className="flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-200">{action.description || action.function}</p>
                            <details className="mt-2 group">
                              <summary className="text-[11px] text-gray-500 cursor-pointer select-none">
                                {action.function}
                              </summary>
                              <pre className="mt-1.5 bg-gray-950 rounded-lg p-3 border border-gray-800 text-[11px] text-gray-400 overflow-x-auto">
                                <code>{JSON.stringify(action.parameters, null, 2)}</code>
                              </pre>
                            </details>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => declineProposal(message.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-gray-700 hover:border-red-500/30"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" /> {t('decline')}
                            </button>
                            <button
                              type="button"
                              onClick={() => void executeProposal(action, message.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" /> {t('approve')}
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
            <div className="flex gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" aria-hidden="true" />
              </div>
              <div className="px-4 py-4 rounded-2xl bg-gray-800 flex items-center gap-2" aria-label={t('thinking')}>
                <span className="sr-only">{t('thinking')}</span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <div className="p-3 sm:p-4 bg-gray-900 border-t border-gray-800">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
          className="max-w-3xl mx-auto relative flex items-end gap-2"
        >
          <button
            type="button"
            onClick={toggleLiveSession}
            disabled={isLiveLoading || !userId}
            aria-label={isLiveActive ? t('stopLive') : t('startLive')}
            title={isLiveActive ? t('stopLive') : t('startLive')}
            className={`p-3 rounded-xl transition-colors shrink-0 ${
              isLiveActive ? 'text-white bg-red-500 hover:bg-red-600' : 'text-gray-400 hover:text-emerald-400 bg-gray-950 border border-gray-800'
            }`}
          >
            {isLiveLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : isLiveActive ? (
              <MicOff className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Mic className="w-5 h-5" aria-hidden="true" />
            )}
          </button>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLiveActive ? t('liveSession') : t('chatPlaceholder')}
            aria-label={t('chatPlaceholder')}
            className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none min-h-[48px] max-h-32"
            rows={Math.min(4, input.split('\n').length || 1)}
            disabled={isProcessing || isLiveActive}
          />

          {isProcessing ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label={t('cancel')}
              className="p-3 bg-gray-800 text-gray-300 rounded-xl hover:bg-gray-700 transition-colors shrink-0"
            >
              <Square className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLiveActive}
              aria-label={t('send')}
              className="p-3 bg-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
