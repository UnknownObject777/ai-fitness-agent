# Sparky AI Fitness Agent

Sparky 是一个移动端风格的 AI 健身与饮食助手。它可以通过自然语言或食物图片记录训练、饮食和身体数据，也可以基于历史记录生成训练建议、查看趋势分析，并维护用户长期语义记忆。

当前主架构是 **React + Vite 前端** 和 **FastAPI + LangGraph 后端**。早期 Express 实现已保留在 `server.ts.legacy`，但日常开发以 `backend/app` 为准。

## 功能概览

- AI 对话：支持多轮聊天、会话列表、会话归档、会话重命名和删除。
- 饮食记录：支持文本记录、手动搜索食物营养、图片识别多食物并估算营养。
- 训练记录：支持自由训练、训练模板、组数/重量/次数记录、休息计时和完成进度。
- 身体数据：记录体重、体脂、腰围、胸围、臀围等指标。
- 趋势分析：展示训练趋势、营养摄入、身体指标变化和综合洞察。
- 长期记忆：后端维护 `user_semantic_memory`，用于保存偏好、训练统计和历史上下文。
- 本地持久化：SQLite 数据库和上传图片都保存在项目本地。

## 技术栈

### 前端

- React 19
- Vite 6
- Tailwind CSS 4
- Motion
- Lucide React
- Recharts

### 后端

- FastAPI
- LangGraph
- LangChain OpenAI / Google GenAI
- SQLite / aiosqlite
- Pydantic v2
- uv

## 目录结构

```text
.
+-- backend/                  # FastAPI + LangGraph 后端
|   +-- app/
|   |   +-- agent/            # LangGraph 节点、状态、LLM 和 prompt
|   |   +-- api/              # HTTP API 路由
|   |   +-- models/           # 请求/响应模型
|   |   +-- services/         # 数据库、记忆、营养、训练分析等服务
|   +-- tests/                # 后端测试
|   +-- pyproject.toml
+-- src/                      # React 前端
|   +-- components/           # 分析、训练、饮食、身体数据等组件
|   +-- data/                 # 前端静态数据
|   +-- App.tsx               # 主应用
|   +-- main.tsx
+-- memory/                   # 项目记忆文档
+-- uploads/                  # 图片上传目录
+-- fitness.sqlite            # 本地 SQLite 数据库
+-- server.ts.legacy          # 旧 Express 服务实现
+-- vite.config.ts            # Vite 配置和 API 代理
+-- package.json
```

## 快速开始

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
cd backend
uv sync
cd ..
```

### 3. 配置环境变量

后端会读取仓库根目录的 `.env` 和 `backend/.env`。推荐从后端示例文件复制一份到根目录：

```bash
cp backend/.env.example .env
```

Windows PowerShell 可以使用：

```powershell
Copy-Item backend\.env.example .env
```

常用配置如下：

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

DEFAULT_AI_PROVIDER=openai
SPARKY_DATABASE_PATH=../fitness.sqlite
SPARKY_UPLOAD_DIR=../uploads
```

说明：

- `DEFAULT_AI_PROVIDER` 可设置为 `openai` 或 `gemini`。
- `SPARKY_DATABASE_PATH` 默认指向项目根目录的 `fitness.sqlite`。
- `SPARKY_UPLOAD_DIR` 默认指向项目根目录的 `uploads/`。
- 不要提交真实 API Key。

### 4. 启动开发环境

```bash
npm run dev:all
```

启动后：

- 前端地址：`http://localhost:5173`
- 后端地址：`http://localhost:8000`
- API 文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

Vite 已配置代理，前端请求 `/api` 和 `/uploads` 会转发到 FastAPI 的 `8000` 端口。

也可以分别启动：

```bash
npm run dev
npm run dev:backend
```

## 可用脚本

```bash
npm run dev          # 启动 Vite 前端
npm run dev:backend  # 启动 FastAPI 后端
npm run dev:all      # 同时启动前后端
npm run build        # 构建前端生产包
npm run preview      # 预览前端生产包
npm run lint         # TypeScript 类型检查
npm run clean        # 清理 dist 目录
```

后端常用命令：

```bash
cd backend
uv run pytest -v
uv run python -m compileall app tests
```

## API 概览

### 基础

- `GET /health`：健康检查。
- `GET /api/system-prompt`：获取 AI 系统提示词。

### 聊天与会话

- `GET /api/chat/{session_id}`：获取指定会话消息。
- `POST /api/chat-openai`：发送聊天请求，由 LangGraph agent 返回结构化结果。
- `GET /api/chat-sessions?scope=active|archived|all`：获取会话列表。
- `POST /api/chat-sessions`：创建会话。
- `PATCH /api/chat-sessions/{session_id}`：更新会话标题或归档状态。
- `DELETE /api/chat-sessions/{session_id}`：删除会话和消息。

### 记录与历史

- `POST /api/save-record`：保存饮食、训练、身体指标或计划记录。
- `GET /api/logs`：获取活动历史。
- `PATCH /api/logs/{record_id}`：修改活动记录。
- `DELETE /api/logs/{record_id}`：删除活动记录。

### 图片与食物字典

- `POST /api/upload-image`：上传 base64 图片并返回图片地址。
- `GET /api/dictionary/foods?q=keyword`：搜索食物营养数据。

### 分析与记忆

- `GET /api/semantic-memory`：获取用户长期语义记忆。
- `GET /api/analysis/workout-trends`：训练趋势分析。
- `GET /api/analysis/nutrition`：饮食营养分析。
- `GET /api/analysis/body-metrics`：身体指标趋势。
- `GET /api/analysis/summary`：训练、饮食和身体指标综合摘要。

## AI 意图类型

后端 agent 会把用户输入解析成结构化意图，前端根据意图展示卡片并保存记录。

常见意图包括：

- `generate_workout_plan`：生成训练计划。
- `update_workout_plan`：调整已有训练计划。
- `log_strength_workout`：记录力量训练。
- `log_exercise`：记录有氧或普通运动。
- `log_food`：记录单项饮食。
- `log_food_multi`：记录图片识别出的多项食物。
- `log_measurement`：记录身体指标。

## 数据存储

默认使用项目根目录下的 `fitness.sqlite`。启动后端时会自动创建或补齐以下表：

- `users`
- `chat_sessions`
- `chat_messages`
- `meal_logs`
- `meal_items`
- `workout_logs`
- `activity_records`
- `body_metrics`
- `user_semantic_memory`

图片上传默认保存在 `uploads/`，并通过 `/uploads/{filename}` 访问。

## 开发检查

提交前建议运行：

```bash
npm run lint
npm run build

cd backend
uv run pytest -v
uv run python -m compileall app tests
```

## 相关文档

- `backend/README.md`：后端单独说明。
- `memory/MEMORY.md`：项目记忆文档索引。
- `memory/database_schema.md`：数据库结构说明。
- `memory/api_endpoints.md`：接口说明。
- `memory/intent_system.md`：意图系统说明。
- `memory/frontend_structure.md`：前端结构说明。

## 备注

- `server.ts.legacy` 是旧 Express 服务实现，仅作历史参考。
- 当前开发命令以 `npm run dev:all` 为主。
- 如果切换 AI Provider，请确认对应 API Key 已配置。
