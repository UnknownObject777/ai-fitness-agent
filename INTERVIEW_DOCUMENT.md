# Sparky AI Fitness Agent - 面试文档

## 项目概述

Sparky 是一款 AI 驱动的健身与营养助手，采用移动优先的 iPhone 风格设计。用户可以通过自然语言与 AI 对话，完成训练计划生成、饮食记录、运动追踪、身体数据测量等功能。

---

## 技术架构

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 6 |
| 样式方案 | Tailwind CSS 4 |
| 动画库 | Motion |
| 图标库 | Lucide React |
| 图表库 | Recharts |
| 后端 | Express.js |
| 数据库 | SQLite (文件存储) |
| AI 接口 | OpenAI API / Google Gemini |
| 状态管理 | React Hooks (useState/useEffect) |

### 架构亮点
- **Monorepo 结构**: 前后端同在一个仓库
- **文件型数据库**: SQLite 零配置，开箱即用
- **多模态 AI**: 支持文字 + 图片识别食物
- **意图驱动**: AI 返回结构化 JSON，前端动态渲染

---

## 数据库设计 (10张核心表)

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据库 ER 关系图                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────────┐                     │
│  │    users     │◄────┤  chat_sessions   │                     │
│  │  (用户表)    │     │   (会话表)       │                     │
│  │  id (PK)     │     │  id (PK)         │                     │
│  │  created_at  │     │  user_id (FK)    │                     │
│  └──────────────┘     │  title           │                     │
│         │             │  archived        │                     │
│         │             └────────┬─────────┘                     │
│         │                      │                              │
│         ▼                      ▼                              │
│  ┌─────────────────────────────────────────┐                  │
│  │         chat_messages (消息表)          │                  │
│  │  id (PK)                                │                  │
│  │  session_id (FK)                        │                  │
│  │  role (user/assistant)                  │                  │
│  │  content, image_data, intent, intent_data│                 │
│  └─────────────────────────────────────────┘                  │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │   meal_logs      │◄───┤   meal_items     │                 │
│  │  (饮食记录主表)   │    │  (饮食明细表)     │                 │
│  │  id (PK)         │    │  id (PK)         │                 │
│  │  user_id (FK)    │    │  meal_log_id (FK)│                 │
│  │  meal_type       │    │  food_name       │                 │
│  │  total_kcal, etc │    │  grams, kcal, etc│                 │
│  └──────────────────┘    └──────────────────┘                 │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │  workout_logs    │    │  body_metrics    │                 │
│  │  (运动记录表)     │    │  (身体数据表)     │                 │
│  │  id (PK)         │    │  id (PK)         │                 │
│  │  user_id (FK)    │    │  user_id (FK)    │                 │
│  │  workout_type    │    │  weight_kg       │                 │
│  │  duration_min    │    │  body_fat_pct    │                 │
│  │  calories_burned │    │  waist_cm, etc   │                 │
│  └──────────────────┘    └──────────────────┘                 │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                 │
│  │ activity_records │    │ user_semantic_   │                 │
│  │  (活动记录统一表) │    │     memory       │                 │
│  │  用于历史查询展示  │    │ (用户语义记忆表)  │                 │
│  └──────────────────┘    └──────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 表结构详解

#### 1. `users` - 用户表
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `chat_sessions` - 会话管理表
- 支持多会话切换、归档、重命名
- 自动维护最后消息时间和预览

#### 3. `chat_messages` - 聊天消息表
- 存储用户与 AI 的对话历史
- 支持图片数据存储 (base64)
- 记录 AI 意图和结构化数据

#### 4. `meal_logs` + `meal_items` - 饮食记录
- 一对多关系：一次用餐可包含多个食物
- 自动计算总热量、蛋白质、碳水、脂肪
- 支持图片识别来源标记

#### 5. `workout_logs` - 运动记录表
- 支持有氧运动和力量训练
- 存储原始 JSON 数据便于灵活扩展

#### 6. `body_metrics` - 身体数据表
- 体重、体脂率、腰围、胸围、臀围

