/**
 * In-browser demo data store used by the GitHub Pages preview build
 * (`VITE_DEMO_MODE=true`).
 *
 * It mirrors the shape of the Firestore documents so every screen of the app
 * can be explored visually without Firebase, without the Express API and
 * without any network access. Data is persisted in localStorage.
 */

export interface DemoProject {
  id: string;
  name: string;
  category: string;
  status: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface DemoTask {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority?: string | null;
  dueDate?: string | null;
  description?: string;
  assignedTo?: string | null;
  totalSubtasks?: number;
  completedSubtasks?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DemoSubtask {
  id: string;
  projectId: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface DemoNote {
  id: string;
  projectId: string;
  taskId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface DemoFile {
  id: string;
  projectId: string;
  name: string;
  content: string;
  size?: number;
  uploadedBy?: string;
  createdAt: string;
}

export interface DemoEvent {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  createdAt: string;
}

export interface DemoDb {
  version: number;
  projects: DemoProject[];
  tasks: DemoTask[];
  subtasks: DemoSubtask[];
  notes: DemoNote[];
  files: DemoFile[];
  events: DemoEvent[];
}

export const DEMO_EMAIL = 'demo@carema.app';
export const DEMO_UID = 'demo-user';

const STORAGE_KEY = 'carema_demo_db_v2';
const DB_VERSION = 2;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

let seq = 0;

function id(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

function isoDate(offsetDays: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function daysAgoIso(offsetDays: number): string {
  return isoDate(-offsetDays, 9);
}

/* -------------------------------------------------------------------------- */
/* Seed data                                                                  */
/* -------------------------------------------------------------------------- */

function seed(): DemoDb {
  const p1 = id('proj');
  const p2 = id('proj');

  const t1 = id('task');
  const t2 = id('task');
  const t3 = id('task');
  const t4 = id('task');
  const t5 = id('task');
  const t6 = id('task');

  const s1 = id('sub');
  const s2 = id('sub');
  const s3 = id('sub');

  return {
    version: DB_VERSION,
    projects: [
      {
        id: p1,
        name: 'بازطراحی وب‌سایت CaReMa',
        category: 'Development',
        status: 'ACTIVE',
        ownerId: DEMO_UID,
        members: [DEMO_EMAIL],
        createdAt: daysAgoIso(12),
      },
      {
        id: p2,
        name: 'پژوهش یادگیری ماشین',
        category: 'Research',
        status: 'ACTIVE',
        ownerId: DEMO_UID,
        members: [DEMO_EMAIL],
        createdAt: daysAgoIso(5),
      },
    ],
    tasks: [
      {
        id: t1,
        projectId: p1,
        title: 'طراحی وایرفریم صفحات اصلی',
        status: 'DONE',
        priority: 'High',
        dueDate: isoDate(-2, 12),
        description: 'وایرفریم داشبورد، جدول وظایف و تایم‌لاین در Figma آماده شد.',
        assignedTo: DEMO_EMAIL,
        createdAt: daysAgoIso(11),
      },
      {
        id: t2,
        projectId: p1,
        title: 'پیاده‌سازی نمای کانبان با درگ و دراپ',
        status: 'IN_PROGRESS',
        priority: 'Critical',
        dueDate: isoDate(2, 17),
        description: 'Stages: TODO → IN_PROGRESS → REVIEW → DONE. فعلاً جابجایی با کلیک انجام می‌شود.',
        assignedTo: DEMO_EMAIL,
        totalSubtasks: 3,
        completedSubtasks: 1,
        createdAt: daysAgoIso(8),
      },
      {
        id: t3,
        projectId: p1,
        title: 'بازبینی طراحی با تیم محصول',
        status: 'REVIEW',
        priority: 'Medium',
        dueDate: isoDate(1, 15),
        createdAt: daysAgoIso(6),
      },
      {
        id: t4,
        projectId: p1,
        title: 'نوشتن تست‌های یکپارچگی برای جریان ورود',
        status: 'TODO',
        priority: 'Low',
        dueDate: isoDate(6, 11),
        createdAt: daysAgoIso(3),
      },
      {
        id: t5,
        projectId: p2,
        title: 'جمع‌آوری دیتاست مقالات فارسی',
        status: 'IN_PROGRESS',
        priority: 'High',
        dueDate: isoDate(4, 16),
        createdAt: daysAgoIso(4),
      },
      {
        id: t6,
        projectId: p2,
        title: 'آموزش مدل پایه و گزارش متریک‌ها',
        status: 'TODO',
        priority: 'Critical',
        dueDate: isoDate(-1, 18),
        createdAt: daysAgoIso(2),
      },
    ],
    subtasks: [
      { id: s1, projectId: p1, taskId: t2, title: 'طراحی کارت وظیفه', completed: true, createdAt: daysAgoIso(7) },
      { id: s2, projectId: p1, taskId: t2, title: 'پیاده‌سازی drag events', completed: false, createdAt: daysAgoIso(6) },
      { id: s3, projectId: p1, taskId: t2, title: 'دسترس‌پذیری با صفحه‌کلید', completed: false, createdAt: daysAgoIso(5) },
    ],
    notes: [
      {
        id: id('note'),
        projectId: p1,
        taskId: t2,
        content: 'برای drag & drop از کتابخانه dnd-kit استفاده می‌کنیم؛ پشتیبانی صفحه‌کلید هم دارد.',
        author: DEMO_EMAIL,
        createdAt: daysAgoIso(2),
      },
    ],
    files: [
      {
        id: id('file'),
        projectId: p1,
        name: 'meeting-notes.md',
        content: [
          '# یادداشت جلسه ۱۲ آبان',
          '',
          '## تصمیم‌ها',
          '- [ ] تعیین تاریخ انتشار نسخهٔ آزمایشی',
          '- [ ] آماده‌سازی مستندات راهنمای کاربر',
          'TODO: بررسی دسترس‌پذیری فرم ورود',
          '',
          'نکته: گزارش نهایی تا پایان هفته آماده شود.',
        ].join('\n'),
        size: 420,
        uploadedBy: DEMO_EMAIL,
        createdAt: daysAgoIso(1),
      },
    ],
    events: [
      {
        id: id('event'),
        userId: DEMO_UID,
        projectId: p1,
        title: 'جلسهٔ روزانهٔ تیم محصول',
        startTime: isoDate(1, 10),
        endTime: isoDate(1, 10, 30),
        location: 'Google Meet',
        meetingLink: 'https://meet.google.com/',
        agenda: 'مرور وظایف هفته و رفع موانع',
        createdAt: daysAgoIso(1),
      },
      {
        id: id('event'),
        userId: DEMO_UID,
        projectId: p2,
        title: 'ارائهٔ نتایج مدل به استاد راهنما',
        startTime: isoDate(3, 14),
        endTime: isoDate(3, 15),
        location: 'دانشکده فنی — اتاق ۲۰۳',
        createdAt: daysAgoIso(2),
      },
      {
        id: id('event'),
        userId: DEMO_UID,
        title: 'بازنگری هفتگی (گذشته)',
        startTime: isoDate(-3, 11),
        endTime: isoDate(-3, 12),
        createdAt: daysAgoIso(9),
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

let cache: DemoDb | null = null;
const listeners = new Set<() => void>();

function read(): DemoDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb;
      if (parsed && parsed.version === DB_VERSION && Array.isArray(parsed.projects)) {
        return parsed;
      }
    }
  } catch {
    /* corrupted or unavailable storage → fall back to the seed */
  }
  return seed();
}

function persist(): void {
  try {
    if (cache) localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* private mode / quota — the demo keeps working in memory */
  }
}

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[demo] listener failed', error);
    }
  });
}

export function getDemoDb(): DemoDb {
  if (!cache) {
    cache = read();
    persist();
  }
  return cache;
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commit(mutator: (db: DemoDb) => void): void {
  const db = getDemoDb();
  mutator(db);
  persist();
  emit();
}

export function resetDemoData(): void {
  cache = seed();
  persist();
  emit();
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export interface NewProjectInput {
  name: string;
  category?: string;
  ownerId: string;
  members: string[];
}

export function demoCreateProject(input: NewProjectInput): string {
  const projectId = id('proj');
  commit((db) => {
    db.projects.unshift({
      id: projectId,
      name: input.name,
      category: input.category ?? 'General',
      status: 'ACTIVE',
      ownerId: input.ownerId,
      members: input.members,
      createdAt: new Date().toISOString(),
    });
  });
  return projectId;
}

export function demoShareProject(projectId: string, email: string): void {
  commit((db) => {
    const project = db.projects.find((item) => item.id === projectId);
    if (project && !project.members.includes(email)) project.members.push(email);
  });
}

export function demoDeleteProject(projectId: string): void {
  commit((db) => {
    db.projects = db.projects.filter((project) => project.id !== projectId);
    const taskIds = db.tasks.filter((task) => task.projectId === projectId).map((task) => task.id);
    db.tasks = db.tasks.filter((task) => task.projectId !== projectId);
    db.subtasks = db.subtasks.filter((subtask) => !taskIds.includes(subtask.taskId));
    db.notes = db.notes.filter((note) => !taskIds.includes(note.taskId));
    db.files = db.files.filter((file) => file.projectId !== projectId);
    db.events = db.events.filter((event) => event.projectId !== projectId);
  });
}

export interface NewTaskInput {
  projectId: string;
  title: string;
  status?: string;
  priority?: string | null;
  dueDate?: string | null;
  description?: string;
}

export function demoCreateTask(input: NewTaskInput): string {
  const taskId = id('task');
  commit((db) => {
    db.tasks.push({
      id: taskId,
      projectId: input.projectId,
      title: input.title,
      status: input.status ?? 'TODO',
      priority: input.priority ?? null,
      dueDate: input.dueDate ?? null,
      description: input.description,
      createdAt: new Date().toISOString(),
    });
  });
  return taskId;
}

export function demoUpdateTask(projectId: string, taskId: string, patch: Record<string, unknown>): void {
  commit((db) => {
    const task = db.tasks.find((item) => item.id === taskId && item.projectId === projectId);
    if (task) Object.assign(task, patch, { updatedAt: new Date().toISOString() });
  });
}

export function demoDeleteTask(projectId: string, taskId: string): void {
  commit((db) => {
    db.tasks = db.tasks.filter((task) => !(task.id === taskId && task.projectId === projectId));
    db.subtasks = db.subtasks.filter((subtask) => subtask.taskId !== taskId);
    db.notes = db.notes.filter((note) => note.taskId !== taskId);
  });
}

export function demoCreateSubtask(projectId: string, taskId: string, title: string): void {
  commit((db) => {
    db.subtasks.push({
      id: id('sub'),
      projectId,
      taskId,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    });
  });
}

export function demoToggleSubtask(subtaskId: string, completed: boolean): void {
  commit((db) => {
    const subtask = db.subtasks.find((item) => item.id === subtaskId);
    if (subtask) subtask.completed = completed;
  });
}

export function demoDeleteSubtask(subtaskId: string): void {
  commit((db) => {
    db.subtasks = db.subtasks.filter((subtask) => subtask.id !== subtaskId);
  });
}

export function demoCreateNote(projectId: string, taskId: string, content: string, author: string): void {
  commit((db) => {
    db.notes.unshift({
      id: id('note'),
      projectId,
      taskId,
      content,
      author,
      createdAt: new Date().toISOString(),
    });
  });
}

export function demoDeleteNote(noteId: string): void {
  commit((db) => {
    db.notes = db.notes.filter((note) => note.id !== noteId);
  });
}

export function demoCreateFile(input: {
  projectId: string;
  name: string;
  content: string;
  size?: number;
  uploadedBy?: string;
}): void {
  commit((db) => {
    db.files.unshift({
      id: id('file'),
      projectId: input.projectId,
      name: input.name,
      content: input.content,
      size: input.size,
      uploadedBy: input.uploadedBy,
      createdAt: new Date().toISOString(),
    });
  });
}

export function demoDeleteFile(fileId: string): void {
  commit((db) => {
    db.files = db.files.filter((file) => file.id !== fileId);
  });
}

export interface NewEventInput {
  userId: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  projectId?: string;
}

export function demoCreateEvent(input: NewEventInput): string {
  const eventId = id('event');
  commit((db) => {
    db.events.push({
      id: eventId,
      userId: input.userId,
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime ?? input.startTime,
      location: input.location,
      meetingLink: input.meetingLink,
      agenda: input.agenda,
      projectId: input.projectId,
      createdAt: new Date().toISOString(),
    });
  });
  return eventId;
}

export function demoDeleteEvent(eventId: string): void {
  commit((db) => {
    db.events = db.events.filter((event) => event.id !== eventId);
  });
}
