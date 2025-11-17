# Code Comments Guide

This document explains the structure and comments throughout the Draggable To-Do application code.

## index.html Structure

### Head Section
```html
<!-- Character encoding and viewport for responsive design -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />

<!-- Link to external CSS stylesheet (all styling) -->
<link rel="stylesheet" href="styles.css">

<!-- Link to external JavaScript file (all logic) -->
<script src="script.js"></script>
```

### Body Structure

#### 1. Header Section
```html
<!-- HEADER: Title and application description -->
<header>
  <h1>Draggable To-Do</h1>
  <p class="subtitle">Create, edit, delete and drag tasks between columns.</p>
</header>
```

#### 2. Controls Section
```html
<!-- CONTROLS: Quick-add bar for rapid task creation -->
<div class="controls" role="region" aria-label="Task controls">
  <!-- Task title input field -->
  <input id="titleInput" ... />
  <!-- Column dropdown (To Do, In Progress, Done) -->
  <select id="columnSelect" ... />
  <!-- Add Task button (creates task or opens modal) -->
  <button id="openCreate" ... />
  <!-- Clear all saved tasks button -->
  <button id="clearStorage" ... />
</div>
```

#### 3. Board Section
```html
<!-- BOARD: Three-column kanban layout -->
<!-- aria-live="polite" tells screen readers to announce changes -->
<main class="board" id="board" aria-live="polite">
  <!-- Columns and tasks are inserted here by JavaScript -->
</main>
```

#### 4. Modal Dialog
```html
<!-- MODAL: Pop-up form for creating/editing tasks -->
<div id="modalBackdrop" class="modal-backdrop" role="dialog" aria-modal="true">
  <div class="modal" role="document">
    <!-- Title field (required) -->
    <input id="taskTitle" required ... />
    <!-- Description field (optional) -->
    <textarea id="taskDesc" ... />
    <!-- Column selector -->
    <select id="taskColumn" ... />
    <!-- Cancel and Save buttons -->
  </div>
</div>
```

#### 5. Accessibility Regions
```html
<!-- ANNOUNCER: Hidden region that announces actions to screen readers -->
<div id="announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>

<!-- TOAST: Visual notification popup (bottom right) -->
<div id="toast" class="toast" role="status" aria-live="polite"></div>
```

---

## script.js Structure

### Section 1: Storage & Configuration

**Purpose:** Load/save data, generate IDs, show notifications

```javascript
/* Storage key - identifies data location in localStorage */
const STORAGE_KEY = 'draggable-todo-board-v1';

/* Data model - stores all tasks organized by column */
let board = { todo: [], inprogress: [], done: [] };

/* Currently editing task ID (null if creating) */
let editingTaskId = null;

/* Functions:
   - genId(): Generate unique task ID
   - nowISO(): Get current timestamp
   - loadFromStorage(): Load saved tasks
   - saveToStorage(): Save tasks to localStorage
   - showToast(): Display notification message
   - announce(): Alert screen reader users
*/
```

### Section 2: Rendering

**Purpose:** Create and update DOM elements from data

```javascript
/* columnsMeta: Define the three columns */
const columnsMeta = [
  {key:'todo', title:'To Do'},
  {key:'inprogress', title:'In Progress'},
  {key:'done', title:'Done'}
];

/* Functions:
   - createColumnEl(): Create a single column with header and task list
   - render(): Rebuild entire board from data model
   - createTaskCard(): Create a single task card element with buttons
*/
```

**How render() works:**
1. Clear old DOM: `boardEl.innerHTML = ''`
2. For each column in columnsMeta:
   - Create column element
   - Get tasks from board[column]
   - If empty: show "No tasks" message
   - If has tasks: create card for each task
   - Attach drag-drop listeners

### Section 3: Drag & Drop

**Purpose:** Native HTML5 drag-drop implementation

```javascript
/* Drag state variables */
let draggingEl = null;     // Currently dragged element
let draggingId = null;     // ID of dragged task
let sourceColumn = null;   // Column task started in
let placeholderEl = null;  // Visual drop preview

/* Functions:
   - makeColumnDroppable(): Attach drag listeners to column
   - handleDragStart(): Called when drag begins
   - handleDragEnd(): Called when drag ends
   - moveTaskTo(): Update data model after successful drop
*/
```

