import React, { useEffect, useState } from 'react';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { createEvent } from '../lib/appData';
import { describeError } from '../lib/errorHandlers';

interface AddEventModalProps {
  open: boolean;
  onClose: () => void;
  uid: string;
  /** Pre-fills the date part of the form (YYYY-MM-DD). */
  defaultDate?: string;
  onCreated?: () => void;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultTimes(dateStr?: string): { start: string; end: string } {
  const base = dateStr ? new Date(`${dateStr}T09:00:00`) : new Date();
  if (!dateStr) {
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
  }
  const end = new Date(base.getTime() + 60 * 60 * 1000);
  return { start: toLocalInput(base), end: toLocalInput(end) };
}

/**
 * Manual event creation.
 *
 * Previously calendar events could only be created by the AI assistant — a
 * dead end when the AI was unavailable or when the user just wanted to type a
 * meeting. This modal is the direct path.
 */
export default function AddEventModal({ open, onClose, uid, defaultDate, onCreated }: AddEventModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [agenda, setAgenda] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const times = defaultTimes(defaultDate);
    setTitle('');
    setStart(times.start);
    setEnd(times.end);
    setLocation('');
    setMeetingLink('');
    setAgenda('');
    setError('');
    setSaving(false);
  }, [open, defaultDate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end || start);
    if (Number.isNaN(startDate.getTime())) {
      setError(t('invalidTimeRange'));
      return;
    }
    if (!Number.isNaN(endDate.getTime()) && endDate < startDate) {
      setError(t('invalidTimeRange'));
      return;
    }
    if (meetingLink && !/^https?:\/\//i.test(meetingLink)) {
      setError(t('meetingLink') + ': https://…');
      return;
    }

    setSaving(true);
    try {
      await createEvent({
        uid,
        title: title.trim(),
        startTime: startDate.toISOString(),
        endTime: Number.isNaN(endDate.getTime()) ? startDate.toISOString() : endDate.toISOString(),
        location,
        meetingLink,
        agenda,
      });
      showToast({ message: t('eventCreated'), type: 'success' });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="add-event-title" className="max-w-lg">
      <form
        onSubmit={submit}
        className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800 bg-gray-950/50">
          <CalendarPlus className="w-5 h-5 text-emerald-400" aria-hidden="true" />
          <h2 id="add-event-title" className="text-sm font-semibold text-gray-100">
            {t('newEvent')}
          </h2>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <label className="block text-xs text-gray-400">
            <span className="block mb-1 font-medium">{t('eventTitle')}</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              autoFocus
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-gray-400">
              <span className="block mb-1 font-medium">{t('startsAt')}</span>
              <input
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block text-xs text-gray-400">
              <span className="block mb-1 font-medium">{t('endsAt')}</span>
              <input
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <label className="block text-xs text-gray-400">
            <span className="block mb-1 font-medium">{t('location')}</span>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block text-xs text-gray-400">
            <span className="block mb-1 font-medium">{t('meetingLink')}</span>
            <input
              type="url"
              value={meetingLink}
              onChange={(event) => setMeetingLink(event.target.value)}
              placeholder="https://meet.google.com/..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block text-xs text-gray-400">
            <span className="block mb-1 font-medium">{t('agenda')}</span>
            <textarea
              value={agenda}
              onChange={(event) => setAgenda(event.target.value)}
              rows={3}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-emerald-500 resize-y"
            />
          </label>

          {error && (
            <p role="alert" className="text-xs text-rose-400">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-800 bg-gray-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t('addEvent')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
