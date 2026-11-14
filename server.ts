import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { WebSocketServer } from 'ws';

// Initialize Gemini Client
// We use the modern @google/genai SDK as requested.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/ai/process', async (req, res) => {
    try {
      const { user_id, input_type, input_content, conversation_history, app_context } = req.body;
      
      const systemInstruction = `
        You are CaReMa OS, a Multimodal AI Agent functioning as an executive assistant and strategic manager.
        The user wants to manage projects, tasks, calendar events, and risks.
        
        Here is the user's current app state/data (projects, tasks, calendar events):
        ${JSON.stringify(app_context || {}, null, 2)}
        
        Analyze the user's input based on their current data.
        If they ask questions about their data (like upcoming meetings), answer them directly using the context provided above.
        If the user is asking to create or modify data (e.g., "Create a project called X", "Schedule a meeting"), propose an action.
        Return your response in strict JSON format.
        
        Example JSON Response for a Proposal:
        {
          "status": "PROPOSAL",
          "message_id": "msg_xxx",
          "proposed_actions": [
            {
              "function": "create_project",
              "parameters": { 
                "name": "Project Name", 
                "category": "Development",
                "tasks": [
                  { "title": "Task 1", "priority": "HIGH" },
                  { "title": "Task 2", "priority": "MEDIUM" }
                ]
              },
              "description": "Create a new project with 2 tasks"
            }
          ],
          "display_text": "Proposal: Create project 'Project Name' and its tasks. Do you approve?"
        }

        Example JSON for a Calendar Event Proposal:
        {
          "status": "PROPOSAL",
          "message_id": "msg_xxx",
          "proposed_actions": [
            {
              "function": "create_event",
              "parameters": { 
                "title": "Meeting with Client", 
                "startTime": "2026-06-30T10:00:00Z",
                "endTime": "2026-06-30T11:00:00Z",
                "location": "Google Meet"
              },
              "description": "Schedule meeting with Client"
            }
          ],
          "display_text": "Proposal: Schedule meeting with Client tomorrow. Do you approve?"
        }

        Example JSON for a direct chat response:
        {
          "status": "MESSAGE",
          "message_id": "msg_yyy",
          "display_text": "Good morning! You have 3 pending tasks."
        }
      `;

      let textInput = input_content;

      // Note: We are using gemini-2.5-flash to avoid rate limits
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: textInput }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        }
      });

      let responseText = response.text || "{}";
      let parsed = JSON.parse(responseText);

      res.json(parsed);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/extract-tasks', async (req, res) => {
    try {
      const { fileContent } = req.body;
      
      const systemInstruction = `
        Analyze the following document and extract all action items, tasks, follow-ups, and scheduled meetings/events.
        Return the response strictly as a JSON object with:
        - a "tasks" array (each object having "title" and "priority" [Low, Medium, High, Critical])
        - an "events" array (each object having "title", "startTime" (ISO string), "endTime" (ISO string), and "location" (optional))
        Example: { "tasks": [{ "title": "Review Q3 budget", "priority": "High" }], "events": [{ "title": "Q3 Planning", "startTime": "2026-07-01T10:00:00Z", "endTime": "2026-07-01T11:00:00Z" }] }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: fileContent }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text || "{}";
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Setup WebSocket Server for Live API
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on("connection", (clientWs) => {
    let session: any = null;

    clientWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'setup' && !session) {
           const context = msg.app_context || {};
          const liveTools = [{
            functionDeclarations: [
              {
                name: 'propose_action',
                description: 'Propose an action to the user, like creating a project, task, or meeting.',
                parameters: { 
                  type: 'OBJECT', 
                  properties: { 
                     action_type: { type: 'STRING', description: 'CREATE_PROJECT, CREATE_TASK, SCHEDULE_MEETING' },
                     payload: { type: 'STRING', description: 'JSON string of the payload' }
                  }, 
                  required: ['action_type', 'payload'] 
                }
              }
            ]
          }];

           session = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: [Modality.AUDIO],
              tools: liveTools as any,
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
              },
              systemInstruction: `You are CaReMa OS, an executive assistant. 
Here is the user's current data (events, projects, tasks): 
${JSON.stringify(context, null, 2)}
Answer questions based on this data. Be helpful and concise. If the user asks to create a task, project, or schedule a meeting, use the propose_action tool.`,
            },
            callbacks: {
              onmessage: (message: any) => {
                const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ audio }));
                }
                if (message.toolCall) {
                   clientWs.send(JSON.stringify({ toolCall: message.toolCall.functionCalls[0] }));
                   
                   // Auto-respond to the tool call so the model continues
                   try {
                     const toolResponses = message.toolCall.functionCalls.map((call: any) => ({
                        id: call.id,
                        name: call.name,
                        response: { result: "Action proposed to the user successfully." }
                     }));
                     session.send({ toolResponse: { functionResponses: toolResponses } });
                   } catch(e) {
                     console.error("Failed to send tool response:", e);
                   }
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
              },
            },
          });
          clientWs.send(JSON.stringify({ ready: true }));
        }
        else if (msg.audio && session) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } catch (e) {
        console.error("Live input error:", e);
      }
    });

    clientWs.on("close", () => {
       try {
         if (session) (session as any).close?.();
       } catch(e) {}
    });
  });

}

startServer();
