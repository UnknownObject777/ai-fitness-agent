import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getSystemPrompt } from './services/systemPrompt';
import {
  saveRecord,
  getHistory,
  getSessionMessages,
  addChatMessage,
  saveMealLogMulti,
  listChatSessions,
  createChatSession,
  updateChatSession,
  deleteChatSession,
  updateActivityRecord,
  deleteActivityRecord
} from './services/dbService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/system-prompt', (req, res) => {
    res.json({ prompt: getSystemPrompt() });
  });

  app.get('/api/chat/:sessionId', async (req, res) => {
    try {
      const messages = await getSessionMessages(req.params.sessionId);
      res.json({ success: true, messages });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/chat-sessions', async (req, res) => {
    try {
      const rawScope = String(req.query.scope || 'active');
      const scope = rawScope === 'all' || rawScope === 'archived' ? rawScope : 'active';
      const sessions = await listChatSessions(scope);
      res.json({ success: true, sessions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/chat-sessions', async (req, res) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
      const session = await createChatSession(title);
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/chat-sessions/:sessionId', async (req, res) => {
    try {
      const updates: { title?: string; archived?: boolean } = {};
      if (typeof req.body?.title === 'string') {
        updates.title = req.body.title;
      }
      if (typeof req.body?.archived === 'boolean') {
        updates.archived = req.body.archived;
      }

      const hasUpdates = Object.keys(updates).length > 0;
      if (!hasUpdates) {
        res.status(400).json({ success: false, error: 'No valid updates provided' });
        return;
      }

      const session = await updateChatSession(req.params.sessionId, updates);
      res.json({ success: true, session });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/chat-sessions/:sessionId', async (req, res) => {
    try {
      await deleteChatSession(req.params.sessionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/chat-openai', async (req, res) => {
    try {
      const { messages, sessionId = 'session_1', base64Image } = req.body;
      const systemPrompt = getSystemPrompt();
      const latestUserMessage = messages[messages.length - 1];

      await addChatMessage(sessionId, 'user', latestUserMessage.content, base64Image);

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(0, -1).map((message: any) => ({ role: message.role, content: message.content }))
      ];

      if (base64Image) {
        apiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: latestUserMessage.content || '识别这张图片中的食物' },
            { type: 'image_url', image_url: { url: base64Image } }
          ]
        });
      } else {
        apiMessages.push({ role: 'user', content: latestUserMessage.content });
      }

      const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
      const body = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: apiMessages,
        temperature: 0.2,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${errorText}`);
      }

      const data = await response.json();
      const aiContent = data.choices[0].message.content;
      const cleanJsonStr = (aiContent || '').replace(/```json\n?|```\n?/g, '').trim();

      let aiResponse: any;
      try {
        aiResponse = JSON.parse(cleanJsonStr);
      } catch {
        aiResponse = { response: aiContent, intent: 'chat' };
      }

      if (aiResponse.items && aiResponse.meal_type && base64Image) {
        aiResponse.intent = 'log_food_multi';
      }

      await addChatMessage(
        sessionId,
        'assistant',
        aiResponse.response || '已分析完成',
        undefined,
        aiResponse.intent,
        aiResponse.items ? aiResponse : aiResponse.data
      );

      res.json({ success: true, ...aiResponse });
    } catch (error: any) {
      console.error('OpenAI Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/save-record', async (req, res) => {
    try {
      const { intent, data, entryDate } = req.body;

      if (intent === 'log_food_multi') {
        const record = await saveMealLogMulti('user_1', data, 'photo');
        res.json({ success: true, record });
      } else {
        const record = await saveRecord(intent, data, entryDate);
        res.json({ success: true, record });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/logs', async (req, res) => {
    try {
      const logs = await getHistory();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/logs/:recordId', async (req, res) => {
    try {
      const { data, entryDate } = req.body;
      const hasData = data !== undefined;
      const hasEntryDate = typeof entryDate === 'string';
      if (!hasData && !hasEntryDate) {
        res.status(400).json({ success: false, error: 'No valid updates provided' });
        return;
      }

      const record = await updateActivityRecord(req.params.recordId, { data, entryDate });
      res.json({ success: true, record });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/logs/:recordId', async (req, res) => {
    try {
      await deleteActivityRecord(req.params.recordId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

