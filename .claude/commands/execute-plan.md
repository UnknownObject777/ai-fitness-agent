---
description: Execute a development plan for the Sparky AI Fitness Agent with integrated task management
argument-hint: [plan-file-path]
---

# Execute Development Plan for Sparky AI Fitness Agent

You are about to execute a comprehensive development plan with integrated task management.

## Project Context

**Sparky AI Fitness Agent** - A mobile-styled AI fitness and nutrition assistant built with React + Express.

### Project Structure
- `src/` - React frontend (App.tsx, components/)
- `services/` - Backend services (dbService.ts, nutritionService.ts, etc.)
- `server.ts` - Express server
- `memory/` - Project documentation

### Key Technologies
- React 19, Vite 6, Tailwind CSS 4, Motion
- Express.js with SQLite
- OpenAI API / Google Gemini

## Step 1: Read and Parse the Plan

Read the plan file specified in: $ARGUMENTS

The plan file will contain:
- A list of tasks to implement
- References to existing codebase components and integration points
- Context about where to look in the codebase for implementation

## Step 2: Create All Tasks Locally

For EACH task identified in the plan:
1. Create a corresponding task using `TaskCreate`
2. Set initial status as "pending"
3. Include detailed descriptions from the plan
4. Maintain the task order/priority from the plan

**IMPORTANT**: Create ALL tasks upfront before starting implementation. This ensures complete visibility of the work scope.

## Step 3: Codebase Analysis

Before implementation begins:
1. Analyze ALL integration points mentioned in the plan
2. Use Grep and Glob tools to:
   - Understand existing code patterns
   - Identify where changes need to be made
   - Find similar implementations for reference
3. Read all referenced files and components
4. Build a comprehensive understanding of the codebase context

### Key Files to Reference
- `src/App.tsx` - Main app structure and UI patterns
- `server.ts` - API endpoint patterns
- `services/dbService.ts` - Database patterns
- `src/components/` - Existing component patterns
- `services/` - Service patterns

## Step 4: Implementation Cycle

For EACH task in sequence:

### 4.1 Start Task
- Move the current task to "in_progress" status using `TaskUpdate`
- Track any subtasks locally if needed

### 4.2 Implement
- Execute the implementation based on:
  - The task requirements from the plan
  - Your codebase analysis findings
  - Best practices and existing patterns
- Make all necessary code changes
- Ensure code quality and consistency

**Follow Existing Patterns**:
- React components: Follow patterns in `src/components/`
- API endpoints: Follow patterns in `server.ts`
- Services: Follow patterns in `services/`
- Database: Follow patterns in `dbService.ts`

### 4.3 Complete Task
- Once implementation is complete, update task status appropriately
- Document any issues or notes

### 4.4 Proceed to Next
- Move to the next task in the list
- Repeat steps 4.1-4.3

**CRITICAL**: Only ONE task should be in "in_progress" status at any time. Complete each task before starting the next.

## Step 5: Validation Phase

After ALL tasks are complete:

**Use the `validator` agent for comprehensive testing**
1. Launch the validator agent using the Task tool
   - Provide the validator with a detailed description of what was built
   - Include the list of features implemented and files modified
   - The validator will create simple, effective unit tests
   - It will run tests and report results

The validator agent will:
- Create focused unit tests for the main functionality
- Test critical edge cases and error handling
- Run the tests using the project's test framework
- Report what was tested and any issues found

Additional validation you should perform:
- Check for integration issues between components
- Ensure all acceptance criteria from the plan are met
- Run `npm run lint` for type checking
- Run `npm run dev` to verify the app starts correctly

## Step 6: Finalize Tasks

After successful validation:

1. For each task that has corresponding test coverage:
   - Mark as "completed" using `TaskUpdate`

2. For any tasks without test coverage:
   - Leave in previous status for future attention
   - Document why they remain incomplete

## Step 7: Final Report

Provide a summary including:
- Total tasks created and completed
- Key features implemented
- Files modified/created
- Any issues encountered and how they were resolved
- Testing results

## Workflow Rules

1. **ALWAYS** create all tasks upfront before starting implementation
2. **MAINTAIN** one task in "in_progress" status at a time
3. **VALIDATE** all work before marking tasks as completed
4. **TRACK** progress continuously through task status updates
5. **ANALYZE** the codebase thoroughly before implementation
6. **TEST** everything before final completion
7. **FOLLOW** existing code patterns and conventions

## Error Handling

If at any point task management fails:
1. Retry the operation
2. If persistent failures, document the issue but continue tracking manually
3. Never abandon task tracking - find workarounds if needed

Remember: The success of this execution depends on maintaining systematic task management throughout the entire process.
