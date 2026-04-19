# Sparky AI Fitness Agent - LLM能力文档

## 一、系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Agent 架构                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  意图识别    │  │  记忆系统    │  │  数据分析    │             │
│  │  (7种意图)  │  │ (三层架构)   │  │  (洞察生成)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         └─────────────────┼─────────────────┘                    │
│                           ▼                                      │
│              ┌─────────────────────────┐                         │
│              │     OpenAI/Gemini API   │                         │
│              │   (gpt-4o-mini /        │                         │
│              │    gemini-2.5-flash)      │                         │
│              └─────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、意图系统（Intent System）

### 2.1 支持的意图列表

| 意图 | 类型 | 描述 | 触发条件 |
|------|------|------|----------|
| `generate_workout_plan` | 计划生成 | 创建训练计划 | "给我做计划/安排周期/一周怎么练" |
| `update_workout_plan` | 计划更新 | 调整现有计划 | "调整计划/根据当前状态变化" |
| `log_strength_workout` | 训练记录 | 力量训练 | "我今天做了什么训练"（力量） |
| `log_exercise` | 训练记录 | 有氧运动 | "我今天做了什么训练"（有氧） |
| `log_food` | 饮食记录 | 文本记录饮食 | "我吃了什么" |
| `log_food_multi` | 饮食记录 | 图片识别饮食 | 发送食物图片（自动触发） |
| `chat` | 闲聊 | 普通对话 | 不涉及以上特定意图 |

### 2.2 意图数据结构

#### `generate_workout_plan`

```typescript
{
  intent: "generate_workout_plan",
  response: "AI的回复文本",
  data: {
    plan_metadata: {
      goal_orientation: "fat_loss" | "muscle_gain" | "performance" | "general_fitness",
      total_weeks: number,
      start_phase: "基础适应" | "容量构建" | "强化阶段",
      rationale: "简要原因"
    },
    weekly_templates: [
      {
        week_number: number,
        sessions: [
          {
            session_id: "A",
            focus: "训练重点",
            exercises: [
              {
                name: "动作名",
                sets: number,
                reps: number,
                rpe: number,  // 主观强度 1-10
                notes: "要点"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

#### `log_strength_workout`

```typescript
{
  intent: "log_strength_workout",
  response: "AI的回复文本",
  data: {
    workout_name: "训练名",
    duration_minutes: number,
    exercises: [
      {
        name: "动作名",
        muscle_groups: {
          primary: ["主要肌肉群"],
          secondary: ["次要肌肉群"]
        },
        sets: [
          {
            weight: number,
            reps: number,
            rpe: number,  // 1-10
            failure: boolean
          }
        ]
      }
    ],
    training_volume: {
      total_sets: number,
      total_reps: number,
      total_volume_load: number,  // 重量×次数
      muscle_group_distribution: {
        "胸部": { sets: number, volume_load: number },
        "三头肌": { sets: number, volume_load: number }
      }
    }
  }
}
```

#### `log_food_multi`（图片识别）

```typescript
{
  intent: "log_food_multi",
  response: "我已经识别了图片中的食物。请确认估算是否准确。",
  meal_type: "lunch",  // breakfast/lunch/dinner/snack
  items: [
    {
      name: "食物名称",
      estimated_grams: 150,
      confidence: 0.85,  // 0.0-1.0
      nutrition_estimate: {
        kcal: 248,
        protein_g: 46.5,
        carb_g: 0,
        fat_g: 5.4
      },
      candidate_foods: [
        { source_id: "usda:12345", name: "可能的原食材名称" }
      ]
    }
  ],
  total: {
    kcal: 520,
    protein_g: 50,
    carb_g: 35,
    fat_g: 18
  },
  needs_user_confirmation: true  // confidence < 0.75 时为 true
}
```

---

## 三、记忆系统（Memory System）

### 3.1 三层记忆架构

```
┌─────────────────────────────────────────────────────────────┐
│                     AgentContext                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐                                       │
│  │  Semantic Memory │  长期记忆 - 用户画像                    │
│  │  (语义记忆)       │  • 训练目标 (goals)                   │
│  │                  │  • 弱点 (weakPoints)                   │
│  │                  │  • 受伤历史 (injuryHistory)            │
│  │                  │  • 偏好风格 (preferredStyle)            │
│  │                  │  • 每周训练统计 (weeklyTrainingStats)    │
│  └──────────────────┘                                       │
│  ┌──────────────────┐                                       │
│  │ Episodic Memory  │  短期记忆 - 最近活动                    │
│  │ (情景记忆)        │  • 最近10条记录                        │
│  │                  │  • 饮食、训练、计划等                     │
│  └──────────────────┘                                       │
│  ┌──────────────────┐                                       │
│  │ Working Memory   │  工作记忆 - 当前会话                    │
│  │ (工作记忆)        │  • sessionId                           │
│  │                  │  • 最近5条用户消息                       │
│  │                  │  • activeExerciseIndex                 │
│  │                  │  • currentSetNumber                    │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 记忆更新机制

