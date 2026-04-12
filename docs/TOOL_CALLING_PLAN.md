# Sparky AI 工具调用链 (Tool Calling Chain) 实现方案

## 1. 架构设计

### 1.1 核心概念

```
┌─────────────────────────────────────────────────────────────────┐
│                     工具调用链架构 (Tool Calling Chain)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────┐    │
│   │  用户输入  │───▶│  LLM 意图识别  │───▶│  工具选择器 (Router) │    │
│   └──────────┘    └──────────────┘    └──────────────────┘    │
│                                                  │              │
│                           ┌─────────────────────┼─────────────┐│
│                           │                     │             ││
│                           ▼                     ▼             ▼│
│              ┌─────────────────┐   ┌──────────────────┐  ┌─────────────┐│
│              │   工具 A: 查询天气  │   │   工具 B: 获取训练记录  │  │  工具 C: ...  ││
│              └─────────────────┘   └──────────────────┘  └─────────────┘│
│                       │                     │                    │      │
│                       └─────────────────────┼────────────────────┘      │
│                                             ▼                           │
│                              ┌────────────────────────┐                  │
│                              │   结果聚合器 (Aggregator)  │                  │
│                              └────────────────────────┘                  │
│                                             │                           │
│                                             ▼                           │
│                              ┌────────────────────────┐                  │
│                              │   决策: 需要更多工具?     │                  │
│                              │   - 是 → 回到工具选择器   │                  │
│                              │   - 否 → 生成最终回复     │                  │
│                              └────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件

```typescript
// 工具定义接口
interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
  execute: (args: any, context: ToolContext) => Promise<ToolResult>;
}

// 工具参数定义
interface ToolParameters {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required: string[];
}

// 工具执行上下文
interface ToolContext {
  userId: string;
  sessionId: string;
  memory: SemanticMemory;
  previousResults: ToolResult[];
  metadata: Record<string, any>;
}

// 工具执行结果
interface ToolResult {
  success: boolean;
  data: any;
  error?: string;
  metadata?: {
    executionTime: number;
    toolName: string;
    timestamp: string;
  };
}

