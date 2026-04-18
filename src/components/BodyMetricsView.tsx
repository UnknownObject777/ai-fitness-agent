import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Scale, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface BodyMetricPoint {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  waist_cm: number | null;
  bmi: number | null;
}

const RANGE_OPTIONS = [
  { value: '30d',  label: '30天' },
  { value: '90d',  label: '90天' },
  { value: '180d', label: '180天' },
];

const BMI_CATEGORIES = [
  { max: 18.5, label: '偏瘦', color: '#60a5fa' },
  { max: 24.0, label: '正常', color: '#34d399' },
  { max: 28.0, label: '偏重', color: '#fbbf24' },
  { max: 999,  label: '肥胖', color: '#f87171' },
];

function getBmiCategory(bmi: number | null) {
  if (!bmi) return null;
  return BMI_CATEGORIES.find(c => bmi < c.max) || BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-100 p-2.5 text-xs">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          {p.dataKey === 'weight_kg' ? ' kg' : p.dataKey === 'body_fat_pct' ? '%' : p.dataKey === 'waist_cm' ? ' cm' : ''}
        </p>
      ))}
    </div>
  );
};

const StatCard = ({
  label, value, sub, color, trend
}: {
  label: string; value: string; sub?: string; color: string; trend?: 'up' | 'down' | 'flat';
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'down' ? 'text-emerald-500' : trend === 'up' ? 'text-red-400' : 'text-gray-400';
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <div className="flex items-end gap-1.5">
        <span className={`text-xl font-bold ${color} leading-tight`}>{value}</span>
        {trend && <TrendIcon className={`w-3.5 h-3.5 mb-0.5 ${trendColor}`} />}
      </div>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
};

export default function BodyMetricsView() {
  const [range, setRange] = useState('90d');
  const [data, setData] = useState<BodyMetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState<'weight' | 'fat' | 'waist'>('weight');

  const fetchData = async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analysis/body-metrics?range=${r}`);
      const json = await res.json();
      if (json.success) setData(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(range); }, [range]);

  // Filter only points that have the active metric
  const chartData = data.filter(d => {
    if (activeMetric === 'weight') return d.weight_kg !== null;
    if (activeMetric === 'fat')    return d.body_fat_pct !== null;
    if (activeMetric === 'waist')  return d.waist_cm !== null;
    return false;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Summary stats
  const weights   = data.map(d => d.weight_kg).filter(v => v !== null) as number[];
  const fats      = data.map(d => d.body_fat_pct).filter(v => v !== null) as number[];
  const bmis      = data.map(d => d.bmi).filter(v => v !== null) as number[];

  const latestWeight = weights.at(-1);
  const firstWeight  = weights[0];
  const weightChange = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null;

  const latestFat    = fats.at(-1);
  const latestBmi    = bmis.at(-1);
  const bmiCategory  = getBmiCategory(latestBmi ?? null);

  const metricOptions = [
    { key: 'weight', label: '体重',   color: '#6366f1', dataKey: 'weight_kg',    unit: 'kg',  stroke: '#6366f1' },
    { key: 'fat',    label: '体脂率', color: '#ec4899', dataKey: 'body_fat_pct', unit: '%',   stroke: '#ec4899' },
    { key: 'waist',  label: '腰围',   color: '#f59e0b', dataKey: 'waist_cm',     unit: 'cm',  stroke: '#f59e0b' },
  ];
  const activeOpt = metricOptions.find(o => o.key === activeMetric)!;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400">加载身体数据...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-bold text-gray-800">身体指标</span>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              id={`body-range-${opt.value}`}
              onClick={() => setRange(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                range === opt.value
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="当前体重"
          value={latestWeight != null ? `${latestWeight.toFixed(1)} kg` : '—'}
          sub={weightChange != null ? (weightChange < 0 ? `较首次 ${weightChange.toFixed(1)} kg` : `较首次 +${weightChange.toFixed(1)} kg`) : `${range}内`}
          color="text-indigo-600"
          trend={weightChange == null ? undefined : weightChange < -0.2 ? 'down' : weightChange > 0.2 ? 'up' : 'flat'}
        />
        <StatCard
          label="当前体脂"
          value={latestFat != null ? `${latestFat.toFixed(1)}%` : '—'}
          sub={latestFat != null ? (latestFat < 15 ? '运动员体型' : latestFat < 20 ? '健身体型' : latestFat < 25 ? '普通体型' : '需要减脂') : '暂无记录'}
          color="text-pink-600"
        />
        <StatCard
          label="BMI"
          value={latestBmi != null ? latestBmi.toFixed(1) : '—'}
          sub={bmiCategory?.label || '暂无记录'}
          color={bmiCategory ? `text-[${bmiCategory.color}]` : 'text-gray-600'}
        />
        <StatCard
          label="记录次数"
          value={data.length.toString()}
          sub={`${range}内测量`}
          color="text-emerald-600"
        />
      </div>

      {/* BMI Category Bar */}
      {latestBmi && (
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">BMI 指数</span>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${bmiCategory?.color}20`, color: bmiCategory?.color }}
            >
              {bmiCategory?.label} · {latestBmi.toFixed(1)}
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex">
            {BMI_CATEGORIES.map((cat, i) => {
              const widths = ['20%', '40%', '25%', '15%'];
              return (
                <div
                  key={i}
                  style={{ width: widths[i], background: cat.color, opacity: bmiCategory?.label === cat.label ? 1 : 0.25 }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {BMI_CATEGORIES.map(cat => (
              <span key={cat.label} className="text-[9px] text-gray-400">{cat.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* Metric selector + Chart */}
      {data.length > 0 && (
        <>
          <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 self-start">
            {metricOptions.map(opt => (
              <button
                key={opt.key}
                id={`body-metric-${opt.key}`}
                onClick={() => setActiveMetric(opt.key as any)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  activeMetric === opt.key
                    ? 'bg-white shadow-sm'
                    : 'text-gray-500'
                }`}
                style={activeMetric === opt.key ? { color: opt.color } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-1.5 mb-2">
              <Scale className="w-3.5 h-3.5" style={{ color: activeOpt.stroke }} />
              <span className="text-xs font-semibold text-gray-700">
                {activeOpt.label}趋势 ({activeOpt.unit})
              </span>
            </div>
            {chartData.length >= 2 ? (
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={activeOpt.stroke} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={activeOpt.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    domain={['auto', 'auto']}
                    unit={activeOpt.unit}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={activeOpt.dataKey}
                    name={activeOpt.label}
                    stroke={activeOpt.stroke}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: activeOpt.stroke, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : chartData.length === 1 ? (
              <div className="flex items-center justify-center h-24 text-xs text-gray-400">
                仅有 1 条记录，至少需要 2 条才能显示趋势图
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-xs text-gray-400">
                此指标暂无记录
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {data.length === 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 text-center border border-purple-100">
          <Scale className="w-10 h-10 text-purple-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-purple-700 mb-1">暂无身体数据</p>
          <p className="text-[11px] text-purple-500">
            告诉 AI 助手你的体重、体脂率等，开始追踪身体变化吧！
          </p>
        </div>
      )}

      {/* Milestone hints */}
      {weightChange != null && weightChange < -2 && (
        <div className="bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl p-3 text-white text-center shadow-md">
          <div className="text-lg mb-0.5">🎉</div>
          <div className="text-sm font-bold">体重下降里程碑！</div>
          <div className="text-[11px] opacity-90">
            本周期内共减轻 {Math.abs(weightChange).toFixed(1)} kg，继续保持！
          </div>
        </div>
      )}
    </div>
  );
}
