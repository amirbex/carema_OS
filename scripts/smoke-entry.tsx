/**
 * Client-render smoke entry: mounts the real views in demo mode so the
 * `smoke-pages` script can assert that the static preview actually renders
 * (instead of a blank page). Bundled by scripts/smoke-pages.mjs with
 * `VITE_DEMO_MODE=true`.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nProvider } from '../src/context/I18nContext';
import { ToastProvider } from '../src/context/ToastContext';
import { FocusProvider } from '../src/context/FocusContext';
import ProjectsView from '../src/components/ProjectsView';
import TimelineView from '../src/components/TimelineView';
import ChatView from '../src/components/ChatView';
import ProjectFilesView from '../src/components/ProjectFilesView';
import { getDemoDb } from '../src/lib/demoStore';

function tree(initialPath: string) {
  return (
    <I18nProvider>
      <ToastProvider>
        <FocusProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route path="/dashboard/projects" element={<ProjectsView />} />
              <Route path="/dashboard/timeline" element={<TimelineView />} />
              <Route path="/dashboard/chat" element={<ChatView />} />
              <Route
                path="/dashboard/files"
                element={<ProjectFilesView projectId={getDemoDb().projects[0].id} />}
              />
            </Routes>
          </MemoryRouter>
        </FocusProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

async function mount(node: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 80));
  });
  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function providers(node: React.ReactNode) {
  return (
    <I18nProvider>
      <ToastProvider>
        <FocusProvider>{node}</FocusProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

/** Clicks “extract data” on the seeded file and reports the task delta. */
export async function runExtractionSmoke(): Promise<{ before: number; after: number }> {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const projectId = getDemoDb().projects[0].id;
  const before = getDemoDb().tasks.length;

  const { container, unmount } = await mount(providers(<ProjectFilesView projectId={projectId} />));

  const button = Array.from(container.querySelectorAll('button')).find((element) =>
    (element.textContent ?? '').includes('استخراج')
  );
  if (!button) {
    await unmount();
    throw new Error('extract button not found in the files view');
  }

  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });

  await unmount();
  return { before, after: getDemoDb().tasks.length };
}

export async function runSmoke(): Promise<Record<string, string>> {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  const settle = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
  };

  // A fresh root per route: MemoryRouter keeps its history when the same
  // component instance is re-rendered, which would hide route-specific bugs.
  const render = async (path: string) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(tree(path));
    });
    await settle();

    const text = container.textContent ?? '';
    await act(async () => {
      root.unmount();
    });
    container.remove();
    return text;
  };

  const results: Record<string, string> = {};
  results.projects = await render('/dashboard/projects');
  results.timeline = await render('/dashboard/timeline');
  results.chat = await render('/dashboard/chat');
  results.files = await render('/dashboard/files');

  return results;
}
