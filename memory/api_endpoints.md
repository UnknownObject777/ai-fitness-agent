---
name: api_endpoints
description: REST API endpoints for Sparky AI Fitness Agent
type: reference
---

# API Endpoints

Base URL: `http://localhost:3000`

## Chat & AI

### GET /api/system-prompt
Get AI system prompt
```json
{ "prompt": "..." }
```

### GET /api/chat/:sessionId
Get chat history for a session
```json
{ "success": true, "messages": [...] }
```

### GET /api/chat-sessions
List chat sessions (query: `scope=active|archived|all`)
```json
{ "success": true, "sessions": [...] }
```

### POST /api/chat-sessions
Create new chat session
```json
{ "title": "Optional Title" }
```
Response:
```json
{ "success": true, "session": { "id": "...", "title": "..." } }
```

### PATCH /api/chat-sessions/:sessionId
Update session (title or archived status)
```json
{ "title": "New Title" }
{ "archived": true }
```

### DELETE /api/chat-sessions/:sessionId
Delete session and its messages

### POST /api/chat-openai
**Main AI chat endpoint**
```json
{
  "messages": [{ "role": "user", "content": "..." }],
  "sessionId": "session_1",
  "base64Image": "data:image/jpeg;base64,...",
  "imageKey": "uploaded_image_key"
}
```
Response: AI-generated JSON with intent, data, and response

### POST /api/upload-image
Upload image for food recognition
```json
{ "base64Image": "data:image/jpeg;base64,..." }
```
Response:
```json
{ "success": true, "imageKey": "...", "imageUrl": "/uploads/..." }
```

## Data Records

### POST /api/save-record
Save extracted health record to database
```json
{
  "intent": "log_strength_workout",
  "data": { ... },
  "entryDate": "2026-04-18"
}
```

### GET /api/logs
Get activity history (last 100 records)
```json
[
  { "id": "...", "intent": "...", "timestamp": "...", "data": {...} }
]
```

### PATCH /api/logs/:recordId
Update activity record
```json
{ "data": {...}, "entryDate": "2026-04-18" }
```

### DELETE /api/logs/:recordId
Delete activity record

### GET /api/semantic-memory
Get user's semantic memory (AI profile)
```json
{ "success": true, "memory": { "userProfile": {...}, "strengthModel": {...} } }
```

## Analysis APIs (v1.1)

### GET /api/analysis/workout-trends
Get workout trend analysis
Query params: `range=7d|30d|90d|180d` (default: 30d), `userId=user_1`

Response:
```json
{
  "success": true,
  "data": {
    "trendPoints": [...],
    "muscleDistribution": [...],
    "strengthProgress": [...],
    "summary": {...}
  },
  "insights": [...]
}
```

### GET /api/analysis/nutrition
Get nutrition analysis
Query params: `range=7d|30d|90d|180d`, `userId=user_1`

Response:
```json
{
  "success": true,
  "data": {
    "dailyData": [...],
    "macroDistribution": {...},
    "summary": {...},
    "goalComparison": {...}
  },
  "insights": [...]
}
```

### GET /api/analysis/body-metrics
Get body metrics trend
Query params: `range=30d|90d|180d` (default: 90d), `userId=user_1`

Response:
```json
{
  "success": true,
  "data": [
    { "date": "2026-04-01", "weight_kg": 70, "body_fat_pct": 15, ... }
  ]
}
```

### GET /api/analysis/summary
Get combined dashboard summary
Query params: `range=7d|30d|90d`, `userId=user_1`

Response:
```json
{
  "success": true,
  "workout": {...},
  "nutrition": {...},
  "bodyMetrics": [...],
  "insights": [...]
}
```

## Error Responses

All endpoints return consistent error format:
```json
{ "success": false, "error": "Error message" }
```

HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `500` - Server error
