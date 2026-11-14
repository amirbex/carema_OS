import type { Priority } from './appData';

/**
 * Offline, rule-based replacement for the Gemini extraction endpoint.
 *
 * Used in demo/preview mode (GitHub Pages) so the “extract tasks from file”
 * button still does something useful without any API key or server.
 */

export interface LocallyExtractedTask {
  title: string;
  priority: Priority;
}

const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s*\[( |x|X)\]\s+(.+)$/;
const TODO_PREFIX = /^\s*(?:TODO|FIXME|ACTION|کار|وظیفه)\s*[::]\s*(.+)$/i;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;
const BULLET = /^\s*[-*+]\s+(.+)$/;

const URGENT = /(فوری|امروز|حتما|حتماً|urgent|asap|critical|blocker)/i;
const HIGH = /(مهم|اولویت بالا|high|important|deadline|مهلت)/i;

function cleanTitle(raw: string): string {
  return raw
    .replace(CHECKBOX, '$2')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function priorityFor(title: string): Priority {
  if (URGENT.test(title)) return 'Critical';
  if (HIGH.test(title)) return 'High';
  return 'Medium';
}

export function extractTasksLocally(content: string, limit = 20): LocallyExtractedTask[] {
  const seen = new Set<string>();
  const tasks: LocallyExtractedTask[] = [];

  for (const line of String(content ?? '').split(/\r?\n/)) {
    let match: RegExpMatchArray | null = null;
    let isTask = false;

    if ((match = line.match(CHECKBOX))) {
      isTask = match[1].trim() === ''; // only unchecked boxes become tasks
      match = [line, match[2]];
    } else if ((match = line.match(TODO_PREFIX))) {
      isTask = true;
    } else if ((match = line.match(NUMBERED)) || (match = line.match(BULLET))) {
      // Plain list items are only treated as tasks when they read like an
      // action (verb-ish length) — this keeps headings/notes out.
      isTask = match![1].trim().split(/\s+/).length >= 3;
    }

    if (!isTask || !match) continue;

    const title = cleanTitle(match[1] ?? '');
    const key = title.toLowerCase();
    if (title.length < 3 || seen.has(key)) continue;

    seen.add(key);
    tasks.push({ title, priority: priorityFor(title) });
    if (tasks.length >= limit) break;
  }

  return tasks;
}
