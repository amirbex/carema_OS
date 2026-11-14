import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, IS_DEMO } from './firebase';
import { handleFirestoreError, OperationType } from './errorHandlers';
import * as demo from './demoStore';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED';

export interface Project {
  id: string;
  name: string;
  status?: string;
  category?: string;
  ownerId?: string;
  members?: string[];
  createdAt?: unknown;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  status: TaskStatus | string;
  priority?: Priority | string;
  dueDate?: string | null;
  description?: string;
  assignedTo?: string;
  totalSubtasks?: number;
  completedSubtasks?: number;
  createdAt?: unknown;
  [key: string]: unknown;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  userId?: string;
  projectId?: string;
  [key: string]: unknown;
}

export interface Subtask {
  id: string;
  title: string;
  completed?: boolean;
  createdAt?: unknown;
}

export interface Note {
  id: string;
  content?: string;
  author?: string;
  createdAt?: unknown;
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  size?: number;
  uploadedBy?: string;
  createdAt?: unknown;
}

export interface WorkspaceContext {
  generatedAt: string;
  calendarEvents: CalendarEvent[];
  projects: Array<Project & { tasks: Task[]; files: Array<{ id: string; name: string; content: string }> }>;
}

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function isProjectMember(project: Pick<Project, 'members'>, email?: string | null): boolean {
  const target = normalizeEmail(email);
  if (!target) return false;
  return (project.members ?? []).some((member) => normalizeEmail(member) === target);
}

export function isProjectOwner(project: Pick<Project, 'ownerId'>, uid?: string | null): boolean {
  return Boolean(uid && project.ownerId === uid);
}

function byName(a: { name?: string }, b: { name?: string }): number {
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' });
}

function byTitle(a: { title?: string }, b: { title?: string }): number {
  return String(a.title ?? '').localeCompare(String(b.title ?? ''), undefined, { sensitivity: 'base' });
}

function timeOf(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'object' && value !== null && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime?.() ?? 0;
  }
  return 0;
}

/** Subscribe to a slice of the in-browser demo database. */
function demoSubscribe<T>(select: (database: demo.DemoDb) => T, onData: (value: T) => void): Unsubscribe {
  const push = () => onData(select(demo.getDemoDb()));
  push();
  return demo.subscribeDemo(push);
}

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Subscribe to every project the user can see (owner + shared member).
 */
export function subscribeProjects(
  uid: string,
  email: string | null | undefined,
  onData: (projects: Project[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.projects
          .filter((project) => project.ownerId === uid || isProjectMember(project, email))
          .map((project) => ({ ...project }) as Project)
          .sort(byName),
      onData
    );
  }

  const buckets: Record<'owner' | 'member', Map<string, Project>> = {
    owner: new Map(),
    member: new Map(),
  };

  const emit = () => {
    const merged = new Map<string, Project>();
    for (const bucket of [buckets.owner, buckets.member]) {
      for (const [id, project] of bucket) merged.set(id, project);
    }
    onData(Array.from(merged.values()).sort(byName));
  };

  const fail = (error: unknown, path: string) => {
    onError?.(handleFirestoreError(error, OperationType.GET, path));
  };

  const ownerUnsub = onSnapshot(
    query(collection(db, 'projects'), where('ownerId', '==', uid)),
    (snapshot) => {
      buckets.owner = new Map<string, Project>(
        snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Record<string, unknown>) } as Project])
      );
      emit();
    },
    (error) => fail(error, 'projects (owner)')
  );

  const targetEmail = normalizeEmail(email);
  let memberUnsub: Unsubscribe = () => {};
  if (targetEmail) {
    memberUnsub = onSnapshot(
      query(collection(db, 'projects'), where('members', 'array-contains', targetEmail)),
      (snapshot) => {
        buckets.member = new Map<string, Project>(
          snapshot.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Record<string, unknown>) } as Project])
        );
        emit();
      },
      (error) => fail(error, 'projects (member)')
    );
  }

  return () => {
    ownerUnsub();
    memberUnsub();
  };
}

