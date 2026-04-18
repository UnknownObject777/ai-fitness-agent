import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Dumbbell, TrendingUp, Zap, Clock, ChevronDown } from 'lucide-react';

interface TrendPoint {
  date: string;
  totalVolume: number;
  workoutCount: number;
  durationMin: number;
  avgRpe: number | null;
  muscleGroups: string[];
}

interface MuscleGroup {
  group: string;
  volume: number;
  sessions: number;
}

interface StrengthPoint {
  date: string;
  exercise: string;
  estimated1RM: number;
  bestSet: { weight: number; reps: number };
}

interface WorkoutSummary {
  totalWorkouts: number;
  totalVolume: number;
  avgWorkoutsPerWeek: number;
  mostTrainedGroup: string;
  totalDurationMin: number;
}

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  category: string;
  title: string;
  message: string;
  priority: number;
}

interface WorkoutData {
  trendPoints: TrendPoint[];
  muscleDistribution: MuscleGroup[];
  strengthProgress: StrengthPoint[];
  summary: WorkoutSummary;
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
];

const MUSCLE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#06b6d4'
];

const InsightBadge = ({ insight }: { insight: Insight }) => {
  const styles = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400', icon: '✅' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', icon: '⚠️' },
    info:    { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  dot: 'bg-blue-400',  icon: 'ℹ️' },
    tip:     { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-400', icon: '💡' },
  };
  const s = styles[insight.type] || styles.info;
  return (
    <div className={`rounded-xl p-3 border ${s.bg} ${s.border} mb-2`}>
      <div className={`text-xs font-semibold ${s.text} mb-0.5`}>{s.icon} {insight.title}</div>
      <div className={`text-[11px] ${s.text} opacity-80 leading-snug`}>{insight.message}</div>
    </div>
  );
};

const StatCard = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
  <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col gap-0.5">
    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
    <span className={`text-xl font-bold ${color} leading-tight`}>{value}</span>
    {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-100 p-2.5 text-xs">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          {p.dataKey === 'totalVolume' ? ' kg' : p.dataKey === 'durationMin' ? ' 分钟' : ''}
        </p>
      ))}
    </div>
  );
};

export default function WorkoutTrendsView() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<WorkoutData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'volume' | 'duration' | 'rpe'>('volume');

  const fetchData = async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/workout-trends?range=${r}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setInsights(json.insights || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(range); }, [range]);

  // Format date for chart axis
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Get top exercises for strength progress
  const topExercises = data
    ? [...new Set(data.strengthProgress.map(p => p.exercise))].slice(0, 3)
    : [];

  const strengthByExercise = (exercise: string) =>
    data?.strengthProgress.filter(p => p.exercise === exercise) || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">加载训练数据...</span>
      </div>
    );
  }

  const summary = data?.summary;
  const trendPoints = data?.trendPoints || [];
  const muscleDistrib = data?.muscleDistribution || [];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Dumbbell className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-bold text-gray-800">训练分析</span>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`workout-range-${opt.value}`}
              onClick={() => setRange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                range === opt.value
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="总训练次数" value={summary.totalWorkouts} sub={`${range}内`} color="text-indigo-600" />
          <StatCard label="每周频率" value={summary.avgWorkoutsPerWeek} sub="次/周" color="text-purple-600" />
          <StatCard
            label="总训练量"
            value={summary.totalVolume > 1000 ? `${(summary.totalVolume / 1000).toFixed(1)}t` : `${summary.totalVolume}kg`}
            sub="组×次×重量"
            color="text-pink-600"
          />
          <StatCard
            label="总训练时长"
            value={`${Math.round(summary.totalDurationMin / 60)}h`}
            sub={`${summary.totalDurationMin} 分钟`}
            color="text-amber-600"
          />
        </div>
      )}

      {/* Chart Type Selector */}
      {trendPoints.length > 0 && (
        <>
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 self-start">
            {[
              { key: 'volume', label: '训练量' },
              { key: 'duration', label: '时长' },
            ].map(opt => (
              <button
                key={opt.key}
                id={`chart-type-${opt.key}`}
                onClick={() => setActiveChart(opt.key as any)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeChart === opt.key
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Volume/Duration Trend Chart */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-gray-700">
                {activeChart === 'volume' ? '训练量趋势 (kg)' : '训练时长趋势 (分钟)'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendPoints} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey={activeChart === 'volume' ? 'totalVolume' : 'durationMin'}
                  name={activeChart === 'volume' ? '训练量' : '时长'}
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Muscle Distribution */}
      {muscleDistrib.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-semibold text-gray-700">肌群训练分布</span>
          </div>
          <div className="flex items-center gap-2">
            <ResponsiveContainer width="55%" height={120}>
              <PieChart>
                <Pie
                  data={muscleDistrib.slice(0, 8)}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={52}
                  dataKey="sessions"
                  paddingAngle={2}
                >
                  {muscleDistrib.slice(0, 8).map((_, idx) => (
                    <Cell key={idx} fill={MUSCLE_COLORS[idx % MUSCLE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} 组`, '训练组']}
                  contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e7eb' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 flex flex-col gap-1">
              {muscleDistrib.slice(0, 6).map((m, idx) => (
                <div key={m.group} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: MUSCLE_COLORS[idx % MUSCLE_COLORS.length] }}
                  />
                  <span className="text-[10px] text-gray-600 flex-1 truncate">{m.group}</span>
                  <span className="text-[10px] font-semibold text-gray-800">{m.sessions}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strength Progress */}
      {topExercises.length > 0 && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-pink-500" />
            <span className="text-xs font-semibold text-gray-700">力量进步曲线（估算1RM）</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <LineChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                type="category"
                allowDuplicatedCategory={false}
                tickFormatter={formatDate}
                tick={{ fontSize: 9, fill: '#9ca3af' }}
              />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} unit="kg" />
              <Tooltip
                contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e7eb' }}
                formatter={(val: any) => [`${val}kg`, '估算1RM']}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              {topExercises.map((ex, i) => (
                <Line
                  key={ex}
                  data={strengthByExercise(ex)}
                  type="monotone"
                  dataKey="estimated1RM"
                  name={ex.length > 6 ? ex.slice(0, 6) + '…' : ex}
                  stroke={MUSCLE_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty State */}
      {trendPoints.length === 0 && muscleDistrib.length === 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 text-center border border-indigo-100">
          <Dumbbell className="w-10 h-10 text-indigo-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-indigo-700 mb-1">暂无训练数据</p>
          <p className="text-[11px] text-indigo-500">去 AI 助手记录你的第一次训练吧！</p>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-700 mb-2 block">🧠 AI 洞察</span>
          {insights.slice(0, 4).map((ins, i) => (
            <InsightBadge key={i} insight={ins} />
          ))}
        </div>
      )}
    </div>
  );
}
