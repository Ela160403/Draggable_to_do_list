/* =========================
   JS Application
   ========================= */

/* storage key */
const STORAGE_KEY = 'draggable-todo-board-v1';

/* DOM elements */
const boardEl = document.getElementById('board');
const openCreateBtn = document.getElementById('openCreate');
const modalBackdrop = document.getElementById('modalBackdrop');
const taskForm = document.getElementById('taskForm');
const taskTitleInput = document.getElementById('taskTitle');
const taskDescInput = document.getElementById('taskDesc');
const taskColumnSelect = document.getElementById('taskColumn');
const modalTitle = document.getElementById('modalTitle');
const cancelModalBtn = document.getElementById('cancelModal');
const announcer = document.getElementById('announcer');
const toast = document.getElementById('toast');
const titleInputInline = document.getElementById('titleInput');
const columnSelectInline = document.getElementById('columnSelect');
const clearStorageBtn = document.getElementById('clearStorage');

/* in-memory board structure: { todo: [], inprogress: [], done: [] }
   each task: { id, title, description, column, createdAt, updatedAt } */
let board = { todo: [], inprogress: [], done: [] };

/* currently editing task id (null for create) */
let editingTaskId = null;

/* --- helpers --- */
function genId(){ return 't_' + Math.random().toString(36).slice(2,10); }
function nowISO(){ return new Date().toISOString(); }

/* load from storage with error handling */
function loadFromStorage(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === 'object' && parsed.todo && parsed.inprogress && parsed.done){
      board = parsed;
      // ensure arrays
      board.todo = board.todo || [];
      board.inprogress = board.inprogress || [];
      board.done = board.done || [];
      return true;
    } else {
      throw new Error('Invalid shape');
    }
  }catch(e){
    // fallback: clear corrupt data banner via toast
    showToast('Saved data could not be loaded. Starting fresh. [Clear saved]');
    localStorage.removeItem(STORAGE_KEY);
    board = { todo: [], inprogress: [], done: [] };
    return false;
  }
}

/* save to localStorage with error handling */
function saveToStorage(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(board));
  }catch(e){
    showToast('Unable to save changes; please check browser storage settings.');
    console.error('LocalStorage save error', e);
  }
}

/* show a short toast */
let toastTimer = null;
function showToast(msg, duration=1400){
  toast.textContent = msg;
  toast.style.display = 'block';
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ toast.style.display='none'; }, duration);
}

/* announce for screen readers */
function announce(msg){
  announcer.textContent = msg;
}

/* --- rendering --- */
const columnsMeta = [
  {key:'todo', title:'To Do'},
  {key:'inprogress', title:'In Progress'},
  {key:'done', title:'Done'}
];

function createColumnEl(colKey, colTitle){
  const col = document.createElement('section');
  col.className = 'column';
  col.dataset.column = colKey;
  col.setAttribute('aria-label', colTitle);
  col.setAttribute('role','region');

  const header = document.createElement('div');
  header.className = 'col-title';
  header.innerHTML = `<span>${colTitle}</span><button class="secondary" title="Add to ${colTitle}" aria-label="Add task to ${colTitle}">＋</button>`;
  const addBtn = header.querySelector('button');
  addBtn.addEventListener('click', ()=>openModalForCreate(colKey));
  col.appendChild(header);

  const taskList = document.createElement('div');
  taskList.className = 'task-list';
  taskList.dataset.column = colKey;
  taskList.setAttribute('aria-live','polite');
  taskList.setAttribute('role','list');
  col.appendChild(taskList);

  /* dragover/drop listeners */
  makeColumnDroppable(col, taskList);

  return col;
}