**Drag Event Flow:**
1. **dragstart**: User presses and holds on task
   - Set dragging state
   - Announce action to screen readers

2. **dragover**: User moves mouse over target column
   - Calculate insertion position
   - Show placeholder only if position changed (optimization)
   - Add drop-highlight class to column

3. **dragleave**: User moves mouse out of column
   - Remove highlight if completely outside column bounds
   - Remove placeholder

4. **drop**: User releases task on target column
   - Calculate final insertion index
   - Call moveTaskTo() to update data
   - Call render() to update visuals
   - Clear drag state

### Section 4: CRUD Operations

**Purpose:** Create, Read, Update, Delete tasks

```javascript
/* CREATE Functions:
   - openModalForCreate(): Open form to create new task
   - taskForm.addEventListener('submit'): Save new task
   - Inline quick-add: Create directly from top bar input

/* EDIT Functions:
   - openModalForEdit(): Open form with existing task data
   - Modify title, description, or column
   - Save updates to data model

/* DELETE Functions:
   - deleteTaskWithConfirm(): Delete with confirmation dialog
   - Remove from board[column] array
   - Save changes to localStorage

/* READ Functions:
   - getTaskById(): Find task across all columns
*/
```

**Modal Flow:**
1. User clicks "Add Task" or Edit icon
2. openModalForCreate() or openModalForEdit() called
3. Modal shows with appropriate title and fields
4. User fills form and clicks "Save"
5. taskForm.addEventListener('submit') handler:
   - Validates title (required)
   - Either creates new task or updates existing
   - Calls saveToStorage()
   - Calls render()
   - Closes modal

### Section 5: Keyboard Navigation

**Purpose:** Arrow keys, Enter, Delete support

```javascript
/* Function: handleCardKeydown() */

/* Arrow Right: Move task to next column */
/* todo → inprogress → done */
/* Boundary check: don't go past "done" */

/* Arrow Left: Move task to previous column */
/* done → inprogress → todo */
/* Boundary check: don't go before "todo" */

/* Enter: Open edit modal for focused task */

/* Delete: Delete task with confirmation */
```

**How keyboard navigation works:**
1. User clicks task (gives it focus)
2. User presses arrow key
3. handleCardKeydown() fires
4. Function checks e.key for ArrowRight, ArrowLeft, Enter, Delete
5. For arrow keys:
   - Get current task from board
   - Find column index (0=todo, 1=inprogress, 2=done)
   - Calculate new index with boundary checks
   - Call moveTaskTo() to move task
   - Call render() to update visuals
   - Announce to screen readers

### Section 6: Initialization

**Purpose:** Load data and start the application

```javascript
/* Function: init() */

1. Load data: const ok = loadFromStorage()
   - If no saved data: start with empty board

2. Render board: render()
   - Create DOM elements from data

3. Set up global keyboard handler
   - Escape key: close modal if open
```

**Application Startup:**
```javascript
init();  // Called at end of file to start app
```

---

## styles.css Structure

### Section 1: Design Tokens
```css
:root {
  /* Colors */
  --primary: #4F46E5;           /* Primary blue */
  --primary-hover: #4338CA;      /* Darker blue on hover */
  --accent: #10B981;             /* Green for accents */
  --danger: #DC2626;             /* Red for delete */
  --text: #0F172A;               /* Dark text */
  --page-bg: #F8FAFB;            /* Light background */
  --surface: #FFFFFF;            /* Card background */
  
  /* Spacing and sizing */
  --shadow: 0 6px 18px rgba(...) /* Drop shadow */
}
```

### Section 2: Layout
```css
/* Board: CSS Grid layout */
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* Desktop: 3 columns */
}

/* Mobile: responsive grid */
@media (max-width: 767px) {
  .board {
    grid-template-columns: 1fr;  /* Mobile: 1 column */
  }
}
```