// 工具调用链
interface ToolChain {
  id: string;
  userInput: string;
  intent: string;
  confidence: number;
  steps: ToolChainStep[];
  finalResponse: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

// 工具链步骤
interface ToolChainStep {
  stepNumber: number;
  toolName: string;
  arguments: any;
  result?: ToolResult;
  decision?: {
    type: 'continue' | 'branch' | 'retry' | 'abort';
    nextTool?: string;
    reason: string;
  };
  executionTime: number;
  startedAt: string;
  completedAt?: string;
}
```

---

## 2. 工具注册中心

### 2.1 内置工具集

```typescript
// tools/index.ts
import { Tool } from '../types';
import { weatherTool } from './weatherTool';
import { workoutTool } from './workoutTool';
import { dietTool } from './dietTool';
import { bodyMetricsTool } from './bodyMetricsTool';
import { calendarTool } from './calendarTool';
import { recommendationTool } from './recommendationTool';

export const builtinTools: Tool[] = [
  weatherTool,           // 查询天气
  workoutTool,           // 训练记录查询/保存
  dietTool,              // 饮食记录查询/分析
  bodyMetricsTool,       // 身体指标查询/记录
  calendarTool,          // 日历/日程相关
  recommendationTool,    // 智能推荐
];

// 工具注册表
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getOpenAIFormat(): any[] {
    return this.getAll().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}

export const toolRegistry = new ToolRegistry();
builtinTools.forEach(tool => toolRegistry.register(tool));
```

### 2.2 工具实现示例

```typescript
// tools/workoutTool.ts
import { Tool, ToolContext, ToolResult } from '../types';
import { getWorkoutLogs, getTrainingVolumeByMuscle } from '../services/dbService';

export const workoutTool: Tool = {
  name: 'query_workout',
  description: '查询用户的训练记录、训练量、肌肉群分布等信息。支持按日期范围、动作名称、肌肉群筛选。',
  parameters: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['recent', 'by_date_range', 'by_exercise', 'by_muscle_group', 'volume_analysis'],
        description: '查询类型：最近训练、日期范围、按动作、按肌肉群、训练量分析',
      },
      date_range: {
        type: 'object',
        properties: {
          start: { type: 'string', description: '开始日期 (YYYY-MM-DD)' },
          end: { type: 'string', description: '结束日期 (YYYY-MM-DD)' },
        },
      },
      exercise_name: {
        type: 'string',
        description: '动作名称（如：卧推、深蹲）',
      },
      muscle_group: {
        type: 'string',
        enum: ['胸部', '背部', '腿部', '肩部', '手臂', '核心'],
        description: '肌肉群',
      },
      limit: {
        type: 'number',
        description: '返回记录数量限制',
        default: 10,
      },
    },
    required: ['query_type'],
  },

  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    const startTime = Date.now();

    try {
      const { query_type, date_range, exercise_name, muscle_group, limit } = args;
      const userId = context.userId;

      let data: any;

      switch (query_type) {
        case 'recent':
          data = await getWorkoutLogs(userId, limit);
          break;

        case 'by_date_range':
          data = await getWorkoutLogs(userId, limit, {
            start: date_range?.start,
            end: date_range?.end,
          });
          break;

        case 'by_exercise':
          data = await getWorkoutLogs(userId, limit, { exercise_name });
          break;

        case 'by_muscle_group':
          data = await getTrainingVolumeByMuscle(userId, muscle_group, date_range);
          break;

        case 'volume_analysis':
          data = await analyzeTrainingVolume(userId, date_range);
          break;

        default:
          throw new Error(`Unknown query type: ${query_type}`);
      }

      return {
        success: true,
        data: {
          query_type,
          count: Array.isArray(data) ? data.length : 1,
          results: data,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: 'query_workout',
          timestamp: new Date().toISOString(),
        },
      };

    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message,
        metadata: {
          executionTime: Date.now() - startTime,
          toolName: 'query_workout',
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
};
```

---

## 3. 工具调用链执行器

```typescript
// core/ToolChainExecutor.ts
import { OpenAI } from 'openai';
import { ToolRegistry, toolRegistry } from '../tools';
import { ToolChain, ToolChainStep, ToolContext, ToolResult } from '../types';

export class ToolChainExecutor {
  private openai: OpenAI;
  private registry: ToolRegistry;
  private maxIterations: number = 10;

  constructor(openaiApiKey: string, registry: ToolRegistry = toolRegistry) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.registry = registry;
  }

  /**
   * 执行工具调用链
   */
  async execute(
    userInput: string,
    context: ToolContext
  ): Promise<ToolChain> {
    const chain: ToolChain = {
      id: this.generateChainId(),
      userInput,
      intent: '',
      confidence: 0,
      steps: [],
      finalResponse: '',
      status: 'running',
      createdAt: new Date().toISOString(),
    };

    try {
      // 第一轮：意图识别 + 第一个工具选择
      const result = await this.runLLMIteration(userInput, [], context);
      
      chain.intent = result.intent || 'general';
      chain.confidence = result.confidence || 0.5;

      // 执行工具链
      let shouldContinue = true;
      let iterationCount = 0;
      let previousResults: ToolResult[] = [];

      while (shouldContinue && iterationCount < this.maxIterations) {
        iterationCount++;

        // 运行 LLM 决定下一步
        const decision = await this.runLLMIteration(
          userInput,
          chain.steps,
          context,
          previousResults
        );

        if (decision.type === 'respond') {
          // 生成最终回复
          chain.finalResponse = decision.response || '';
          shouldContinue = false;
          break;
        }

        // 执行工具
        const tool = this.registry.get(decision.toolName);
        if (!tool) {
          throw new Error(`Tool not found: ${decision.toolName}`);
        }

        const stepStartTime = Date.now();
        const result = await tool.execute(decision.arguments, context);

        const step: ToolChainStep = {
          stepNumber: iterationCount,
          toolName: decision.toolName,
          arguments: decision.arguments,
          result,
          decision: {
            type: result.success ? 'continue' : 'retry',
            reason: result.success
              ? 'Tool executed successfully'
              : `Tool failed: ${result.error}`,
          },
          executionTime: Date.now() - stepStartTime,
          startedAt: new Date(stepStartTime).toISOString(),
          completedAt: new Date().toISOString(),
        };

        chain.steps.push(step);
        previousResults.push(result);

        // 如果工具执行失败且不能重试，则停止
        if (!result.success && step.decision.type !== 'retry') {
          shouldContinue = false;
          chain.finalResponse = `执行过程中遇到问题: ${result.error}`;
        }
      }

      chain.status = 'completed';
      chain.completedAt = new Date().toISOString();

      return chain;
    } catch (error: any) {
      chain.status = 'failed';
      chain.finalResponse = `执行失败: ${error.message}`;
      chain.completedAt = new Date().toISOString();
      return chain;
    }
  }

  /**
   * 运行 LLM 迭代
   */
  private async runLLMIteration(
    userInput: string,
    previousSteps: ToolChainStep[],
    context: ToolContext,
    previousResults?: ToolResult[]
  ): Promise<{
    type: 'tool' | 'respond';
    toolName?: string;
    arguments?: any;
    response?: string;
    intent?: string;
    confidence?: number;
  }> {
    // 构建 messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
      {
        role: 'user',
        content: userInput,
      },
    ];

    // 添加上下文（之前的工具调用和结果）
    for (const step of previousSteps) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify({
          tool: step.toolName,
          arguments: step.arguments,
        }),
      });

      if (step.result) {
        messages.push({
          role: 'tool',
          content: JSON.stringify({
            success: step.result.success,
            data: step.result.data,
            error: step.result.error,
          }),
        });
      }
    }

    // 调用 OpenAI
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    const decision = JSON.parse(content);

    if (decision.action === 'respond') {
      return {
        type: 'respond',
        response: decision.response,
        intent: decision.intent,
        confidence: decision.confidence,
      };
    } else {
      return {
        type: 'tool',
        toolName: decision.tool,
        arguments: decision.arguments,
        intent: decision.intent,
        confidence: decision.confidence,
      };
    }
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    const tools = this.registry.getAll();
    const toolDescriptions = tools
      .map(
        (t) => `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters)}`
      )
      .join('\n');

    return `你是一个智能健身助手，可以通过调用工具来帮助用户完成各种任务。

## 可用工具
${toolDescriptions}

## 工作流程

1. **分析用户需求** - 理解用户想要做什么
2. **选择工具** - 如果需要外部数据或执行操作，选择合适的工具
3. **执行工具** - 调用工具并获取结果
4. **判断下一步** - 
   - 如果还需要更多信息，继续调用工具
   - 如果已经满足用户需求，生成回复

## 输出格式

你必须以 JSON 格式输出决策：

### 调用工具时：
{\n  "action": "call_tool",\n  "tool": "工具名称",\n  "arguments": {\n    "参数名": "参数值"\n  },\n  "intent": "用户意图",\n  "confidence": 0.95,\n  "reason": "为什么选择这个工具"\n}

### 回复用户时：
{\n  "action": "respond",\n  "response": "回复内容",\n  "intent": "用户意图",\n  "confidence": 0.95\n}

## 示例场景

用户："我昨天练了胸，今天推荐练什么？"

思考过程：
1. 用户提到"昨天练了胸" - 需要查询历史训练记录
2. 需要"推荐今天练什么" - 需要根据训练历史给出建议

第一步决策：
{\n  "action": "call_tool",\n  "tool": "query_workout",\n  "arguments": {\n    "query_type": "recent",\n    "limit": 7\n  },\n  "intent": "查询最近训练记录",\n  "confidence": 0.95,\n  "reason": "需要获取用户最近的训练历史，特别是昨天的训练内容"\n}

获得结果后，分析发现昨天确实练了胸部，今天是推日，应该安排背部/腿部训练。

第二步决策：
{\n  "action": "call_tool",\n  "tool": "recommend_workout",\n  "arguments": {\n    "target_muscles": ["背部", "腿部"],\n    "difficulty": "intermediate",\n    "estimated_time": 60\n  },\n  "intent": "推荐今日训练",\n  "confidence": 0.9,\n  "reason": "昨天练了胸，今天应该安排背部和腿部训练，保持肌肉平衡"\n}

获得推荐后，生成最终回复。

最终决策：
{\n  "action": "respond",\n  "response": "昨天练了胸，今天建议安排背部+腿部训练！根据你的训练历史，我为你推荐：\\n\\n**拉力训练 B**\\n1. 引体向上 4组 x 8次\\n2. 杠铃划船 4组 x 10次\\n3. 罗马尼亚硬拉 3组 x 12次\\n4. 坐姿划船 3组 x 12次\\n5. 腿弯举 3组 x 15次\\n\\n预计用时 60分钟，可以有效平衡昨天的胸部训练。",\n  "intent": "推荐今日训练",\n  "confidence": 0.92\n}`;
  }

  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
