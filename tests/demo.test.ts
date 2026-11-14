import assert from 'node:assert/strict';
import { test } from 'node:test';

// Minimal localStorage shim: the demo store persists through it, and Node has
// no DOM. It must exist before the module is imported.
const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => void storage.set(key, String(value)),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
};

const demo = await import('../src/lib/demoStore.ts');
const { extractTasksLocally } = await import('../src/lib/localExtraction.ts');
const { buildDemoReply } = await import('../src/lib/demoAssistant.ts');

test('demo store seeds projects, tasks, files and events', () => {
  demo.resetDemoData();
  const db = demo.getDemoDb();

  assert.ok(db.projects.length >= 2);
  assert.ok(db.tasks.length >= 5);
  assert.ok(db.files.length >= 1);
  assert.ok(db.events.length >= 2);
  assert.ok(db.subtasks.length >= 2);

  // Everything belongs to the demo identity.
  assert.ok(db.projects.every((project) => project.members.includes(demo.DEMO_EMAIL)));
});

test('demo store notifies subscribers and persists to localStorage', () => {
  demo.resetDemoData();
  let notifications = 0;
  const unsubscribe = demo.subscribeDemo(() => {
    notifications += 1;
  });

  const projectId = demo.demoCreateProject({
    name: 'پروژه تست',
    ownerId: demo.DEMO_UID,
    members: [demo.DEMO_EMAIL],
  });

  assert.equal(notifications, 1);
  assert.ok(demo.getDemoDb().projects.some((project) => project.id === projectId));
  assert.ok(storage.get('carema_demo_db_v2')?.includes('پروژه تست'));

  unsubscribe();
  demo.demoDeleteProject(projectId);
  assert.equal(notifications, 1, 'unsubscribed listener must not fire');
});

test('demo task updates and cascading delete keep the store consistent', () => {
  demo.resetDemoData();
  const db = demo.getDemoDb();
  const project = db.projects[0];
  const task = db.tasks.find((item) => item.projectId === project.id)!;

  demo.demoUpdateTask(project.id, task.id, { status: 'DONE' });
  assert.equal(demo.getDemoDb().tasks.find((item) => item.id === task.id)?.status, 'DONE');

  demo.demoCreateSubtask(project.id, task.id, 'زیرکار جدید');
  assert.equal(demo.getDemoDb().subtasks.filter((item) => item.taskId === task.id).length, 1);

  demo.demoDeleteTask(project.id, task.id);
  const after = demo.getDemoDb();
  assert.equal(after.tasks.filter((item) => item.id === task.id).length, 0);
  assert.equal(after.subtasks.filter((item) => item.taskId === task.id).length, 0);
});

test('reset restores the original seed data', () => {
  demo.resetDemoData();
  demo.demoCreateProject({ name: 'موقت', ownerId: demo.DEMO_UID, members: [demo.DEMO_EMAIL] });
  const mutated = demo.getDemoDb().projects.length;

  demo.resetDemoData();
  assert.ok(demo.getDemoDb().projects.length < mutated);
});

test('offline extraction finds unchecked items and TODO lines only', () => {
  const tasks = extractTasksLocally(
    ['# عنوان', '- [ ] بررسی دسترس‌پذیری فرم ورود', '- [x] کار انجام‌شده', 'TODO: آماده‌سازی مستندات', 'متن ساده'].join(
      '\n'
    )
  );

  const titles = tasks.map((task) => task.title);
  assert.deepEqual(titles, ['بررسی دسترس‌پذیری فرم ورود', 'آماده‌سازی مستندات']);
  assert.ok(tasks.every((task) => ['Low', 'Medium', 'High', 'Critical'].includes(task.priority)));
});

test('demo assistant answers stats and proposes creating a project', () => {
  demo.resetDemoData();
  const database = demo.getDemoDb();
  const context = {
    generatedAt: new Date().toISOString(),
    calendarEvents: database.events,
    projects: database.projects.map((project) => ({
      ...project,
      tasks: database.tasks.filter((task) => task.projectId === project.id),
      files: [],
    })),
  };

  const stats = buildDemoReply('خلاصه وضعیت را بگو', context as any, 'fa');
  assert.equal(stats.status, 'MESSAGE');
  assert.match(stats.display_text, new RegExp(String(database.projects.length)));
  assert.match(stats.display_text, /پیش‌نمایش/);

  const created = buildDemoReply('یک پروژه جدید به نام «اپلیکیشن موبایل» بساز', context as any, 'fa');
  assert.equal(created.status, 'PROPOSAL');
  assert.equal(created.proposed_actions[0].function, 'create_project');
  assert.equal(created.proposed_actions[0].parameters.name, 'اپلیکیشن موبایل');

  const meeting = buildDemoReply('یک جلسه برای فردا بساز', context as any, 'fa');
  assert.equal(meeting.proposed_actions[0].function, 'create_event');
  assert.ok(Date.parse(meeting.proposed_actions[0].parameters.startTime) > Date.now());
});