function render(){
  boardEl.innerHTML = '';
  columnsMeta.forEach(({key,title})=>{
    const col = createColumnEl(key,title);
    const list = col.querySelector('.task-list');
    const tasks = board[key] || [];
    if(tasks.length === 0){
      const empty = document.createElement('div');
      empty.className = 'col-empty';
      empty.textContent = 'No tasks — add one using the “Add Task” button.';
      list.appendChild(empty);
    } else {
      tasks.forEach(task => {
        const el = createTaskCard(task);
        list.appendChild(el);
      });
    }
    boardEl.appendChild(col);
  });
}

/* create single task card element */
function createTaskCard(task){
  const card = document.createElement('div');
  card.className = 'task-card';
  card.setAttribute('draggable','true');
  card.dataset.id = task.id;
  card.dataset.column = task.column;
  card.tabIndex = 0;
  card.setAttribute('role','listitem');
  card.setAttribute('aria-grabbed','false');
  card.setAttribute('aria-label', `${task.title}. ${task.description || ''}`);

  // drag handle
  const handleBtn = document.createElement('button');
  handleBtn.className = 'drag-handle';
  handleBtn.title = "Drag";
  handleBtn.setAttribute('aria-hidden', 'true');
  handleBtn.innerHTML = svgBars();
  card.appendChild(handleBtn);

  // body
  const body = document.createElement('div');
  body.className = 'task-body';
  const t = document.createElement('div');
  t.className = 'task-title';
  t.textContent = task.title;
  const d = document.createElement('div');
  d.className = 'task-desc';
  d.textContent = task.description || '';
  body.appendChild(t);
  body.appendChild(d);
  card.appendChild(body);

  // actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.title = 'Edit';
  editBtn.setAttribute('aria-label', `Edit task: ${task.title}`);
  editBtn.innerHTML = svgPencil();
  editBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    openModalForEdit(task.id);
  });
  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.title = 'Delete';
  delBtn.setAttribute('aria-label', `Delete task: ${task.title}`);
  delBtn.innerHTML = svgTrash();
  delBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    deleteTaskWithConfirm(task.id);
  });
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);

  /* drag events */
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);
  card.addEventListener('keydown', handleCardKeydown);

  return card;
}

/* --- Drag & Drop Implementation (native drag events) --- */

/* state used during drag */
let draggingEl = null;
let draggingId = null;
let sourceColumn = null;
let placeholderEl = null;

/* utility: find index in children for an element */
function indexWithin(listEl, childEl) {
  return Array.prototype.indexOf.call(listEl.children, childEl);
}

/* create placeholder */
function makePlaceholder(height){
  const p = document.createElement('div');
  p.className = 'placeholder';
  if(height) p.style.height = height + 'px';
  return p;
}