```

### 3.2 工具链可视化

```typescript
// core/ToolChainVisualizer.ts
export class ToolChainVisualizer {
  /**
   * 生成 Mermaid 流程图
   */
  static toMermaid(chain: ToolChain): string {
    const lines: string[] = [
      'graph TD',
      `    Start([用户输入]) --> Intent{意图识别}`,
      `    Intent -->|置信度 ${(chain.confidence * 100).toFixed(0)}%| ${chain.steps[0]?.toolName || 'End'}`,
    ];

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];
      const nodeId = `Step${i}`;
      const nextNodeId = i < chain.steps.length - 1 ? `Step${i + 1}` : 'End';

      lines.push(`    ${nodeId}[${step.toolName}] -->|${step.result?.success ? '成功' : '失败'}| ${nextNodeId}`);

      if (step.decision?.type === 'retry') {
        lines.push(`    ${nodeId} -.重试.-> ${nodeId}`);
      }
    }

    lines.push(`    ${chain.steps.length > 0 ? `Step${chain.steps.length - 1}` : 'Intent'} --> End([生成回复])`);

    return lines.join('\n');
  }

  /**
   * 生成文本流程图
   */
  static toText(chain: ToolChain): string {
    const lines: string[] = [
      `工具调用链 #${chain.id}`,
      `================`,
      `用户输入: ${chain.userInput}`,
      `意图: ${chain.intent} (置信度: ${(chain.confidence * 100).toFixed(0)}%)`,
      `状态: ${chain.status}`,
      ``,
      `执行步骤:`,
    ];

    for (const step of chain.steps) {
      const status = step.result?.success ? '✓' : '✗';
      lines.push(`  ${status} 步骤 ${step.stepNumber}: ${step.toolName}`);
      lines.push(`     参数: ${JSON.stringify(step.arguments)}`);
      if (step.result) {
        lines.push(`     结果: ${step.result.success ? '成功' : `失败 (${step.result.error})`}`);
        lines.push(`     耗时: ${step.executionTime}ms`);
      }
      if (step.decision) {
        lines.push(`     决策: ${step.decision.type} - ${step.decision.reason}`);
      }
      lines.push('');
    }

    if (chain.finalResponse) {
      lines.push('最终回复:');
      lines.push(chain.finalResponse);
    }

    return lines.join('\n');
  }

  /**
   * 生成 JSON 格式（用于前端展示）
   */
  static toJSON(chain: ToolChain): object {
    return {
      ...chain,
      summary: {
        totalSteps: chain.steps.length,
        successfulSteps: chain.steps.filter(s => s.result?.success).length,
        failedSteps: chain.steps.filter(s => s.result && !s.result.success).length,
        totalExecutionTime: chain.steps.reduce((sum, s) => sum + s.executionTime, 0),
      },
    };
  }
}
```

---

## 4. 使用示例

### 4.1 简单查询

```typescript
// 用户："我上周练了几次？"
const chain = await executor.execute(
  '我上周练了几次？',
  {
    userId: 'user_1',
    sessionId: 'session_1',
    memory: semanticMemory,
    previousResults: [],
    metadata: {},
  }
);

