import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3000);
const IS_PROD = process.env.NODE_ENV === 'production';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.0-flash-live-001';

// Hard limits: protect the server (and the Gemini bill) from oversized payloads.
const LIMITS = {
  json: '2mb',
  userInput: 8_000,
  historyMessages: 20,
  historyMessage: 4_000,
  fileContent: 60_000,
  contextJson: 120_000,
  wsPayload: 2 * 1024 * 1024,
};

const AI_CONFIGURED = Boolean(process.env.GEMINI_API_KEY);

let ai: GoogleGenAI | null = null;
if (AI_CONFIGURED) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.warn(
    '[CaReMa OS] GEMINI_API_KEY is not set. AI endpoints will answer with a clear 503 error; the rest of the app keeps working.'
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function str(value: unknown, max = 1_000): string {
  if (typeof value !== 'string') return '';
  return value.length > max ? value.slice(0, max) : value;
}

/** Strip markdown fences / stray prose around a JSON payload, then parse it. */
function parseJsonLoose(raw: string): any {
  const text = (raw ?? '').trim();
  const candidates: string[] = [];
  if (text) candidates.push(text);

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error('Model returned a non-JSON payload.');
}

/** Serialize the workspace context while keeping the prompt inside budget. */
function serializeContext(context: unknown): string {
  let json = '';
  try {
    json = JSON.stringify(context ?? {}, null, 2);
  } catch {
    json = '{}';
  }
  if (json.length <= LIMITS.contextJson) return json;

  // Over budget: retry without file bodies (usually the bulk of the payload).
  try {
    const clone = JSON.parse(json);
    if (Array.isArray(clone?.projects)) {
      clone.projects = clone.projects.map((p: any) => ({
        ...p,
        files: Array.isArray(p?.files)
          ? p.files.map((f: any) => ({ id: f?.id, name: f?.name, content: '' }))
          : [],
      }));
    }
    const trimmed = JSON.stringify(clone, null, 2);
    return trimmed.length <= LIMITS.contextJson
      ? trimmed
      : `${trimmed.slice(0, LIMITS.contextJson)}\n... (context truncated)`;
  } catch {
    return `${json.slice(0, LIMITS.contextJson)}\n... (context truncated)`;
  }
}

function normalizeHistory(history: unknown) {
  if (!Array.isArray(history)) return [];

  const turns = history
    .filter((m: any) => m && typeof m.content === 'string' && m.content.trim())
    .filter((m: any) => m.type === 'user' || m.type === 'agent')
    .slice(-LIMITS.historyMessages)
    .map((m: any) => ({
      role: m.type === 'user' ? ('user' as const) : ('model' as const),
      text: str(m.content, LIMITS.historyMessage),
    }));

  // Gemini expects an alternating user/model conversation that starts with a
  // user turn. Merge consecutive same-role entries and drop leading model
  // greetings so the request is always valid.
  const merged: Array<{ role: 'user' | 'model'; text: string }> = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.text = `${last.text}\n\n${turn.text}`;
    } else {
      merged.push({ ...turn });
    }
  }
  while (merged.length && merged[0].role === 'model') merged.shift();

  return merged.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
}

/** Very small in-memory sliding-window rate limiter (per IP). */
function createRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.status(429).json({ error: 'Too many requests. Please slow down and try again in a minute.' });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    // Opportunistic cleanup so the map cannot grow forever.
    if (hits.size > 5_000) {
      for (const [k, v] of hits) {
        if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    next();
  };
}

const aiRateLimit = createRateLimiter({ windowMs: 60_000, max: 30 });
const uploadRateLimit = createRateLimiter({ windowMs: 60_000, max: 10 });

const SYSTEM_RULES = `
You are CaReMa OS, a multimodal executive assistant that manages projects, tasks, calendar events and risks.
The user's workspace data is provided below as JSON. It can be empty.

Rules:
- Answer questions about the user's own data directly from the context (counts, deadlines, upcoming meetings...).
- When the user asks to create/modify something, DO NOT pretend it happened. Propose it as an action which the user must approve.
- Only use these action functions: create_project, create_task, create_event, update_task_status.
- Dates must be ISO-8601 strings (UTC, e.g. 2026-06-30T10:00:00Z). Task priorities are one of Low|Medium|High|Critical.
- When a relative date is used ("tomorrow"), resolve it using today's date: {{TODAY}}.
- ALWAYS reply with valid JSON only, no markdown fences, matching one of these shapes:
  {"status":"MESSAGE","message_id":"msg_...","display_text":"..."}
  {"status":"PROPOSAL","message_id":"msg_...","display_text":"...","proposed_actions":[{"function":"create_project","parameters":{...},"description":"..."}]}
- Write display_text in the same language the user wrote in (Persian or English).
`;

function buildSystemInstruction(context: unknown) {
  return `${SYSTEM_RULES.replace('{{TODAY}}', new Date().toISOString().slice(0, 10))}

Here is the user's current app data:
${serializeContext(context)}
`;
}

