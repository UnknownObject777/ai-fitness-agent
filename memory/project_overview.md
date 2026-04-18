---
name: project_overview
description: Sparky AI Fitness Agent core project information, architecture, and tech stack
type: project
---

# Sparky AI Fitness Agent - Project Overview

## What is this project?

Sparky AI Fitness Agent is a mobile-styled AI fitness and nutrition assistant built with React + Express. Users can chat with an AI to log workouts, track diet (via text or food images), generate workout plans, and view their fitness history.

## Tech Stack

### Frontend
- **React 19** - UI framework
- **Vite 6** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **Motion** - Animations
- **Lucide React** - Icons

### Backend
- **Express.js** - Web framework (integrated with Vite dev server)
- **SQLite** - File-based database (`fitness.sqlite`)

### AI
- **OpenAI API** (primary) or **Google Gemini** (configurable)
- Default model: `gpt-4o-mini`

## Project Structure

```
F:\cch\code\sparky-ai-fitness-agent\
├── server.ts              # Express server with API endpoints
├── services/               # Backend services
│   ├── dbService.ts       # SQLite database operations
│   ├── systemPrompt.ts    # AI system prompt (Chinese)
│   ├── memoryService.ts   # Semantic/episodic memory for AI
│   ├── trainingAnalytics.ts  # Workout trend analysis
│   ├── nutritionService.ts   # Nutrition analysis
│   └── insightEngine.ts   # Insight generation from data
├── src/
│   ├── App.tsx            # Main React app with mobile UI
│   ├── main.tsx           # React entry point
│   └── components/        # React components
├── fitness.sqlite         # SQLite database (gitignored)
└── CLAUDE.md              # Project instructions for Claude Code
```

## Key Commands

```bash
npm run dev      # Start development server (Express + Vite middleware mode)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # TypeScript type check
npm run clean    # Remove dist folder
```

## Environment Variables

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
DEFAULT_AI_PROVIDER=openai
```

## Why

This project demonstrates how to build a practical AI assistant that combines:
- Natural language understanding for fitness/nutrition tracking
- Multi-modal input (text + images for food recognition)
- Persistent memory of user profiles and history
- Data analytics and insights generation
- Mobile-first responsive UI

## How to apply

When working on this codebase:
1. Check `CLAUDE.md` for project-specific guidance
2. Review the `services/` directory for backend logic
3. Check `src/App.tsx` for UI changes
4. Use the intent system for new AI features
5. Test with `npm run dev` before committing
