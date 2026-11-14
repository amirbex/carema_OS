import type { AiProposalAction, AiReply } from './aiClient';
import type { WorkspaceContext } from './appData';
import { createId } from './format';

/**
 * Local, rule-based stand-in for the Gemini assistant, used in the static
 * preview build (GitHub Pages). It understands a handful of intents so the
 * chat screen is still explorable and can even create demo data — but it never
 * claims to be the real model.
 */

type Lang = 'fa' | 'en';

const PROPOSALS = {
  createProject: (name: string): AiProposalAction => ({
    function: 'create_project',
    description: `create_project: ${name}`,
    parameters: {
      name,
      category: 'General',
      tasks: [
        { title: 'تعریف اهداف و محدودهٔ پروژه', priority: 'High' },
        { title: 'تدوین برنامهٔ زمان‌بندی', priority: 'Medium' },
        { title: 'جلسهٔ هم‌سویی با تیم', priority: 'Low' },
      ],
    },
  }),
  createTask: (projectId: string, title: string): AiProposalAction => ({
    function: 'create_task',
    description: `create_task: ${title}`,
    parameters: { project_id: projectId, title, priority: 'Medium' },
  }),
  createEvent: (title: string, startTime: string): AiProposalAction => ({
    function: 'create_event',
    description: `create_event: ${title}`,
    parameters: {
      title,
      startTime,
      endTime: startTime,
      location: 'Google Meet',
    },
  }),
};

