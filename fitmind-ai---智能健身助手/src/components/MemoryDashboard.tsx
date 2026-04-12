import React, { useState, useEffect } from 'react';
import { Brain, History, UserCircle, Activity, TrendingUp, Calendar, PlusCircle } from 'lucide-react';
import { getSemanticMemory } from '../memory/semanticMemoryService';
import { getEpisodicMemories, simulateWorkout } from '../memory/episodicMemoryService';
import type { SemanticMemory, EpisodicMemory, ExerciseStrengthEntry } from '../memory/types';
import { cn } from '../lib/utils';

export default function MemoryDashboard() {
  const [semantic, setSemantic] = useState<SemanticMemory | null>(null);
  const [episodes, setEpisodes] = useState<EpisodicMemory[]>([]);
  const [activeTab, setActiveTab] = useState<'semantic' | 'episodic'>('semantic');

  const refresh = () => {
    setSemantic(getSemanticMemory());
    setEpisodes(getEpisodicMemories());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSimulate = () => {
    simulateWorkout();
    refresh();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex gap-4">
        <button
          onClick={() => setActiveTab('semantic')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'semantic' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Brain className="w-4 h-4" /> 语义记忆
        </button>
        <button
          onClick={() => setActiveTab('episodic')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'episodic' ? 'bg-orange-100 text-orange-700' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <History className="w-4 h-4" /> 情节记忆
        </button>
        
        <button
          onClick={handleSimulate}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-900 text-white hover:bg-black transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" /> 模拟训练
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'semantic' && semantic && (
          <div className="space-y-6">
            {/* User Profile */}
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <UserCircle className="w-3 h-3" /> 用户画像
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">训练目标</p>
                  <div className="flex flex-wrap gap-1">
                    {semantic.userProfile.goals.length > 0 
                      ? semantic.userProfile.goals.map(g => <span key={g} className="text-xs font-medium text-gray-700">#{g}</span>)
                      : <span className="text-xs text-gray-400 italic">未设置</span>
                    }
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 mb-1">偏好风格</p>
                  <p className="text-xs font-medium text-gray-700">{semantic.userProfile.preferredStyle}</p>
                </div>
              </div>
            </section>

            {/* Strength Model */}
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <TrendingUp className="w-3 h-3" /> 力量模型 (1RM)
              </h3>
              <div className="space-y-2">
                {Object.entries(semantic.strengthModel).length > 0 ? (
                  Object.entries(semantic.strengthModel).map(([id, entry]) => {
                    const e = entry as ExerciseStrengthEntry;
                    return (
                      <div key={id} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                        <span className="text-xs font-semibold text-gray-700">{id}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-orange-200 text-orange-700">{e.estimated1RM}kg</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                            e.trend === 'rising' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          )}>
                            {e.trend === 'rising' ? '持续增长' : '平台期'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-gray-400 italic text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    暂无力量数据，开始训练后自动生成
                  </p>
                )}
              </div>
            </section>

            {/* Fatigue Model */}
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                <Activity className="w-3 h-3" /> 疲劳与恢复
              </h3>
              <div className="p-4 bg-gray-900 rounded-2xl text-white">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">平均恢复时间</p>
                    <p className="text-xl font-bold">{semantic.fatigueModel.avgRecoveryDays} <span className="text-xs font-normal opacity-60">天</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">建议每周频次</p>
                    <p className="text-xl font-bold">{semantic.fatigueModel.optimalSessionsPerWeek} <span className="text-xs font-normal opacity-60">次</span></p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'episodic' && (
          <div className="space-y-3">
            {episodes.length > 0 ? (
              episodes.map((e) => (
                <div key={e.id} className="p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                      <Calendar className="w-3 h-3" /> {e.date}
                    </span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                      完成率 {Math.round(e.metrics.completionRate * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed mb-2">{e.summary}</p>
                  <div className="flex flex-wrap gap-1">
                    {e.tags.map(t => (
                      <span key={t} className="text-[9px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100">#{t}</span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                <History className="w-12 h-12 text-gray-200" />
                <p className="text-sm text-gray-400">尚无训练情节记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
