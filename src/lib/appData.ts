import {
  addDoc,
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
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './errorHandlers';

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

export interface WorkspaceContext {
  generatedAt: string;
  calendarEvents: CalendarEvent[];
  projects: Array<Project & { tasks: Task[]; files: Array<{ id: string; name: string; content: string }> }>;
}

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
export const PRIORITIES: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

/* -------------------------------------------------------------------------- */
/* Projects                                                                   */
/* -------------------------------------------------------------------------- */

export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function isProjectMember(project: Pick<Project, 'members'>, email?: string | null): boolean {
  const target = normalizeEmail(email);
  if (!target) return false;
  return (project.members ?? []).some((m) => normalizeEmail(m) === target);
}

export function isProjectOwner(project: Pick<Project, 'ownerId'>, uid?: string | null): boolean {
  return Boolean(uid && project.ownerId === uid);
}

/**
 * Subscribe to every project the user can see.
 *
 * The original implementation only listened to `members array-contains email`,
 * so a project created without a members array (or owned before a rename)
 * silently disappeared. We now listen to both the owner query and the member
 * query and merge the results by document id.
 */
export function subscribeProjects(
  uid: string,
  email: string | null | undefined,
  onData: (projects: Project[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  const buckets: Record<'owner' | 'member', Map<string, Project>> = {
    owner: new Map(),
    member: new Map(),
  };

  const emit = () => {
    const merged = new Map<string, Project>();
    for (const bucket of [buckets.owner, buckets.member]) {
      for (const [id, project] of bucket) merged.set(id, project);
    }
    const list = Array.from(merged.values()).sort((a, b) =>
      String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { sensitivity: 'base' })
    );
    onData(list);
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
  const { arrayUnion } = await import('firebase/firestore');
  await updateDoc(doc(db, 'projects', projectId), {
    members: arrayUnion(normalizeEmail(email)),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Firestore never deletes subcollections automatically, so deleting a project
 * used to leave orphaned tasks/files/notes behind (unreadable and billed).
 */
export async function deleteProjectCascade(projectId: string): Promise<void> {
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
  return onSnapshot(
    collection(db, 'projects', projectId, 'tasks'),
    (snapshot) => {
      const tasks = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Task[];
      // Stable order: newest first, then title, so optimistic edits don't jump.
      tasks.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }));
      onData(tasks);
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
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/* -------------------------------------------------------------------------- */
/* Calendar events                                                            */
/* -------------------------------------------------------------------------- */

export function subscribeEvents(
  uid: string,
  onData: (events: CalendarEvent[]) => void,
  onError?: (message: string) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'calendarEvents'), where('userId', '==', uid)),
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as CalendarEvent[];
      events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      onData(events);
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
  await deleteDoc(doc(db, 'calendarEvents', eventId));
}

/* -------------------------------------------------------------------------- */
/* AI workspace snapshot                                                      */
/* -------------------------------------------------------------------------- */

const MAX_FILE_CHARS = 4_000;

/**
 * Build a compact snapshot of the user's workspace for the AI endpoints.
 * Shared by the chat view, the live (voice) session and future features so the
 * three copies of this logic can no longer drift apart.
 */
export async function fetchWorkspaceContext(uid: string, email?: string | null): Promise<WorkspaceContext> {
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
