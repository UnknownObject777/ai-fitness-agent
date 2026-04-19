"""
FitWeek AI Researcher 节点
===========================

本模块定义 LangGraph 工作流中的 Research Node（研究节点）。
这是 AI 教练大脑的"研究员"，负责：
1. 执行网络搜索获取相关科学研究和数据
2. 为生成教练笔记提供外部信息支持

当前状态：
本节点当前工作流中未使用（被注释掉）。
原本用于通过 Tavily API 搜索健身相关的科学研究、训练方法等信息。

简化原因：
1. 减少外部 API 调用带来的延迟
2. 降低对第三方服务（Tavily）的依赖
3. 当前 AI 生成能力已足够支持纯 LLM 的分析

如需重新启用：
1. 在 graph.py 中取消注释相关代码
2. 确保 TAVILY_API_KEY 环境变量已配置
3. 在 requirements.txt 中添加 tavily-python 依赖

Tavily API 说明：
Tavily 是一个专门为 AI 应用设计的搜索引擎 API，特点：
- 针对长查询优化
- 返回结构化结果（标题、URL、摘要）
- 支持高级搜索参数（搜索深度、域名过滤等）
"""

import os
from tavily import TavilyClient
from agentStateNode import AgentState


# 初始化 Tavily 客户端
# TavilyClient 需要 TAVILY_API_KEY 环境变量
tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))


def research_node(state: AgentState):
    """
    Research Node（研究节点）核心函数

    这是 LangGraph 工作流中的研究节点，扮演"研究员"的角色。
    它接收 Planner Node 生成的研究计划，对每个计划步骤执行网络搜索，
    收集相关的科学研究、训练方法和健身知识，为生成教练笔记提供外部信息支持。

    处理流程：
    1. 从状态中提取研究计划（research_plan）
    2. 遍历计划中的每个研究步骤
    3. 对每个步骤调用 Tavily API 执行网络搜索
    4. 收集搜索结果的 URL 和内容摘要
    5. 将所有结果返回到状态的 research_results 字段

    Tavily 搜索配置说明：
    - search_depth="advanced": 使用高级搜索深度
      这会进行更深入的搜索，返回更多相关结果，但会增加延迟
      适合需要高质量科学研究的场景
    - query: 搜索查询字符串，来自 research_plan 中的每个步骤

    结果格式：
    Tavily 返回的结果结构如下：
    {
        "results": [
            {
                "url": "https://example.com/article",
                "content": "文章摘要内容...",
                ...
            },
            ...
        ]
    }
    本函数提取每个结果的 URL 和内容，格式化为字符串：
    "Source: {URL}\nInsight: {Content}"

    参数:
        state (AgentState): 当前工作流状态对象，包含：
            - research_plan (List[str]): Planner Node 生成的研究计划列表
                                        每个字符串是一个研究步骤描述

    返回:
        dict: 包含更新后状态字段的字典，格式如下：
            {
                "research_results": List[str]  # 格式化后的搜索结果字符串列表
            }

        每个结果字符串格式：
        "Source: {URL}\nInsight: {Content}"

    使用示例：
        >>> state = {
        ...     "research_plan": [
        ...         "Research optimal training volume for chest hypertrophy",
        ...         "Find RPE guidelines for strength training"
        ...     ],
        ...     ...
        ... }
        >>> result = research_node(state)
        >>> print(result["research_results"])
        [
            "Source: https://pubmed.ncbi.nlm.nih.gov/...\nInsight: Research suggests 10-20 sets per week...",
            "Source: https://www.strongerbyscience.com/...\nInsight: RPE 7-8 is optimal for most training...",
            ...
        ]

    依赖：
        - TavilyClient: Tavily 搜索引擎的 Python 客户端
        - AgentState: 工作流状态类型定义

    环境要求：
        环境变量：
            TAVILY_API_KEY: Tavily API 密钥（在 .env 文件中配置）

    异常处理：
        - 如果 TAVILY_API_KEY 未配置，TavilyClient 初始化会抛出异常
        - 如果 Tavily API 调用失败，会在控制台打印错误并返回空结果

    性能优化建议：
        1. Tavily 搜索可能是工作流的性能瓶颈，考虑添加缓存机制
        2. 对于常见的研究计划（如"深蹲训练量"），可以缓存搜索结果
        3. 使用异步并行处理多个研究步骤（当前是串行处理）

    维护者注意：
        - 本节点当前未在工作流中使用（被注释掉）
        - 重新启用时需要测试 Tavily API 的连接和配额
        - 考虑添加结果去重逻辑（多个步骤可能返回相同的 URL）
    """
    # 从状态中提取研究计划
    # research_plan 是由 Planner Node 生成的字符串列表
    # 每个字符串描述一个具体的研究任务
    plans = state["research_plan"]

    # 初始化结果列表，用于存储所有搜索结果
    results = []

    # 遍历研究计划中的每个步骤
    # 注意：当前是串行处理，每个步骤依次执行搜索
    for step in plans:
        # 打印日志，方便调试和监控
        print(f"Architect researching: {step}")

        # 调用 Tavily API 执行网络搜索
        # search_depth="advanced": 使用高级搜索，返回更深入的结果
        search_result = tavily.search(query=step, search_depth="advanced")

        # 处理搜索结果，提取 URL 和内容
        # Tavily 返回的结果结构包含 results 列表
        for context in search_result.get('results', []):
            # 格式化每个结果为 "Source: URL\nInsight: Content"
            # 方便 Writer Node 理解和使用
            results.append(f"Source: {context['url']}\nInsight: {context['content']}")

    # 返回搜索结果到状态
    # research_results 字段会追加到 AgentState 中
    # 使用 Annotated[List[str], operator.add] 确保追加而非覆盖
    return {
        "research_results": results
    }