#### 7. `activity_records` - 统一活动记录表
- 用于历史展示的统一视图
- 聚合饮食、运动、计划等多种记录

#### 8. `user_semantic_memory` - 用户语义记忆
- AI 长期记忆用户特征
- 目标、弱点、伤病历史、偏好风格

---

## 前端页面结构

```
┌─────────────────────────────────────────────────────────────┐
│                    App.tsx (主容器)                         │
│               ┌─────────────────────────────┐               │
│               │     Mobile-Style UI         │               │
│               │  (iPhone-like container)    │               │
│               └─────────────────────────────┘               │
│                                                             │
│  ┌────────────┬────────────┬────────────┬────────────┬─────┐│
│  │   Home     │   Diet     │  Workout   │    Plan    │ AI  ││
│  │  (首页)    │  (饮食)    │  (运动)    │  (计划)    │     ││
│  └─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴──┬──┘│
│        │            │            │            │         │   │
│        ▼            ▼            ▼            ▼         ▼   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐┌────┐│
│  │今日概览   │  │Diet     │  │Training │  │Training ││Chat││
│  │数据卡片   │  │Analysis │  │CardView │  │CardView ││界面││
│  │快捷入口   │  │View     │  │         │  │         ││    ││
│  │         │  │(营养分析) │  │(训练卡片)│  │(计划展示)││    ││
│  │         │  │         │  │         │  │         ││    ││
│  │ ┌────┐  │  │ ┌────┐  │  │ ┌────┐  │  │┌────┐   ││┌──┐││
│  │ │图表│  │  │ │图表│  │  │ │周历│  │  ││周历│   │││💬│││
│  │ └────┘  │  │ │分布│  │  │ │训练│  │  ││计划│   ││└──┘││
│  │         │  │ └────┘  │  │ └────┘  │  │└────┘   ││    ││
│  │ ┌────┐  │  │         │  │ ┌────┐  │  │        ││┌──┐││
│  │ │趋势│  │  │ ┌────┐  │  │ │统计│  │  │        │││📷│││
│  │ └────┘  │  │ │摄入│  │  │ └────┘  │  │        ││└──┘││
│  │         │  │ └────┘  │  │         │  │        ││    ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘└────┘│
│                                                             │
│        ┌──────────────────────────────────────────┐         │
│        │           Analysis (数据分析)           │         │
│        │  - 训练趋势 WorkoutTrendsView           │         │
│        │  - 身体数据 BodyMetricsView             │         │
│        │  - 综合分析 AnalysisDashboard           │         │
│        └──────────────────────────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6个主页面 (Tab Navigation)

| Tab | 页面 | 核心功能 | 使用组件 |
|-----|------|---------|---------|
| `home` | 首页 | 今日概览、快速入口、数据卡片 | App.tsx |
| `diet` | 饮食 | 营养分析、热量趋势、宏量营养素 | DietAnalysisView |
| `workout` | 运动 | 训练周历、训练卡片、运动统计 | TrainingCardView |
| `plan` | 计划 | 训练计划展示、周计划模板 | TrainingCardView |
| `ai` | AI助手 | 聊天界面、图片识别、手动录入 | App.tsx + ManualDietEntry |
| `analysis` | 数据分析 | 综合仪表盘、多维度分析 | AnalysisDashboard |

### 核心组件清单

| 组件 | 路径 | 功能描述 |
|------|------|---------|
| `App.tsx` | `src/App.tsx` | 主应用组件，包含底部导航和状态管理 |
| `TrainingCardView` | `src/components/TrainingCardView.tsx` | 训练计划/训练记录展示卡片 |
| `DietAnalysisView` | `src/components/DietAnalysisView.tsx` | 饮食营养分析图表 |
| `AnalysisDashboard` | `src/components/AnalysisDashboard.tsx` | 综合数据仪表盘 |
| `ManualDietEntry` | `src/components/ManualDietEntry.tsx` | 手动录入饮食组件 |
| `ExerciseSelectorModal` | `src/components/ExerciseSelectorModal.tsx` | 运动选择弹窗 |
| `WorkoutTrendsView` | `src/components/WorkoutTrendsView.tsx` | 训练趋势图表 |
| `BodyMetricsView` | `src/components/BodyMetricsView.tsx` | 身体数据趋势图 |

---

## AI Agent 核心实现

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent 架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Input                                                     │
│     │                                                          │
│     ├──────┬────────────────┬──────────┐                       │
│     ▼      ▼                ▼          ▼                       │
│  [文字] [图片]          [语音]      [指令]                      │
│     │      │                │          │                       │
│     ▼      ▼                ▼          ▼                       │
│  ┌─────────────────────────────────────────┐                    │
│  │         systemPrompt.ts                 │                    │
│  │      (系统提示词 / Agent 大脑)          │                    │
│  │                                         │                    │
│  │  "你是一个专业 AI 健身和营养助手"       │                    │
│  │  - 角色定义                            │                    │
│  │  - 意图列表 (6种核心意图)              │                    │
│  │  - JSON 格式规范                        │                    │
│  │  - 多模态提示 (图片识别)               │                    │
│  └─────────────────────────────────────────┘                    │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────┐                    │
│  │           OpenAI / Gemini API           │                    │
│  │           (大模型推理)                  │                    │
│  └─────────────────────────────────────────┘                    │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────┐                    │
│  │      结构化 JSON Response               │                    │
│  │                                         │                    │
│  │  {                                      │                    │
│  │    "intent": "log_food",               │                    │
│  │    "response": "已记录...",            │                    │
│  │    "data": {...},                      │                    │
│  │    "entryDate": "today"                │                    │
│  │  }                                      │                    │
│  └─────────────────────────────────────────┘                    │
│                    │                                            │
│         ┌──────────┴──────────┐                                 │
│         ▼                     ▼                                 │
│  [Database Storage]    [UI Render]                              │
│  dbService.ts          App.tsx                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6大核心意图系统

```
┌─────────────────────────────────────────────────────────────────┐
│                     Intent 分类与流程                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. generate_workout_plan                                       │
│     ├─ 触发词: "帮我制定计划", "一周怎么练"                      │
│     ├─ 数据: 目标/周数/阶段/周模板/训练动作                      │
│     └─ 存储: activity_records + workout_logs                    │
│                                                                 │
│  2. update_workout_plan                                         │
│     ├─ 触发词: "调整计划", "根据最近表现更新"                    │
│     ├─ 数据: 调整原因/变更字段/下周重点                          │
│     └─ 存储: activity_records                                   │
│                                                                 │
│  3. log_strength_workout                                        │
│     ├─ 触发词: "今天练了胸", "深蹲 100kg"                       │
│     ├─ 数据: 动作名/组数/次数/重量/RPE/肌肉群分布               │
│     └─ 存储: workout_logs + activity_records                    │
│                                                                 │
│  4. log_exercise                                                │
│     ├─ 触发词: "跑步 5公里", "游泳 30分钟"                      │
│     ├─ 数据: 运动名/时长/距离                                    │
│     └─ 存储: workout_logs + activity_records                    │
│                                                                 │
│  5. log_food                                                    │
│     ├─ 触发词: "吃了鸡胸肉", "早餐两个鸡蛋"                     │
│     ├─ 数据: 食物名/数量/热量/蛋白质/碳水/脂肪                  │
│     └─ 存储: meal_logs + meal_items + activity_records          │
│                                                                 │
│  6. log_food_multi (图片识别)                                   │
│     ├─ 触发词: [用户发送图片]                                    │
│     ├─ AI: 多模态识别食物种类、克重、营养成分                    │
│     ├─ 数据: items[]/置信度/营养估算/需要确认                    │
│     └─ 流程: AI识别 → 用户确认 → 保存到数据库                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI Agent 核心代码解析

