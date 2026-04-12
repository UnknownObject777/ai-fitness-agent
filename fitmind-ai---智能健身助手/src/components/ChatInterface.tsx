import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useWorkingMemory } from '../memory/workingMemoryStore';
import { callLLM } from '../memory/llmService';
import { buildAgentContext, formatContextAsSystemPrompt } from '../memory/agentContextBuilder';

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { recentUserMessages, addMessage, clearSession } = useWorkingMemory();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recentUserMessages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    addMessage('user', userMsg);
    setIsLoading(true);

    try {
      const context = await buildAgentContext(userMsg);
      const systemPrompt = formatContextAsSystemPrompt(context);
      const reply = await callLLM(userMsg, systemPrompt);
      addMessage('assistant', reply);
    } catch (error: any) {
      addMessage('assistant', `错误: ${error.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-bottom border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">FitMind AI 教练</h2>
            <p className="text-[10px] text-gray-500">基于三层记忆系统</p>
          </div>
        </div>
        <button 
          onClick={clearSession}
          className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
          title="清除对话历史"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {recentUserMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">欢迎来到 FitMind</h3>
              <p className="text-sm text-gray-500 max-w-xs mx-auto">
                我是你的智能健身教练。我可以记住你的训练偏好、力量进展和疲劳状态。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {['帮我制定这周的训练计划', '分析我最近的力量趋势', '我今天感觉有点累，该怎么练？'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-xs p-3 bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-700 rounded-xl border border-gray-100 transition-all text-left"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {recentUserMessages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                msg.role === 'user' ? "bg-gray-100" : "bg-orange-100"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-gray-600" /> : <Bot className="w-4 h-4 text-orange-600" />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user' 
                  ? "bg-orange-500 text-white rounded-tr-none" 
                  : "bg-gray-100 text-gray-800 rounded-tl-none"
              )}>
                {msg.role === 'assistant' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 mr-auto"
          >
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-orange-600" />
            </div>
            <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/30">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="咨询你的 AI 教练..."
            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white rounded-lg transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