/* set column droppable behaviors */
function makeColumnDroppable(columnEl, listEl){
  let isHighlighted = false;

  /* handle dragenter / dragover / dragleave / drop on list */
  listEl.addEventListener('dragenter', (e)=>{
    e.preventDefault();
    if(!draggingEl || isHighlighted) return;
    isHighlighted = true;
    columnEl.classList.add('drop-highlight');
  });

  listEl.addEventListener('dragover', (e)=>{
    if(!draggingEl) return;
    e.preventDefault(); // allow drop

    // compute insertion position based on pointer Y
    const children = Array.from(listEl.querySelectorAll('.task-card:not(.dragging), .placeholder, .col-empty'));
    let targetIndex = children.length;
    
    for(let i = 0; i < children.length; i++){
      const child = children[i];
      if(child === draggingEl) continue;
      const rect = child.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if(e.clientY < midpoint){
        targetIndex = i;
        break;
      }
    }

    // check if placeholder already exists and is in correct position
    const existingPlaceholder = listEl.querySelector('.placeholder');
    const currentIndex = existingPlaceholder ? 
      Array.prototype.indexOf.call(listEl.children, existingPlaceholder) : -1;

    // only update DOM if placeholder position changed
    if(currentIndex !== targetIndex){
      // remove existing placeholder if any
      if(existingPlaceholder && existingPlaceholder.parentElement) {
        existingPlaceholder.parentElement.removeChild(existingPlaceholder);
      }

      // hide empty message temporarily
      const emptyMsg = listEl.querySelector('.col-empty');
      if(emptyMsg) emptyMsg.style.display = 'none';

      // create and insert placeholder at computed index
      const height = draggingEl.getBoundingClientRect().height;
      placeholderEl = makePlaceholder(height);
      
      if(targetIndex >= listEl.children.length){
        listEl.appendChild(placeholderEl);
      } else {
        listEl.insertBefore(placeholderEl, listEl.children[targetIndex]);
      }
    }
  });

  listEl.addEventListener('dragleave', (e)=>{
    // If leaving the column area entirely, remove highlight
    const rect = listEl.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    if(x < rect.left || x > rect.right || y < rect.top || y > rect.bottom){
      isHighlighted = false;
      columnEl.classList.remove('drop-highlight');
      if(placeholderEl && placeholderEl.parentElement) {
        placeholderEl.parentElement.removeChild(placeholderEl);
        placeholderEl = null;
      }
    }
  });

  listEl.addEventListener('drop', (e)=>{
    e.preventDefault();
    isHighlighted = false;
    columnEl.classList.remove('drop-highlight');
    
    // restore empty message if no real tasks
    const emptyMsg = listEl.querySelector('.col-empty');
    if(emptyMsg) emptyMsg.style.display = '';
    
    if(!draggingId) return;

    const toColumn = columnEl.dataset.column;
    // determine insertion index from placeholder position
    let newIndex = 0;
    const children = Array.from(listEl.children);
    const placeholderIdx = children.indexOf(placeholderEl);
    
    if(placeholderEl && placeholderIdx !== -1){
      // count only actual task cards before placeholder
      newIndex = Array.from(listEl.querySelectorAll('.task-card:not(.dragging)')).length;
      if(placeholderIdx < children.length){
        newIndex = Array.from(listEl.children).slice(0, placeholderIdx)
          .filter(el => el.classList.contains('task-card')).length;
      }
    }

    // perform move in data model (only if column changed or position changed)
    const taskInSourceCol = board[sourceColumn]?.findIndex(t => t.id === draggingId) ?? -1;
    
    if(sourceColumn !== toColumn || taskInSourceCol !== newIndex){
      moveTaskTo(draggingId, sourceColumn, toColumn, newIndex);
    }

    // cleanup
    if(placeholderEl && placeholderEl.parentElement) {
      placeholderEl.parentElement.removeChild(placeholderEl);
    }
    placeholderEl = null;
    draggingEl = null;
    draggingId = null;
    sourceColumn = null;
    
    announceOnDrop();
    render();
  });
}

/* dragstart handler */
function handleDragStart(e){
  draggingEl = e.currentTarget;
  draggingId = draggingEl.dataset.id;
  sourceColumn = draggingEl.dataset.column;
  draggingEl.classList.add('dragging');
  draggingEl.setAttribute('aria-grabbed','true');

  // set drag image to default (browser) but dataTransfer holds metadata
  try{
    e.dataTransfer.setData('text/plain', JSON.stringify({id:draggingId, from:sourceColumn}));
  }catch(err){ /* ignore */ }

  announce(`Moving task "${getTaskById(draggingId).title}" — select drop target`);
}

/* dragend handler */
function handleDragEnd(e){
  if(draggingEl){
    draggingEl.classList.remove('dragging');
    draggingEl.setAttribute('aria-grabbed','false');
  }
  // remove all highlights & placeholder
  document.querySelectorAll('.column').forEach(col => {
    col.classList.remove('drop-highlight');
  });
  if(placeholderEl && placeholderEl.parentElement) {
    placeholderEl.parentElement.removeChild(placeholderEl);
  }
  // restore empty messages that were hidden
  document.querySelectorAll('.col-empty').forEach(msg => {
    msg.style.display = '';
  });
  placeholderEl = null;
  draggingEl = null;
  draggingId = null;
  sourceColumn = null;
  announce('Drag ended.');
}

