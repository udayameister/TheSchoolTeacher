/** Dates in India time. Last dates are stored as YYYY-MM-DD and include the whole day. */
export function todayIst(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Whole days from today (India) to the date: 0 = today is the last day, negative = passed. */
export function daysLeft(lastDate: string | null | undefined, now = new Date()): number | null {
  if (!lastDate || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)) return null;
  return Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${todayIst(now)}T00:00:00Z`)) / 86400000);
}

export function isPast(lastDate: string | null | undefined, now = new Date()): boolean {
  const d = daysLeft(lastDate, now);
  return d !== null && d < 0;
}

export const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const isYearMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
