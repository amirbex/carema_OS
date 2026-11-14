/**
 * Pure formatting / data helpers.
 * Everything here is side-effect free so it can be unit tested without a DOM.
 */

/** Days remaining until `date` (negative = overdue). `null` when unusable. */
export function daysUntil(date: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

export function isOverdue(date: string | Date | null | undefined, status?: string, now: Date = new Date()): boolean {
  if (status === 'DONE') return false;
  const delta = daysUntil(date, now);
  return delta !== null && delta < 0;
}

/** Clamp a number into [min, max]; NaN falls back to min. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Percentage 0-100 that never divides by zero. */
export function percent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

/** CSV cell escaping (RFC 4180) — always quote, double inner quotes. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
}

/** Trigger a browser download for a text payload. */
export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Filesystem-safe file name fragment. */
export function safeFileName(name: string, fallback = 'export'): string {
  const cleaned = (name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return cleaned || fallback;
}

/** Human friendly relative time (used in the activity feed). */
export function relativeTime(input: string | Date, now: Date = new Date(), locale = 'en'): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 60) return formatter.format(Math.round(diffSec), 'second');
  if (abs < 3600) return formatter.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return formatter.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 2_592_000) return formatter.format(Math.round(diffSec / 86_400), 'day');
  return formatter.format(Math.round(diffSec / 2_592_000), 'month');
}

/** Stable id that also works in insecure contexts (crypto.randomUUID requires HTTPS). */
export function createId(prefix = ''): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/** Convert a Firestore Timestamp | Date | ISO string into a Date (or null). */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null && typeof (value as any).toDate === 'function') {
    try {
      return (value as any).toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Minimum one-line initial(s) for avatar bubbles; handles empty names. */
export function initials(value?: string | null, length = 2): string {
  const text = (value ?? '').trim();
  if (!text) return '?';
  // Prefer the local part of an email ("ada.lovelace@x.dev" -> "AL").
  const base = text.includes('@') ? text.split('@')[0].replace(/[._-]+/g, ' ') : text;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, length).toUpperCase();
}

/** Truncate long text with an ellipsis, never mid-surrogate-pair. */
export function truncate(value: string, max: number): string {
  if (!value) return '';
  if (value.length <= max) return value;
  return `${Array.from(value).slice(0, Math.max(0, max - 1)).join('')}…`;
}
