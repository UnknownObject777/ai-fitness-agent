---
name: frontend_structure
description: React frontend structure and components
type: reference
---

# Frontend Structure

## Tech Stack

- **React 19** - UI framework
- **Vite 6** - Build tool
- **Tailwind CSS 4** - Styling
- **Motion** - Animations
- **Lucide React** - Icons

## File Structure

```
src/
├── main.tsx                    # React entry point
├── App.tsx                     # Main app with mobile UI
└── components/
    ├── TrainingCardView.tsx    # Workout training cards view
    ├── AnalysisDashboard.tsx   # Analytics dashboard
    ├── DietAnalysisView.tsx    # Nutrition analysis view
    ├── WorkoutTrendsView.tsx # Workout trends view
    └── BodyMetricsView.tsx     # Body metrics tracking view
```

## Main Components

### App.tsx

**Responsibilities:**
- Mobile-styled container (iPhone-like frame)
- Bottom navigation with 5 tabs
- Chat interface with image upload
- Tab switching logic

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState<Tab>('home');
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [sessions, setSessions] = useState<Session[]>([]);
const [currentSessionId, setCurrentSessionId] = useState('session_1');
```

**Tabs:**
1. `home` - Analysis dashboard (AnalysisDashboard component)
2. `diet` - Diet analysis view (DietAnalysisView component)
3. `workout` - Training cards view (TrainingCardView component)
4. `plan` - Placeholder for workout plans
5. `ai` - Chat interface

**Chat Features:**
- Text input with send button
- Image upload for food recognition
- Session management (create, switch, archive)
- Message history per session

---

### TrainingCardView.tsx

**Responsibilities:**
- Display workout records as cards
- Show workout summary (exercises, sets, volume)
- Muscle group analysis visualization
- Date-based grouping

**Features:**
- Expandable workout cards
- Exercise breakdown with sets/reps/weight
- Volume load calculation
- RPE display

---

### AnalysisDashboard.tsx

**Responsibilities:**
- Main dashboard view (home tab)
- Display workout and nutrition summary cards
- Show recent insights
- Quick stats overview

**Data Sources:**
- `/api/analysis/summary` for combined data

---

### DietAnalysisView.tsx

**Responsibilities:**
- Nutrition analysis visualization
- Macro distribution charts
- Calorie trend over time
- Goal comparison display

**Data Sources:**
- `/api/analysis/nutrition`

---

### WorkoutTrendsView.tsx

**Responsibilities:**
- Workout trend visualization
- Volume over time chart
- Muscle group distribution
- Strength progress tracking

**Data Sources:**
- `/api/analysis/workout-trends`

---

### BodyMetricsView.tsx

**Responsibilities:**
- Body measurements tracking
- Weight trend chart
- Body fat percentage over time
- BMI calculation and display

**Data Sources:**
- `/api/analysis/body-metrics`

---

## State Management Pattern

The app uses React hooks for state management:

```typescript
// Main app state in App.tsx
const [activeTab, setActiveTab] = useState<Tab>('home');
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);

// Session management
const [sessions, setSessions] = useState<Session[]>([]);
const [currentSessionId, setCurrentSessionId] = useState('session_1');

// Image upload for food recognition
const [pendingImage, setPendingImage] = useState<string | null>(null);
```

## API Integration

All API calls use fetch with consistent error handling:

```typescript
const response = await fetch('/api/chat-openai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, sessionId, base64Image })
});
const data = await response.json();
```

## Styling Approach

- **Tailwind CSS** for all styling
- Mobile-first responsive design
- iPhone-like container frame
- Bottom navigation bar
- Card-based content display
- Consistent spacing and colors
