import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Utensils, Flame, Apple, Target } from 'lucide-react';

interface DailyNutrition {
  date: string;
  totalKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  mealCount: number;
}

interface MacroDistribution {
  proteinPct: number;
  carbPct: number;
  fatPct: number;
  avgProteinG: number;
  avgCarbG: number;
  avgFatG: number;
}

interface NutritionSummary {
  avgDailyKcal: number;
  avgProteinG: number;
  daysLogged: number;
  proteinGoalPct: number;
  calorieConsistencyScore: number;
  streakDays: number;
}

interface GoalComparison {
  targetKcal: number;
  avgKcal: number;
  deficitOrSurplus: number;
  targetProteinG: number;
  avgProteinG: number;
  proteinAdequacy: 'adequate' | 'low' | 'high';
}

interface NutritionData {
  dailyData: DailyNutrition[];
  macroDistribution: MacroDistribution;
  summary: NutritionSummary;
  goalComparison: GoalComparison;
}

interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  category: string;
  title: string;
  message: string;
  priority: number;
}

const RANGE_OPTIONS = [
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
];

const MACRO_COLORS = { protein: '#6366f1', carb: '#f59e0b', fat: '#ec4899' };
const PIE_COLORS = ['#6366f1', '#f59e0b', '#ec4899'];

const InsightBadge = ({ insight }: { insight: Insight }) => {
  const styles = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '✅' },
    warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   icon: '⚠️' },
    info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    icon: 'ℹ️' },
    tip:     { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  icon: '💡' },
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
          {p.name}: {typeof p.value === 'number' ? Math.round(p.value) : p.value}
          {p.dataKey === 'totalKcal' ? ' kcal' : 'g'}
        </p>
      ))}
    </div>
  );
};

// Radial progress ring
const RingProgress = ({ pct, color, size = 72, stroke = 7 }: { pct: number; color: string; size?: number; stroke?: number }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

export default function DietAnalysisView() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<NutritionData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'kcal' | 'macros'>('kcal');

  const fetchData = async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/nutrition?range=${r}`);
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">加载饮食数据...</span>
      </div>
    );
  }

  const summary = data?.summary;
  const dailyData = data?.dailyData || [];
  const macro = data?.macroDistribution;
  const goal = data?.goalComparison;

  const macroPieData = macro ? [
    { name: '蛋白质', value: macro.proteinPct },
    { name: '碳水',   value: macro.carbPct },
    { name: '脂肪',   value: macro.fatPct },
  ] : [];

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Header + Range */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Utensils className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-bold text-gray-800">饮食分析</span>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`diet-range-${opt.value}`}
              onClick={() => setRange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                range === opt.value
                  ? 'bg-white text-orange-500 shadow-sm'
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
          <StatCard label="日均热量" value={`${summary.avgDailyKcal}`} sub="kcal / 天" color="text-orange-500" />
          <StatCard label="日均蛋白质" value={`${summary.avgProteinG}g`} sub={`目标 ${goal?.targetProteinG}g`} color="text-indigo-600" />
          <StatCard label="记录天数" value={summary.daysLogged} sub={`${range}内`} color="text-emerald-600" />
          <StatCard label="连续打卡" value={`${summary.streakDays}天`} sub="持续记录" color="text-purple-600" />
        </div>
      )}

      {/* Goal Progress Rings */}
      {goal && summary && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-1.5 mb-3">
            <Target className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-gray-700">目标达成率</span>
          </div>
          <div className="flex gap-4 justify-around">
            {/* Calorie ring */}
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <RingProgress
                  pct={goal.targetKcal > 0 ? Math.round((goal.avgKcal / goal.targetKcal) * 100) : 0}
                  color="#f97316"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-700">
                    {goal.targetKcal > 0 ? Math.round((goal.avgKcal / goal.targetKcal) * 100) : 0}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 text-center">热量<br/>({goal.targetKcal}目标)</span>
            </div>
            {/* Protein ring */}
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <RingProgress pct={summary.proteinGoalPct} color="#6366f1" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-700">{summary.proteinGoalPct}%</span>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 text-center">蛋白质<br/>({goal.targetProteinG}g目标)</span>
            </div>
            {/* Consistency ring */}
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <RingProgress pct={summary.calorieConsistencyScore} color="#10b981" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-gray-700">{summary.calorieConsistencyScore}</span>
                </div>
              </div>
              <span className="text-[10px] text-gray-500 text-center">饮食<br/>规律度</span>
            </div>
          </div>
        </div>
      )}

      {/* Chart selector */}
      {dailyData.length > 0 && (
        <>
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 self-start">
            {[
              { key: 'kcal', label: '热量趋势' },
              { key: 'macros', label: '营养素' },
            ].map(opt => (
              <button
                key={opt.key}
                id={`diet-chart-${opt.key}`}
                onClick={() => setActiveChart(opt.key as any)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeChart === opt.key
                    ? 'bg-white text-orange-500 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            {activeChart === 'kcal' ? (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-gray-700">每日热量摄入 (kcal)</span>
                  {goal && (
                    <span className="ml-auto text-[10px] text-gray-400">目标 {goal.targetKcal} kcal</span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kcalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                    <Tooltip content={<CustomTooltip />} />
                    {goal && (
                      <Area type="monotone" dataKey={() => goal.targetKcal} name="目标" stroke="#e5e7eb" fill="none" strokeDasharray="4 4" dot={false} />
                    )}
                    <Area type="monotone" dataKey="totalKcal" name="热量" stroke="#f97316" fill="url(#kcalGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Apple className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-xs font-semibold text-gray-700">每日三大营养素 (g)</span>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 9, fill: '#9ca3af' }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="proteinG" name="蛋白质" fill={MACRO_COLORS.protein} stackId="a" radius={[0,0,0,0]} />
                    <Bar dataKey="carbG"    name="碳水"   fill={MACRO_COLORS.carb}    stackId="a" />
                    <Bar dataKey="fatG"     name="脂肪"   fill={MACRO_COLORS.fat}     stackId="a" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </>
      )}

      {/* Macro Pie */}
      {macroPieData.length > 0 && macro && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <span className="text-xs font-semibold text-gray-700 block mb-2">平均宏量营养素比例</span>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width="45%" height={100}>
              <PieChart>
                <Pie data={macroPieData} cx="50%" cy="50%" innerRadius={28} outerRadius={46} dataKey="value" paddingAngle={3}>
                  {macroPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {[
                { label: '蛋白质', pct: macro.proteinPct, avg: macro.avgProteinG, color: MACRO_COLORS.protein },
                { label: '碳水',   pct: macro.carbPct,    avg: macro.avgCarbG,    color: MACRO_COLORS.carb },
                { label: '脂肪',   pct: macro.fatPct,     avg: macro.avgFatG,     color: MACRO_COLORS.fat },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-600">{m.label}</span>
                    <span className="text-[10px] font-semibold text-gray-800">{m.avg}g · {m.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.pct}%`, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {dailyData.length === 0 && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 text-center border border-orange-100">
          <Utensils className="w-10 h-10 text-orange-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-orange-700 mb-1">暂无饮食记录</p>
          <p className="text-[11px] text-orange-500">去 AI 助手记录你的饮食，开始追踪营养摄入！</p>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <span className="text-xs font-bold text-gray-700 mb-2 block">🧠 AI 营养洞察</span>
          {insights.slice(0, 4).map((ins, i) => (
            <InsightBadge key={i} insight={ins} />
          ))}
        </div>
      )}
    </div>
  );
}
