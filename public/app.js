const taskList = document.querySelector('#task-list');
const taskDialog = document.querySelector('#task-dialog');
const taskForm = document.querySelector('#task-form');
const titleInput = document.querySelector('#task-title');
const descriptionInput = document.querySelector('#task-description');
const formError = document.querySelector('#form-error');
const toast = document.querySelector('#toast');

let tasks = [];
let activeFilter = 'all';
let editingId = null;
let toastTimer;

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('en', {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
}).format(new Date());

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'The request could not be completed.');
  }
  return response.status === 204 ? null : response.json();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
}

function renderTasks() {
  const completedCount = tasks.filter((task) => task.completed).length;
  const visibleTasks = tasks.filter((task) => {
    if (activeFilter === 'active') return !task.completed;
    if (activeFilter === 'completed') return task.completed;
    return true;
  });

  document.querySelector('#nav-count').textContent = tasks.length;
  document.querySelector('#section-total').textContent = tasks.length;
  document.querySelector('#progress-count').textContent = `${completedCount} / ${tasks.length}`;
  document.querySelector('#progress-fill').style.width = tasks.length ? `${(completedCount / tasks.length) * 100}%` : '0%';
  document.querySelector('#progress-label').textContent = tasks.length
    ? completedCount === tasks.length ? 'Everything is wrapped up' : 'Keep your momentum going'
    : 'Ready when you are';
  document.querySelector('#progress-note').textContent = tasks.length
    ? `${tasks.length - completedCount} ${tasks.length - completedCount === 1 ? 'task' : 'tasks'} left to go.`
    : 'Add a task to get started.';

  if (!visibleTasks.length) {
    const isEmpty = tasks.length === 0;
    taskList.innerHTML = `<div class="empty-state"><span class="empty-mark">${isEmpty ? '+' : '✓'}</span><h3>${isEmpty ? 'A fresh page' : 'Nothing to see here'}</h3><p>${isEmpty ? 'Add your first task and make today count.' : 'Tasks in this view will show up here.'}</p></div>`;
    return;
  }

  taskList.replaceChildren(...visibleTasks.map((task) => {
    const row = document.createElement('article');
    row.className = `task-row${task.completed ? ' is-complete' : ''}`;
    const check = document.createElement('button');
    check.className = `check-button${task.completed ? ' checked' : ''}`;
    check.type = 'button';
    check.setAttribute('aria-label', task.completed ? 'Mark task in progress' : 'Mark task complete');
    check.addEventListener('click', () => updateTask(task.id, { completed: !task.completed }));

    const copy = document.createElement('div');
    copy.className = 'task-copy';
    const title = document.createElement('p');
    title.className = 'task-title';
    title.textContent = task.title;
    copy.append(title);
    if (task.description) {
      const description = document.createElement('p');
      description.className = 'task-description';
      description.textContent = task.description;
      copy.append(description);
    }

    const date = document.createElement('time');
    date.className = 'task-date';
    date.dateTime = task.createdAt;
    date.textContent = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(task.createdAt));

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.className = 'icon-button';
    editButton.type = 'button';
    editButton.setAttribute('aria-label', `Edit ${task.title}`);
    editButton.title = 'Edit task';
    editButton.textContent = '✎';
    editButton.addEventListener('click', () => openDialog(task));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'icon-button delete';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `Delete ${task.title}`);
    deleteButton.title = 'Delete task';
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => deleteTask(task.id));
    actions.append(editButton, deleteButton);
    row.append(check, copy, date, actions);
    return row;
  }));
}

async function loadTasks() {
  try {
    tasks = await request('/api/tasks');
    renderTasks();
  } catch (error) {
    taskList.innerHTML = `<div class="empty-state"><h3>Could not load tasks</h3><p>${error.message}</p></div>`;
  }
}

function openDialog(task = null) {
  editingId = task?.id || null;
  document.querySelector('#dialog-title').textContent = task ? 'Edit task' : 'Create a task';
  document.querySelector('#save-task').textContent = task ? 'Save changes' : 'Create task';
  titleInput.value = task?.title || '';
  descriptionInput.value = task?.description || '';
  formError.textContent = '';
  taskDialog.showModal();
  titleInput.focus();
}

async function updateTask(id, changes) {
  try {
    await request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
    await loadTasks();
    if (changes.completed !== undefined) showToast(changes.completed ? 'Task completed' : 'Task back in progress');
    else showToast('Task updated');
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteTask(id) {
  try {
    await request(`/api/tasks/${id}`, { method: 'DELETE' });
    await loadTasks();
    showToast('Task deleted');
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelector('#new-task-button').addEventListener('click', () => openDialog());
document.querySelector('#close-dialog').addEventListener('click', () => taskDialog.close());
document.querySelector('#cancel-dialog').addEventListener('click', () => taskDialog.close());
document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('selected', item === button));
    renderTasks();
  });
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = { title: titleInput.value.trim(), description: descriptionInput.value.trim() };
  if (!payload.title) return;
  const saveButton = document.querySelector('#save-task');
  saveButton.disabled = true;
  formError.textContent = '';
  try {
    if (editingId) {
      await request(`/api/tasks/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Task updated');
    } else {
      await request('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Task created');
    }
    taskDialog.close();
    await loadTasks();
  } catch (error) {
    formError.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

loadTasks();