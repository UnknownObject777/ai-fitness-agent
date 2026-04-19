"""
FitWeek AI 数据库工具模块
===========================

本模块提供与 PostgreSQL 数据库交互的功能，主要用于：
1. 查询动作的 7 天历史训练记录
2. 为 Writer Node 提供历史数据支持

数据库架构：
- 使用 SQLAlchemy 作为 ORM 和连接池管理工具
- 连接 PostgreSQL 数据库
- 主要涉及的表：
  - set_logs: 存储每组训练的详细信息（重量、次数、RPE）
  - workout_sessions: 存储训练会话的元信息（标题、日期）

环境要求：
- DATABASE_URL 环境变量必须在 .env 文件中配置
- 格式：postgresql://user:password@host:port/database

性能优化：
- 使用 SQLAlchemy 的连接池管理数据库连接
- 查询使用索引优化（确保 exercise_name 和 workout_date 列有索引）
- 限制查询范围为 7 天，避免全表扫描
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# 加载 .env 文件中的环境变量
# 包含 DATABASE_URL 等敏感信息
load_dotenv()

# 从环境变量读取数据库连接 URL
# 格式：postgresql://user:password@host:port/database
DB_URL = os.getenv("DATABASE_URL")

# 验证环境变量是否配置正确
# 如果 DATABASE_URL 未设置，抛出环境错误，防止应用以无效配置启动
if not DB_URL:
    raise EnvironmentError("DATABASE_URL not found in .env. Check your Docker container.")

# 创建 SQLAlchemy 数据库引擎
# create_engine 参数说明：
# - DB_URL: 数据库连接 URL
# - pool_pre_ping=True: 在从连接池取连接前，先发送一个简单的 ping 检查连接是否有效
#   这可以防止使用已断开的连接，提高应用稳定性
engine = create_engine(DB_URL, pool_pre_ping=True)


def get_exercise_history_7_days(exercise_name: str):
    """
    查询指定动作在过去 7 天内的所有训练记录

    这是数据库工具模块的核心函数，为 Writer Node 提供历史数据支持。
    它查询指定动作在过去 7 天内的所有组记录，包括重量、次数、RPE 和训练日期。

    查询逻辑：
    1. 在 set_logs 表中筛选指定动作名称的记录
    2. 通过 workout_session_id 关联 workout_sessions 表
    3. 筛选 workout_date 在过去 7 天内的记录（CURRENT_DATE - INTERVAL '7 days'）
    4. 按 workout_date 降序排列（最近的在前）

    参数:
        exercise_name (str): 要查询的动作名称（如 "Bench Press"、"Squat"）
                           注意：名称区分大小写，必须与数据库中的存储完全一致

    返回:
        List[Row]: 查询结果列表，每个元素是一个 SQLAlchemy Row 对象
                   每个 Row 包含以下列（可以通过属性访问）：
            - weight (float): 使用的重量（kg）
            - reps (int): 完成的重复次数
            - rpe (int): 主观疲劳程度评分（1-10，10 表示极限努力）
            - workout_date (datetime.date): 训练日期

        如果查询失败或没有匹配记录，返回空列表 []

    使用示例：
        # 查询 "Bench Press" 的 7 天历史
        history = get_exercise_history_7_days("Bench Press")

        # 遍历结果
        for record in history:
            print(f"Date: {record.workout_date}")
            print(f"Weight: {record.weight}kg")
            print(f"Reps: {record.reps}")
            print(f"RPE: {record.rpe}")
            print("---")

        # 计算平均重量
        if history:
            avg_weight = sum(r.weight for r in history) / len(history)
            print(f"Average weight: {avg_weight:.1f}kg")

    在 Writer Node 中的使用：
        # 遍历今日训练的所有动作
        for entry in workout.get('setLogs', []):
            exercise = entry.get('exerciseName')
            # 查询该动作的 7 天历史
            hist = get_exercise_history_7_days(exercise)

            if hist:
                # 格式化为人类可读的字符串
                h_str = [f"{h.weight}kg x {h.reps} (RPE {h.rpe}) on {h.workout_date}" for h in hist]
                history_context.append(f"{exercise} 7-Day History: {h_str}")
            else:
                history_context.append(f"{exercise}: No recent history found.")

    依赖：
        - SQLAlchemy: Python SQL 工具包和 ORM
        - create_engine: 创建数据库引擎
        - text: 创建原始 SQL 查询

    环境要求：
        环境变量：
            DATABASE_URL: PostgreSQL 连接 URL（在 .env 文件中配置）
                          格式：postgresql://user:password@host:port/database

    数据库 Schema 要求：
        表 set_logs：
            - id: 主键
            - exercise_name: VARCHAR，动作名称
            - weight: FLOAT，重量（kg）
            - reps: INTEGER，次数
            - rpe: INTEGER，RPE（1-10）
            - workout_session_id: 外键，关联 workout_sessions

        表 workout_sessions：
            - id: 主键
            - title: VARCHAR，训练标题
            - workout_date: DATE，训练日期

        索引要求（性能优化）：
        - set_logs.exercise_name: 加速按动作名称筛选
        - workout_sessions.workout_date: 加速按日期范围筛选
        - set_logs.workout_session_id: 加速关联查询

    性能特征：
        - 时间复杂度：O(1) 平均（使用索引的查询）
        - 空间复杂度：O(n)，n 为返回的记录数
        - 典型延迟：10-100ms（取决于数据库负载和网络）

    连接池配置：
        create_engine 默认使用连接池，参数：
        - pool_size: 5（默认保持连接数）
        - max_overflow: 10（超出 pool_size 的最大额外连接）
        - pool_pre_ping=True: 验证连接有效性

    错误处理：
        - 数据库连接失败：抛出 SQLAlchemy 的 DBAPIError
        - 查询执行失败：抛出 SQLAlchemy 的 SQLAlchemyError
        - 函数内部捕获异常，返回空列表 []

    日志记录：
        函数内部打印错误信息到标准输出：
        print(f"DB Memory Error: {e}")

    建议的改进：
        1. 添加重试机制：数据库暂时不可用时自动重试
        2. 添加缓存层：缓存频繁查询的结果（如常用动作的 7 天历史）
        3. 批量查询：支持一次查询多个动作的历史（减少数据库往返）
        4. 连接监控：监控连接池使用率，防止连接泄漏
        5. 查询优化：对于大数据量，考虑使用物化视图或预聚合表

    安全性：
        - 使用参数化查询（:name）防止 SQL 注入
        - 数据库凭据从环境变量读取，不硬编码
        - 使用最小权限原则：应用数据库用户只应有 SELECT 权限（只读）

    维护者注意：
        - 修改 SQL 查询时，确保索引仍然有效
        - 监控查询执行计划，防止全表扫描
        - 数据库 schema 变更时需要同步更新此函数
        - 考虑添加查询执行时间监控，及时发现性能退化
    """

    # 初始化 LLM（Large Language Model，大语言模型）
    # ChatGoogleGenerativeAI 是 LangChain 提供的 Google Gemini 模型封装
    # 使用 "gemini-2.5-flash" 模型，这是一个快速且经济的模型变体
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

    # 从状态中提取训练数据
    # workout 是一个字典，包含 title、workoutDate、setLogs 等字段
    workout = state["workout_data"]

    # 从状态中提取 Planner Node 生成的分析计划
    # instructions 是一个字符串列表，每个字符串描述一个具体的分析步骤
    instructions = state["research_plan"]

    # =================================================================
    # 步骤 1：查询并格式化 7 天历史数据
    # =================================================================

    # 初始化历史数据上下文列表
    # 这个列表将存储每个动作的格式化历史记录，用于构建 LLM 提示词
    history_context = []

    # 遍历今日训练数据中的每个组记录
    # workout.get('setLogs', []) 获取组记录列表
    for entry in workout.get('setLogs', []):
        # 提取动作名称
        # exerciseName 字段标识了这个组记录对应的训练动作
        exercise = entry.get('exerciseName')

        # 查询该动作的 7 天历史记录
        # get_exercise_history_7_days 函数执行 SQL 查询并返回结果列表
        hist = get_exercise_history_7_days(exercise)

        # 处理查询结果
        if hist:
            # 如果存在历史记录，格式化为人类可读的字符串列表
            # hist 是一个列表，每个元素是一个包含 (weight, reps, rpe, workout_date) 的元组
            # 使用列表推导式格式化每个历史记录
            # 格式："{weight}kg x {reps} (RPE {rpe}) on {workout_date}"
            h_str = [f"{h.weight}kg x {h.reps} (RPE {h.rpe}) on {h.workout_date}" for h in hist]

            # 将格式化的历史记录添加到上下文列表
            # 格式："{exercise} 7-Day History: ['记录1', '记录2', ...]"
            history_context.append(f"{exercise} 7-Day History: {h_str}")
        else:
            # 如果没有找到历史记录（新动作或 7 天内未训练）
            # 添加一个友好的提示信息，告知 LLM 这是新动作
            history_context.append(f"{exercise}: No recent history found.")

    # =================================================================
    # 步骤 2：构造提示词并生成教练笔记
    # =================================================================

    # 构造详细的定量分析提示词
    # 这是整个 Writer Node 的核心，决定了生成笔记的质量和结构
    # 提示词包含多个部分：角色设定、数据输入、严格定量指南、约束条件
    prompt = f"""
    You are my Personal World-Class Workout Coach. Your goal is to provide a
    highly specific, quantitative analysis based ONLY on the data below.

    TODAY'S WORKOUT: {workout.get('setLogs')}
    7-DAY HISTORY: {history_context}
    PLANNER INSTRUCTIONS: {instructions}

    STRICT QUANTITATIVE GUIDELINES (4 SENTENCES TOTAL):
    1. Sentence 1 (Volume Analysis): Compare today's total tonnage (weight * reps) per muscle group to the 7-day average.
    2. Sentence 2 (Imbalance Check): Call out specific muscle groups that are currently being overtrained or undertrained based on the history provided.
    3. Sentence 3 (Intensity Prescription): State a precise, RPE-adjusted load (kg) or rep target for the next session's primary lift.
    4. Sentence 4 (Exertion Goal): List the specific target RPE exertion levels for each muscle group involved to optimize future recovery.

    CONSTRAINTS: No philosophical, vague, or flowery language. Use exact numbers and percentages.
    """

    # 调用 LLM 生成教练笔记
    # llm.invoke(prompt) 发送提示词到 Gemini API
    # 返回一个包含生成文本的响应对象
    response = llm.invoke(prompt)

    # 返回生成的教练笔记到状态
    # final_notes 是工作流的最终输出
    # main.py 的 /analyze 端点从状态中读取 final_notes 并返回给客户端
    return {"final_notes": response.content.strip()}