```typescript
// 从AI响应中自动提取用户画像更新
if (aiResponse.profile_update) {
  await updateSemanticMemory(aiResponse.profile_update);
}

// 增量更新规则
- goals: 合并新目标（去重）
- weakPoints: 合并新弱点（去重）
- injuryHistory: 合并新伤病（去重）
- preferredStyle: 直接覆盖
```

### 3.3 记忆上下文注入

每次调用AI时，记忆会被格式化为系统提示词的一部分：

```markdown
## 你对用户的记忆 (Long-term & Short-term Memory)

### 用户画像 (Semantic Memory)
- 训练目标：减脂、增肌
- 已知弱点：肩部稳定性不足
- 偏好风格：力量训练为主
- 受伤历史：左膝半月板损伤

### 最近活动记录 (Episodic Memory)
- [2026-04-19] 饮食日志：吃了 鸡胸肉沙拉，约 450 大卡
- [2026-04-19] 力量训练：上肢推力，时长 65 分钟

### 当前对话概要 (Working Memory)
- 会话ID: session_abc123
- 最近交流摘要: [user] 我今天吃了沙拉 [assistant] 已记录...

请结合以上背景信息，为用户提供极其个性化、专业且有温度的健身/营养建议。
```

---

## 四、API接口文档

### 4.1 核心AI对话接口

#### `POST /api/chat-openai`

**请求体：**
```typescript
{
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  sessionId?: string;      // 会话ID，用于关联聊天记录
  base64Image?: string;    // Base64编码的图片（用于饮食识别）
  imageKey?: string;       // 已上传图片的key
}
```

**响应体：**
```typescript
{
  success: true;
  response: string;           // AI回复的文本
  intent?: string;           // 识别到的意图
  data?: any;                // 意图对应的结构化数据
  items?: any[];             // log_food_multi时的食物列表
  meal_type?: string;        // 餐型（log_food_multi时）
  total?: any;               // 营养总计（log_food_multi时）
  needs_user_confirmation?: boolean; // 是否需要用户确认
  entryDate?: string;        // 日期（today|yesterday|YYYY-MM-DD）
  profile_update?: {         // 用户属性增量更新
    goals: string[];
    weakPoints: string[];
    injuryHistory: string[];
    preferredStyle: string;
  };
}
```

### 4.2 数据分析接口

#### `GET /api/analysis/workout-trends`

**查询参数：**
- `range`: 时间范围（`7d`|`30d`|`90d`|`180d`）
- `userId`: 用户ID

**响应：**
```typescript
{
  success: true;
  data: {
    trendPoints: WorkoutTrendPoint[];
    muscleDistribution: MuscleGroupDistribution[];
    strengthProgress: StrengthProgressPoint[];
    summary: {
      totalWorkouts: number;
      totalVolume: number;
      avgWorkoutsPerWeek: number;
      mostTrainedGroup: string;
      totalDurationMin: number;
    };
  };
  insights: Insight[];  // 生成的智能洞察
}
```

#### `GET /api/analysis/nutrition`

