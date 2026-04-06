import { addDays, getDate, getDay, isAfter, set, startOfDay } from 'date-fns';

/** Jour semaine FR 1=lundi … 7=dimanche → valeur `Date.getDay()` (0=dim … 6=sam). */
function frWeekdayToJs(fr: number): number {
  return fr === 7 ? 0 : fr;
}

/**
 * Prochaine exécution locale (serveur) pour une planification push.
 * `sendTime` : `HH:mm` ou `HH:mm:ss`.
 */
export function computeNextScheduleRun(
  frequency: 'daily' | 'weekly' | 'monthly',
  sendTime: string,
  from: Date = new Date(),
  opts?: { frDayOfWeek?: number | null; dayOfMonth?: number | null },
): Date {
  const p = sendTime.split(':');
  const hh = parseInt(p[0] ?? '9', 10);
  const mm = parseInt(p[1] ?? '0', 10);
  const ss = parseInt(p[2] ?? '0', 10);

  const targetJsDay = frWeekdayToJs(opts?.frDayOfWeek ?? 1);
  const dom = Math.min(31, Math.max(1, opts?.dayOfMonth ?? 1));

  for (let i = 0; i < 400; i++) {
    const base = addDays(startOfDay(from), i);
    const candidate = set(base, { hours: hh, minutes: mm, seconds: ss, milliseconds: 0 });
    if (!isAfter(candidate, from)) continue;
    if (frequency === 'daily') return candidate;
    if (frequency === 'weekly') {
      if (getDay(candidate) === targetJsDay) return candidate;
    } else if (frequency === 'monthly') {
      if (getDate(candidate) === dom) return candidate;
    }
  }
  return addDays(from, 1);
}

export function normalizePgTime(sendTime: string): string {
  const t = sendTime.trim();
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  return t;
}
