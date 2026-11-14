import type { WorkspaceContext } from './appData';

export interface AiProposalAction {
  function: string;
  parameters: Record<string, any>;
  description?: string;
}

export interface AiReply {
  status: 'MESSAGE' | 'PROPOSAL';
  message_id: string;
  display_text: string;
  proposed_actions: AiProposalAction[];
}

export interface ChatTurn {
  role: 'user' | 'agent';
  content: string;
}

export class AiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 45_000;

async function postJson<T>(url: string, body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new AiRequestError(
        (payload && typeof payload.error === 'string' && payload.error) || 'The assistant is unavailable right now.',
        response.status
      );
    }
    if (!payload || typeof payload !== 'object') {
      throw new AiRequestError('The assistant returned an unreadable answer. Please try again.', 502);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof AiRequestError) throw error;
    if ((error as any)?.name === 'AbortError') {
      throw new AiRequestError('The request took too long and was cancelled.', 408);
    }
    throw new AiRequestError('Could not reach the assistant. Check your connection and try again.', 0);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Ask the AI agent for a reply/proposal, sending the real conversation history. */
export async function requestAiReply(args: {
  uid: string;
  input: string;
  history: ChatTurn[];
  context: WorkspaceContext;
  signal?: AbortSignal;
}): Promise<AiReply> {
  const reply = await postJson<Partial<AiReply>>(
    '/api/ai/process',
    {
      user_id: args.uid,
      input_type: 'text',
      input_content: args.input,
      conversation_history: args.history,
      app_context: args.context,
    },
    DEFAULT_TIMEOUT_MS,
    args.signal
  );

  return {
    status: reply.status === 'PROPOSAL' ? 'PROPOSAL' : 'MESSAGE',
    message_id: reply.message_id || `msg_${Date.now()}`,
    display_text: reply.display_text || 'No answer was produced.',
    proposed_actions: Array.isArray(reply.proposed_actions) ? (reply.proposed_actions as AiProposalAction[]) : [],
  };
}

export interface ExtractedData {
  tasks: Array<{ title: string; priority: 'Low' | 'Medium' | 'High' | 'Critical' }>;
  events: Array<{ title: string; startTime: string; endTime: string; location?: string }>;
}

export async function extractTasksFromFile(fileContent: string, signal?: AbortSignal): Promise<ExtractedData> {
  const data = await postJson<Partial<ExtractedData>>('/api/ai/extract-tasks', { fileContent }, 90_000, signal);

  const tasks = (Array.isArray(data.tasks) ? data.tasks : [])
    .filter((t) => t && typeof t.title === 'string' && t.title.trim())
    .map((t) => ({
      title: t.title.trim(),
      priority: (['Low', 'Medium', 'High', 'Critical'] as const).includes(t.priority as any)
        ? (t.priority as ExtractedData['tasks'][number]['priority'])
        : ('Medium' as const),
    }));

  const events = (Array.isArray(data.events) ? data.events : [])
    .filter((e) => e && typeof e.title === 'string' && typeof e.startTime === 'string')
    .map((e) => ({
      title: e.title.trim(),
      startTime: e.startTime,
      endTime: e.endTime || e.startTime,
      location: e.location ?? '',
    }));

  return { tasks, events };
}
