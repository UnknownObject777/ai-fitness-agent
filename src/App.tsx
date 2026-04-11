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
  id?: string;
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
  const [editFormData, setEditFormData] = useState<any>({});
  const [editEntryDate, setEditEntryDate] = useState('');
  const [editLogError, setEditLogError] = useState('');
  const [isSavingLogEdit, setIsSavingLogEdit] = useState(false);
  const [sessionId, setSessionId] = useState<string>('session_1');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const resolveStoredImage = (value?: string) => {
    if (!value) return undefined;
    if (value.startsWith('data:') || value.startsWith('/uploads/') || value.startsWith('http')) {
      return value;
    }
    return `/uploads/${value}`;
  };

  const normalizeMessage = (message: any): Message => ({
    id: message.id,
    role: message.role,
    content: message.content,
    intent: message.intent,
    data: message.data,
    base64Image: resolveStoredImage(message.image_data)
  });

  const scrollChatToBottom = (smooth: boolean = false) => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  };

  useEffect(() => {
    if (activeTab !== 'ai' || showLogs || showSessionManager) return;
    requestAnimationFrame(() => scrollChatToBottom(messages.length > 1));
  }, [messages, activeTab, showLogs, showSessionManager]);

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
        setMessages(data.messages.map((msg: any) => normalizeMessage(msg)));
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

    const userMsg: Message = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: input,
      base64Image: selectedImage || undefined
    };
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
        let imageKey: string | undefined;
        if (imageToSend) {
          try {
            const uploadRes = await fetch('/api/upload-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Image: imageToSend })
            });
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
              imageKey = uploadData.imageKey;
            }
          } catch (uploadError) {
            console.error('Image upload failed, fallback to base64:', uploadError);
          }
        }

        const res = await fetch('/api/chat-openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: messages.concat(userMsg),
            sessionId,
            base64Image: imageToSend,
            imageKey
          })
        });
        aiResponse = await res.json();
      }

      if (aiResponse.success !== false) {
        const assistantMsg: Message = {
          id: `assistant_${Date.now()}`,
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
      setMessages(prev => [...prev, { id: `error_${Date.now()}`, role: 'assistant', content: `Error: ${error.message}` }]);
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

  const toNumberOr = (value: any, fallback: number = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const toNullableNumber = (value: any) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getEditFormData = (log: LogRecord) => {
    const raw = JSON.parse(JSON.stringify(log.data || {}));

    if (log.intent === 'log_food') {
      return {
        food_name: raw.food_name || '',
        quantity: raw.quantity ?? '',
        unit: raw.unit || '',
        meal_type: raw.meal_type || 'meal',
        calories: raw.calories ?? 0,
        protein: raw.protein ?? 0,
        carbs: raw.carbs ?? 0,
        fat: raw.fat ?? 0
      };
    }

    if (log.intent === 'log_exercise') {
      return {
        exercise_name: raw.exercise_name || '',
        duration_minutes: raw.duration_minutes ?? 0,
        distance: raw.distance ?? 0,
        distance_unit: raw.distance_unit || 'km'
      };
    }

    if (log.intent === 'log_strength_workout') {
      return {
        workout_name: raw.workout_name || '',
        duration_minutes: raw.duration_minutes ?? 0,
        note: raw.note || '',
        exercises: Array.isArray(raw.exercises) ? raw.exercises : []
      };
    }

    if (log.intent === 'log_food_multi') {
      return {
        meal_type: raw.meal_type || 'meal',
        items: Array.isArray(raw.items)
          ? raw.items.map((item: any) => ({
              ...item,
              name: item?.name || '',
              estimated_grams: item?.estimated_grams ?? 0,
              confidence: item?.confidence ?? 1,
              nutrition_estimate: {
                kcal: item?.nutrition_estimate?.kcal ?? 0,
                protein_g: item?.nutrition_estimate?.protein_g ?? 0,
                carb_g: item?.nutrition_estimate?.carb_g ?? 0,
                fat_g: item?.nutrition_estimate?.fat_g ?? 0
              }
            }))
          : [],
        total: {
          kcal: raw?.total?.kcal ?? 0,
          protein_g: raw?.total?.protein_g ?? 0,
          carb_g: raw?.total?.carb_g ?? 0,
          fat_g: raw?.total?.fat_g ?? 0
        },
        needs_user_confirmation: Boolean(raw?.needs_user_confirmation)
      };
    }

    if (log.intent === 'log_measurement') {
      const weightFromArray = Array.isArray(raw.measurements)
        ? raw.measurements.find((item: any) => item.metric === 'weight' || item.type === 'weight')?.value
        : undefined;

      return {
        weight_kg: raw.weight_kg ?? weightFromArray ?? '',
        body_fat_pct: raw.body_fat_pct ?? '',
        waist_cm: raw.waist_cm ?? '',
        chest_cm: raw.chest_cm ?? '',
        hip_cm: raw.hip_cm ?? ''
      };
    }

    return raw;
  };

  const buildPayloadFromForm = (intent: string, formData: any) => {
    if (intent === 'log_food') {
      return {
        food_name: String(formData.food_name || ''),
        quantity: toNumberOr(formData.quantity, 0),
        unit: String(formData.unit || '份'),
        meal_type: String(formData.meal_type || 'meal'),
        calories: toNumberOr(formData.calories, 0),
        protein: toNumberOr(formData.protein, 0),
        carbs: toNumberOr(formData.carbs, 0),
        fat: toNumberOr(formData.fat, 0)
      };
    }

    if (intent === 'log_exercise') {
      return {
        exercise_name: String(formData.exercise_name || ''),
        duration_minutes: toNumberOr(formData.duration_minutes, 0),
        distance: toNumberOr(formData.distance, 0),
        distance_unit: String(formData.distance_unit || 'km')
      };
    }

    if (intent === 'log_strength_workout') {
      return {
        workout_name: String(formData.workout_name || ''),
        duration_minutes: toNumberOr(formData.duration_minutes, 0),
        note: String(formData.note || ''),
        exercises: Array.isArray(formData.exercises) ? formData.exercises : []
      };
    }

    if (intent === 'log_food_multi') {
      return {
        meal_type: String(formData.meal_type || 'meal'),
        items: Array.isArray(formData.items)
          ? formData.items.map((item: any) => ({
              ...item,
              name: String(item?.name || ''),
              estimated_grams: toNumberOr(item?.estimated_grams, 0),
              confidence: toNumberOr(item?.confidence, 1),
              nutrition_estimate: {
                kcal: toNumberOr(item?.nutrition_estimate?.kcal, 0),
                protein_g: toNumberOr(item?.nutrition_estimate?.protein_g, 0),
                carb_g: toNumberOr(item?.nutrition_estimate?.carb_g, 0),
                fat_g: toNumberOr(item?.nutrition_estimate?.fat_g, 0)
              }
            }))
          : [],
        total: {
          kcal: toNumberOr(formData?.total?.kcal, 0),
          protein_g: toNumberOr(formData?.total?.protein_g, 0),
          carb_g: toNumberOr(formData?.total?.carb_g, 0),
          fat_g: toNumberOr(formData?.total?.fat_g, 0)
        },
        needs_user_confirmation: Boolean(formData?.needs_user_confirmation)
      };
    }

    if (intent === 'log_measurement') {
      const weight = toNullableNumber(formData.weight_kg);
      return {
        weight_kg: weight,
        body_fat_pct: toNullableNumber(formData.body_fat_pct),
        waist_cm: toNullableNumber(formData.waist_cm),
        chest_cm: toNullableNumber(formData.chest_cm),
        hip_cm: toNullableNumber(formData.hip_cm),
        measurements: weight !== null
          ? [{ metric: 'weight', value: weight, unit: 'kg' }]
          : []
      };
    }

    return formData;
  };

  const setEditField = (field: string, value: any) => {
    setEditFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const setFoodMultiItemField = (index: number, field: string, value: any) => {
    setEditFormData((prev: any) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      items[index] = { ...(items[index] || {}), [field]: value };
      return { ...prev, items };
    });
  };

  const setFoodMultiItemNutritionField = (index: number, field: string, value: any) => {
    setEditFormData((prev: any) => {
      const items = Array.isArray(prev.items) ? [...prev.items] : [];
      const nextItem = { ...(items[index] || {}) };
      nextItem.nutrition_estimate = {
        ...(nextItem.nutrition_estimate || {}),
        [field]: value
      };
      items[index] = nextItem;
      return { ...prev, items };
    });
  };

  const setFoodMultiTotalField = (field: string, value: any) => {
    setEditFormData((prev: any) => ({
      ...prev,
      total: {
        ...(prev.total || {}),
        [field]: value
      }
    }));
  };

  const openLogEditor = (log: LogRecord) => {
    if (!canManageLog(log.intent)) return;
    setEditingLog(log);
    setEditFormData(getEditFormData(log));
    setEditEntryDate(log.entryDate || '');
    setEditLogError('');
  };

  const closeLogEditor = () => {
    setEditingLog(null);
    setEditFormData({});
    setEditEntryDate('');
    setEditLogError('');
    setIsSavingLogEdit(false);
  };

  const saveLogEdit = async () => {
    if (!editingLog || isSavingLogEdit) return;

    try {
      setIsSavingLogEdit(true);
      setEditLogError('');
      const payloadData = buildPayloadFromForm(editingLog.intent, editFormData);

      const payload: { data: any; entryDate?: string } = { data: payloadData };
      if (editEntryDate.trim()) {
        payload.entryDate = editEntryDate.trim();
      }

      const res = await fetch(`/api/logs/${editingLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: payloadData,
          ...(payload.entryDate ? { entryDate: payload.entryDate } : {})
        })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '更新失败');
      }

      await fetchLogs();
      closeLogEditor();
    } catch (error: any) {
      setEditLogError(error.message || '修改失败，请稍后重试');
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
      case 'log_food_multi': return <Utensils className="w-4 h-4" style={{color:'#F0997B'}} />;
      case 'log_exercise': return <Activity className="w-4 h-4 text-green-500" />;
      case 'log_strength_workout': return <Dumbbell className="w-4 h-4 text-[#1D9E75]" />;
      case 'generate_workout_plan': return <ClipboardList className="w-4 h-4 text-[#7F77DD]" />;
      case 'log_water': return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'log_measurement': return <Scale className="w-4 h-4 text-purple-500" />;
      default: return <ChevronRight className="w-4 h-4 text-gray-400" />;
    }
  };

  const getIntentLabel = (intent?: string) => {
    switch (intent) {
      case 'log_food': return '饮食记录';
      case 'log_food_multi': return '图片识别饮食';
      case 'log_exercise': return '有氧运动';
      case 'log_strength_workout': return '力量训练';
      case 'generate_workout_plan': return '训练计划';
      case 'log_water': return '饮水记录';
      case 'log_measurement': return '身体测量';
      default: return '健康记录';
    }
  };

  const getGoalLabel = (goal?: string) => {
    switch (goal) {
      case 'fat_loss': return '减脂';
      case 'muscle_gain': return '增肌';
      case 'strength': return '增力';
      case 'endurance': return '耐力';
      case 'maintenance': return '维持体型';
      case 'general_fitness': return '综合健身';
      default: return goal || '未设置';
    }
  };

  const getMealLabel = (mealType?: string) => {
    switch (mealType) {
      case 'breakfast': return '早餐';
      case 'lunch': return '午餐';
      case 'dinner': return '晚餐';
      case 'snack': return '加餐';
      case 'meal': return '饮食';
      default: return mealType || '饮食';
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
    <div className="min-h-screen bg-[#EEEDF5] flex items-center justify-center py-8 px-4">
      <div className="bg-white w-full max-w-[390px] h-[844px] rounded-[44px] shadow-2xl relative overflow-hidden flex flex-col border-[8px] border-[#141414]">
        {/* Header */}
        <header className="h-[64px] flex-shrink-0 flex items-center justify-between px-5 bg-white border-b border-[#EAEAEE] z-10 pt-2">
          <div className="flex flex-col min-w-0">
            <h1 className="text-[18px] font-bold text-[#141414] tracking-tight leading-tight">
              {activeTab === 'home' && '今日总览'}
              {activeTab === 'diet' && '饮食记录'}
              {activeTab === 'workout' && '今日训练'}
              {activeTab === 'plan' && '训练计划'}
              {activeTab === 'ai' && 'AI 助手'}
            </h1>
            {activeTab === 'ai' && currentSession && (
              <p className="text-[11px] text-[#141414]/40 mt-0.5 truncate max-w-[180px]">
                {currentSession.title}
              </p>
            )}
          </div>
          {activeTab === 'ai' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  fetchSessions('all');
                  setShowLogs(false);
                  setShowSessionManager(!showSessionManager);
                }}
                className={`p-2 rounded-xl transition-colors ${showSessionManager ? 'bg-[#EEEDFE] text-[#7F77DD]' : 'text-[#141414]/40 hover:bg-[#F5F5F5] hover:text-[#7F77DD]'}`}
                title="对话管理"
              >
                <History className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => {
                  setShowSessionManager(false);
                  setShowLogs(!showLogs);
                }}
                className={`p-2 rounded-xl transition-colors ${showLogs ? 'bg-[#EEEDFE] text-[#7F77DD]' : 'text-[#141414]/40 hover:bg-[#F5F5F5] hover:text-[#7F77DD]'}`}
                title="健康日志"
              >
                <Database className="w-[18px] h-[18px]" />
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F9F9F9]">
          {activeTab === 'ai' ? (
            <>
              {/* Chat Area */}
              <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${(showLogs || showSessionManager) ? 'hidden' : 'flex'}`}>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                    key={msg.id || i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-2.5 shrink-0 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-[#EEEDFE] border border-[#AFA9EC] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#7F77DD]" />
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-[#7F77DD] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`space-y-2 max-w-[78%] ${msg.role === 'user' ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                      {msg.content && (
                        <div className={`px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words ${
                          msg.role === 'user' 
                            ? 'bg-[#7F77DD] text-white rounded-[16px_4px_16px_16px] shadow-sm' 
                            : 'bg-white text-[#1E1A3F] rounded-[4px_16px_16px_16px] border border-[#E0DFF8] shadow-sm'
                        }`}>
                          {msg.content}
                          {msg.base64Image && (
                            <img src={msg.base64Image} alt="user uploaded" className="mt-2 rounded-lg max-h-36 object-cover w-full" />
                          )}
                        </div>
                      )}
                      {!msg.content && msg.base64Image && (
                        <div className="rounded-xl overflow-hidden shadow-sm border border-[#E0DFF8]">
                          <img src={msg.base64Image} alt="user uploaded" className="max-h-40 object-cover" />
                        </div>
                      )}

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
                    <div className="flex gap-2.5 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-[#EEEDFE] border border-[#AFA9EC] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#7F77DD] animate-pulse" />
                  </div>
                  <div className="bg-white border border-[#E0DFF8] px-4 py-3 rounded-[4px_16px_16px_16px] shadow-sm">
                    <div className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 bg-[#AFA9EC] rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-[#AFA9EC] rounded-full animate-bounce [animation-delay:0.15s]" />
                      <span className="w-2 h-2 bg-[#AFA9EC] rounded-full animate-bounce [animation-delay:0.3s]" />
                    </div>
                  </div>
                    </div>
                  )}
                  <div ref={chatEndRef} className="h-2" />
                </div>{/* end chatScrollRef */}

            {/* Input Area */}
            <div className="px-3 py-2.5 border-t border-[#EAEAEE] bg-white flex-shrink-0">
              {selectedImage && (
                <div className="mb-2 flex items-center gap-2 bg-[#F5F5F5] rounded-xl px-3 py-2 border border-[#EAEAEE]">
                  <img src={selectedImage} className="h-10 w-10 object-cover rounded-lg flex-shrink-0" alt="Preview"/>
                  <span className="text-[11px] text-[#141414]/50 flex-1">图片已选择</span>
                  <button onClick={() => setSelectedImage(null)} className="p-1 text-[#141414]/40 hover:text-[#141414] rounded-full hover:bg-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex bg-[#F7F7F9] border border-[#EAEAEE] rounded-[22px] pl-1 pr-3 flex-1 items-center focus-within:border-[#AFA9EC] focus-within:bg-white transition-all">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-[#141414]/35 hover:text-[#7F77DD] transition-colors rounded-full flex-shrink-0"
                  >
                    <Camera className="w-[18px] h-[18px]" />
                  </button>
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="和 AI 聊聊或上传图片记录饮食..."
                    className="w-full bg-transparent py-2.5 text-[13.5px] text-[#141414] focus:outline-none placeholder:text-[#141414]/25"
                  />
                </div>
                <button 
                  onClick={sendMessage}
                  disabled={(!input.trim() && !selectedImage) || isLoading}
                  className="w-10 h-10 shrink-0 bg-[#7F77DD] text-white rounded-full flex items-center justify-center disabled:opacity-40 transition-all shadow-sm hover:bg-[#6B62CC] hover:shadow-md active:scale-95"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>{/* end outer flex-col chat container */}

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
              {/* Stats Header */}
              <div className="bg-gradient-to-br from-[#7F77DD] to-[#534AB7] rounded-2xl p-4 text-white shadow-md">
                <div className="text-[11px] opacity-70 font-medium uppercase tracking-wide mb-1">健康记录总数</div>
                <div className="text-[36px] font-bold leading-none">{logs.length}</div>
                <div className="flex gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[22px] font-semibold">{dietLogs.length}</span>
                    <span className="text-[10px] opacity-65">饮食</span>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="flex flex-col">
                    <span className="text-[22px] font-semibold">{workoutLogs.length}</span>
                    <span className="text-[10px] opacity-65">训练</span>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div className="flex flex-col">
                    <span className="text-[22px] font-semibold">{planLogs.length}</span>
                    <span className="text-[10px] opacity-65">计划</span>
                  </div>
                </div>
              </div>

              {/* Recent Logs */}
              {logs.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#141414]/40 uppercase tracking-wide px-1 mb-2">最近记录</div>
                  <div className="space-y-2">
                    {[...logs].reverse().slice(0, 5).map((log) => (
                      <div key={log.id} className="bg-white rounded-xl p-3.5 border border-[#EAEAEE] shadow-sm flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#F5F4FF] flex items-center justify-center flex-shrink-0">
                          {getIntentIcon(log.intent)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-[#141414] truncate">
                            {log.data?.food_name || log.data?.exercise_name || log.data?.workout_name || getIntentLabel(log.intent)}
                          </div>
                          <div className="text-[11px] text-[#141414]/45 mt-0.5">{getIntentLabel(log.intent)}</div>
                        </div>
                        <span className="text-[10px] text-[#141414]/35 flex-shrink-0">{formatDate(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-[#141414]/25">
                  <Target className="w-12 h-12 mb-3" />
                  <p className="text-[13px] font-medium">暂无记录</p>
                  <p className="text-[11px] mt-1">前往 AI 标签页开始记录</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'diet' && (
            dietLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[#141414]/25 pb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] flex items-center justify-center">
                  <Utensils className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium">暂无饮食记录</p>
                  <p className="text-[11px] mt-1">通过 AI 对话记录每日饮食</p>
                </div>
              </div>
            ) : (
              [...dietLogs].reverse().map((log) => (
                <div key={log.id} className="bg-white rounded-2xl border border-[#EAEAEE] shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F5F7]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FFF0EA] flex items-center justify-center">
                        <Utensils className="w-4 h-4" style={{color:'#F0997B'}} />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#141414]">
                          {log.data?.food_name || (log.intent === 'log_food_multi' ? '图片识别饮食' : '饮食记录')}
                        </div>
                        <div className="text-[10px] text-[#141414]/40">{getMealLabel(log.data?.meal_type)}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#141414]/35">{formatDate(log.timestamp)}</span>
                  </div>

                  {/* Card Body */}
                  <div className="px-4 py-3">
                    {log.intent === 'log_food' && (
                      <>
                        <div className="text-[12px] text-[#141414]/55 mb-2">{log.data?.quantity || '-'} {log.data?.unit || ''}</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label:'热量', value: `${log.data?.calories || 0}`, unit:'kcal', color:'#F0997B', bg:'#FFF0EA' },
                            { label:'蛋白质', value: `${log.data?.protein || 0}`, unit:'g', color:'#1D9E75', bg:'#E1F5EE' },
                            { label:'碳水', value: `${log.data?.carbs || 0}`, unit:'g', color:'#7F77DD', bg:'#EEEDFE' },
                            { label:'脂肪', value: `${log.data?.fat || 0}`, unit:'g', color:'#141414', bg:'#F5F5F5' },
                          ].map(m => (
                            <div key={m.label} className="rounded-xl p-2 text-center" style={{background: m.bg}}>
                              <div className="text-[13px] font-bold" style={{color: m.color}}>{m.value}</div>
                              <div className="text-[9px] text-[#141414]/40 mt-0.5">{m.unit}</div>
                              <div className="text-[9px] font-medium" style={{color: m.color, opacity:0.7}}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {log.intent === 'log_food_multi' && (
                      <>
                        <div className="text-[11px] text-[#141414]/50 mb-2">{(log.data?.items || []).length} 个食物项</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label:'热量', value: `${log.data?.total?.kcal || 0}`, unit:'kcal', color:'#534AB7', bg:'#EEEDFE' },
                            { label:'蛋白质', value: `${log.data?.total?.protein_g || 0}`, unit:'g', color:'#1D9E75', bg:'#E1F5EE' },
                            { label:'碳水', value: `${log.data?.total?.carb_g || 0}`, unit:'g', color:'#7F77DD', bg:'#F0EFFE' },
                            { label:'脂肪', value: `${log.data?.total?.fat_g || 0}`, unit:'g', color:'#141414', bg:'#F5F5F5' },
                          ].map(m => (
                            <div key={m.label} className="rounded-xl p-2 text-center" style={{background: m.bg}}>
                              <div className="text-[13px] font-bold" style={{color: m.color}}>{m.value}</div>
                              <div className="text-[9px] text-[#141414]/40 mt-0.5">{m.unit}</div>
                              <div className="text-[9px] font-medium" style={{color: m.color, opacity:0.7}}>{m.label}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex border-t border-[#F5F5F7]">
                    <button
                      onClick={() => openLogEditor(log)}
                      className="flex-1 py-2.5 text-[12px] font-medium text-[#7F77DD] hover:bg-[#F5F4FF] transition-colors"
                    >
                      修改
                    </button>
                    <div className="w-px bg-[#F5F5F7]" />
                    <button
                      onClick={() => deleteLogRecord(log)}
                      className="flex-1 py-2.5 text-[12px] font-medium text-[#B94747] hover:bg-[#FFF8F8] transition-colors"
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
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[#141414]/25 pb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] flex items-center justify-center">
                  <Dumbbell className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium">暂无训练记录</p>
                  <p className="text-[11px] mt-1">通过 AI 对话记录训练情况</p>
                </div>
              </div>
            ) : (
              [...workoutLogs].reverse().map((log) => (
                <div key={log.id} className="bg-white rounded-2xl border border-[#EAEAEE] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F5F7]">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        log.intent === 'log_strength_workout' ? 'bg-[#E1F5EE]' :
                        log.intent === 'log_measurement' ? 'bg-[#F3F0FF]' : 'bg-[#EAF8F1]'
                      }`}>
                        {getIntentIcon(log.intent)}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#141414]">
                          {log.data?.exercise_name || log.data?.workout_name || getIntentLabel(log.intent)}
                        </div>
                        <div className="text-[10px] text-[#141414]/40">{getIntentLabel(log.intent)}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#141414]/35">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex gap-3">
                      {log.data?.duration_minutes > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[18px] font-bold text-[#1D9E75]">{log.data.duration_minutes}</span>
                          <span className="text-[10px] text-[#141414]/40">分钟</span>
                        </div>
                      )}
                      {log.data?.exercises?.length > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[18px] font-bold text-[#7F77DD]">{log.data.exercises.length}</span>
                          <span className="text-[10px] text-[#141414]/40">个动作</span>
                        </div>
                      )}
                      {log.intent === 'log_measurement' && log.data?.weight_kg && (
                        <div className="flex flex-col">
                          <span className="text-[18px] font-bold text-[#141414]">{log.data.weight_kg}</span>
                          <span className="text-[10px] text-[#141414]/40">kg</span>
                        </div>
                      )}
                    </div>
                    {log.data?.note && (
                      <div className="text-[11px] text-[#141414]/50 mt-2 bg-[#F9F9F9] rounded-lg px-3 py-2">{log.data.note}</div>
                    )}
                  </div>
                  <div className="flex border-t border-[#F5F5F7]">
                    <button
                      onClick={() => openLogEditor(log)}
                      className="flex-1 py-2.5 text-[12px] font-medium text-[#7F77DD] hover:bg-[#F5F4FF] transition-colors"
                    >
                      修改
                    </button>
                    <div className="w-px bg-[#F5F5F7]" />
                    <button
                      onClick={() => deleteLogRecord(log)}
                      className="flex-1 py-2.5 text-[12px] font-medium text-[#B94747] hover:bg-[#FFF8F8] transition-colors"
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
              <div className="h-full flex flex-col items-center justify-center gap-3 text-[#141414]/25 pb-8">
                <div className="w-16 h-16 rounded-2xl bg-[#F5F5F5] flex items-center justify-center">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium">暂无训练计划</p>
                  <p className="text-[11px] mt-1">通过 AI 为你生成个性化计划</p>
                </div>
              </div>
            ) : (
              [...planLogs].reverse().map((log) => (
                <div key={log.id} className="bg-white rounded-2xl border border-[#EAEAEE] shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F5F7]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#EEEDFE] flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-[#7F77DD]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#141414]">个性化训练计划</div>
                        <div className="text-[10px] text-[#141414]/40">{getGoalLabel(log.data?.plan_metadata?.goal_orientation)}</div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[#141414]/35">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="px-4 py-3 flex gap-4">
                    <div className="flex flex-col">
                      <span className="text-[18px] font-bold text-[#7F77DD]">{log.data?.plan_metadata?.total_weeks || 0}</span>
                      <span className="text-[10px] text-[#141414]/40">周周期</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[18px] font-bold text-[#1D9E75]">{(log.data?.weekly_templates || []).length}</span>
                      <span className="text-[10px] text-[#141414]/40">周模板</span>
                    </div>
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

                {editingLog.intent === 'log_food' && (() => {
                  // Auto-calc calories: protein×4 + carbs×4 + fat×9
                  const autoCalories = Math.round(
                    (Number(editFormData.protein) || 0) * 4 +
                    (Number(editFormData.carbs) || 0) * 4 +
                    (Number(editFormData.fat) || 0) * 9
                  );
                  return (
                    <div className="space-y-2">
                      {/* Food name + quantity */}
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editFormData.food_name || ''} onChange={(e) => setEditField('food_name', e.target.value)} placeholder="食物名称" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                        <input value={editFormData.quantity ?? ''} onChange={(e) => setEditField('quantity', e.target.value)} placeholder="数量" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                        <input value={editFormData.unit || ''} onChange={(e) => setEditField('unit', e.target.value)} placeholder="单位" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                        <select value={editFormData.meal_type || 'meal'} onChange={(e) => setEditField('meal_type', e.target.value)} className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] bg-white focus:outline-none focus:border-[#AFA9EC]">
                          <option value="breakfast">早餐</option>
                          <option value="lunch">午餐</option>
                          <option value="dinner">晚餐</option>
                          <option value="snack">加餐</option>
                          <option value="meal">其他</option>
                        </select>
                      </div>

                      {/* Macros grid - editable */}
                      <div>
                        <div className="text-[11px] text-[#141414]/40 mb-1.5 font-medium">三大营养素（修改后热量自动计算）</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-[#1D9E75] font-medium">蛋白质 g</label>
                            <input
                              value={editFormData.protein ?? 0}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditFormData((prev: any) => ({
                                  ...prev,
                                  protein: v,
                                  calories: Math.round((Number(v)||0)*4 + (Number(prev.carbs)||0)*4 + (Number(prev.fat)||0)*9)
                                }));
                              }}
                              type="number" min="0"
                              className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#1D9E75] w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-[#7F77DD] font-medium">碳水 g</label>
                            <input
                              value={editFormData.carbs ?? 0}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditFormData((prev: any) => ({
                                  ...prev,
                                  carbs: v,
                                  calories: Math.round((Number(prev.protein)||0)*4 + (Number(v)||0)*4 + (Number(prev.fat)||0)*9)
                                }));
                              }}
                              type="number" min="0"
                              className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#7F77DD] w-full"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-[#D85A30] font-medium">脂肪 g</label>
                            <input
                              value={editFormData.fat ?? 0}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditFormData((prev: any) => ({
                                  ...prev,
                                  fat: v,
                                  calories: Math.round((Number(prev.protein)||0)*4 + (Number(prev.carbs)||0)*4 + (Number(v)||0)*9)
                                }));
                              }}
                              type="number" min="0"
                              className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#D85A30] w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Calories - read-only, auto-calculated */}
                      <div className="flex items-center gap-2 bg-[#FFF4E8] border border-[#F0997B]/40 rounded-lg px-3 py-2">
                        <span className="text-[11px] text-[#D85A30] font-medium flex-1">热量（自动计算）</span>
                        <span className="text-[15px] font-bold text-[#D85A30]">{autoCalories}</span>
                        <span className="text-[11px] text-[#D85A30]/60">kcal</span>
                      </div>
                      <p className="text-[10px] text-[#141414]/30">公式：蛋白质×4 + 碳水×4 + 脂肪×9</p>
                    </div>
                  );
                })()}

                {editingLog.intent === 'log_exercise' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editFormData.exercise_name || ''} onChange={(e) => setEditField('exercise_name', e.target.value)} placeholder="运动名称" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.duration_minutes ?? 0} onChange={(e) => setEditField('duration_minutes', e.target.value)} placeholder="时长（分钟）" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.distance ?? 0} onChange={(e) => setEditField('distance', e.target.value)} placeholder="距离" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.distance_unit || 'km'} onChange={(e) => setEditField('distance_unit', e.target.value)} placeholder="距离单位" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                  </div>
                )}

                {editingLog.intent === 'log_strength_workout' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editFormData.workout_name || ''} onChange={(e) => setEditField('workout_name', e.target.value)} placeholder="训练名称" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.duration_minutes ?? 0} onChange={(e) => setEditField('duration_minutes', e.target.value)} placeholder="时长（分钟）" type="number" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.note || ''} onChange={(e) => setEditField('note', e.target.value)} placeholder="备注" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                  </div>
                )}

                {editingLog.intent === 'log_measurement' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editFormData.weight_kg ?? ''} onChange={(e) => setEditField('weight_kg', e.target.value)} placeholder="体重 kg" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.body_fat_pct ?? ''} onChange={(e) => setEditField('body_fat_pct', e.target.value)} placeholder="体脂 %" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.waist_cm ?? ''} onChange={(e) => setEditField('waist_cm', e.target.value)} placeholder="腰围 cm" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.chest_cm ?? ''} onChange={(e) => setEditField('chest_cm', e.target.value)} placeholder="胸围 cm" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    <input value={editFormData.hip_cm ?? ''} onChange={(e) => setEditField('hip_cm', e.target.value)} placeholder="臀围 cm" type="number" className="col-span-2 text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                  </div>
                )}

                {editingLog.intent === 'log_food_multi' && (
                  <div className="space-y-3">
                    <select value={editFormData.meal_type || 'meal'} onChange={(e) => setEditField('meal_type', e.target.value)} className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] bg-white focus:outline-none focus:border-[#AFA9EC]">
                      <option value="breakfast">早餐</option>
                      <option value="lunch">午餐</option>
                      <option value="dinner">晚餐</option>
                      <option value="snack">加餐</option>
                      <option value="meal">其他</option>
                    </select>

                    {(Array.isArray(editFormData.items) ? editFormData.items : []).map((item: any, index: number) => (
                      <div key={index} className="border border-[#EFEFEF] rounded-lg p-2 space-y-2">
                        <input value={item.name || ''} onChange={(e) => setFoodMultiItemField(index, 'name', e.target.value)} placeholder="食物名称" className="w-full text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={item.estimated_grams ?? 0} onChange={(e) => setFoodMultiItemField(index, 'estimated_grams', e.target.value)} placeholder="克重" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                          <input value={item.confidence ?? 1} onChange={(e) => setFoodMultiItemField(index, 'confidence', e.target.value)} placeholder="置信度" type="number" step="0.01" min="0" max="1" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                          <input value={item?.nutrition_estimate?.kcal ?? 0} onChange={(e) => setFoodMultiItemNutritionField(index, 'kcal', e.target.value)} placeholder="热量" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                          <input value={item?.nutrition_estimate?.protein_g ?? 0} onChange={(e) => setFoodMultiItemNutritionField(index, 'protein_g', e.target.value)} placeholder="蛋白质" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                          <input value={item?.nutrition_estimate?.carb_g ?? 0} onChange={(e) => setFoodMultiItemNutritionField(index, 'carb_g', e.target.value)} placeholder="碳水" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                          <input value={item?.nutrition_estimate?.fat_g ?? 0} onChange={(e) => setFoodMultiItemNutritionField(index, 'fat_g', e.target.value)} placeholder="脂肪" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-2 gap-2">
                      <input value={editFormData?.total?.kcal ?? 0} onChange={(e) => setFoodMultiTotalField('kcal', e.target.value)} placeholder="总热量" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                      <input value={editFormData?.total?.protein_g ?? 0} onChange={(e) => setFoodMultiTotalField('protein_g', e.target.value)} placeholder="总蛋白质" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                      <input value={editFormData?.total?.carb_g ?? 0} onChange={(e) => setFoodMultiTotalField('carb_g', e.target.value)} placeholder="总碳水" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                      <input value={editFormData?.total?.fat_g ?? 0} onChange={(e) => setFoodMultiTotalField('fat_g', e.target.value)} placeholder="总脂肪" type="number" className="text-[12px] px-2.5 py-2 rounded-lg border border-[#E1E1E1] focus:outline-none focus:border-[#AFA9EC]" />
                    </div>
                  </div>
                )}

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
      <nav className="h-[68px] flex-shrink-0 bg-white/95 backdrop-blur-sm border-t border-[#EAEAEE] flex justify-around items-center px-1 pb-1">
        {([
          { id: 'home', label: '总览', icon: Home },
          { id: 'diet', label: '饮食', icon: Utensils },
          { id: 'workout', label: '训练', icon: Dumbbell },
          { id: 'plan', label: '计划', icon: ClipboardList },
          { id: 'ai', label: 'AI', icon: Sparkles },
        ] as const).map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const isAI = id === 'ai';
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl relative transition-all duration-200 ${
                isActive
                  ? isAI ? 'text-[#7F77DD]' : 'text-[#141414]'
                  : 'text-[#141414]/28 hover:text-[#141414]/55'
              }`}
            >
              {isActive && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full ${
                  isAI ? 'bg-[#7F77DD]' : 'bg-[#141414]'
                }`} />
              )}
              <Icon className={`w-[22px] h-[22px] ${isActive && !isAI ? 'stroke-[2]' : 'stroke-[1.5]'} ${isActive && isAI ? 'stroke-[2]' : ''}`} />
              <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-normal'}`}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  </div>
);
}
