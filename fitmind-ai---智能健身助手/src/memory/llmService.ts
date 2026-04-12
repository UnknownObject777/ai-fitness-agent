import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { ApiConfig } from "./types";

const CONFIG_KEY = 'fitmind-api-config';

export function getApiConfig(): ApiConfig | null {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function saveApiConfig(config: ApiConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function callLLM(prompt: string, systemPrompt?: string): Promise<string> {
  const config = getApiConfig();
  if (!config) {
    throw new Error('请先在设置中配置 API Key');
  }

  if (config.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model || "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
      }
    });
    return response.text || '';
  } else {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      dangerouslyAllowBrowser: true
    });
    
    const response = await openai.chat.completions.create({
      model: config.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt || "你是一个健身助手" },
        { role: "user", content: prompt }
      ],
    });
    
    return response.choices[0].message.content || '';
  }
}
