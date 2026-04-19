"""
FitWeek AI Critique 节点
=========================

本模块定义 LangGraph 工作流中的 Critique Node（审核节点）。
这是 AI 教练大脑的"质量审核员"，负责：
1. 审核 Research Node 收集的研究结果质量
2. 判断研究结果是否足够支持生成教练笔记
3. 如果研究不足，生成补充研究任务

当前状态：
本节点当前工作流中未使用（被注释掉）。
原本用于构建质量控制的循环机制，确保研究充分后才进入写作阶段。

简化原因：
1. Research Node 已被移除，无研究结果需要审核
2. 减少 LLM 调用次数，降低延迟和成本
3. 当前纯 LLM 分析已足够满足需求

如需重新启用：
1. 在 graph.py 中取消注释相关代码
2. 确保 route_from_auditor 路由函数正确配置
3. 在节点循环中连接 Research Node -> Critique Node

工作机制（完整版）：
1. Critique Node 接收 research_results 和 workout_data
2. 使用 Gemini LLM 评估研究结果的相关性和充分性
3. 返回 CritiqueOutput：
   - is_validated: 是否通过审核
   - missing_info_plans: 如未通过，补充研究任务列表
4. 路由器根据 is_validated 决定：
   - True: 流向 Writer Node
   - False: 流回 Research Node（循环）
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from agentStateNode import AgentState
from pydantic import BaseModel, Field
from typing import List


# =============================================================================
# 结构化输出模型定义
# =============================================================================

class CritiqueOutput(BaseModel):
    """
    审核结果结构化输出模型

    使用 Pydantic BaseModel 定义 Critique Node 的结构化输出格式。
    这确保 Gemini 返回的数据是一个格式良好的 JSON 对象，
    包含审核通过标志和补充研究任务列表。

    设计目的：
    - 明确的二元决策：is_validated 字段提供清晰的通过/失败信号
    - 可操作的反馈：missing_info_plans 提供具体的改进方向
    - 自动化友好：结构化格式便于程序解析和路由决策

    字段说明：
        is_validated (bool):
            审核通过标志。
            True 表示研究结果充分，可以进入写作阶段；
            False 表示研究不足，需要补充研究。

        missing_info_plans (List[str]):
            补充研究任务列表。
            当 is_validated=False 时使用，每个字符串描述一个具体的研究任务。
            这些任务会被追加到 research_plan 中，触发新一轮研究循环。

    使用示例：
        >>> # 审核通过的情况
        >>> output = CritiqueOutput(
        ...     is_validated=True,
        ...     missing_info_plans=[]
        ... )
        >>> # 审核失败的情况
        >>> output = CritiqueOutput(
        ...     is_validated=False,
        ...     missing_info_plans=[
        ...         "Research optimal RPE ranges for hypertrophy training",
        ...         "Find studies on recovery time for chest muscles after bench press"
        ...     ]
        ... )

    与路由器的配合：
        def route_from_auditor(state: AgentState):
            if state["is_validated"]:
                return "writer"  # 流向 Writer Node
            else:
                return "researcher"  # 流回 Researcher Node

    维护者注意：
        - 确保提示词清晰区分"通过"和"失败"的标准
        - 失败时提供的 missing_info_plans 应该具体、可执行
        - 考虑添加审核标准的一致性检查（如总是包含某些关键信息类型）
    """

    is_validated: bool = Field(description="True if research is sufficient, False otherwise.")
    missing_info_plans: List[str] = Field(description="Specific research steps to fix gaps if is_validated is False.")


# =============================================================================
# Critique Node 核心函数
# =============================================================================

def critique_node(state: AgentState):
    """
    Critique Node（审核节点）核心函数

    这是 LangGraph 工作流中的质量控制节点，扮演"质量审核员"的角色。
    它接收 Research Node 收集的研究结果，使用 Gemini LLM 评估研究质量，
    判断研究结果是否足够支持生成科学、安全的教练笔记。

    处理流程：
    1. 从状态中提取研究结果（research_results）和训练数据（workout_data）
    2. 初始化 Gemini LLM（使用 gemini-2.5-flash 模型）
    3. 构造审核提示词（prompt），包含：
       - 角色设定：质量审核员
       - 任务描述：评估研究充分性
       - 评估标准：科学性、安全性、针对性
    4. 调用 LLM 生成结构化审核结果（CritiqueOutput）
    5. 将审核结果返回到对应的状态字段

    评估标准详解：

    标准 1：科学性（Scientific Validity）
    - 研究结果是否基于科学证据（如同行评审的研究论文）
    - 信息来源是否权威（如 PubMed、学术期刊、专业组织）
    - 结论是否有数据支持（如研究样本量、统计显著性）

    标准 2：安全性（Safety）
    - 建议的训练方法是否考虑了受伤风险
    - 强度和容量建议是否在安全范围内
    - 是否考虑了恢复和过度训练的预防措施

    标准 3：针对性（Specificity）
    - 研究是否与用户的具体训练动作相关
    - 建议是否针对用户的训练目标和当前水平
    - 信息是否考虑了用户的具体训练历史

    通过标准：
    研究必须同时满足：
    - 至少 3 个相关且权威的信息来源
    - 至少 1 个来源直接涉及训练动作或相关肌肉群
    - 所有建议都有明确的科学依据

    失败处理：
    如果审核失败（is_validated=False）：
    1. 生成 2-3 个具体的补充研究任务
    2. 任务应该针对信息缺口（如缺少的肌肉群研究、恢复数据等）
    3. 任务会被追加到 research_plan，触发新一轮研究循环

    提示词设计说明：
    - 角色明确：质量审核员，职责是评估而非创作
    - 标准清晰：科学性、安全性、针对性三个维度
    - 决策二元：通过或失败，无模糊地带
    - 反馈具体：失败时提供可操作的改进任务

    参数:
        state (AgentState): 当前工作流状态对象，包含：
            - research_results (List[str]): Research Node 收集的研究结果列表
              每个字符串格式："Source: {URL}\nInsight: {Content}"
            - workout_data (dict): 原始训练数据，包含：
              - title: 训练标题
              - workoutDate: 训练日期
              - setLogs: 组记录列表

    返回:
        dict: 包含更新后状态字段的字典，格式如下：
            {
                "is_validated": bool,          # 审核通过标志
                "research_plan": List[str]     # 补充研究任务列表（仅在失败时使用）
            }

        说明：
        - 审核通过时：is_validated=True，research_plan=[]
        - 审核失败时：is_validated=False，research_plan=[补充任务1, 补充任务2, ...]

        LangGraph 会自动将这个字典的字段合并到整体状态中。
        由于 research_plan 使用 Annotated[List[str], operator.add]，
        新任务会追加到现有列表（而非替换），实现研究循环。

    使用示例：
        >>> state = {
        ...     "research_results": [
        ...         "Source: https://pubmed.ncbi.nlm.nih.gov/...\nInsight: Research suggests...",
        ...         "Source: https://www.strongerbyscience.com/...\nInsight: Optimal volume..."
        ...     ],
        ...     "workout_data": {
        ...         "title": "Chest Day",
        ...         "setLogs": [...]
        ...     },
        ...     ...
        ... }

        # 审核通过的场景
        >>> result = critique_node(state)
        >>> print(result)
        {
            "is_validated": True,
            "research_plan": []  # 空列表，无需补充研究
        }

        # 审核失败的场景
        >>> result = critique_node(state)
        >>> print(result)
        {
            "is_validated": False,
            "research_plan": [
                "Research specific guidelines for bench press RPE targets",
                "Find studies on chest muscle recovery time after heavy pressing"
            ]
        }

    依赖：
        - ChatGoogleGenerativeAI: LangChain 封装的 Gemini LLM 客户端
        - CritiqueOutput: Pydantic 模型，定义审核结果的结构化格式
        - AgentState: 类型字典，定义工作流状态结构

    环境要求：
        环境变量：
            GOOGLE_API_KEY: Google Gemini API 密钥（在 .env 文件中配置）

    模型信息：
        使用模型：gemini-2.5-flash
        选择理由：
        - 速度快：适合实时应用，延迟低
        - 成本效益：比 Pro 版本更经济
        - 判断任务：二元分类（通过/失败）适合 Flash 模型能力

    审核标准：
        通过条件（满足以下所有）：
        - 至少 3 个相关且权威的信息来源
        - 至少 1 个来源直接涉及训练动作或相关肌肉群
        - 所有建议都有明确的科学依据

        失败处理：
        - 生成 2-3 个具体的补充研究任务
        - 任务针对信息缺口（缺少的肌肉群研究、恢复数据等）
        - 任务会被追加到 research_plan，触发新一轮研究循环

    循环机制：
        审核失败 -> 生成补充任务 -> 追加到 research_plan -> Research Node 重新搜索
        这个循环可以重复多次，直到审核通过或达到最大迭代次数

    异常处理：
        - 如果 LLM 调用失败，会抛出异常并由 LangGraph 的异常处理机制捕获
        - 建议在调用处添加 try-except 块进行错误处理和日志记录
        - 如果审核输出格式异常（如 is_validated 为 None），应视为失败

    性能优化建议：
        1. 缓存 LLM 判断结果，避免对相同研究结果重复审核
        2. 设置最大循环次数（如 3 次），防止无限循环
        3. 考虑使用更轻量的模型或本地模型进行简单审核

    维护者注意：
        - 审核标准变更时需要同步更新提示词
        - 添加新的通过条件时，需确保 LLM 能获得足够信息做出判断
        - 定期审核失败案例，优化提示词以提高审核准确性
    """

    # 初始化 LLM（Large Language Model，大语言模型）
    # ChatGoogleGenerativeAI 是 LangChain 提供的 Google Gemini 模型封装
    # 使用 "gemini-2.5-flash" 模型，这是一个快速且经济的模型变体
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

    # 使用结构化输出包装器
    # with_structured_output 方法确保 LLM 返回符合 CritiqueOutput 模型的结构化数据
    # 这避免了自由文本解析的复杂性，直接返回可编程处理的 Python 对象
    structured_llm = llm.with_structured_output(CritiqueOutput)

    # 从状态中提取数据
    # research: 研究结果列表，每个元素是格式化的字符串
    # workout: 训练数据字典，包含标题、日期、组记录等
    research = state["research_results"]
    workout = state["workout_data"]

    # 构造审核提示词（Prompt）
    # 提示词是提供给 LLM 的指令，告诉它：
    # 1. 它扮演的角色（质量审核员）
    # 2. 它需要完成的任务（评估研究充分性）
    # 3. 评估标准（科学性、安全性、斯多葛哲学）
    # 4. 输出格式（通过/失败标志 + 补充任务列表）
    prompt = f"""
    You are the 'Quality Auditor' for the FitWeek AI.
    Review the gathered research for the workout: {workout.get('title')}.

    Current Research Data: {research}

    Evaluate if this data allows for a scientific, safe, and Stoic coaching tip.
    If it is vague or missing scientific backing for these specific exercises,
    set is_validated to False and provide 2-3 specific new research tasks.
    """

    # 调用 LLM 进行审核
    # structured_llm.invoke(prompt) 发送提示词到 Gemini API
    # 返回 CritiqueOutput 对象，包含 is_validated 和 missing_info_plans 字段
    response = structured_llm.invoke(prompt)

    # 将审核结果返回到状态
    # 注意：
    # 1. is_validated 直接返回到状态的 is_validated 字段
    #    用于条件路由决策（通过/失败）
    # 2. research_plan 仅在审核失败时返回补充任务
    #    使用三元表达式：如果通过则返回空列表，失败则返回任务列表
    # 3. 由于 research_plan 定义为 Annotated[List[str], operator.add]，
    #    新任务会追加到现有列表，实现研究循环
    return {
        "is_validated": response.is_validated,
        "research_plan": response.missing_info_plans if not response.is_validated else []
    }
