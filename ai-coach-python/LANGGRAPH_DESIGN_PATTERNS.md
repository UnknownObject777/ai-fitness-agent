# LangGraph 健身教练 Agent 设计模式

> 基于 FitWeek AI Coach 的架构抽象与实践总结

---

## 目录

1. [概述](#概述)
2. [核心架构原则](#核心架构原则)
3. [状态驱动架构](#状态驱动架构)
4. [节点职责分离](#节点职责分离)
5. [提示词工程分层](#提示词工程分层)
6. [LangGraph 编排模式](#langgraph-编排模式)
7. [核心设计抽象总结](#核心设计抽象总结)
8. [关键设计决策](#关键设计决策)

---

## 概述

本文档抽象了 FitWeek AI Coach 项目中使用 LangGraph 构建健身教练 Agent 的核心设计思想。该架构展示了一种**分层递进式 AI 工作流模式**，适用于需要结构化输出、多步骤推理和可控执行流程的领域。

### 系统定位

```
┌─────────────────────────────────────────────────────────────┐
│                    FitWeek AI Coach                         │
│                                                             │
│   Input: Workout Session Data (exercises, sets, reps,     │
│          weight, RPE)                                       │
│                                                             │
│   Output: Structured 4-sentence AI Coaching Notes           │
│           (Volume Analysis → Imbalance Check →             │
│            Intensity Prescription → Exertion Goal)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心架构原则

### 1. 状态为中心 (State-Centric)

所有节点共享一个中心化的**TypedDict 状态对象**，而非通过参数传递数据。这使得：
- 节点间解耦：节点只需关注自己读取和写入的状态字段
- 可追溯性：完整执行历史保存在状态对象中
- 可恢复性：可以在任意节点断点处恢复执行

### 2. 累加语义 (Additive Semantics)

使用 `Annotated[T, operator.add]` 定义列表类型的状态字段，实现**追加而非覆盖**的更新语义：

```python
research_plan: Annotated[List[str], operator.add]
```

这使得工作流可以支持**循环迭代**——新产生的研究计划会被追加到现有列表，而非替换。

### 3. 分层职责 (Layered Responsibilities)

每个节点有明确的**角色定位**和**职责边界**：

| 层级 | 角色 | 思考维度 |
|------|------|----------|
| Planner | 策略师 | "做什么" (What) |
| Researcher | 研究员 | "查什么" (Search) - 可选 |
| Critique | 审核员 | "合格吗" (Quality) - 可选 |
| Writer | 作家 | "怎么写" (How) |

---

## 状态驱动架构

### 状态类型定义

```python
class AgentState(TypedDict):
    # 输入层
    workout_data: dict          # 原始训练数据（输入）
    
    # 处理层
    research_plan: Annotated[List[str], operator.add]   # 累加型状态
    research_results: Annotated[List[str], operator.add]
    
    # 输出层
    final_notes: str            # 最终教练笔记（输出）
    is_validated: bool          # 质量验证标志
```

### 状态流转图

```
┌─────────────────────────────────────────────────────────────────┐
│                         状态流转过程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Initial State                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │ workout_data│ │ research_plan│ │ final_notes │ │is_validat │ │
│  │  {input}    │ │     []       │ │     ""      │ │   False   │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └───────────┘ │
│          │                                                       │
│          ▼                                                       │
│  After Planner Node                                              │
│  ┌─────────────┐ ┌────────────────────────────────┐              │
│  │ workout_data│ │ research_plan                  │              │
│  │  {input}    │ │ ["1. Calculate tonnage...",    │              │
│  │             │ │  "2. Flag high-RPE sets...",   │              │
│  │             │ │  "3. Analyze muscle groups...",│              │
│  │             │ │  "4. Set next targets..."]     │              │
│  └─────────────┘ └────────────────────────────────┘              │
│          │                                                       │
│          ▼                                                       │
│  After Writer Node                                               │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────────┐│
│  │ workout_data│ │research_plan │ │      final_notes             ││
│  │  {input}    │ │  [...]       │ │  "Compared to your 7-day...  ││
│  │             │ │              │ │   Chest is overtrained...   ││
│  │             │ │              │ │   Next session target...    ││
│  │             │ │              │ │   Aim for RPE 7-8..."       ││
│  └─────────────┘ └──────────────┘ └────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 节点职责分离

### Planner Node（规划器节点）

**角色**: 首席数据策略师  
**职责**: 分析训练数据，生成4步分析计划  
**输出**: `research_plan` (List[str])

```python
def planner_node(state: AgentState):
    # 1. 提取训练数据
    workout = state["workout_data"]
    
    # 2. 初始化LLM并使用结构化输出
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
    structured_llm = llm.with_structured_output(ResearchPlan)
    
    # 3. 构造提示词（角色 + 任务 + 数据 + 约束）
    prompt = f"""
    You are the 'Lead Data Strategist' for FitWeek.
    Analyze today's session to identify the key quantitative metrics...
    
    WORKOUT: {workout.get('title')}
    LIFTS: {workout.get('setLogs')}
    
    Your task is to create a 4-step execution plan...
    """
    
    # 4. 调用LLM生成结构化计划
    response = structured_llm.invoke(prompt)
    
    # 5. 返回更新后的状态
    return {"research_plan": response.steps}
```

**4步分析计划详解**:

| 步骤 | 任务 | 目的 |
|------|------|------|
| 1 | 识别主要复合动作 | 计算总训练量 (Tonnage) |
| 2 | 标记高RPE组 | 识别需要恢复调整的高强度组 |
| 3 | 分析肌肉群刺激 | 检查相对于7天趋势的过度训练 |
| 4 | 设定下次目标 | 基于今日表现设定下次负荷目标 |

### Writer Node（写作节点）

**角色**: 世界级私人训练教练  
**职责**: 整合所有信息，生成结构化的4句教练笔记  
**输出**: `final_notes` (str)

**核心特点**:

1. **数据融合**: 整合三类数据源
   - `workout_data`: 今日训练数据
   - `history_context`: 7天历史记录（通过DB查询）
   - `instructions`: Planner生成的分析计划

2. **严格约束提示词**:

```python
prompt = f"""
You are my Personal World-Class Workout Coach. 
Your goal is to provide a highly specific, quantitative analysis based ONLY on the data below.

TODAY'S WORKOUT: {workout.get('setLogs')}
7-DAY HISTORY: {history_context}
PLANNER INSTRUCTIONS: {instructions}

STRICT QUANTITATIVE GUIDELINES (4 SENTENCES TOTAL):
1. Sentence 1 (Volume Analysis): Compare today's total tonnage...
2. Sentence 2 (Imbalance Check): Call out specific muscle groups...
3. Sentence 3 (Intensity Prescription): State a precise, RPE-adjusted load...
4. Sentence 4 (Exertion Goal): List the specific target RPE exertion levels...

CONSTRAINTS: No philosophical, vague, or flowery language. Use exact numbers and percentages.
"""
```

3. **4句话结构**:

| 句子 | 主题 | 内容要求 |
|------|------|----------|
| 1 | Volume Analysis | 今日容量 vs 7天平均，百分比差异 |
| 2 | Imbalance Check | 过度/欠训练肌肉群，具体风险 |
| 3 | Intensity Prescription | 下次目标重量/次数，调整幅度 |
| 4 | Exertion Goal | 各动作目标RPE范围 |

---

## 提示词工程分层

### 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROMPT HIERARCHY                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 1: STRATEGIC (策略层) - Planner Node                     │
│  ─────────────────────────────────────────────                   │
│  Role: Lead Data Strategist                                     │
│  Task: Create 4-step execution plan                             │
│  Thinking: "What analysis should be performed?"                 │
│  Output: Research Plan (List[str])                                │
│                                                                 │
│  Prompt Structure:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ROLE: You are the 'Lead Data Strategist'...             │   │
│  │ DATA: WORKOUT: {title}, LIFTS: {setLogs}                │   │
│  │ TASK: Create a 4-step execution plan for the Writer    │   │
│  │ CONSTRAINT: Numbered list, specific metrics...          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 2: TACTICAL (战术层) - 当前未使用（Research/Critique）  │
│  ─────────────────────────────────────────────                   │
│  Role: Researcher / Quality Auditor                             │
│  Task: Gather external data / Validate quality                  │
│  Thinking: "Is the information sufficient?"                     │
│  Output: Research Results / Validation Flag                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LAYER 3: EXECUTION (执行层) - Writer Node                      │
│  ─────────────────────────────────────────────                   │
│  Role: Personal World-Class Workout Coach                       │
│  Task: Generate structured 4-sentence coaching notes              │
│  Thinking: "How do I communicate this quantitatively?"          │
│  Output: Final Notes (str)                                      │
│                                                                 │
│  Prompt Structure:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ROLE: You are my Personal World-Class Workout Coach    │   │
│  │ DATA: TODAY'S WORKOUT: {setLogs}                        │   │
│  │       7-DAY HISTORY: {history}                          │   │
│  │       PLANNER INSTRUCTIONS: {instructions}            │   │
│  │ TASK: Provide highly specific, quantitative analysis    │   │
│  │ CONSTRAINT:                                              │   │
│  │   - STRICT QUANTITATIVE GUIDELINES (4 SENTENCES)       │   │
│  │   - Sentence 1: Volume Analysis                        │   │
│  │   - Sentence 2: Imbalance Check                        │   │
│  │   - Sentence 3: Intensity Prescription                 │   │
│  │   - Sentence 4: Exertion Goal                          │   │
│  │   - CONSTRAINTS: No philosophical/vague language       │   │
│  │                  Use exact numbers and percentages      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 分层设计优势

| 优势 | 说明 |
|------|------|
| **关注点分离** | 每层只关心自己的职责，降低认知负担 |
| **可测试性** | 每层可以独立测试，mock下层依赖 |
| **可替换性** | 可以替换某一层的实现而不影响其他层 |
| **可复用性** | 相同的分层模式可以应用到其他领域 |

---

## LangGraph 编排模式

### 1. 线性流程模式 (Linear Flow)

**适用场景**: 步骤确定、无分支、单向执行

**当前架构**:
```
Entry -> Planner -> Writer -> END
```

**代码实现**:
```python
workflow = StateGraph(AgentState)

# 添加节点
workflow.add_node("planner", planner_node)
workflow.add_node("writer", writer_node)

# 定义线性边
workflow.set_entry_point("planner")
workflow.add_edge("planner", "writer")
workflow.add_edge("writer", END)

# 编译
architect_brain = workflow.compile()
```

### 2. 条件分支模式 (Conditional Branching)

**适用场景**: 需要根据状态决定执行路径

**完整架构示例**:
```
                    ┌─────────────┐
              ┌────→│   Writer    │──→ END
              │     └─────────────┘
              │     (is_validated=True)
              │
Entry → Planner → Researcher → Auditor
              │                    │
              │     (is_validated=False)
              │     ┌─────────────┐
              └────←│  Researcher │ (loop back)
                    └─────────────┘
```

**代码实现**:
```python
# 条件路由函数
def route_from_auditor(state: AgentState):
    if state["is_validated"]:
        return "writer"
    else:
        return "researcher"  # 循环回研究节点

# 定义条件边
workflow.add_conditional_edges(
    "auditor",                    # 源节点
    route_from_auditor,           # 路由决策函数
    {                             # 返回值映射
        "writer": "writer",
        "researcher": "researcher"
    }
)
```

### 3. 循环迭代模式 (Loop Iteration)

**适用场景**: 需要反复执行直到满足条件

**实现机制**:

1. **累加型状态字段**:
```python
research_plan: Annotated[List[str], operator.add]
```

2. **条件路由函数**判断是否应该继续循环

3. **节点返回新任务**，自动追加到列表

```
Iteration 1:
  research_plan = ["task1", "task2"]
  
  Auditor: is_validated = False
  Missing tasks: ["task3", "task4"]
  
Iteration 2:
  research_plan = ["task1", "task2", "task3", "task4"]  (追加)
  
  Auditor: is_validated = True
  → Exit to Writer
```

---

## 核心设计抽象总结

```
┌─────────────────────────────────────────────────────────────────────┐
│           LANGGRAPH 健身教练 AGENT 设计模式                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. STATE-CENTRIC (状态为中心架构)                          │   │
│  │  ─────────────────────────────────                          │   │
│  │  • 所有节点共享 TypedDict 状态对象                          │   │
│  │  • 使用 Annotated + operator.add 实现累加语义               │   │
│  │  • 支持循环迭代和状态累积                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  2. ROLE-BASED NODES (基于角色的节点设计)                  │   │
│  │  ─────────────────────────────────────────                   │   │
│  │                                                             │   │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │   │
│  │   │ Planner  │→ │Researcher│→ │ Critique │→ │  Writer  │   │   │
│  │   │ (策略师) │  │ (研究员) │  │ (审核员) │  │ (作家)  │   │   │
│  │   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │   │
│  │        │            │            │            │          │   │
│  │        ▼            ▼            ▼            ▼          │   │
│  │     "做什么"      "查什么"      "合格吗"      "怎么写"    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  3. PROMPT LAYERING (分层提示词工程)                         │   │
│  │  ────────────────────────────────────                        │   │
│  │                                                             │   │
│  │   LAYER 1: STRATEGIC (策略层)                               │   │
│  │   ├── Role: Lead Data Strategist                            │   │
│  │   ├── Output: 4-step execution plan                         │   │
│  │   └── Constraint: Abstract, high-level guidance            │   │
│  │                                                             │   │
│  │   LAYER 2: TACTICAL (战术层) [可选]                          │   │
│  │   ├── Role: Researcher / Quality Auditor                  │   │
│  │   ├── Output: External data / Validation flag              │   │
│  │   └── Constraint: Quality thresholds                       │   │
│  │                                                             │   │
│  │   LAYER 3: EXECUTION (执行层)                               │   │
│  │   ├── Role: Personal World-Class Workout Coach             │   │
│  │   ├── Output: 4-sentence structured notes                    │   │
│  │   └── Constraint: Exact numbers, percentages, no fluff      │   │
│  │                                                             │   │
│  │   Data Flow: LAYER 1 → LAYER 2 → LAYER 3                   │   │
│  │   Constraint Progression: Abstract → Specific → Exact       │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  4. WORKFLOW PATTERNS (工作流编排模式)                       │   │
│  │  ─────────────────────────────────────                       │   │
│  │                                                             │   │
│  │   PATTERN 1: LINEAR FLOW (线性流程)                         │   │
│  │   Entry → Node A → Node B → END                           │   │
│  │   Used when: Steps are deterministic, no branching         │   │
│  │                                                             │   │
│  │   PATTERN 2: CONDITIONAL BRANCHING (条件分支)                │   │
│  │                    ┌─────────┐                              │   │
│  │              ┌────→│ Node B  │                              │   │
│  │              │Yes  └─────────┘                              │   │
│  │   Entry → Decision                                          │   │
│  │              │No   ┌─────────┐                              │   │
│  │              └────→│ Node C  │                              │   │
│  │                    └─────────┘                              │   │
│  │   Used when: Path depends on state evaluation               │   │
│  │                                                             │   │
│  │   PATTERN 3: LOOP ITERATION (循环迭代)                       │   │
│  │   ┌─────────────────────────────────────┐                   │   │
│  │   │                                     ▼                   │   │
│  │   │  ┌─────────┐    ┌─────────┐    ┌─────────┐             │   │
│  │   └──│ Node A  │──→ │  Audit  │──No→│ Node B  │             │   │
│  │      └─────────┘    └─────────┘    └─────────┘             │   │
│  │                           │Yes                               │   │
│  │                           ▼                                  │   │
│  │                      ┌─────────┐                             │   │
│  │                      │  Node C │                             │   │
│  │                      └─────────┘                             │   │
│  │   Used when: Quality requires iteration                     │   │
│  │   Mechanism: Annotated[List, operator.add] for accumulation │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 关键设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **状态更新语义** | `Annotated[T, operator.add]` 追加 | 支持循环迭代，保留历史状态 |
| **节点数量** | 简化为2个 (Planner + Writer) | 减少延迟，移除外部依赖 (Tavily) |
| **LLM模型** | `gemini-2.5-flash` | 速度快，成本低，结构化输出稳定 |
| **提示词策略** | 分层约束 (Strategy → Execution) | 从抽象策略到精确执行的渐进细化 |
| **历史数据范围** | 7天 | 提供趋势上下文，支持定量对比，避免噪声 |
| **输出结构** | 4句话固定结构 | 可预测、可验证、易于前端解析展示 |

---

## 总结

本文档抽象了 FitWeek AI Coach 的核心设计模式，展示了如何使用 LangGraph 构建一个**可扩展、可解释、可控**的 AI Agent 工作流。

### 核心思想

1. **状态为中心**: 所有节点通过共享的 TypedDict 状态对象通信
2. **累加语义**: 使用 `Annotated + operator.add` 支持循环迭代
3. **角色分离**: 每个节点有明确的角色和职责边界
4. **分层提示词**: 从策略层到执行层的渐进约束细化
5. **模式化编排**: 线性、条件分支、循环迭代三种基本模式的组合

### 适用场景

此设计模式适用于以下类型的 AI 应用：

- 需要**结构化输出**的领域（如固定格式的报告、分析）
- 需要**多步骤推理**的复杂任务
- 需要**可追溯、可解释**的决策过程
- 需要**人机协作**的场景（人在循环中审核、调整）

### 扩展建议

1. **添加 Research Node**: 如需外部知识，可集成 Tavily/Serper 等搜索 API
2. **添加 Critique Node**: 如需质量循环，可添加审核节点形成迭代
3. **多模态扩展**: 可添加图像分析节点处理训练视频/姿势
4. **个性化学习**: 可添加用户反馈节点持续优化提示词

---

**文档版本**: v1.0  
**最后更新**: 2026-04-19  
**作者**: FitWeek AI Team