**响应：**
```typescript
{
  success: true;
  data: {
    dailyData: DailyNutrition[];
    macroDistribution: MacroDistribution;
    summary: {
      avgDailyKcal: number;
      avgProteinG: number;
      daysLogged: number;
      proteinGoalPct: number;
      calorieConsistencyScore: number;
      streakDays: number;
    };
    goalComparison: {
      targetKcal: number;
      avgKcal: number;
      deficitOrSurplus: number;
      targetProteinG: number;
      avgProteinG: number;
      proteinAdequacy: 'adequate' | 'low' | 'high';
    };
  };
  insights: Insight[];
}
```

#### `GET /api/analysis/summary`

**响应：**
```typescript
{
  success: true;
  workout: WorkoutTrendsResult;
  nutrition: NutritionAnalysisResult;
  bodyMetrics: BodyMetricPoint[];
  insights: Insight[];  // 合并的训练+营养洞察
}
```

### 4.3 记忆系统接口

#### `GET /api/semantic-memory`

**响应：**
```typescript
{
  success: true;
  memory: {
    userId: string;
    userProfile: {
      goals: string[];
      weakPoints: string[];
      preferredStyle: string;
      injuryHistory: string[];
    };
    strengthModel: Record<string, any>;
    weeklyTrainingStats?: Record<string, WeeklyTrainingStats>;
    updatedAt: string;
  };
}
```

### 4.4 其他核心接口

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/upload-image` | POST | 上传图片（用于饮食识别） |
| `/api/save-record` | POST | 保存健康记录到数据库 |
| `/api/logs` | GET | 获取用户活动历史 |
| `/api/chat/:sessionId` | GET | 获取会话聊天记录 |
| `/api/chat-sessions` | GET/POST | 会话管理（列表/创建） |
| `/api/system-prompt` | GET | 获取系统提示词 |

---

## 五、重构建议

基于以上分析，如果你计划重构Agent系统，可以考虑以下方向：

### 5.1 模块化架构

```
services/
├── agent/
│   ├── core/
│   │   ├── Agent.ts              # 核心Agent类
│   │   ├── IntentParser.ts       # 意图解析器
│   │   └── ContextBuilder.ts     # 上下文构建器
│   ├── memory/
│   │   ├── SemanticMemory.ts     # 语义记忆管理
│   │   ├── EpisodicMemory.ts     # 情景记忆管理
│   │   └── WorkingMemory.ts      # 工作记忆管理
│   ├── tools/
│   │   ├── WorkoutPlanner.ts     # 计划生成工具
│   │   ├── NutritionAnalyzer.ts  # 营养分析工具
│   │   └── ProgressTracker.ts    # 进度追踪工具
│   └── insights/
│       ├── WorkoutInsight.ts     # 训练洞察生成
│       ├── NutritionInsight.ts   # 营养洞察生成
│       └── InsightEngine.ts      # 洞察引擎
```

### 5.2 关键改进点

1. **意图系统扩展**
   - 将硬编码的7种意图改为可配置的意图注册表
   - 支持动态意图发现和插件化扩展

2. **记忆系统增强**
   - 添加记忆压缩和总结机制
   - 实现记忆的长期存储和检索优化（向量数据库）

3. **工具调用（Function Calling）**
   - 从当前的JSON解析迁移到OpenAI的Function Calling
   - 支持更复杂的工具链和条件执行

4. **多Agent协作**
   - 分离Planner、Executor、Evaluator角色
   - 支持Agent之间的协作和任务委派

---

## 六、核心文件清单

| 文件 | 描述 | 关键功能 |
|------|------|----------|
| `server.ts` | Express服务器 | API端点、AI调用、记忆更新 |
| `services/systemPrompt.ts` | 系统提示词 | 意图定义、JSON格式规则 |
| `services/dbService.ts` | 数据库操作 | CRUD、会话管理、记录存储 |
| `services/memoryService.ts` | 记忆系统 | 三层记忆、上下文构建 |
| `services/trainingAnalytics.ts` | 训练分析 | 趋势计算、肌肉群分析 |
| `services/nutritionService.ts` | 营养分析 | 营养统计、目标对比 |
| `services/insightEngine.ts` | 洞察引擎 | 智能建议生成 |
| `src/App.tsx` | 前端主组件 | UI交互、API调用、状态管理 |

---

*文档生成时间：2026-04-19*
