---
description: Create a comprehensive implementation plan for Sparky AI Fitness Agent features
argument-hint: [plan-description-or-requirements-file]
---

# Create Implementation Plan for Fitness Agent Features

You are about to create a comprehensive implementation plan for the Sparky AI Fitness Agent project. This involves analyzing requirements and creating a detailed roadmap for execution.

## Project Context

**Sparky AI Fitness Agent** is a mobile-styled AI fitness and nutrition assistant built with:
- **Frontend**: React 19 + Vite 6 + Tailwind CSS 4 + Motion
- **Backend**: Express.js with SQLite database
- **AI**: OpenAI API / Google Gemini for intent extraction

### Key Directories
- `src/` - React frontend components
- `services/` - Backend services (dbService, nutritionService, etc.)
- `server.ts` - Express server and API endpoints
- `memory/` - Project documentation

### Existing Components
- **Frontend**: `App.tsx`, `DietAnalysisView`, `BodyMetricsView`, `WorkoutTrendsView`, `TrainingCardView`, `ExerciseSelectorModal`, `ManualDietEntry`
- **Services**: `dbService.ts`, `nutritionService.ts`, `trainingAnalytics.ts`, `insightEngine.ts`, `systemPrompt.ts`

## Step 1: Read and Analyze Requirements

Understand the requirements or read the requirements document from: $ARGUMENTS

Extract and understand:
- Core feature requests and objectives
- Technical requirements and constraints
- Integration points with existing fitness tracking system
- AI intent system requirements (if applicable)
- Database schema changes needed

## Step 2: Research Phase

### 2.1 Web Research (if applicable)
- Search for fitness/health app best practices
- Look up React + fitness UI patterns
- Research nutrition/exercise tracking patterns

### 2.2 Codebase Analysis

**Use the `codebase-analyst` agent for deep pattern analysis**
- Launch the codebase-analyst agent to analyze:
  - How existing components are structured in `src/components/`
  - How services are organized in `services/`
  - How API endpoints are defined in `server.ts`
  - How the AI intent system works
  - Database patterns in `dbService.ts`

For quick searches:
- Use Grep to find similar features or patterns
- Look at existing similar components for reference
- Check `src/App.tsx` for UI patterns
- Check `server.ts` for API patterns

## Step 3: Planning and Design

### 3.1 Task Breakdown
Create a prioritized list of implementation tasks:
- Frontend components (React + Tailwind)
- Backend services (if needed)
- API endpoints (in server.ts)
- Database changes (in dbService.ts)
- AI intent handling (if applicable)

### 3.2 Technical Architecture
- Component structure following existing patterns
- Service integration patterns
- Database schema changes
- API endpoint design

### 3.3 Implementation References
- Similar components in `src/components/`
- Similar services in `services/`
- API patterns in `server.ts`
- Database patterns in `dbService.ts`

## Step 4: Create the Plan Document

Write a comprehensive plan to `PRPs/requests/[feature-name].md` with roughly this structure:

```markdown
# Implementation Plan: [Feature Name]

## Overview
[Brief description of what will be implemented]

## Requirements Summary
- [Key requirement 1]
- [Key requirement 2]

## Research Findings
### Best Practices
- [Finding 1]

### Reference Implementations
- [Example from src/components/ or services/]

### Technology Decisions
- [Technology choice 1 and rationale]

## Implementation Tasks

### Phase 1: Foundation
1. **Task Name**
   - Description: [What needs to be done]
   - Files to modify/create: [List files]
   - Dependencies: [Any prerequisites]
   - Estimated effort: [time estimate]

### Phase 2: Core Implementation
[Continue with numbered tasks...]

### Phase 3: Integration & Testing
[Continue with numbered tasks...]

## Codebase Integration Points
### Files to Modify
- `path/to/file1.ts` - [What changes needed]

### New Files to Create
- `path/to/newfile.ts` - [Purpose]

### Existing Patterns to Follow
- [Pattern 1 from codebase]

## Technical Design

### Architecture Diagram (if applicable)
```
[ASCII diagram or description]
```

### Data Flow
[Description of how data flows through the feature]

### API Endpoints (if applicable)
- `POST /api/endpoint` - [Purpose]

## Dependencies and Libraries
- [Library 1] - [Purpose]

## Testing Strategy
- Unit tests for [components]
- Integration tests for [workflows]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Notes and Considerations
- [Any important notes]
- [Potential challenges]
- [Future enhancements]

---
*This plan is ready for execution with `/execute-plan`*
```

## Step 5: Validation

Before finalizing the plan:
1. Ensure all requirements are addressed
2. Verify tasks are properly sequenced
3. Check that integration points are identified
4. Confirm research supports the approach
5. Make sure the plan is actionable and clear

## Important Guidelines

- **Be thorough in research**: The quality of the plan depends on understanding best practices
- **Keep it actionable**: Every task should be clear and implementable
- **Reference everything**: Include links, file paths, and examples
- **Consider the existing codebase**: Follow established patterns and conventions
- **Think about testing**: Include testing tasks in the plan
- **Size tasks appropriately**: Not too large, not too granular

## Output

Save the plan to the PRPs/requests/ directory and inform the user:
"Implementation plan created at: PRPs/requests/[feature-name].md
You can now execute this plan using: `/execute-plan PRPs/requests/[feature-name].md`"
