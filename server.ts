import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getSystemPrompt } from './services/systemPrompt';
import { saveRecord, getHistory } from './services/dbService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  
  // Get System Prompt (for frontend Gemini calls)
  app.get('/api/system-prompt', (req, res) => {
    res.json({ prompt: getSystemPrompt() });
  });

  // OpenAI Proxy
  app.post('/api/chat-openai', async (req, res) => {
    try {
      const { messages } = req.body;
      const systemPrompt = getSystemPrompt();
      
      const url = `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`;
      const body = {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.7,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Error: ${errorText}`);
      }

      const data = await response.json();
      const aiContent = data.choices[0].message.content;
      
      // Clean JSON
      const cleanJsonStr = aiContent.replace(/```json\n?|```\n?/g, '').trim();
      const aiResponse = JSON.parse(cleanJsonStr);

      res.json({ success: true, ...aiResponse });
    } catch (error: any) {
      console.error("OpenAI Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Save Record
  app.post('/api/save-record', async (req, res) => {
    try {
      const { intent, data, entryDate } = req.body;
      const record = await saveRecord(intent, data, entryDate);
      res.json({ success: true, record });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get Logs
  app.get('/api/logs', async (req, res) => {
    try {
      const logs = await getHistory();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
