/*
 * One calendar event as an .ics file (RFC 5545), with reminders 1 day and 1 hour before.
 * Adapted from AcadeXMatch lib/ics.ts; here the start is a UTC ISO time (slots are stored in UTC),
 * and the file is served by the server so it also works when opened from an email link.
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  /** ISO time (UTC). */
  start: string;
  durationMin: number;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  cancelled?: boolean;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Long lines are folded at 75 octets (approximated by characters) as the standard asks. */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? ' ' : '') + line.slice(i, i + 73));
  return parts.join('\r\n');
}

export function buildIcs(e: CalendarEvent, now = new Date()): string {
  const start = new Date(e.start);
  const end = new Date(start.getTime() + e.durationMin * 60_000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TheSchoolTeacher//Interviews//EN', 'CALSCALE:GREGORIAN', `METHOD:${e.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT', `UID:${e.uid}@theschoolteacher.in`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(e.title)}`, `STATUS:${e.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.description || e.url) lines.push(`DESCRIPTION:${esc([e.description, e.url].filter(Boolean).join('\n'))}`);
  if (e.url) lines.push(`URL:${e.url}`);
  for (const trigger of ['-P1D', '-PT1H']) lines.push('BEGIN:VALARM', `TRIGGER:${trigger}`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** "Mon, 16 Nov 2026, 10:30 am" in India time. */
export function istDateTime(iso: string, locale: 'en' | 'hi' = 'en'): string {
  return new Date(iso).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

/** Converts a date (YYYY-MM-DD) and time (HH:MM) in India Standard Time to a UTC ISO time. */
export function istToUtc(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  if (h > 23 || min > 59) return null;
  const ms = Date.UTC(y, m - 1, d, h, min) - 330 * 60_000;
  const back = new Date(ms + 330 * 60_000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  return new Date(ms).toISOString();
}