// 预期工具链：
// 1. query_workout (query_type: 'by_date_range', date_range: {start: '2026-04-05', end: '2026-04-12'})
// 2. respond ("你上周训练了 4 次，分别是周一胸部、周三背部、周五腿部、周日有氧")
```

### 4.2 条件分支

```typescript
// 用户："今天适合户外跑步吗？"
const chain = await executor.execute('今天适合户外跑步吗？', context);

// 预期工具链：
// 1. query_weather (location: '用户当前位置')
// 2. [条件分支]
//    - 如果下雨/空气质量差 -> query_indoor_workout (推荐室内训练)
//    - 如果天气好 -> recommend_workout (推荐户外跑步路线)
// 3. respond (根据天气给出建议)
```

### 4.3 循环重试

```typescript
// 用户："帮我制定下周的训练计划"
const chain = await executor.execute('帮我制定下周的训练计划', context);

// 预期工具链：
// 1. query_workout (获取最近2周训练记录) - 用于分析当前状态
// 2. analyze_training_load (分析训练负荷)
// 3. [可能需要重试]
//    - 如果分析结果不充分 -> query_workout (扩大查询范围)
//    - 如果数据充分 -> generate_workout_plan
// 4. save_workout_plan (保存生成的计划)
// 5. respond (展示计划)
```

---

## 5. 错误处理与恢复

```typescript
// core/ErrorRecovery.ts
export class ErrorRecovery {
  /**
   * 重试策略
   */
  static async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * 故障转移策略
   */
  static async failover<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryFn();
    } catch (error) {
      console.warn('Primary function failed, using fallback:', error);
      return await fallbackFn();
    }
  }
}
```

---

## 6. 监控与日志

```typescript
// core/ChainMonitor.ts
export class ChainMonitor {
  private chains: Map<string, ToolChain> = new Map();