#### systemPrompt.ts - Agent 的大脑
```typescript
export function getSystemPrompt() {
  return `你是一个专业的 AI 健身和营养助手...

针对饮食图像识别任务（多模态提示），请遵循严格的JSON输出格式：
如果用户发送了包含食物的图片...必须输出以下结构的JSON...
{
  "intent": "log_food_multi",
  "response": "我已经识别了图片中的食物...",
  "meal_type": "lunch",
  "items": [...],
  "total": {...},
  "needs_user_confirmation": true
}

文本支持意图列表：
1. generate_workout_plan - 生成训练计划
2. update_workout_plan - 调整计划
3. log_strength_workout - 记录力量训练
4. log_exercise - 记录有氧运动
5. log_food - 记录饮食（文本）
6. chat - 普通聊天

意图选择规则：...`;
}
```

#### App.tsx - Agent 的交互层
```typescript
const sendMessage = async () => {
  // 1. 构建消息上下文
  const userMsg = { role: 'user', content: input, base64Image: selectedImage };
  
  // 2. 调用 AI API
  const res = await fetch('/api/chat-openai', {
    method: 'POST',
    body: JSON.stringify({ messages, sessionId, base64Image })
  });
  
  const aiResponse = await res.json(); // { intent, response, data, entryDate }
  
  // 3. 根据 intent 自动处理
  const logIntents = ['log_food', 'log_exercise', 'log_strength_workout', ...];
  if (logIntents.includes(aiResponse.intent)) {
    // 自动保存到数据库
    await fetch('/api/save-record', {
      body: JSON.stringify({ 
        intent: aiResponse.intent, 
        data: aiResponse.data 
      })
    });
    fetchLogs(); // 刷新记录列表
  }
};
```