export async function createProject(input: {
  name: string;
  uid: string;
  email?: string | null;
  category?: string;
}): Promise<string> {
  const members = Array.from(new Set([normalizeEmail(input.email)].filter(Boolean)));

  if (IS_DEMO) {
    return demo.demoCreateProject({
      name: input.name.trim(),
      category: input.category,
      ownerId: input.uid,
      members,
    });
  }

  const ref = await addDoc(collection(db, 'projects'), {
    name: input.name.trim(),
    category: input.category ?? 'General',
    status: 'ACTIVE',
    ownerId: input.uid,
    members,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function shareProject(projectId: string, email: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoShareProject(projectId, normalizeEmail(email));
    return;
  }
  await updateDoc(doc(db, 'projects', projectId), {
    members: arrayUnion(normalizeEmail(email)),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Firestore never deletes subcollections automatically, so deleting a project
 * would leave orphaned tasks/files/notes behind. Demo mode mirrors that.
 */
export async function deleteProjectCascade(projectId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteProject(projectId);
    return;
  }

  const tasksSnap = await getDocs(collection(db, 'projects', projectId, 'tasks'));

  for (const taskDoc of tasksSnap.docs) {
    for (const sub of ['subtasks', 'notes']) {
      try {
        const nested = await getDocs(collection(db, 'projects', projectId, 'tasks', taskDoc.id, sub));
        await Promise.all(nested.docs.map((nestedDoc) => deleteDoc(nestedDoc.ref)));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/tasks/${sub}`);
      }
    }
    try {
      await deleteDoc(taskDoc.ref);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'projects/tasks');
    }
  }

  try {
    const filesSnap = await getDocs(collection(db, 'projects', projectId, 'files'));
    await Promise.all(filesSnap.docs.map((fileDoc) => deleteDoc(fileDoc.ref)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'projects/files');
  }

  await deleteDoc(doc(db, 'projects', projectId));
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export function subscribeTasks(
  projectId: string,
  onData: (tasks: Task[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.tasks
          .filter((task) => task.projectId === projectId)
          .map((task) => ({ ...task }) as Task)
          .sort(byTitle),
      onData
    );
  }

  return onSnapshot(
    collection(db, 'projects', projectId, 'tasks'),
    (snapshot) => {
      const tasks = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Task[];
      onData(tasks.sort(byTitle));
    },
    (error) => onError?.(handleFirestoreError(error, OperationType.GET, 'projects/tasks'))
  );
}

export async function createTask(input: {
  projectId: string;
  title: string;
  status?: string;
  priority?: string | null;
  dueDate?: string | null;
  description?: string;
}): Promise<string> {
  if (IS_DEMO) {
    return demo.demoCreateTask(input);
  }

  const ref = await addDoc(collection(db, 'projects', input.projectId, 'tasks'), {
    title: input.title.trim(),
    status: input.status ?? 'TODO',
    projectId: input.projectId,
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...(input.description ? { description: input.description } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(projectId: string, taskId: string, patch: Record<string, unknown>): Promise<void> {
  if (IS_DEMO) {
    demo.demoUpdateTask(projectId, taskId, patch);
    return;
  }
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
    ...patch,
    updatedAt: serverTimestamp(),
  } as Record<string, any>);
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteTask(projectId, taskId);
    return;
  }
  await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
}

/* -------------------------------------------------------------------------- */
/* Subtasks                                                                   */
/* -------------------------------------------------------------------------- */

export function subscribeSubtasks(
  projectId: string,
  taskId: string,
  onData: (subtasks: Subtask[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.subtasks
          .filter((subtask) => subtask.taskId === taskId)
          .map((subtask) => ({ ...subtask }) as Subtask)
          .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt)),
      onData
    );
  }

  return onSnapshot(
    query(collection(db, 'projects', projectId, 'tasks', taskId, 'subtasks')),
    (snapshot) => {
      const subtasks = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Subtask[];
      onData(subtasks.sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt)));
    },
    (error) => onError?.(handleFirestoreError(error, OperationType.LIST, 'tasks/subtasks'))
  );
}

export async function addSubtaskRecord(projectId: string, taskId: string, title: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoCreateSubtask(projectId, taskId, title);
    return;
  }
  await addDoc(collection(db, 'projects', projectId, 'tasks', taskId, 'subtasks'), {
    title,
    completed: false,
    createdAt: serverTimestamp(),
  });
}

export async function setSubtaskCompleted(
  projectId: string,
  taskId: string,
  subtaskId: string,
  completed: boolean
): Promise<void> {
  if (IS_DEMO) {
    demo.demoToggleSubtask(subtaskId, completed);
    return;
  }
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId, 'subtasks', subtaskId), { completed });
}

export async function deleteSubtaskRecord(projectId: string, taskId: string, subtaskId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteSubtask(subtaskId);
    return;
  }
  await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId, 'subtasks', subtaskId));
}

/* -------------------------------------------------------------------------- */
/* Notes                                                                      */
/* -------------------------------------------------------------------------- */

export function subscribeNotes(
  projectId: string,
  taskId: string,
  onData: (notes: Note[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.notes
          .filter((note) => note.taskId === taskId)
          .map((note) => ({ ...note }) as Note)
          .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)),
      onData
    );
  }

  return onSnapshot(
    query(collection(db, 'projects', projectId, 'tasks', taskId, 'notes')),
    (snapshot) => {
      const notes = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Note[];
      onData(notes.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)));
    },
    (error) => onError?.(handleFirestoreError(error, OperationType.LIST, 'tasks/notes'))
  );
}

export async function addNoteRecord(
  projectId: string,
  taskId: string,
  content: string,
  author: string
): Promise<void> {
  if (IS_DEMO) {
    demo.demoCreateNote(projectId, taskId, content, author);
    return;
  }
  await addDoc(collection(db, 'projects', projectId, 'tasks', taskId, 'notes'), {
    content,
    author,
    createdAt: serverTimestamp(),
  });
}

export async function deleteNoteRecord(projectId: string, taskId: string, noteId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteNote(noteId);
    return;
  }
  await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId, 'notes', noteId));
}

/* -------------------------------------------------------------------------- */
/* Project files                                                              */
/* -------------------------------------------------------------------------- */

export function subscribeProjectFiles(
  projectId: string,
  onData: (files: ProjectFile[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.files
          .filter((file) => file.projectId === projectId)
          .map((file) => ({ ...file }) as ProjectFile)
          .sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)),
      onData
    );
  }

  return onSnapshot(
    collection(db, 'projects', projectId, 'files'),
    (snapshot) => {
      const files = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as ProjectFile[];
      onData(files.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)));
    },
    (error) => onError?.(handleFirestoreError(error, OperationType.GET, 'projects/files'))
  );
}

export async function addProjectFile(input: {
  projectId: string;
  name: string;
  content: string;
  size?: number;
  uploadedBy?: string;
}): Promise<void> {
  if (IS_DEMO) {
    demo.demoCreateFile(input);
    return;
  }
  await addDoc(collection(db, 'projects', input.projectId, 'files'), {
    name: input.name,
    content: input.content,
    size: input.size ?? input.content.length,
    uploadedBy: input.uploadedBy ?? '',
    createdAt: serverTimestamp(),
  });
}

export async function deleteProjectFile(projectId: string, fileId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteFile(fileId);
    return;
  }
  await deleteDoc(doc(db, 'projects', projectId, 'files', fileId));
}

/* -------------------------------------------------------------------------- */
/* Calendar events                                                            */
/* -------------------------------------------------------------------------- */

export function subscribeEvents(
  uid: string,
  onData: (events: CalendarEvent[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  if (IS_DEMO) {
    return demoSubscribe(
      (database) =>
        database.events
          .filter((event) => event.userId === uid)
          .map((event) => ({ ...event }) as CalendarEvent)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      onData
    );
  }

  return onSnapshot(
    query(collection(db, 'calendarEvents'), where('userId', '==', uid)),
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as CalendarEvent[];
      onData(events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    },
    (error) => onError?.(handleFirestoreError(error, OperationType.GET, 'calendarEvents'))
  );
}

export async function createEvent(input: {
  uid: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  meetingLink?: string;
  agenda?: string;
  projectId?: string;
}): Promise<string> {
  if (IS_DEMO) {
    return demo.demoCreateEvent({
      userId: input.uid,
      title: input.title.trim(),
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      meetingLink: input.meetingLink,
      agenda: input.agenda,
      projectId: input.projectId,
    });
  }

  const ref = await addDoc(collection(db, 'calendarEvents'), {
    title: input.title.trim(),
    startTime: input.startTime,
    endTime: input.endTime || input.startTime,
    location: input.location?.trim() ?? '',
    meetingLink: input.meetingLink?.trim() ?? '',
    agenda: input.agenda?.trim() ?? '',
    ...(input.projectId ? { projectId: input.projectId } : {}),
    userId: input.uid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  if (IS_DEMO) {
    demo.demoDeleteEvent(eventId);
    return;
  }
  await deleteDoc(doc(db, 'calendarEvents', eventId));
}

/* -------------------------------------------------------------------------- */
/* AI workspace snapshot                                                      */
/* -------------------------------------------------------------------------- */

const MAX_FILE_CHARS = 4_000;

export async function fetchWorkspaceContext(uid: string, email?: string | null): Promise<WorkspaceContext> {
  if (IS_DEMO) {
    const database = demo.getDemoDb();
    const projects = database.projects
      .filter((project) => project.ownerId === uid || isProjectMember(project, email))
      .map((project) => ({
        ...project,
        tasks: database.tasks.filter((task) => task.projectId === project.id) as unknown as Task[],
        files: database.files
          .filter((file) => file.projectId === project.id)
          .map((file) => ({ id: file.id, name: file.name, content: file.content.slice(0, MAX_FILE_CHARS) })),
      }));
    return {
      generatedAt: new Date().toISOString(),
      calendarEvents: database.events.filter((event) => event.userId === uid) as unknown as CalendarEvent[],
      projects,
    };
  }

  const [eventsSnap, ownerSnap] = await Promise.all([
    getDocs(query(collection(db, 'calendarEvents'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'projects'), where('ownerId', '==', uid))),
  ]);

  const projectMap = new Map<string, Project>(
    ownerSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as object) } as Project])
  );

  const targetEmail = normalizeEmail(email);
  if (targetEmail) {
    const memberSnap = await getDocs(
      query(collection(db, 'projects'), where('members', 'array-contains', targetEmail))
    );
    for (const d of memberSnap.docs) {
      projectMap.set(d.id, { id: d.id, ...(d.data() as object) } as Project);
    }
  }

  const projects = await Promise.all(
    Array.from(projectMap.values()).map(async (project) => {
      let tasks: Task[] = [];
      let files: Array<{ id: string; name: string; content: string }> = [];
      try {
        const tasksSnap = await getDocs(collection(db, 'projects', project.id, 'tasks'));
        tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as Task));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects/tasks');
      }
      try {
        const filesSnap = await getDocs(collection(db, 'projects', project.id, 'files'));
        files = filesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: String(data.name ?? 'file'),
            content: String(data.content ?? '').slice(0, MAX_FILE_CHARS),
          };
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects/files');
      }
      return { ...project, tasks, files };
    })
  );

  const calendarEvents = eventsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as CalendarEvent[];

  return {
    generatedAt: new Date().toISOString(),
    calendarEvents,
    projects,
  };
}