  /**
   * 记录链开始
   */
  startChain(chain: ToolChain): void {
    this.chains.set(chain.id, chain);
    console.log(`[Chain ${chain.id}] Started: ${chain.userInput}`);
  }

  /**
   * 记录步骤完成
   */
  logStep(chainId: string, step: ToolChainStep): void {
    const chain = this.chains.get(chainId);
    if (chain) {
      chain.steps.push(step);
    }

    const status = step.result?.success ? '✓' : '✗';
    console.log(
      `[Chain ${chainId}] Step ${step.stepNumber}: ${step.toolName} ${status} (${step.executionTime}ms)`
    );
  }

  /**
   * 记录链完成
   */
  endChain(chainId: string, finalResponse: string): void {
    const chain = this.chains.get(chainId);
    if (chain) {
      chain.finalResponse = finalResponse;
      chain.status = 'completed';
      chain.completedAt = new Date().toISOString();
    }

    console.log(`[Chain ${chainId}] Completed in ${chain?.steps.length} steps`);
  }

  /**
   * 获取链统计
   */
  getStats(): object {
    const chains = Array.from(this.chains.values());
    return {
      totalChains: chains.length,
      completedChains: chains.filter((c) => c.status === 'completed').length,
      failedChains: chains.filter((c) => c.status === 'failed').length,
      averageSteps:
        chains.reduce((sum, c) => sum + c.steps.length, 0) / chains.length || 0,
      averageExecutionTime:
        chains
          .filter((c) => c.completedAt)
          .reduce(
            (sum, c) =>
              sum +
              (new Date(c.completedAt!).getTime() -
                new Date(c.createdAt).getTime()),
            0
          ) / chains.filter((c) => c.completedAt).length || 0,
    };
  }
}

export const chainMonitor = new ChainMonitor();
```

---

## 7. 前端可视化组件

```typescript
// components/ToolChainVisualizer.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolChain } from '../types';

interface ToolChainVisualizerProps {
  chain: ToolChain | null;
}

