# Prime Context for the AI Coding Assistant

Start with reading the CLAUDE.md file if it exists to get an understanding of the project.

Read key files to understand the project:

## Frontend (React + Vite)
- `src/main.tsx` - Entry point
- `src/App.tsx` - Main React app with mobile-styled UI
- `src/components/` - React components:
  - `DietAnalysisView.tsx` - Diet/nutrition analysis view
  - `BodyMetricsView.tsx` - Body metrics tracking
  - `AnalysisDashboard.tsx` - Main dashboard
  - `WorkoutTrendsView.tsx` - Workout trends visualization
  - `ExerciseSelectorModal.tsx` - Exercise selection modal
  - `ManualDietEntry.tsx` - Manual food entry component
  - `TrainingCardView.tsx` - Training card display
- `src/data/exerciseDictionary.ts` - Exercise data

## Backend (Express + SQLite)
- `server.ts` - Express server with API endpoints
- `services/` - Backend services:
  - `dbService.ts` - SQLite database operations
  - `systemPrompt.ts` - AI system prompt (Chinese)
  - `memoryService.ts` - Chat memory management
  - `trainingAnalytics.ts` - Training data analytics
  - `nutritionService.ts` - Nutrition processing
  - `insightEngine.ts` - AI insights generation
  - `nutritionApiService.ts` - External nutrition API

## Explain back to me:
- Project structure and architecture
- Key features and functionality
- How the AI fitness agent works (intent system)
- Database schema overview
- Any important dependencies or configuration