function normalizeAiResponse(parsed: any): { status: 'MESSAGE' | 'PROPOSAL'; message_id: string; display_text: string; proposed_actions: unknown[] } {
  const status = parsed?.status === 'PROPOSAL' ? 'PROPOSAL' : 'MESSAGE';
  const actions = Array.isArray(parsed?.proposed_actions) ? parsed.proposed_actions : [];
  return {
    status,
    message_id: typeof parsed?.message_id === 'string' ? parsed.message_id : `msg_${Date.now()}`,
    display_text:
      typeof parsed?.display_text === 'string' && parsed.display_text.trim()
        ? parsed.display_text
        : 'I could not produce a readable answer. Please rephrase your request.',
    proposed_actions: status === 'PROPOSAL' ? actions : [],
  };
}

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

function normalizePriority(value: unknown): (typeof PRIORITIES)[number] {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw.startsWith('crit') || raw === 'urgent' || raw === 'بحرانی') return 'Critical';
  if (raw.startsWith('high') || raw === 'بالا') return 'High';
  if (raw.startsWith('low') || raw === 'پایین') return 'Low';
  return 'Medium';
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit: LIMITS.json }));

  // Tiny request log for API routes (no bodies, no secrets).
  app.use('/api', (req, _res, next) => {
    if (!IS_PROD) console.log(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: AI_CONFIGURED,
      model: GEMINI_MODEL,
      liveModel: GEMINI_LIVE_MODEL,
      uptime: Math.round(process.uptime()),
    });
  });

  app.post('/api/ai/process', aiRateLimit, async (req, res) => {
    if (!ai) {
      res.status(503).json({ error: 'AI is not configured on this server (missing GEMINI_API_KEY).' });
      return;
    }

    const inputContent = str(req.body?.input_content, LIMITS.userInput).trim();
    if (!inputContent) {
      res.status(400).json({ error: 'input_content is required.' });
      return;
    }

    try {
      const history = normalizeHistory(req.body?.conversation_history);
      const contents = [
        ...history,
        // Guard against duplicating the newest message when the client already
        // includes it in the history array.
        ...(history.at(-1)?.parts?.[0]?.text === inputContent ? [] : [{ role: 'user' as const, parts: [{ text: inputContent }] }]),
      ];

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction: buildSystemInstruction(req.body?.app_context),
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      });

      const parsed = parseJsonLoose(response.text ?? '{}');
      res.json(normalizeAiResponse(parsed));
    } catch (error: any) {
      console.error('[AI process]', error?.message ?? error);
      const quota = /quota|rate limit|429/i.test(String(error?.message));
      res.status(quota ? 429 : 502).json({
        error: quota
          ? 'The AI service is busy right now. Please try again shortly.'
          : 'The AI service could not answer that. Please try again.',
      });
    }
  });

  app.post('/api/ai/extract-tasks', uploadRateLimit, async (req, res) => {
    if (!ai) {
      res.status(503).json({ error: 'AI is not configured on this server (missing GEMINI_API_KEY).' });
      return;
    }

    const fileContent = str(req.body?.fileContent, LIMITS.fileContent).trim();
    if (!fileContent) {
      res.status(400).json({ error: 'fileContent is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: fileContent }] }],
        config: {
          systemInstruction: `Extract every action item, task, follow-up and scheduled meeting from the document.
Return JSON only: {"tasks":[{"title":string,"priority":"Low|Medium|High|Critical"}],"events":[{"title":string,"startTime":ISO8601,"endTime":ISO8601,"location":string}]}.
If nothing is found, return {"tasks":[],"events":[]}. Never invent meetings that are not in the document.`,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = parseJsonLoose(response.text ?? '{}');
      const tasks = (Array.isArray(parsed?.tasks) ? parsed.tasks : [])
        .filter((t: any) => t && typeof t.title === 'string' && t.title.trim())
        .slice(0, 100)
        .map((t: any) => ({ title: str(t.title, 500).trim(), priority: normalizePriority(t.priority) }));

      const events = (Array.isArray(parsed?.events) ? parsed.events : [])
        .map((e: any) => {
          const startTime = isoOrNull(e?.startTime);
          if (!e?.title || !startTime) return null;
          return {
            title: str(e.title, 500).trim(),
            startTime,
            endTime: isoOrNull(e?.endTime) ?? startTime,
            location: str(e?.location, 300),
          };
        })
        .filter(Boolean)
        .slice(0, 100);

      res.json({ tasks, events });
    } catch (error: any) {
      console.error('[AI extract]', error?.message ?? error);
      res.status(502).json({ error: 'Could not extract data from this file. Please try again.' });
    }
  });

  // Unknown API route: JSON 404 instead of the SPA shell.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // JSON body parser errors (payload too large / malformed JSON).
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (!err) return next();
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload too large.' });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'Malformed JSON body.' });
      return;
    }
    next(err);
  });

  // Frontend: Vite middleware in development, static build in production.
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    // SPA fallback that also works on Express 4 (no '*all' route pattern).
    // Missing build assets must 404 instead of returning the HTML shell.
    app.use((req, res) => {
      if (/^\/(assets|static)\//.test(req.path) || /\.[a-z0-9]{2,5}$/i.test(req.path)) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CaReMa OS] server listening on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
  });

  /* ------------------------------------------------------------------------ */
  /* Gemini Live (speech-to-speech) over WebSocket                            */
  /* ------------------------------------------------------------------------ */
  const wss = new WebSocketServer({ server: httpServer, path: '/live', maxPayload: LIMITS.wsPayload });

  const liveConnections = new Map<string, number>();
  const MAX_LIVE_PER_IP = 2;

  wss.on('connection', (clientWs: WebSocket, req) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const openForIp = liveConnections.get(ip) ?? 0;
    if (openForIp >= MAX_LIVE_PER_IP) {
      clientWs.close(1013, 'Too many concurrent voice sessions');
      return;
    }
    liveConnections.set(ip, openForIp + 1);

    let session: any = null;
    let closed = false;
    const heartbeat = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) clientWs.ping();
    }, 30_000);

    const send = (payload: unknown) => {
      if (!closed && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('pong', () => {
      /* liveness confirmed */
    });

    clientWs.on('message', async (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        send({ error: 'Malformed message.' });
        return;
      }

      try {
        if (msg.type === 'setup') {
          if (session) return;
          if (!ai) {
            send({ error: 'Voice assistant is not configured on this server (missing GEMINI_API_KEY).' });
            clientWs.close();
            return;
          }

          session = await ai.live.connect({
            model: GEMINI_LIVE_MODEL,
            config: {
              responseModalities: [Modality.AUDIO],
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: 'propose_action',
                      description: 'Propose an action for the user to approve, e.g. create a project, task or meeting.',
                      parameters: {
                        type: 'OBJECT',
                        properties: {
                          action_type: {
                            type: 'STRING',
                            description: 'One of CREATE_PROJECT, CREATE_TASK, SCHEDULE_MEETING',
                          },
                          payload: { type: 'STRING', description: 'JSON string with the action parameters' },
                        },
                        required: ['action_type', 'payload'],
                      },
                    },
                  ],
                },
              ] as any,
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
              },
              systemInstruction: `You are CaReMa OS, a concise and helpful voice executive assistant.
Today is ${new Date().toISOString().slice(0, 10)}.
The user's workspace data (JSON) follows:
${serializeContext(msg.app_context)}
Answer questions about this data. When the user asks to create a project, task or meeting, call propose_action instead of claiming it is done.
Keep spoken answers short (1-3 sentences).`,
            },
            callbacks: {
              onmessage: (message: any) => {
                const parts = message?.serverContent?.modelTurn?.parts ?? [];
                for (const part of parts) {
                  if (part?.inlineData?.data) send({ audio: part.inlineData.data });
                }
                if (message?.toolCall?.functionCalls?.length) {
                  const call = message.toolCall.functionCalls[0];
                  send({ toolCall: call });
                  try {
                    session?.send({
                      toolResponse: {
                        functionResponses: message.toolCall.functionCalls.map((c: any) => ({
                          id: c.id,
                          name: c.name,
                          response: { result: 'Proposal shown to the user for approval.' },
                        })),
                      },
                    });
                  } catch (e) {
                    console.error('[Live] failed to acknowledge tool call', e);
                  }
                }
                if (message?.serverContent?.interrupted) send({ interrupted: true });
              },
              onerror: (e: any) => {
                console.error('[Live] session error', e?.message ?? e);
                send({ error: 'Voice session failed. Please try again.' });
              },
              onclose: () => {
                send({ closed: true });
              },
            },
          });
          send({ ready: true });
        } else if (msg.audio) {
          if (!session) return;
          const data = str(msg.audio, 2_000_000);
          if (!data) return;
          // Browsers may ignore the requested 16 kHz capture rate, so the client
          // reports the real rate it encoded at.
          const rate = Number.isFinite(Number(msg.sampleRate))
            ? Math.min(48_000, Math.max(8_000, Math.round(Number(msg.sampleRate))))
            : 16_000;
          session.sendRealtimeInput({ audio: { data, mimeType: `audio/pcm;rate=${rate}` } });
        }
      } catch (e: any) {
        console.error('[Live]', ip, e?.message ?? e);
        send({ error: 'Voice session could not start.' });
      }
    });

    clientWs.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      const remaining = (liveConnections.get(ip) ?? 1) - 1;
      if (remaining <= 0) liveConnections.delete(ip);
      else liveConnections.set(ip, remaining);
      try {
        session?.close?.();
      } catch {
        /* already closed */
      }
      session = null;
    });

    clientWs.on('error', (e: any) => console.error('[Live] socket error', e?.message ?? e));
  });

  const shutdown = async () => {
    console.log('[CaReMa OS] shutting down...');
    wss.clients.forEach((client) => client.close());
    wss.close();
    httpServer.close(() => process.exit(0));
    // Do not hang forever on open keep-alive sockets.
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((error) => {
  console.error('[CaReMa OS] failed to start server', error);
  process.exit(1);
});