export const ToolChainVisualizer: React.FC<ToolChainVisualizerProps> = ({
  chain,
}) => {
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  if (!chain) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        等待用户输入...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* 头部信息 */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800">
          工具调用链 #{chain.id.slice(-6)}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{chain.userInput}</p>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
            意图: {chain.intent}
          </span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
            置信度: {(chain.confidence * 100).toFixed(0)}%
          </span>
          <span
            className={`px-2 py-1 rounded ${
              chain.status === 'completed'
                ? 'bg-purple-100 text-purple-700'
                : chain.status === 'running'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            状态: {chain.status}
          </span>
        </div>
      </div>

      {/* 步骤时间线 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">执行步骤</h4>

        <AnimatePresence>
          {chain.steps.map((step, index) => (
            <motion.div
              key={step.stepNumber}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.1 }}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedStep === step.stepNumber
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() =>
                setSelectedStep(
                  selectedStep === step.stepNumber ? null : step.stepNumber
                )
              }
            >
              {/* 步骤头部 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.result?.success
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  <span className="font-medium text-gray-800">{step.toolName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{step.executionTime}ms</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      selectedStep === step.stepNumber ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* 展开详情 */}
              <AnimatePresence>
                {selectedStep === step.stepNumber && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-gray-200"
                  >
                    {/* 参数 */}
                    <div className="mb-3">
                      <span className="text-xs font-medium text-gray-500">参数:</span>
                      <pre className="mt-1 text-xs bg-gray-100 rounded p-2 overflow-x-auto">
                        {JSON.stringify(step.arguments, null, 2)}
                      </pre>
                    </div>

                    {/* 结果 */}
                    {step.result && (
                      <div>
                        <span className="text-xs font-medium text-gray-500">结果:</span>
                        <pre
                          className={`mt-1 text-xs rounded p-2 overflow-x-auto ${
                            step.result.success
                              ? 'bg-green-50 text-green-800'
                              : 'bg-red-50 text-red-800'
                          }`}
                        >
                          {JSON.stringify(
                            step.result.success
                              ? step.result.data
                              : step.result.error,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}

                    {/* 决策 */}
                    {step.decision && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-500">决策:</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              step.decision.type === 'continue'
                                ? 'bg-blue-100 text-blue-700'
                                : step.decision.type === 'retry'
                                ? 'bg-yellow-100 text-yellow-700'
                                : step.decision.type === 'branch'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {step.decision.type}
                          </span>
                          <span className="text-xs text-gray-600">
                            {step.decision.reason}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 最终回复 */}
      {chain.finalResponse && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
        >
          <h4 className="text-sm font-medium text-gray-700 mb-2">最终回复</h4>
          <p className="text-gray-800 whitespace-pre-wrap">{chain.finalResponse}</p>
        </motion.div>
      )}
    </div>
  );
};
```

---

## 5. 高级特性

### 5.1 条件分支

```typescript
// 根据工具执行结果决定下一步
interface ConditionalBranch {
  condition: {
    field: string;           // 检查结果中的字段
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'exists';
    value?: any;
  };
  then: {
    tool: string;
    arguments: any;
  };
  else?: {
    tool: string;
    arguments: any;
  };
}

// 示例：根据天气决定推荐室内还是户外训练
const weatherBranch: ConditionalBranch = {
  condition: {
    field: 'weather.condition',
    operator: 'eq',
    value: 'rain',
  },
  then: {
    tool: 'recommend_workout',
    arguments: { type: 'indoor', focus: 'strength' },
  },
  else: {
    tool: 'recommend_workout',
    arguments: { type: 'outdoor', focus: 'cardio' },
  },
};
```

### 5.2 并行执行

```typescript
// 同时执行多个独立的工具
interface ParallelExecution {
  type: 'parallel';
  branches: {
    id: string;
    tool: string;
    arguments: any;
  }[];
  aggregate: {
    strategy: 'merge' | 'select' | 'custom';
    selector?: (results: ToolResult[]) => any;
  };
}

// 示例：同时查询训练记录和饮食记录
const parallelQuery: ParallelExecution = {
  type: 'parallel',
  branches: [
    {
      id: 'workout',
      tool: 'query_workout',
      arguments: { query_type: 'recent', limit: 7 },
    },
    {
      id: 'diet',
      tool: 'query_diet',
      arguments: { query_type: 'recent', limit: 7 },
    },
  ],
  aggregate: {
    strategy: 'merge',
    selector: (results) => ({
      workouts: results.find((r) => r.metadata?.toolName === 'query_workout')?.data,
      diets: results.find((r) => r.metadata?.toolName === 'query_diet')?.data,
    }),
  },
};
```

### 5.3 循环重试

```typescript
// 工具执行失败时的重试逻辑
interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[]; // 哪些错误可以重试
  onRetry?: (attempt: number, error: Error) => void;
}

// 示例：查询外部天气 API 的重试策略
const weatherRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000,
  maxDelay: 10000,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', '429', '503'],
  onRetry: (attempt, error) => {
    console.log(`Weather API retry ${attempt}/3: ${error.message}`);
  },
};
```

---

## 6. 与现有系统的集成

### 6.1 修改 server.ts

```typescript
// server.ts 中的修改

// 1. 导入工具调用链
import { ToolChainExecutor } from './core/ToolChainExecutor';
import { toolRegistry } from './tools';
import { chainMonitor } from './core/ChainMonitor';

// 2. 初始化执行器
const toolExecutor = new ToolChainExecutor(
  process.env.OPENAI_API_KEY!,
  toolRegistry
);

// 3. 修改聊天 API 支持工具调用
app.post('/api/chat-openai', async (req, res) => {
  try {
    const { messages, sessionId, useToolChain, base64Image } = req.body;

    // 如果请求使用工具调用链
    if (useToolChain) {
      const latestUserMessage = messages[messages.length - 1];

      // 构建上下文
      const context: ToolContext = {
        userId: 'user_1',
        sessionId,
        memory: await getOrInitSemanticMemory('user_1'),
        previousResults: [],
        metadata: {
          hasImage: !!base64Image,
        },
      };

      // 执行工具调用链
      const chain = await toolExecutor.execute(
        latestUserMessage.content,
        context
      );

      // 记录链
      chainMonitor.startChain(chain);

      // 返回结果
      res.json({
        success: true,
        type: 'tool_chain',
        chain: ToolChainVisualizer.toJSON(chain),
        response: chain.finalResponse,
      });

      return;
    }

    // 原有的直接 API 调用逻辑...
    // ... (原有代码)
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 添加工具链可视化 API
app.get('/api/tool-chains/:chainId', async (req, res) => {
  // 返回特定链的详细信息
});

app.get('/api/tool-chains', async (req, res) => {
  // 返回最近的链列表
  const stats = chainMonitor.getStats();
  res.json({ success: true, stats });
});
```

### 6.2 前端集成

```typescript
// 在 App.tsx 中添加工具调用链支持

const [activeChain, setActiveChain] = useState<ToolChain | null>(null);
const [showChainVisualizer, setShowChainVisualizer] = useState(false);

// 修改 sendMessage 函数
const sendMessage = async () => {
  // ... 原有代码

  const res = await fetch('/api/chat-openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.concat(userMsg),
      sessionId,
      useToolChain: true, // 启用工具调用链
      base64Image: imageToSend,
    }),
  });

  const data = await res.json();

  if (data.type === 'tool_chain') {
    // 显示工具调用链可视化
    setActiveChain(data.chain);
    setShowChainVisualizer(true);
  }

  // ... 原有处理逻辑
};

// 在 UI 中添加工具链可视化
{
  showChainVisualizer && activeChain && (
    <ToolChainVisualizer chain={activeChain} />
  );
}
```

---

## 7. 总结

这个工具调用链实现方案提供了：

### ✅ 核心能力
1. **多轮工具调用** - 支持复杂的链式调用
2. **条件分支** - 根据结果动态选择路径
3. **并行执行** - 同时执行独立的工具
4. **错误恢复** - 重试、降级、回滚
5. **可视化监控** - 实时查看执行流程

### ✅ 架构优势
- **模块化设计** - 易于扩展新工具
- **类型安全** - TypeScript 全程支持
- **可观测性** - 完整的日志和监控
- **灵活配置** - 支持不同的执行策略

### ✅ 集成友好
- 与现有系统无缝集成
- 支持渐进式采用
- 提供可视化调试工具

---

**下一步行动建议：**

1. 从简单场景开始（单工具调用）
2. 逐步引入条件分支和重试机制
3. 添加可视化和监控
4. 最后支持复杂的并行和循环场景