### Section 3: Components

#### Task Card
```css
.task-card {
  /* Smooth animations on drag */
  transition: transform 200ms cubic-bezier(...);
  
  /* GPU acceleration for dragging */
  will-change: transform;
}

/* Visual feedback while dragging */
.task-card.dragging {
  opacity: 0.9;
  transform: scale(1.02);
  box-shadow: (larger shadow);
}

/* Column highlight when dragging over */
.column.drop-highlight {
  outline: 2px dashed (blue);
  background: (light blue);
}
```

#### Placeholder
```css
.placeholder {
  /* Shows where task will be dropped */
  border: 2px dashed (blue);
  background: (light blue);
  height: 54px;  /* Match task card height */
  transition: all 150ms ease-out;  /* Smooth movement */
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                                 │
│  Click, Drag, Type, Keyboard Input                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT HANDLER                                    │
│  handleDragStart, handleCardKeydown, taskForm.addEventListener...   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  DATA MODEL UPDATE                                  │
│  Move task, Create task, Delete task                                │
│  Update: board = { todo: [...], inprogress: [...], done: [...] }    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SAVE TO STORAGE                                    │
│  saveToStorage() → localStorage.setItem(STORAGE_KEY, JSON)          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  RENDER DOM                                         │
│  render() → Clear boardEl.innerHTML                                  │
│          → Create columns and task cards                            │
│          → Insert into DOM                                          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  VISUAL UPDATE                                      │
│  Browser renders updated DOM                                        │
│  CSS transitions animate changes                                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ACCESSIBILITY ANNOUNCEMENTS                            │
│  announce() → announcer div updates → Screen reader speaks          │
│  showToast() → Toast notification appears                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### 1. No External Dependencies
- Pure vanilla JavaScript (no jQuery, React, Vue)
- Native HTML5 drag-and-drop API (no drag library)
- Custom CSS (no Bootstrap, Tailwind)

### 2. Performance Optimizations
- **Placeholder updates only when position changes** (dragover event optimization)
- **will-change: transform** for GPU-accelerated animations
- **Conditional rendering** - only update DOM when necessary
- **Highlight state flag** prevents redundant class operations

### 3. Accessibility Features
- **ARIA labels** on all interactive elements
- **aria-live="polite"** regions announce changes
- **Semantic HTML** - `<section>`, `<main>`, `<form>`, `<section role="list">`
- **Keyboard navigation** - Full support without mouse
- **Focus management** - Focus rings and modal focus trapping
- **Screen reader support** - All actions announced

### 4. Error Handling
- **localStorage corruption detection** - validates JSON structure
- **Storage quota exceeded** - graceful error message
- **Missing data** - starts fresh with empty board
- **Task not found** - defensive checks throughout

### 5. User Experience
- **Toast notifications** for all actions (create, edit, delete, move)
- **Visual placeholders** show exact drop location
- **Column highlighting** on drag-over
- **Task dragging state** visual feedback
- **Smooth animations** 200ms cubic-bezier transitions

---

## Modification Guide

### To Change Column Names:
Edit `columnsMeta` in script.js:
```javascript
const columnsMeta = [
  {key:'backlog', title:'Backlog'},      // Changed
  {key:'inprogress', title:'In Progress'},
  {key:'review', title:'Code Review'}    // Changed
];
```

### To Change Colors:
Edit CSS variables in styles.css:
```css
:root {
  --primary: #FF6B6B;        /* New color */
  --danger: #FFD93D;         /* New color */
}
```

### To Change Animation Speed:
Edit transitions in styles.css:
```css
.task-card {
  /* Change 200ms to desired duration */
  transition: transform 300ms cubic-bezier(...);
}
```

---

## Code Reading Tips

1. **Start with index.html** to understand structure
2. **Read script.js Section 1** to understand data model
3. **Read script.js init()** to see initialization order
4. **Follow a task creation** from click → data update → render → display
5. **Follow a drag operation** from dragstart → dragover → drop → moveTaskTo
6. **Check styles.css** for corresponding styling

---

**Last Updated:** November 17, 2025
