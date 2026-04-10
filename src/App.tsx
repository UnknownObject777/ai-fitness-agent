import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Bot, 
  User, 
  Settings, 
  History, 
  Activity, 
  Utensils, 
  Droplets, 
  Scale, 
  ChevronRight,
  Database,
  Dumbbell,
  ClipboardList,
  Target,
  Home,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  data?: any;
}

interface LogRecord {
  id: string;
  timestamp: string;
  intent: string;
  entryDate: string;
  data: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'diet' | 'workout' | 'plan' | 'ai'>('ai');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      let aiResponse: any;

      if (provider === 'gemini') {
        // Fetch system prompt from backend
        const promptRes = await fetch('/api/system-prompt');
        const { prompt: systemInstruction } = await promptRes.json();

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: messages.concat(userMsg).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          }
        });

        const cleanJsonStr = response.text.replace(/```json\n?|```\n?/g, '').trim();
        aiResponse = JSON.parse(cleanJsonStr);
      } else {
        const res = await fetch('/api/chat-openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: messages.concat(userMsg) })
        });
        aiResponse = await res.json();
      }

      if (aiResponse.success !== false) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: aiResponse.response,
          intent: aiResponse.intent,
          data: aiResponse.data
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Save record if it's a log intent
        const logIntents = ['log_food', 'log_exercise', 'log_measurement', 'log_water', 'log_strength_workout', 'generate_workout_plan'];
        if (logIntents.includes(aiResponse.intent)) {
          await fetch('/api/save-record', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intent: aiResponse.intent,
              data: aiResponse.data,
              entryDate: aiResponse.entryDate
            })
          });
          fetchLogs();
        }
      } else {
        throw new Error(aiResponse.error || "AI failed to respond");
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'log_food': return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'log_exercise': return <Activity className="w-4 h-4 text-green-500" />;
      case 'log_strength_workout': return <Dumbbell className="w-4 h-4 text-red-500" />;
      case 'generate_workout_plan': return <ClipboardList className="w-4 h-4 text-blue-600" />;
      case 'log_water': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'log_measurement': return <Scale className="w-4 h-4 text-purple-500" />;
      default: return <ChevronRight className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center py-8">
      <div className="bg-white max-w-sm w-full h-[844px] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col border-[8px] border-[#141414]">
        {/* Header */}
        <header className="h-[60px] flex-shrink-0 flex items-center justify-between px-6 bg-white border-b border-[#E4E3E0]/50 sticky top-0 z-10 pt-2">
          <div className="flex flex-col">
            <h1 className="text-[17px] font-semibold text-[#141414] tracking-tight">
              {activeTab === 'home' && '今日总览'}
              {activeTab === 'diet' && '饮食记录'}
              {activeTab === 'workout' && '今日训练'}
              {activeTab === 'plan' && '训练计划'}
              {activeTab === 'ai' && 'AI 助手'}
            </h1>
          </div>
          {activeTab === 'ai' && (
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="text-[12px] font-medium text-[#7F77DD]"
            >
              <History className="w-5 h-5 opacity-80" />
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F9F9F9]">
          {activeTab === 'ai' ? (
            <>
              {/* Chat Area */}
              <div className={`flex-1 flex flex-col transition-all duration-300 ${showLogs ? 'hidden' : 'flex'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center mt-6 space-y-4">
                      <div className="bg-[#141414]/5 text-[#141414]/60 text-xs px-3 py-1.5 rounded-lg border border-[#141414]/10 max-w-[90%] text-center">
                        早上好！今天是训练日 · 推力 A
                      </div>
                      <div className="w-full bg-white border border-[#AFA9EC] rounded-[10px] overflow-hidden">
                        <div className="bg-[#EEEDFE] px-3 py-2 text-[11px] font-medium text-[#3C3489] flex items-center">
                          今日简报
                        </div>
                        <div className="p-3 flex gap-2">
                          <div className="flex-1 bg-white border border-[#AFA9EC] rounded-lg p-2 text-center">
                            <div className="text-sm font-medium text-[#534AB7]">72.5<span className="text-[10px]">kg</span></div>
                            <div className="text-[9px] text-[#7F77DD]">体重</div>
                          </div>
                          <div className="flex-1 bg-white border border-[#AFA9EC] rounded-lg p-2 text-center">
                            <div className="text-sm font-medium text-[#534AB7]">1,840</div>
                            <div className="text-[9px] text-[#7F77DD]">kcal 摄入</div>
                          </div>
                          <div className="flex-1 bg-white border border-[#AFA9EC] rounded-lg p-2 text-center">
                            <div className="text-sm font-medium text-[#534AB7]">第1周</div>
                            <div className="text-[9px] text-[#7F77DD]">力量计划</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full">
                        <div className="text-[10px] text-[#141414]/50 mb-2 font-medium">快捷指令</div>
                        <div className="flex flex-wrap gap-2">
                          {['记录体重', '开始训练', '添加饮食', '查看进展'].map(cmd => (
                            <button 
                              key={cmd}
                              onClick={() => setInput(cmd)}
                              className="px-3 py-1.5 bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5] rounded-full text-xs transition-colors hover:bg-[#5DCAA5]/20"
                            >
                              {cmd}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 shrink-0 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`space-y-2 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`px-4 py-2.5 text-[14px] leading-relaxed break-words shadow-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#7F77DD] text-[#EEEDFE] rounded-[16px_4px_16px_16px]' 
                          : 'bg-[#EEEDFE] text-[#3C3489] rounded-[4px_16px_16px_16px] border border-[#AFA9EC]'
                      }`}>
                        {msg.content}
                      </div>

                      {msg.intent && msg.intent !== 'chat' && msg.intent !== 'ask_question' && (
                        <div className="flex flex-col items-start max-w-full">
                          <div className="bg-white border border-[#AFA9EC] rounded-[12px] p-3 shadow-sm w-full mt-2">
                            <div className="text-[11px] font-bold text-[#3C3489] mb-1 flex items-center gap-1.5 border-b border-[#EEEDFE] pb-2">
                              {getIntentIcon(msg.intent)}
                              已准备记录：{msg.intent.replace('log_', '')}
                            </div>
                            <div className="mt-2 text-[12px] text-[#534AB7] leading-relaxed">
                              {msg.intent === 'log_food' && (
                                <>
                                  🍱 {msg.data.food_name} {msg.data.quantity}{msg.data.unit}<br/>
                                  热量 {msg.data.calories} kcal · 蛋白质 {msg.data.protein}g<br/>
                                </>
                              )}
                              {msg.intent === 'log_strength_workout' && (
                                <>
                                  💪 {msg.data.workout_name}<br/>
                                  {msg.data.exercises?.length || 0} 个动作
                                </>
                              )}
                              {msg.intent === 'log_measurement' && (
                                <>
                                  ⚖️ 记录指标<br/>
                                  {msg.data.measurements?.[0]?.value}{msg.data.measurements?.[0]?.unit}
                                </>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3 pt-2">
                              <button className="flex-1 bg-[#7F77DD] text-white py-1.5 rounded-lg text-[11px] font-medium shadow-sm transition-all hover:bg-[#685CC9]">
                                确认记录
                              </button>
                              <button className="flex-1 bg-white text-[#3C3489] border border-[#AFA9EC] py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-[#EEEDFE]">
                                修改
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex gap-3">
                  <div className="bg-[#EEEDFE] border border-[#AFA9EC] p-3 rounded-[4px_16px_16px_16px] shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-[#7F77DD] rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-[#7F77DD] rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-[#7F77DD] rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-[#E4E3E0] bg-white flex-shrink-0 flex gap-2 items-center">
              <div className="relative flex-1">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="和 AI 聊聊..."
                  className="w-full bg-[#F5F5F5] border border-[#EAEAEE] rounded-[20px] py-2.5 pl-4 pr-10 text-[14px] text-[#141414] focus:outline-none focus:border-[#AFA9EC] focus:ring-1 focus:ring-[#EEEDFE] transition-all placeholder:text-[#141414]/30"
                />
              </div>
              <button 
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 shrink-0 bg-[#7F77DD] text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-opacity flex-shrink-0 shadow-sm hover:shadow-md"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
          
          {/* Logs */}
          <AnimatePresence>
            {showLogs && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute inset-0 bg-white z-20 flex flex-col"
              >
                <div className="p-4 border-b border-[#E4E3E0] flex justify-between items-center bg-white sticky top-0">
                  <div className="flex items-center gap-2 text-[#141414]">
                    <Database className="w-4 h-4 text-[#7F77DD]" />
                    <h2 className="text-[14px] font-semibold">健康日志</h2>
                  </div>
                  <button onClick={() => setShowLogs(false)} className="text-[12px] text-[#141414]/50 hover:text-[#141414]">
                    关闭
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9F9]">
                  {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-[#141414]">
                      <History className="w-8 h-8 mb-2" />
                      <p className="text-[12px]">暂无记录</p>
                    </div>
                  ) : (
                    [...logs].reverse().map((log) => (
                      <div key={log.id} className="bg-white p-3 rounded-xl shadow-sm border border-[#EAEAEE]">
                        <div className="flex justify-between items-start mb-2 pb-2 border-b border-[#F5F5F5]">
                          <div className="flex items-center gap-1.5 text-[#141414]">
                            {getIntentIcon(log.intent)}
                            <span className="text-[11px] font-semibold uppercase tracking-tight">
                              {log.intent.replace('log_', '')}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#141414]/40">
                            {new Date(log.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        {/* 记录内容渲染保持原样即可 */}
                        <div className="text-[12px] text-[#141414]">
                          {log.intent === 'log_food' && (
                            <div>
                              <span className="font-semibold">{log.data.food_name}</span>
                              <span className="opacity-60 ml-1">{log.data.quantity}{log.data.unit}</span>
                              <div className="grid grid-cols-4 gap-1 mt-2 p-1.5 bg-[#F5F5F5] rounded-md text-[10px] text-[#141414]/70">
                                <div>🔥{log.data.calories}</div>
                                <div>🥩{log.data.protein}</div>
                                <div>🍞{log.data.carbs}</div>
                                <div>🥑{log.data.fat}</div>
                              </div>
                            </div>
                          )}
                          {log.intent === 'log_exercise' && (
                            <div>
                              <span className="font-semibold">{log.data.exercise_name}</span>
                              <span className="opacity-60 ml-1">{log.data.duration_minutes}min</span>
                              {log.data.distance && (
                                <span className="opacity-60 ml-1">/ {log.data.distance}{log.data.distance_unit}</span>
                              )}
                            </div>
                          )}
                          {/* ... 其他的可以保持精简 */}
                          {log.intent !== 'log_food' && log.intent !== 'log_exercise' && (
                            <span className="text-[#141414]/60">已记录相关数据</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-[#141414]/30">
          {activeTab === 'home' && <Home className="w-10 h-10" />}
          {activeTab === 'diet' && <Utensils className="w-10 h-10" />}
          {activeTab === 'workout' && <Dumbbell className="w-10 h-10" />}
          {activeTab === 'plan' && <ClipboardList className="w-10 h-10" />}
          <p className="text-[13px] font-medium tracking-wide">
            这里将是 {activeTab === 'home' ? '总览' : activeTab === 'diet' ? '饮食' : activeTab === 'workout' ? '训练' : '计划'} 页面...
          </p>
        </div>
      )}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-[70px] flex-shrink-0 bg-white border-t border-[#E4E3E0] flex justify-around items-center px-2 pb-2">
        <button className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'home' ? 'text-[#141414]' : 'text-[#141414]/30 hover:text-[#141414]/60'}`} onClick={() => setActiveTab('home')}>
          <Home className="w-[22px] h-[22px] stroke-[1.5]" />
          <span className="text-[10px] font-medium">总览</span>
        </button>
        <button className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'diet' ? 'text-[#141414]' : 'text-[#141414]/30 hover:text-[#141414]/60'}`} onClick={() => setActiveTab('diet')}>
          <Utensils className="w-[22px] h-[22px] stroke-[1.5]" />
          <span className="text-[10px] font-medium">饮食</span>
        </button>
        <button className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'workout' ? 'text-[#141414]' : 'text-[#141414]/30 hover:text-[#141414]/60'}`} onClick={() => setActiveTab('workout')}>
          <Dumbbell className="w-[22px] h-[22px] stroke-[1.5]" />
          <span className="text-[10px] font-medium">训练</span>
        </button>
        <button className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'plan' ? 'text-[#141414]' : 'text-[#141414]/30 hover:text-[#141414]/60'}`} onClick={() => setActiveTab('plan')}>
          <ClipboardList className="w-[22px] h-[22px] stroke-[1.5]" />
          <span className="text-[10px] font-medium">计划</span>
        </button>
        <button className={`flex flex-col items-center gap-1 w-14 ${activeTab === 'ai' ? 'text-[#7F77DD]' : 'text-[#141414]/30 hover:text-[#7F77DD]/70'}`} onClick={() => setActiveTab('ai')}>
          <Sparkles className="w-[22px] h-[22px] stroke-[2]" />
          <span className="text-[10px] font-semibold">AI</span>
        </button>
      </nav>
    </div>
  </div>
);
}
