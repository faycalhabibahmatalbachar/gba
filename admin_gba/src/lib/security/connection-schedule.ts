import type { SupabaseClient } from '@supabase/supabase-js';

const SETTINGS_KEY = 'admin_connection_schedule';

/** Compte toujours autorisé (non restreint par plage) — complété par le JSON settings */
const HARDCODED_BYPASS_EMAILS = ['faycalhabibahmat@gmail.com'];

export type ConnectionSchedulePayload = {
  enabled?: boolean;
  timezone?: string;
  windows?: Array<{ days: number[]; start: string; end: string }>;
  permanentBypassEmails?: string[];
};

function normEmail(e: string | null | undefined) {
  return (e || '').trim().toLowerCase();
}

function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function currentDowShortInTz(timeZone: string): string {
  return new Date().toLocaleDateString('en-US', { timeZone, weekday: 'short' });
}

function currentMinutesInTz(timeZone: string): number {
  const t = new Date().toLocaleString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const [hh, mm] = t.split(':').map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}

/** Map jour court EN -> 1 = lundi … 7 = dimanche (ISO-like) */
const DOW_EN_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export async function loadConnectionSchedule(
  sb: SupabaseClient,
): Promise<ConnectionSchedulePayload | null> {
  const { data } = await sb.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
  const v = data?.value;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as ConnectionSchedulePayload;
}

/**
 * @returns message d’erreur si connexion refusée, sinon null
 */
export async function getConnectionScheduleDenialMessage(
  sb: SupabaseClient,
  email: string | null | undefined,
): Promise<string | null> {
  const sched = await loadConnectionSchedule(sb);
  if (!sched || !sched.enabled) return null;

  const em = normEmail(email);
  const bypass = new Set(
    [...HARDCODED_BYPASS_EMAILS.map(normEmail), ...(sched.permanentBypassEmails || []).map(normEmail)].filter(
      Boolean,
    ),
  );
  if (em && bypass.has(em)) return null;

  const tz = sched.timezone?.trim() || 'UTC';
  const windows = sched.windows || [];
  if (windows.length === 0) return null;

  const dowShort = currentDowShortInTz(tz);
  const isoDow = DOW_EN_TO_ISO[dowShort.slice(0, 3)] ?? 1;
  const nowMin = currentMinutesInTz(tz);

  for (const w of windows) {
    const days = Array.isArray(w.days) ? w.days : [];
    if (!days.includes(isoDow)) continue;
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    if (start == null || end == null) continue;
    if (start <= end) {
      if (nowMin >= start && nowMin <= end) return null;
    } else {
      if (nowMin >= start || nowMin <= end) return null;
    }
  }

  return 'Accès non autorisé en dehors des horaires définis';
}
