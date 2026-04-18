---
name: claude_instructions
description: Instructions for Claude Code when working with this repository
type: reference
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sparky AI Fitness Agent** - A mobile-styled AI fitness and nutrition assistant built with React + Express. Users can chat with an AI to log workouts, track diet (via text or food images), generate workout plans, and view their fitness history.

## Commands

```bash
npm run dev      # Start development server (Express + Vite middleware mode)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # TypeScript type check
npm run clean    # Remove dist folder
```

## Architecture

### Tech Stack
- **Frontend**: React 19, Vite 6, Tailwind CSS 4, Motion (animations), Lucide React (icons)
- **Backend**: Express.js (integrated with Vite dev server)
- **Database**: SQLite (file-based, `fitness.sqlite`)
- **AI**: OpenAI API (primary) or Google Gemini (configurable)

### Key Files
- `server.ts` - Express server with API endpoints and dev/prod handling
- `services/dbService.ts` - SQLite database operations (schema, CRUD for meals, workouts, plans, metrics)
- `services/systemPrompt.ts` - AI system prompt (Chinese) defining intent extraction rules
- `services/memoryService.ts` - Semantic/episodic memory for AI context
- `services/trainingAnalytics.ts` - Workout trend analysis and calculations
- `services/nutritionService.ts` - Nutrition data analysis
- `services/insightEngine.ts` - Generate insights from analytics data
- `src/App.tsx` - Main React app with mobile-styled UI and chat functionality

### API Endpoints
- `GET /api/system-prompt` - Get AI system prompt
- `GET /api/chat/:sessionId` - Get chat history for a session
- `GET /api/chat-sessions` - List chat sessions
- `POST /api/chat-sessions` - Create new session
- `PATCH /api/chat-sessions/:sessionId` - Update session
- `DELETE /api/chat-sessions/:sessionId` - Delete session
- `POST /api/chat-openai` - Send message to AI (returns structured JSON with intent + data)
- `POST /api/upload-image` - Upload image for food recognition
- `POST /api/save-record` - Save extracted health record to database
- `GET /api/logs` - Get activity history
- `GET /api/semantic-memory` - Get user's semantic memory
- `PATCH /api/logs/:recordId` - Update activity record
- `DELETE /api/logs/:recordId` - Delete activity record
- `GET /api/analysis/workout-trends` - Get workout trend analysis
- `GET /api/analysis/nutrition` - Get nutrition analysis
- `GET /api/analysis/body-metrics` - Get body metrics trend
- `GET /api/analysis/summary` - Get combined dashboard summary

### Database Schema
- `users`, `chat_sessions`, `chat_messages` - Chat functionality
- `meal_logs`, `meal_items` - Diet/food records
- `workout_logs` - Exercise records
- `activity_records` - Unified activity log (food, workout, plans, measurements)
- `body_metrics` - Body measurements
- `user_semantic_memory` - AI memory for user profile

### Intent System
The AI returns structured JSON with intents that the frontend displays and saves:
- `generate_workout_plan` - Create training plan
- `update_workout_plan` - Adjust existing plan
- `log_strength_workout` - Log weight training
- `log_exercise` - Log cardio/general exercise
- `log_food` - Log diet (text)
- `log_food_multi` - Log diet (image recognition)
- `log_measurement` - Log body metrics
- `chat` - General chat

### Environment Variables
```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
DEFAULT_AI_PROVIDER=openai
```

### UI Structure
Mobile-styled container (iPhone-like frame), bottom navigation with 5 tabs: Home, Diet, Workout, Plan, AI. The AI tab contains chat interface with image upload support for food recognition.

## Memory System

Additional documentation available in `memory/` directory:
- `MEMORY.md` - Index of all memory files
- `project_overview.md` - Detailed project overview
- `database_schema.md` - Complete database schema
- `api_endpoints.md` - API reference
- `intent_system.md` - Intent extraction system
- `services_architecture.md` - Backend services
- `frontend_structure.md` - React components