### 多模态食物识别流程

```
用户操作                    系统处理                      数据库
   │                            │                           │
   ▼                            ▼                           │
┌──────┐                 ┌──────────────┐                    │
│📷 拍照│  ──────────────►│  /api/upload │                    │
└──────┘    base64        │    -image    │                    │
   │                       └──────┬───────┘                    │
   │                              │                           │
   ▼                              ▼                           │
┌─────────────────────────────────────────┐                   │
│          OpenAI GPT-4 Vision            │                   │
│         (多模态图片理解)                 │                   │
│  - 识别食物种类                          │                   │
│  - 估算克重                              │                   │
│  - 计算营养成分                          │                   │
└──────────────────┬──────────────────────┘                   │
                   │                                          │
                   ▼                                          │
┌─────────────────────────────────────────┐                   │
│         返回结构化数据                   │                   │
│  {                                      │                   │
│    "intent": "log_food_multi",         │                   │
│    "items": [                           │                   │
│      { "name": "鸡胸肉",               │                   │
│        "estimated_grams": 150,         │                   │
│        "confidence": 0.85,             │                   │
│        "nutrition_estimate": {...} }   │                   │
│    ],                                   │                   │
│    "needs_user_confirmation": true      │                   │
│  }                                      │                   │
└──────────────────┬──────────────────────┘                   │
                   │                                          │
                   ▼                                          ▼
          ┌─────────────────┐                        ┌──────────────┐
          │  UI 展示识别结果 │ ─────用户确认──────────►│ 保存到数据库 │
          │  显示置信度和数据  │                       └──────────────┘
          └─────────────────┘
```

---

## API 端点设计

| 方法 | 端点 | 功能 | 核心服务 |
|------|------|------|---------|
| GET | `/api/system-prompt` | 获取 AI 系统提示词 | systemPrompt.ts |
| GET | `/api/chat/:sessionId` | 获取会话历史消息 | dbService.ts |
| POST | `/api/chat-openai` | 发送消息给 AI | AI 代理层 |
| GET | `/api/chat-sessions` | 获取会话列表 | dbService.ts |
| POST | `/api/chat-sessions` | 创建新会话 | dbService.ts |
| PATCH | `/api/chat-sessions/:id` | 更新会话(重命名/归档) | dbService.ts |
| DELETE | `/api/chat-sessions/:id` | 删除会话 | dbService.ts |
| POST | `/api/save-record` | 保存记录到数据库 | dbService.ts |
| GET | `/api/logs` | 获取历史记录 | dbService.ts |
| POST | `/api/upload-image` | 上传图片 | 文件存储 |
| GET | `/api/semantic-memory` | 获取用户记忆 | memoryService.ts |

