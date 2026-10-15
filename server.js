const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const app = express();
const port = process.env.PORT || 3000;
const dataDirectory = path.join(__dirname, 'data');
const dataFile = path.join(dataDirectory, 'tasks.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readTasks() {
  try {
    return JSON.parse(await fs.readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeTasks(tasks) {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(tasks, null, 2)}\n`);
}

app.get('/api/tasks', async (_request, response, next) => {
  try {
    response.json(await readTasks());
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', async (request, response, next) => {
  const title = typeof request.body.title === 'string' ? request.body.title.trim() : '';
  if (!title) return response.status(400).json({ error: 'A task title is required.' });

  try {
    const tasks = await readTasks();
    const task = {
      id: randomUUID(),
      title,
      description: typeof request.body.description === 'string' ? request.body.description.trim() : '',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.unshift(task);
    await writeTasks(tasks);
    response.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/tasks/:id', async (request, response, next) => {
  try {
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === request.params.id);
    if (!task) return response.status(404).json({ error: 'Task not found.' });

    if (typeof request.body.title === 'string') {
      const title = request.body.title.trim();
      if (!title) return response.status(400).json({ error: 'A task title cannot be empty.' });
      task.title = title;
    }
    if (typeof request.body.description === 'string') task.description = request.body.description.trim();
    if (typeof request.body.completed === 'boolean') task.completed = request.body.completed;

    await writeTasks(tasks);
    response.json(task);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', async (request, response, next) => {
  try {
    const tasks = await readTasks();
    const remainingTasks = tasks.filter((task) => task.id !== request.params.id);
    if (remainingTasks.length === tasks.length) return response.status(404).json({ error: 'Task not found.' });

    await writeTasks(remainingTasks);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Something went wrong.' });
});

app.listen(port, () => {
  console.log(`Task manager running at http://localhost:${port}`);
});