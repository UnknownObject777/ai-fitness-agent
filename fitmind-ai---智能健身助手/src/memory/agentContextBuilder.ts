import { getSemanticMemory } from './semanticMemoryService';
import { getRecentEpisodes, searchSimilarEpisodes } from './episodicMemoryService';
import { useWorkingMemory } from './workingMemoryStore';
import type { AgentContext, SemanticMemory } from './types';

export async function buildAgentContext(userMessage: string): Promise<AgentContext> {
  const workingMemory = useWorkingMemory.getState();
  const semanticMemory = getSemanticMemory();
  
  const relevantEpisodes = searchSimilarEpisodes(userMessage, 3);
  const recentEpisodes = getRecentEpisodes(7);

  return { semanticMemory, relevantEpisodes, recentEpisodes, workingMemory, userMessage };
}

export function formatContextAsSystemPrompt(ctx: AgentContext): string {
  return `
你是用户专属的健身 AI 教练。以下是你对这位用户的记忆，请结合这些信息给出个性化建议。

## 用户长期画像
- 训练目标：${ctx.semanticMemory.userProfile.goals.join('、') || '未设置'}
- 已知弱点：${ctx.semanticMemory.userProfile.weakPoints.join('、') || '无'}
- 偏好风格：${ctx.semanticMemory.userProfile.preferredStyle}
- 坚持规律：${ctx.semanticMemory.userProfile.motivationPattern}
- 受伤历史：${ctx.semanticMemory.userProfile.injuryHistory.join('、') || '无'}

## 近期力量状态（关键动作）
${formatStrengthModel(ctx.semanticMemory)}

## 疲劳 & 恢复模型
- 平均恢复天数：${ctx.semanticMemory.fatigueModel.avgRecoveryDays} 天
- 最优每周训练次数：${ctx.semanticMemory.fatigueModel.optimalSessionsPerWeek}
${ctx.semanticMemory.fatigueModel.highFatigueSignals.length > 0 ? `- 当前疲劳信号：${ctx.semanticMemory.fatigueModel.highFatigueSignals.join('；')}` : ''}

## 相关历史训练（语义检索）
${ctx.relevantEpisodes.map((e) => `- ${e.date}：${e.summary}`).join('\n') || '无'}

## 最近7天训练摘要
${ctx.recentEpisodes.map((e) => `- ${e.date}（完成率 ${Math.round(e.metrics.completionRate * 100)}%，RPE ${e.metrics.avgRPE.toFixed(1)}）：${e.summary}`).join('\n') || '暂无记录'}

## 当前会话状态
${ctx.workingMemory.sessionId ? `- 正在训练中，当前动作索引：${ctx.workingMemory.activeExerciseIndex}，第 ${ctx.workingMemory.currentSetNumber} 组` : '- 未在进行训练'}

请根据以上记忆，回答用户的问题。保持专业、鼓励且简洁。
`.trim();
}

function formatStrengthModel(memory: SemanticMemory): string {
  const entries = Object.entries(memory.strengthModel).slice(0, 5);
  if (entries.length === 0) return '暂无力量数据';
  return entries
    .map(([id, e]) => `- ${id}：预估1RM ${e.estimated1RM}kg，趋势 ${e.trend}${e.plateauWeeks > 0 ? `（停滞 ${e.plateauWeeks} 周）` : ''}`)
    .join('\n');
}