---

## 项目亮点 (面试加分项)

### 1. 意图驱动的 AI 架构
- 不使用复杂的 Agent 框架，仅用 Prompt Engineering 实现结构化输出
- 6 个核心意图覆盖健身场景 90% 需求
- JSON Schema 约束确保前后端数据一致性

### 2. 多模态交互
- 支持文字 + 图片输入
- 使用 GPT-4 Vision 识别食物
- 置信度评分机制 (confidence < 0.75 需要用户确认)

### 3. 会话管理与记忆
- 多会话切换，支持归档
- 语义记忆长期存储用户特征
- 聊天记录自动保存，支持历史回溯

### 4. 统一活动记录表
- 不同类型的记录 (饮食/运动/计划) 统一存到 activity_records
- 便于历史查询和时间线展示
- 原始数据保留在 JSON 字段，灵活扩展

### 5. 数据可视化
- Recharts 图表库展示趋势
- 热量、体重、训练量的多维度分析
- 周历视图展示训练计划

---

## 面试问答准备

### Q1: 为什么选择 SQLite？
**A**: 
- 项目定位是个人工具，单机使用即可
- SQLite 零配置，文件存储便于部署
- 本项目不需要高并发，SQLite 足够
- 一个文件搞定，备份迁移简单

### Q2: AI Agent 是怎么实现的？
**A**:
- 核心是 **Prompt Engineering**，没有使用 LangChain/LangGraph
- 系统提示词定义了 6 个核心意图和 JSON 输出格式
- AI 返回结构化数据，前端根据 `intent` 字段路由处理
- 多模态用 GPT-4 Vision API，图片转 base64 传给模型

### Q3: 如何支持图片识别食物？
**A**:
1. 用户选择图片 → 前端转 base64
2. 发送到 `/api/chat-openai` 端点
3. 后端用 `openai.chat.completions.create` 的 `image_url` 参数传图
4. AI 识别后返回 `log_food_multi` 意图 + 食物列表
5. 如果置信度低，UI 显示 "需要确认" 按钮
6. 用户确认后调用 `/api/save-record` 保存

### Q4: 会话历史怎么实现的？
**A**:
- `chat_sessions` 表存储会话元数据
- `chat_messages` 表存储消息内容
- 支持软删除 (archived 字段)，不是物理删除
- 列表页用子查询获取最后一条消息预览和消息数量

### Q5: 训练计划是怎么存储的？
**A**:
- AI 生成的计划存到 `activity_records` 表
- data_json 字段存储完整的周计划模板
- `TrainingCardView` 组件解析 JSON 渲染成卡片视图
- 每周训练用图标表示 (周一-周日)

---

## 草图绘制建议

面试时可以现场画几个关键图：

### 1. 系统架构图
```
[浏览器] ──► [Vite/React] ──► [Express API] ──► [SQLite]
                              │
                              ▼
                         [OpenAI API]
```

### 2. 数据流图
```
用户输入 → AI理解 → 意图分类 → 数据提取 → 数据库存储 → UI渲染
```

### 3. 页面结构草图
```
┌──────────────────┐
│   今日数据卡片    │
├──────────────────┤
│   营养/运动/计划  │
├──────────────────┤
│   聊天输入框     │
│  [文字] [📷] [▶] │
└──────────────────┘
      [Home][Diet][Workout][Plan][AI]
```

---

## 总结

Sparky AI Fitness Agent 是一个完整的 **AI 原生应用**，展示了：
1. **AI 能力集成** - OpenAI API / Gemini / 多模态
2. **全栈开发** - React + Node.js + SQLite
3. **产品思维** - 移动优先设计、会话管理、数据可视化
4. **工程能力** - 模块化代码、类型安全、错误处理

适合面试时展示 **AI 应用开发** 和 **全栈工程** 能力。