/* announce after drop */
function announceOnDrop(){
  announce('Task moved.');
}

/* move task in model */
function moveTaskTo(id, fromCol, toCol, toIndex){
  if(!id) return;
  if(!board[fromCol]) return;
  // find and remove
  const fromArr = board[fromCol];
  const idx = fromArr.findIndex(t=>t.id===id);
  if(idx === -1) return;
  const [task] = fromArr.splice(idx,1);
  task.column = toCol;
  task.updatedAt = nowISO();
  // insert into toCol array at index
  board[toCol] = board[toCol] || [];
  if(toIndex < 0) toIndex = 0;
  if(toIndex >= board[toCol].length) board[toCol].push(task);
  else board[toCol].splice(toIndex,0,task);
  saveToStorage();
}

/* get task by id */
function getTaskById(id){
  for(let k of ['todo','inprogress','done']){
    const t = board[k].find(x=>x.id===id);
    if(t) return t;
  }
  return null;
}

/* --- Create / Edit / Delete --- */

function openModalForCreate(defaultColumn){
  editingTaskId = null;
  modalTitle.textContent = 'Create Task';
  taskTitleInput.value = '';
  taskDescInput.value = '';
  taskColumnSelect.value = defaultColumn || 'todo';
  modalBackdrop.style.display = 'flex';
  modalBackdrop.setAttribute('aria-hidden','false');
  taskTitleInput.focus();
}

function openModalForEdit(taskId){
  const t = getTaskById(taskId);
  if(!t) return;
  editingTaskId = taskId;
  modalTitle.textContent = 'Edit Task';
  taskTitleInput.value = t.title;
  taskDescInput.value = t.description || '';
  taskColumnSelect.value = t.column;
  modalBackdrop.style.display = 'flex';
  modalBackdrop.setAttribute('aria-hidden','false');
  taskTitleInput.focus();
}

/* close modal */
function closeModal(){
  editingTaskId = null;
  modalBackdrop.style.display = 'none';
  modalBackdrop.setAttribute('aria-hidden','true');
  // return focus to Add button
  openCreateBtn.focus();
}

/* handle form submit (create or edit) */
taskForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const title = taskTitleInput.value.trim();
  const desc = taskDescInput.value.trim();
  const column = taskColumnSelect.value;

  if(!title){
    document.getElementById('titleError').style.display = 'block';
    taskTitleInput.focus();
    return;
  } else {
    document.getElementById('titleError').style.display = 'none';
  }

  if(editingTaskId){
    // edit
    const t = getTaskById(editingTaskId);
    if(!t) return closeModal();
    t.title = title;
    t.description = desc;
    // if column changed, move to end of that column
    if(t.column !== column){
      // remove from current
      const arr = board[t.column];
      const idx = arr.findIndex(x=>x.id===t.id);
      if(idx>-1) arr.splice(idx,1);
      t.column = column;
      board[column].push(t);
    }
    t.updatedAt = nowISO();
    showToast('Saved');
    announce(`Task "${t.title}" updated.`);
  } else {
    // create
    const newTask = {
      id: genId(),
      title,
      description: desc,
      column,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    board[column] = board[column] || [];
    board[column].unshift(newTask); // place at top
    showToast('Saved');
    announce(`Task "${title}" created.`);
  }
  saveToStorage();
  closeModal();
  render();
});

/* cancel button */
cancelModalBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  closeModal();
});

/* clicking backdrop closes modal (but keep focus trapped minimal) */
modalBackdrop.addEventListener('click', (e)=>{
  if(e.target === modalBackdrop){
    closeModal();
  }
});

/* Delete with confirmation */
function deleteTaskWithConfirm(id){
  const t = getTaskById(id);
  if(!t) return;
  const ok = confirm(`Are you sure you want to delete "${t.title}"?`);
  if(!ok) return;
  const arr = board[t.column];
  const idx = arr.findIndex(x=>x.id===id);
  if(idx>-1) arr.splice(idx,1);
  saveToStorage();
  render();
  showToast('Deleted');
  announce(`Task "${t.title}" deleted.`);
}

