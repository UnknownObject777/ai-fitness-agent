import type { WorkoutTrendsResult } from './trainingAnalytics.js';
import type { NutritionAnalysisResult } from './nutritionService.js';

export interface Insight {
  type: 'success' | 'warning' | 'info' | 'tip';
  category: 'workout' | 'nutrition' | 'body' | 'general';
  title: string;
  message: string;
  priority: number; // 1 = highest
}

export function generateWorkoutInsights(data: WorkoutTrendsResult): Insight[] {
  const insights: Insight[] = [];
  const { summary, muscleDistribution, trendPoints, strengthProgress } = data;

  // Workout frequency
  if (summary.totalWorkouts === 0) {
    insights.push({
      type: 'warning',
      category: 'workout',
      title: '暂无训练记录',
      message: '本周期内没有找到训练记录，快去开始你的第一次训练吧！',
      priority: 1
    });
    return insights;
  }

  if (summary.avgWorkoutsPerWeek < 2) {
    insights.push({
      type: 'warning',
      category: 'workout',
      title: '训练频率偏低',
      message: `平均每周训练 ${summary.avgWorkoutsPerWeek} 次，建议增加到每周 3-4 次以获得最佳效果。`,
      priority: 1
    });
  } else if (summary.avgWorkoutsPerWeek >= 4) {
    insights.push({
      type: 'success',
      category: 'workout',
      title: '训练频率优秀',
      message: `平均每周训练 ${summary.avgWorkoutsPerWeek} 次，训练积极性非常高！`,
      priority: 3
    });
  }

  // Volume trend: compare last week vs week before
  if (trendPoints.length >= 14) {
    const half = Math.floor(trendPoints.length / 2);
    const firstHalf = trendPoints.slice(0, half);
    const secondHalf = trendPoints.slice(half);
    const vol1 = firstHalf.reduce((s, p) => s + p.totalVolume, 0);
    const vol2 = secondHalf.reduce((s, p) => s + p.totalVolume, 0);
    if (vol2 > vol1 * 1.1) {
      insights.push({
        type: 'success',
        category: 'workout',
        title: '训练量持续提升',
        message: `近期训练量比前期增加了 ${Math.round(((vol2 - vol1) / Math.max(vol1, 1)) * 100)}%，进步明显！`,
        priority: 2
      });
    } else if (vol2 < vol1 * 0.8) {
      insights.push({
        type: 'warning',
        category: 'workout',
        title: '训练量有所下降',
        message: '近期训练量下降较明显，注意保持训练连贯性。',
        priority: 2
      });
    }
  }

  // Muscle imbalance
  if (muscleDistribution.length >= 2) {
    const chest = muscleDistribution.find(m => m.group === '胸部');
    const back = muscleDistribution.find(m => m.group === '背部');
    if (chest && back) {
      const ratio = chest.volume / Math.max(back.volume, 1);
      if (ratio > 1.5) {
        insights.push({
          type: 'warning',
          category: 'workout',
          title: '前后链肌肉不平衡',
          message: `胸部训练量是背部的 ${ratio.toFixed(1)} 倍，建议增加背部训练以维持肌肉平衡。`,
          priority: 1
        });
      }
    }

    const legs = muscleDistribution.find(m => m.group === '腿部');
    const upperTotal = muscleDistribution
      .filter(m => ['胸部', '背部', '肩部', '手臂'].includes(m.group))
      .reduce((s, m) => s + m.volume, 0);
    if (legs && upperTotal > 0 && legs.volume / upperTotal < 0.2) {
      insights.push({
        type: 'tip',
        category: 'workout',
        title: '腿部训练比例偏低',
        message: '腿部是人体最大的肌群，建议增加深蹲等下肢动作的比例。',
        priority: 2
      });
    }
  }

  // Strength progress
  if (strengthProgress.length > 0) {
    // Find exercises with most improvement
    const exerciseMap = new Map<string, number[]>();
    for (const p of strengthProgress) {
      if (!exerciseMap.has(p.exercise)) exerciseMap.set(p.exercise, []);
      exerciseMap.get(p.exercise)!.push(p.estimated1RM);
    }
    for (const [exercise, oneRMs] of exerciseMap.entries()) {
      if (oneRMs.length >= 2) {
        const first = oneRMs[0];
        const last = oneRMs[oneRMs.length - 1];
        const pct = Math.round(((last - first) / first) * 100);
        if (pct >= 5) {
          insights.push({
            type: 'success',
            category: 'workout',
            title: `${exercise} 实力提升`,
            message: `${exercise} 估算 1RM 从 ${first}kg 提升到 ${last}kg，涨幅 ${pct}%！`,
            priority: 2
          });
          break; // Only report top exercise
        }
      }
    }
  }

  // Duration insight
  if (summary.totalDurationMin > 0 && summary.totalWorkouts > 0) {
    const avgDuration = Math.round(summary.totalDurationMin / summary.totalWorkouts);
    if (avgDuration < 30) {
      insights.push({
        type: 'tip',
        category: 'workout',
        title: '训练时长偏短',
        message: `平均训练时长 ${avgDuration} 分钟，建议每次训练保持 45-75 分钟以获得足够刺激。`,
        priority: 3
      });
    } else if (avgDuration > 90) {
      insights.push({
        type: 'tip',
        category: 'workout',
        title: '训练时长较长',
        message: `平均训练 ${avgDuration} 分钟，过长的训练可能增加皮质醇分泌，建议控制在 90 分钟内。`,
        priority: 3
      });
    }
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

export function generateNutritionInsights(data: NutritionAnalysisResult): Insight[] {
  const insights: Insight[] = [];
  const { summary, goalComparison, macroDistribution } = data;

  if (summary.daysLogged === 0) {
    insights.push({
      type: 'info',
      category: 'nutrition',
      title: '暂无饮食记录',
      message: '还没有找到饮食记录，开始记录每日饮食可以帮助你更好地达成目标！',
      priority: 1
    });
    return insights;
  }

  // Calorie adequacy
  const kcalGap = goalComparison.deficitOrSurplus;
  if (Math.abs(kcalGap) < 100) {
    insights.push({
      type: 'success',
      category: 'nutrition',
      title: '热量摄入精准',
      message: `日均摄入 ${summary.avgDailyKcal} kcal，与目标相差不到 100kcal，饮食控制非常好！`,
      priority: 2
    });
  } else if (kcalGap < -300) {
    insights.push({
      type: 'warning',
      category: 'nutrition',
      title: '热量缺口过大',
      message: `日均比目标少摄入 ${Math.abs(kcalGap)} kcal，过度节食可能导致肌肉流失，建议适当增加进食。`,
      priority: 1
    });
  } else if (kcalGap > 300) {
    insights.push({
      type: 'warning',
      category: 'nutrition',
      title: '热量摄入略高',
      message: `日均比目标多摄入 ${kcalGap} kcal，注意控制总热量避免多余脂肪积累。`,
      priority: 2
    });
  }

  // Protein intake
  if (goalComparison.proteinAdequacy === 'low') {
    insights.push({
      type: 'warning',
      category: 'nutrition',
      title: '蛋白质摄入不足',
      message: `日均蛋白质摄入 ${summary.avgProteinG}g，只达到目标 ${goalComparison.targetProteinG}g 的 ${summary.proteinGoalPct}%。建议增加鸡胸肉、鸡蛋、豆类等高蛋白食物。`,
      priority: 1
    });
  } else if (goalComparison.proteinAdequacy === 'adequate') {
    insights.push({
      type: 'success',
      category: 'nutrition',
      title: '蛋白质摄入充足',
      message: `日均蛋白质 ${summary.avgProteinG}g，达到目标的 ${summary.proteinGoalPct}%，非常棒！`,
      priority: 3
    });
  }

  // Macro balance
  if (macroDistribution.carbPct > 60) {
    insights.push({
      type: 'tip',
      category: 'nutrition',
      title: '碳水比例偏高',
      message: `碳水化合物占总热量的 ${macroDistribution.carbPct}%，适当降低碳水比例有助于更好的体脂管理。`,
      priority: 2
    });
  }
  if (macroDistribution.fatPct > 40) {
    insights.push({
      type: 'tip',
      category: 'nutrition',
      title: '脂肪比例偏高',
      message: `脂肪占总热量的 ${macroDistribution.fatPct}%，建议优先摄入不饱和脂肪，控制饱和脂肪摄入。`,
      priority: 2
    });
  }

  // Consistency
  if (summary.calorieConsistencyScore >= 80) {
    insights.push({
      type: 'success',
      category: 'nutrition',
      title: '饮食规律性优秀',
      message: `饮食一致性评分 ${summary.calorieConsistencyScore}/100，规律的饮食有助于代谢稳定。`,
      priority: 3
    });
  } else if (summary.calorieConsistencyScore < 50 && summary.daysLogged >= 5) {
    insights.push({
      type: 'tip',
      category: 'nutrition',
      title: '饮食波动较大',
      message: '每天热量摄入差异较大，尝试保持更规律的饮食习惯可以更好地管理体重。',
      priority: 2
    });
  }

  // Streak
  if (summary.streakDays >= 7) {
    insights.push({
      type: 'success',
      category: 'nutrition',
      title: `连续打卡 ${summary.streakDays} 天！`,
      message: '坚持记录饮食是成功的关键，你做得很棒！',
      priority: 4
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}

export function generateCombinedInsights(
  workoutData: WorkoutTrendsResult,
  nutritionData: NutritionAnalysisResult
): Insight[] {
  const workoutInsights = generateWorkoutInsights(workoutData);
  const nutritionInsights = generateNutritionInsights(nutritionData);
  return [...workoutInsights, ...nutritionInsights].sort((a, b) => a.priority - b.priority);
}
