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
  Sparkles,
  Camera,
  X,
  AlertTriangle,
  Plus,
  Archive,
  ArchiveRestore,
  PencilLine,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  data?: any;
  base64Image?: string;
}

interface LogRecord {
  id: string;
  timestamp: string;
  intent: string;
  entryDate: string;
  data: any;
}

interface ChatSession {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  messageCount: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'diet' | 'workout' | 'plan' | 'ai'>('ai');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showSessionManager, setShowSessionManager] = useState(false);
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [editingLog, setEditingLog] = useState<LogRecord | null>(null);
  const [editDataText, setEditDataText] = useState('');
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editLogError, setEditLogError] = useState('');
  const [isSavingLogEdit, setIsSavingLogEdit] = useState(false);
  const [sessionId, setSessionId] = useState<string>('session_1');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchLogs();
    fetchSessions('all');
  }, []);

  useEffect(() => {
    fetchSession(sessionId);
  }, [sessionId]);

  const fetchSession = async (targetSessionId: string) => {
    try {
      const res = await fetch(`/api/chat/${targetSessionId}`);
      const data = await res.json();
      if (data.success !== false && Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
      setMessages([]);
    }
  };

  const fetchSessions = async (scope: 'active' | 'archived' | 'all' = 'all') => {
    try {
      const res = await fetch(`/api/chat-sessions?scope=${scope}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      } else {
        setSessions([]);
      }
    } catch (e) {
      console.error(e);
      setSessions([]);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch('/api/chat-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!data.success || !data.session?.id) return;

      await fetchSessions('all');
      setSessionId(data.session.id);
      setMessages([]);
      setShowSessionManager(false);
      setShowArchivedSessions(false);
    } catch (e) {
      console.error(e);
    }
  };

  const switchSession = async (nextSessionId: string) => {
    if (nextSessionId === sessionId) {
      setShowSessionManager(false);
      return;
    }
    setSessionId(nextSessionId);
    setShowSessionManager(false);
  };

  const archiveSession = async (targetSessionId: string, archived: boolean) => {
    try {
      const res = await fetch(`/api/chat-sessions/${targetSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived })
      });
      const data = await res.json();
      if (!data.success) return;

      await fetchSessions('all');
      if (archived && targetSessionId === sessionId) {
        const activeCandidates = sessions.filter((session) => !session.archived && session.id !== targetSessionId);
        if (activeCandidates.length > 0) {
          setSessionId(activeCandidates[0].id);
        } else {
          await createNewSession();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeSession = async (targetSessionId: string) => {
    const confirmed = window.confirm('确认删除该会话？会话消息将一并删除。');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/chat-sessions/${targetSessionId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.success) return;

      const isCurrent = targetSessionId === sessionId;
      const nextSessions = sessions.filter((session) => session.id !== targetSessionId && !session.archived);
      await fetchSessions('all');

      if (isCurrent) {
        if (nextSessions.length > 0) {
          setSessionId(nextSessions[0].id);
        } else {
          await createNewSession();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const beginRenameSession = (session: ChatSession) => {
    setRenamingSessionId(session.id);
    setRenameTitle(session.title);
  };

  const submitRenameSession = async (targetSessionId: string) => {
    const nextTitle = renameTitle.trim();
    if (!nextTitle) return;

    try {
      const res = await fetch(`/api/chat-sessions/${targetSessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle })
      });
      const data = await res.json();
      if (!data.success) return;

      await fetchSessions('all');
      setRenamingSessionId(null);
      setRenameTitle('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: Message = { role: 'user', content: input, base64Image: selectedImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const imageToSend = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let aiResponse: any;

      if (provider === 'gemini') {
        const promptRes = await fetch('/api/system-prompt');
        const { prompt: systemInstruction } = await promptRes.json();

        // Warning: Simplified vision fallback, mostly openai backend handled in proxy
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
        
        const contents = messages.concat(userMsg).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content || "发送了图片" }]
        }));

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          }
        });

        const cleanJsonStr = (response.text || '').replace(/```json\n?|```\n?/g, '').trim();
        aiResponse = JSON.parse(cleanJsonStr);
      } else {
        const res = await fetch('/api/chat-openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: messages.concat(userMsg),
            sessionId,
            base64Image: imageToSend
          })
        });
        aiResponse = await res.json();
      }

      if (aiResponse.success !== false) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: aiResponse.response || "已分析完成",
          intent: aiResponse.intent,
          data: aiResponse.items ? aiResponse : aiResponse.data
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Automatically fetch logs occasionally
        const logIntents = ['log_food', 'log_exercise', 'log_measurement', 'log_water', 'log_strength_workout', 'generate_workout_plan', 'log_food_multi'];
        if (logIntents.includes(aiResponse.intent)) {
          // If it's log_food_multi, it's saved automatically on backend if confirmed, 
          // but we can assume auto backend save for now or trigger manual save
          if (aiResponse.intent !== 'log_food_multi') {
            await fetch('/api/save-record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                intent: aiResponse.intent,
                data: aiResponse.data || {},
                entryDate: aiResponse.entryDate
              })
            });
          } else {
            // For multi food, it needs user confirmation, so we won't auto save here
            // But let's say the backend already saved it as a draft or we trigger it via button
            // The user presses '确认记录' which hits /save-record later.
          }
          fetchLogs();
        }

        fetchSessions('all');
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

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLogs([]);
    }
  };

  const editableLogIntents = new Set([
    'log_food',
    'log_food_multi',
    'log_exercise',
    'log_strength_workout',
    'log_measurement'
  ]);

  const canManageLog = (intent: string) => editableLogIntents.has(intent);

  const openLogEditor = (log: LogRecord) => {
    if (!canManageLog(log.intent)) return;
    setEditingLog(log);
    setEditDataText(JSON.stringify(log.data || {}, null, 2));
    setEditEntryDate(log.entryDate || '');
    setEditLogError('');
  };

  const closeLogEditor = () => {
    setEditingLog(null);
    setEditDataText('');
    setEditEntryDate('');
    setEditLogError('');
    setIsSavingLogEdit(false);
  };

  const saveLogEdit = async () => {
    if (!editingLog || isSavingLogEdit) return;

    try {
      setIsSavingLogEdit(true);
      setEditLogError('');
      const parsedData = JSON.parse(editDataText || '{}');

      const payload: { data: any; entryDate?: string } = { data: parsedData };
      if (editEntryDate.trim()) {
        payload.entryDate = editEntryDate.trim();
      }

      const res = await fetch(`/api/logs/${editingLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '更新失败');
      }

      await fetchLogs();
      closeLogEditor();
    } catch (error: any) {
      setEditLogError(error.message || '修改失败，请检查 JSON 格式');
    } finally {
      setIsSavingLogEdit(false);
    }
  };

  const deleteLogRecord = async (log: LogRecord) => {
    if (!canManageLog(log.intent)) return;
    const confirmed = window.confirm('确认删除这条记录？删除后无法恢复。');
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/logs/${log.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '删除失败');
      }

      await fetchLogs();
      if (editingLog?.id === log.id) {
        closeLogEditor();
      }
    } catch (error) {
      console.error(error);
      alert('删除失败，请稍后重试。');
    }
  };

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'log_food': 
      case 'log_food_multi': return <Utensils className="w-4 h-4 text-[#FAECE7]" stroke="#F0997B" />;
      case 'log_exercise': return <Activity className="w-4 h-4 text-green-500" />;
      case 'log_strength_workout': return <Dumbbell className="w-4 h-4 text-[#1D9E75]" />;
      case 'generate_workout_plan': return <ClipboardList className="w-4 h-4 text-blue-600" />;
      case 'log_water': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'log_measurement': return <Scale className="w-4 h-4 text-purple-500" />;
      default: return <ChevronRight className="w-4 h-4 text-gray-400" />;
    }
  };

  const dietLogs = logs.filter((log) => log.intent === 'log_food' || log.intent === 'log_food_multi');
  const workoutLogs = logs.filter((log) => ['log_exercise', 'log_strength_workout', 'log_measurement'].includes(log.intent));
  const planLogs = logs.filter((log) => log.intent.includes('plan'));
  const activeSessions = sessions.filter((session) => !session.archived);
  const archivedSessions = sessions.filter((session) => session.archived);
  const currentSession = sessions.find((session) => session.id === sessionId);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            {activeTab === 'ai' && currentSession && (
              <p className="text-[10px] text-[#141414]/45 mt-0.5 max-w-44 truncate">
                {currentSession.title}
              </p>
            )}
          </div>
          {activeTab === 'ai' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  fetchSessions('all');
                  setShowLogs(false);
                  setShowSessionManager(!showSessionManager);
                }}
                className="p-1.5 rounded-lg text-[#7F77DD] hover:bg-[#EEEDFE]"
                title="对话管理"
              >
                <History className="w-5 h-5 opacity-90" />
              </button>
              <button
                onClick={() => {
                  setShowSessionManager(false);
                  setShowLogs(!showLogs);
                }}
                className="p-1.5 rounded-lg text-[#7F77DD] hover:bg-[#EEEDFE]"
                title="健康日志"
              >
                <Database className="w-5 h-5 opacity-90" />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F9F9F9]">
          {activeTab === 'ai' ? (
            <>
              {/* Chat Area */}
              <div className={`flex-1 flex flex-col transition-all duration-300 ${(showLogs || showSessionManager) ? 'hidden' : 'flex'}`}>
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
                        {msg.base64Image && (
                          <img src={msg.base64Image} alt="user uploaded" className="mt-2 rounded-lg max-h-32 object-cover" />
                        )}
                      </div>

                      {msg.intent && msg.intent !== 'chat' && msg.intent !== 'ask_question' && (
                        <div className="flex flex-col items-start max-w-full">
                          <div className="bg-white border border-[#AFA9EC] rounded-[12px] p-3 shadow-sm w-full mt-2">
                            <div className="text-[11px] font-bold text-[#3C3489] mb-1 flex items-center justify-between border-b border-[#EEEDFE] pb-2">
                              <span className="flex items-center gap-1.5">
                                {getIntentIcon(msg.intent)}
                                已准备{msg.intent === 'log_food_multi' ? '图像' : ''}记录：{msg.intent.replace('log_', '').replace('_multi', '')}
                              </span>
                              {msg.intent === 'log_food_multi' && msg.data?.needs_user_confirmation && (
                                <span className="bg-[#FAECE7] text-[#D85A30] px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="text-[9px]">需确认置信度</span>
                                </span>
                              )}
                            </div>
                            <div className="mt-2 text-[12px] text-[#534AB7] leading-relaxed">
                              {msg.intent === 'log_food' && (
                                <>
                                  🍱 {msg.data?.food_name} {msg.data?.quantity}{msg.data?.unit}<br/>
                                  热量 {msg.data?.calories} kcal · 蛋白质 {msg.data?.protein}g<br/>
                                </>
                              )}
                              {msg.intent === 'log_food_multi' && msg.data?.items?.map((item: any, idx: number) => (
                                <div key={idx} className={`mb-1 ${item.confidence < 0.75 ? 'text-[#D85A30]' : ''}`}>
                                  📸 {item.name} {item.estimated_grams}g <span className="text-[9px] opacity-70">({(item.confidence * 100).toFixed(0)}% 可信)</span><br/>
                                  热量 {item.nutrition_estimate?.kcal} kcal · 蛋白质 {item.nutrition_estimate?.protein_g}g<br/>
                                </div>
                              ))}
                              {msg.intent === 'log_strength_workout' && (
                                <>
                                  💪 {msg.data?.workout_name}<br/>
                                  {msg.data?.exercises?.length || 0} 个动作
                                </>
                              )}
                              {msg.intent === 'log_measurement' && (
                                <>
                                  ⚖️ 记录指标<br/>
                                  {msg.data?.measurements?.[0]?.value}{msg.data?.measurements?.[0]?.unit}
                                </>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3 pt-2">
                              <button 
                                onClick={async () => {
                                  if (msg.intent === 'log_food_multi') {
                                    try {
                                      await fetch('/api/save-record', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ intent: 'log_food_multi', data: msg.data })
                                      });
                                      alert('记录成功！已保存到健康日志。');
                                      fetchLogs();
                                    } catch(e) {}
                                  } else {
                                    alert('确认！');
                                  }
                                }}
                                className="flex-1 bg-[#7F77DD] text-white py-1.5 rounded-lg text-[11px] font-medium shadow-sm transition-all hover:bg-[#685CC9]"
                              >
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
            <div className="p-3 border-t border-[#E4E3E0] bg-white flex-shrink-0 flex gap-2 items-end relative">
              {selectedImage && (
                <div className="absolute -top-16 left-4 right-4 bg-white p-2 rounded-t-xl border border-[#EAEAEE] border-b-0 shadow-sm flex items-center justify-between">
                   <img src={selectedImage} className="h-12 w-12 object-cover rounded" alt="Preview"/>
                   <button onClick={() => setSelectedImage(null)} className="p-1 text-[#141414]/50 hover:bg-[#F5F5F5] rounded-full">
                     <X className="w-4 h-4" />
                   </button>
                </div>
              )}
              <div className="flex bg-[#F5F5F5] border border-[#EAEAEE] rounded-[20px] px-3 py-1 flex-1 items-center focus-within:border-[#AFA9EC] focus-within:ring-1 focus-within:ring-[#EEEDFE] transition-all">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-[#141414]/40 hover:text-[#7F77DD] transition-colors rounded-full"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="和 AI 聊聊或上传图片..."
                  className="w-full bg-transparent py-2 pl-2 pr-2 text-[14px] text-[#141414] focus:outline-none placeholder:text-[#141414]/30"
                />
              </div>
              <button 
                onClick={sendMessage}
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className="w-10 h-10 mb-1 shrink-0 bg-[#7F77DD] text-white rounded-full flex items-center justify-center disabled:opacity-50 transition-opacity shadow-sm hover:shadow-md"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showSessionManager && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute inset-0 bg-white z-20 flex flex-col"
              >
                <div className="p-4 border-b border-[#E4E3E0] flex justify-between items-center bg-white sticky top-0">
                  <div className="flex items-center gap-2 text-[#141414]">
                    <History className="w-4 h-4 text-[#7F77DD]" />
                    <h2 className="text-[14px] font-semibold">对话归档</h2>
                  </div>
                  <button
                    onClick={createNewSession}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-[#EEEDFE] text-[#3C3489] border border-[#AFA9EC]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建
                  </button>
                </div>

                <div className="px-4 pt-3 pb-2 border-b border-[#F1F1F1] bg-white flex justify-between items-center">
                  <span className="text-[11px] text-[#141414]/60">当前 {activeSessions.length} 个会话</span>
                  <button
                    onClick={() => setShowArchivedSessions(!showArchivedSessions)}
                    className="text-[11px] text-[#3C3489]"
                  >
                    {showArchivedSessions ? '隐藏已归档' : `查看归档(${archivedSessions.length})`}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9F9F9]">
                  {activeSessions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-[#141414]/30">
                      <History className="w-8 h-8" />
                      <p className="text-[12px]">暂无会话，点击上方新建</p>
                    </div>
                  ) : (
                    activeSessions.map((session) => (
                      <div key={session.id} className={`bg-white p-3 rounded-xl shadow-sm border ${session.id === sessionId ? 'border-[#AFA9EC]' : 'border-[#EAEAEE]'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-left flex-1">
                            {renamingSessionId === session.id ? (
                              <div className="space-y-2">
                                <input
                                  value={renameTitle}
                                  onChange={(e) => setRenameTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      submitRenameSession(session.id);
                                    }
                                    if (e.key === 'Escape') {
                                      setRenamingSessionId(null);
                                      setRenameTitle('');
                                    }
                                  }}
                                  className="w-full text-[12px] px-2 py-1 border border-[#AFA9EC] rounded-md focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    submitRenameSession(session.id);
                                  }}
                                  className="text-[10px] text-[#3C3489]"
                                >
                                  保存标题
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => switchSession(session.id)}
                                className="text-left w-full"
                              >
                                <div className="text-[12px] font-semibold text-[#141414] truncate">{session.title}</div>
                                <div className="text-[10px] text-[#141414]/45 mt-1 truncate">
                                  {session.lastMessagePreview || '暂无消息'}
                                </div>
                                <div className="text-[10px] text-[#141414]/35 mt-1">
                                  {session.lastMessageAt ? formatDate(session.lastMessageAt) : formatDate(session.createdAt)} · {session.messageCount} 条消息
                                </div>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                beginRenameSession(session);
                              }}
                              className="p-1 rounded text-[#141414]/45 hover:bg-[#F5F5F5]"
                              title="重命名"
                            >
                              <PencilLine className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                archiveSession(session.id, true);
                              }}
                              className="p-1 rounded text-[#141414]/45 hover:bg-[#F5F5F5]"
                              title="归档"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSession(session.id);
                              }}
                              className="p-1 rounded text-[#141414]/45 hover:bg-[#F5F5F5]"
                              title="删除"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {showArchivedSessions && (
                    <div>
                      <div className="text-[11px] text-[#141414]/45 mb-2">已归档会话</div>
                      <div className="space-y-2">
                        {archivedSessions.length === 0 ? (
                          <div className="bg-white border border-dashed border-[#DADADA] rounded-xl p-3 text-[11px] text-[#141414]/40">
                            暂无归档会话
                          </div>
                        ) : (
                          archivedSessions.map((session) => (
                            <div key={session.id} className="bg-white p-3 rounded-xl border border-[#EAEAEE]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[12px] font-medium text-[#141414] truncate">{session.title}</div>
                                  <div className="text-[10px] text-[#141414]/35 mt-1">
                                    {session.lastMessageAt ? formatDate(session.lastMessageAt) : formatDate(session.createdAt)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => archiveSession(session.id, false)}
                                  className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-[#AFA9EC] text-[#3C3489] bg-[#EEEDFE]"
                                >
                                  <ArchiveRestore className="w-3 h-3" />
                                  恢复
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-[#E4E3E0] bg-white">
                  <button
                    onClick={() => setShowSessionManager(false)}
                    className="w-full py-2 rounded-lg text-[12px] border border-[#EAEAEE] text-[#141414]/70"
                  >
                    关闭
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
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
                          {log.intent === 'log_food_multi' && (
                            <div>
                              <span className="font-semibold text-[13px]">{log.data?.meal_type} 识别记录</span>
                              <div className="my-1.5 space-y-1">
                                {log.data?.items?.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center bg-[#F5F5F5] p-1.5 rounded-md text-[11px]">
                                    <span className="font-medium text-[#141414]">📸 {item.name} <span className="opacity-60 font-normal">({item.estimated_grams}g)</span></span>
                                    <span className="text-[#141414]/70 font-mono text-[10px]">🔥{item.nutrition_estimate?.kcal}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-4 gap-1 mt-2 p-1.5 bg-[#EEEDFE] border border-[#AFA9EC] rounded-md text-[10px] text-[#3C3489]">
                                <div>🔥{log.data?.total?.kcal}</div>
                                <div>🥩{log.data?.total?.protein_g}</div>
                                <div>🍞{log.data?.total?.carb_g}</div>
                                <div>🥑{log.data?.total?.fat_g}</div>
                              </div>
                            </div>
                          )}
                          {log.intent !== 'log_food' && log.intent !== 'log_food_multi' && log.intent !== 'log_exercise' && (
                            <span className="text-[#141414]/60">已记录相关数据</span>
                          )}
                        </div>
                        {canManageLog(log.intent) && (
                          <div className="mt-3 pt-2 border-t border-[#F5F5F5] flex items-center justify-end gap-2">
                            <button
                              onClick={() => openLogEditor(log)}
                              className="text-[11px] px-2 py-1 rounded-md border border-[#AFA9EC] text-[#3C3489] bg-[#EEEDFE]"
                            >
                              手动修改
                            </button>
                            <button
                              onClick={() => deleteLogRecord(log)}
                              className="text-[11px] px-2 py-1 rounded-md border border-[#F3C7C7] text-[#B94747] bg-[#FFF2F2]"
                            >
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F9F9F9]">
          {activeTab === 'home' && (
            <>
              <div className="bg-white rounded-xl p-3 border border-[#EAEAEE] shadow-sm">
                <div className="text-[11px] text-[#141414]/50">已持久化记录总数</div>
                <div className="text-[26px] font-semibold text-[#141414] mt-1">{logs.length}</div>
                <div className="text-[11px] text-[#141414]/50 mt-1">饮食 {dietLogs.length} · 训练 {workoutLogs.length} · 计划 {planLogs.length}</div>
              </div>

              {[...logs].slice(0, 5).map((log) => (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-[#EAEAEE] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#141414] text-[11px] font-semibold">
                      {getIntentIcon(log.intent)}
                      <span>{log.intent}</span>
                    </div>
                    <span className="text-[10px] text-[#141414]/40">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="text-[12px] text-[#141414]/70 mt-2">{log.data?.food_name || log.data?.exercise_name || log.data?.plan_metadata?.goal_orientation || '已记录数据'}</div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'diet' && (
            dietLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#141414]/30">
                <Utensils className="w-9 h-9" />
                <p className="text-[12px]">暂无饮食持久化记录</p>
              </div>
            ) : (
              dietLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-[#EAEAEE] shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-[#141414]">
                      {getIntentIcon(log.intent)}
                      <span>{log.data?.meal_type || '饮食记录'}</span>
                    </div>
                    <span className="text-[#141414]/40">{formatDate(log.timestamp)}</span>
                  </div>

                  {log.intent === 'log_food' && (
                    <div className="mt-2 text-[12px] text-[#141414]">
                      <div className="font-medium">{log.data?.food_name || '未命名食物'}</div>
                      <div className="opacity-60">{log.data?.quantity || '-'} {log.data?.unit || ''}</div>
                      <div className="mt-2 grid grid-cols-4 gap-1 p-1.5 bg-[#F5F5F5] rounded-md text-[10px] text-[#141414]/70">
                        <div>🔥{log.data?.calories || 0}</div>
                        <div>🥩{log.data?.protein || 0}</div>
                        <div>🍞{log.data?.carbs || 0}</div>
                        <div>🥑{log.data?.fat || 0}</div>
                      </div>
                    </div>
                  )}

                  {log.intent === 'log_food_multi' && (
                    <div className="mt-2 text-[12px] text-[#141414]">
                      <div className="font-medium">图片识别饮食</div>
                      <div className="opacity-60">{(log.data?.items || []).length} 个食物项</div>
                      <div className="mt-2 grid grid-cols-4 gap-1 p-1.5 bg-[#EEEDFE] rounded-md text-[10px] text-[#3C3489] border border-[#AFA9EC]">
                        <div>🔥{log.data?.total?.kcal || 0}</div>
                        <div>🥩{log.data?.total?.protein_g || 0}</div>
                        <div>🍞{log.data?.total?.carb_g || 0}</div>
                        <div>🥑{log.data?.total?.fat_g || 0}</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-[#F5F5F5] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openLogEditor(log)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#AFA9EC] text-[#3C3489] bg-[#EEEDFE]"
                    >
                      手动修改
                    </button>
                    <button
                      onClick={() => deleteLogRecord(log)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#F3C7C7] text-[#B94747] bg-[#FFF2F2]"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'workout' && (
            workoutLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#141414]/30">
                <Dumbbell className="w-9 h-9" />
                <p className="text-[12px]">暂无训练持久化记录</p>
              </div>
            ) : (
              workoutLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-[#EAEAEE] shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-[#141414]">
                      {getIntentIcon(log.intent)}
                      <span>{log.data?.exercise_name || log.data?.workout_name || log.intent}</span>
                    </div>
                    <span className="text-[#141414]/40">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="mt-2 text-[12px] text-[#141414]/70">
                    时长 {log.data?.duration_minutes || 0} 分钟
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#F5F5F5] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openLogEditor(log)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#AFA9EC] text-[#3C3489] bg-[#EEEDFE]"
                    >
                      手动修改
                    </button>
                    <button
                      onClick={() => deleteLogRecord(log)}
                      className="text-[11px] px-2 py-1 rounded-md border border-[#F3C7C7] text-[#B94747] bg-[#FFF2F2]"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {activeTab === 'plan' && (
            planLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#141414]/30">
                <ClipboardList className="w-9 h-9" />
                <p className="text-[12px]">暂无计划持久化记录</p>
              </div>
            ) : (
              planLogs.map((log) => (
                <div key={log.id} className="bg-white rounded-xl p-3 border border-[#EAEAEE] shadow-sm">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold text-[#141414]">
                      {getIntentIcon(log.intent)}
                      <span>{log.intent}</span>
                    </div>
                    <span className="text-[#141414]/40">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="mt-2 text-[12px] text-[#141414]">
                    <div>目标：{log.data?.plan_metadata?.goal_orientation || '未设置'}</div>
                    <div className="opacity-70">周期：{log.data?.plan_metadata?.total_weeks || 0} 周</div>
                    <div className="opacity-70">周模板：{(log.data?.weekly_templates || []).length} 组</div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}

      <AnimatePresence>
        {editingLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/35 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-sm bg-white rounded-2xl border border-[#EAEAEE] shadow-xl"
            >
              <div className="px-4 py-3 border-b border-[#F3F3F3]">
                <h3 className="text-[14px] font-semibold text-[#141414]">手动修改记录</h3>
                <p className="text-[11px] text-[#141414]/45 mt-1">{editingLog.intent} · ID {editingLog.id.slice(0, 8)}</p>
              </div>

              <div className="px-4 py-3 space-y-3">
                <div>
                  <label className="block text-[11px] text-[#141414]/60 mb-1">记录日期（可选）</label>
                  <input
                    value={editEntryDate}
                    onChange={(e) => setEditEntryDate(e.target.value)}
                    placeholder="today / yesterday / 2026-04-10"
                    className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#141414]/60 mb-1">数据 JSON</label>
                  <textarea
                    value={editDataText}
                    onChange={(e) => setEditDataText(e.target.value)}
                    className="w-full h-44 text-[12px] font-mono px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]"
                  />
                </div>

                {editLogError && (
                  <div className="text-[11px] text-[#B94747] bg-[#FFF2F2] border border-[#F3C7C7] rounded-md px-2.5 py-2">
                    {editLogError}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-[#F3F3F3] flex items-center justify-end gap-2">
                <button
                  onClick={closeLogEditor}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E1E1E1] text-[#141414]/70"
                >
                  取消
                </button>
                <button
                  onClick={saveLogEdit}
                  disabled={isSavingLogEdit}
                  className="text-[12px] px-3 py-1.5 rounded-lg bg-[#7F77DD] text-white disabled:opacity-60"
                >
                  {isSavingLogEdit ? '保存中...' : '保存修改'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