function tomorrowAt(hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function quotedOrAfter(input: string, markers: RegExp[]): string | null {
  const quoted = input.match(/[«"'“]([^»"'”]{2,80})[»"'”]/);
  if (quoted) return quoted[1].trim();
  for (const marker of markers) {
    const match = input.match(marker);
    if (match?.[1]) return match[1].trim().replace(/[.!؟?،,]+$/, '');
  }
  return null;
}

function firstProject(context: WorkspaceContext) {
  return context.projects[0] ?? null;
}

export function buildDemoReply(input: string, context: WorkspaceContext, lang: Lang): AiReply {
  const text = input.trim();
  const note =
    lang === 'fa'
      ? '\n\n> حالت پیش‌نمایش: هوش مصنوعی به سرور متصل نیست و این پاسخ به‌صورت محلی و قاعده‌محور ساخته شده است.'
      : '\n\n> Preview mode: the AI backend is not connected. This reply was generated locally with simple rules.';

  const projectNames = context.projects.map((project) => `«${project.name}»`).join(lang === 'fa' ? '، ' : ', ');
  const taskCount = context.projects.reduce((sum, project) => sum + project.tasks.length, 0);
  const openTasks = context.projects.reduce(
    (sum, project) => sum + project.tasks.filter((task) => task.status !== 'DONE').length,
    0
  );

  const wantsProject = /(پروژه|project)/i.test(text) && /(بساز|ایجاد|جدید|اضافه|create|new|add|make)/i.test(text);
  const wantsMeeting = /(جلسه|ملاقات|قرار|meeting|schedule|call)/i.test(text);
  const wantsTask = /(وظیفه|تسک|کار|task|todo|ticket)/i.test(text) && !wantsProject;
  const wantsStats = /(چند|تعداد|وضعیت|خلاصه|گزارش|how many|status|summary|report|overview)/i.test(text);

  if (wantsProject) {
    const name =
      quotedOrAfter(text, [/(?:به\s*نام|با\s*نام|نام)\s+(.{2,80})/i, /(?:named|called)\s+(.{2,80})/i]) ??
      (lang === 'fa' ? 'پروژهٔ جدید (پیش‌نمایش)' : 'New project (preview)');

    return {
      status: 'PROPOSAL',
      message_id: createId('demo'),
      display_text:
        lang === 'fa'
          ? `پروژهٔ «${name}» با سه وظیفهٔ پیشنهادی ساخته می‌شود. تأیید می‌کنید؟` + note
          : `I can create “${name}” with three starter tasks. Confirm to apply it to the demo data.` + note,
      proposed_actions: [PROPOSALS.createProject(name)],
    };
  }

  if (wantsMeeting) {
    const title =
      quotedOrAfter(text, [/(?:با|برای|عنوان)\s+(.{2,80})/i, /(?:about|with|for)\s+(.{2,80})/i]) ??
      (lang === 'fa' ? 'جلسهٔ هماهنگی تیم' : 'Team sync meeting');

    return {
      status: 'PROPOSAL',
      message_id: createId('demo'),
      display_text:
        lang === 'fa'
          ? `یک رویداد «${title}» برای فردا ساعت ۱۰:۰۰ پیشنهاد می‌شود. تأیید می‌کنید؟` + note
          : `I can schedule “${title}” for tomorrow at 10:00. Confirm to add it to the demo calendar.` + note,
      proposed_actions: [PROPOSALS.createEvent(title, tomorrowAt(10))],
    };
  }

  if (wantsTask) {
    const project = firstProject(context);
    const title =
      quotedOrAfter(text, [/(?:با|عنوان|برای)\s+(.{2,80})/i, /(?:about|to|for)\s+(.{2,80})/i]) ??
      (lang === 'fa' ? 'وظیفهٔ جدید از دستیار' : 'New task from assistant');

    if (!project) {
      return {
        status: 'MESSAGE',
        message_id: createId('demo'),
        display_text:
          (lang === 'fa'
            ? 'برای ساخت وظیفه ابتدا یک پروژه لازم است؛ از صفحهٔ پروژه‌ها یک پروژه بسازید.'
            : 'A project is required first — create one on the Projects page.') + note,
        proposed_actions: [],
      };
    }

    return {
      status: 'PROPOSAL',
      message_id: createId('demo'),
      display_text:
        (lang === 'fa'
          ? `وظیفهٔ «${title}» در پروژهٔ «${project.name}» ساخته شود؟`
          : `Create “${title}” inside “${project.name}”?`) + note,
      proposed_actions: [PROPOSALS.createTask(project.id, title)],
    };
  }

  if (wantsStats) {
    return {
      status: 'MESSAGE',
      message_id: createId('demo'),
      display_text:
        (lang === 'fa'
          ? `**خلاصهٔ داده‌های نمونه**\n\n- پروژه‌ها: **${context.projects.length}** (${projectNames || '—'})\n- وظایف: **${taskCount}** — از این تعداد **${openTasks}** وظیفه باز است\n- رویدادهای تقویم: **${context.calendarEvents.length}**\n\nمی‌توانید از صفحهٔ «پروژه‌ها» وضعیت‌ها را تغییر دهید؛ همهٔ تغییرات فقط در همین مرورگر ذخیره می‌شوند.`
          : `**Demo data summary**\n\n- Projects: **${context.projects.length}** (${projectNames || '—'})\n- Tasks: **${taskCount}** — **${openTasks}** still open\n- Calendar events: **${context.calendarEvents.length}**\n\nChange statuses on the Projects page; edits stay in this browser only.`) +
        note,
      proposed_actions: [],
    };
  }

  return {
    status: 'MESSAGE',
    message_id: createId('demo'),
    display_text:
      (lang === 'fa'
        ? `سلام! این نسخهٔ پیش‌نمایش CaReMa OS است و بدون سرور اجرا می‌شود.\n\nمی‌توانید امتحان کنید:\n- «یک پروژهٔ جدید به نام بازطراحی اپ بساز»\n- «یک جلسه برای فردا بساز»\n- «یک وظیفهٔ جدید اضافه کن»\n- «خلاصهٔ وضعیت را بگو»\n\nصفحه‌های پروژه‌ها، تایم‌لاین، فایل‌های پروژه و تایمر تمرکز کاملاً کار می‌کنند.`
        : `Hi! This is the CaReMa OS preview build and it runs without a server.\n\nTry:\n- “Create a new project named Website redesign”\n- “Schedule a meeting for tomorrow”\n- “Add a task”\n- “Give me a status summary”\n\nProjects, timeline, project files and the focus timer all work fully.`) + note,
    proposed_actions: [],
  };
}