/* Inline quick-add (top controls) */
openCreateBtn.addEventListener('click', ()=>{
  const title = titleInputInline.value.trim();
  if(title){
    const column = columnSelectInline.value;
    const newTask = {
      id: genId(),
      title,
      description: '',
      column,
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    board[column] = board[column] || [];
    board[column].unshift(newTask);
    saveToStorage();
    render();
    titleInputInline.value = '';
    showToast('Saved');
    announce(`Task "${newTask.title}" added.`);
    return;
  }
  // if no inline title, open modal
  openModalForCreate(columnSelectInline.value);
});

/* clear storage button */
clearStorageBtn.addEventListener('click', ()=>{
  if(confirm('Clear all saved tasks?')) {
    localStorage.removeItem(STORAGE_KEY);
    board = { todo: [], inprogress: [], done: [] };
    render();
    showToast('Saved data cleared');
  }
});

/* keyboard: move focused card between columns using Ctrl + ArrowLeft/ArrowRight */
function handleCardKeydown(e){
  const el = e.currentTarget;
  const id = el.dataset.id;
  
  // Arrow Right: Move to next column (no Ctrl needed)
  if(e.key === 'ArrowRight'){
    e.preventDefault();
    const task = getTaskById(id);
    if(!task) return;
    const order = ['todo','inprogress','done'];
    const idx = order.indexOf(task.column);
    const newIdx = Math.min(2, idx + 1); // Don't go past "done"
    if(newIdx !== idx){
      moveTaskTo(id, task.column, order[newIdx], 0);
      render();
      announce(`Task moved to ${order[newIdx] === 'todo' ? 'To Do' : order[newIdx] === 'inprogress' ? 'In Progress' : 'Done'}`);
    }
    return;
  }

  // Arrow Left: Move to previous column (no Ctrl needed)
  if(e.key === 'ArrowLeft'){
    e.preventDefault();
    const task = getTaskById(id);
    if(!task) return;
    const order = ['todo','inprogress','done'];
    const idx = order.indexOf(task.column);
    const newIdx = Math.max(0, idx - 1); // Don't go before "todo"
    if(newIdx !== idx){
      moveTaskTo(id, task.column, order[newIdx], 0);
      render();
      announce(`Task moved to ${order[newIdx] === 'todo' ? 'To Do' : order[newIdx] === 'inprogress' ? 'In Progress' : 'Done'}`);
    }
    return;
  }

  // Enter to open edit
  if(e.key === 'Enter'){
    openModalForEdit(id);
  }

  // Delete key
  if(e.key === 'Delete'){
    deleteTaskWithConfirm(id);
  }
}

/* init: load data & render, attach drag handlers to document for cleanup */
function init(){
  const ok = loadFromStorage();
  if(!ok){
    // if no stored state, sample for demo (small sample)
    board = { todo: [], inprogress: [], done: [] };
    // one sample task each (optional)
    // board.todo.push({id:genId(),title:'Sample task',description:'A sample description',column:'todo',createdAt:nowISO(),updatedAt:nowISO()});
  }
  render();

  // keyboard accessibility: allow tabbing and actions
  document.addEventListener('keydown', (e)=>{
    // ESC closes modal
    if(e.key === 'Escape' && modalBackdrop.style.display === 'flex'){
      closeModal();
    }
  });
}

/* small SVG icons (inline) */
function svgBars(){ return `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 6h8M6 10h8M6 14h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` }
function svgPencil(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 21l3-1 11-11a2.828 2.828 0 10-4-4L6 16 5 19 3 21zM14.5 6.5l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` }
function svgTrash(){ return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18M8 6v12a2 2 0 002 2h4a2 2 0 002-2V6M10 6V4a2 2 0 012-2h0a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` }

/* initialize app */
init();
