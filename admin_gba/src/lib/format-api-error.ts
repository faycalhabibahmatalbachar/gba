/** Human-readable message from API JSON (`error` string or Zod-style flatten object). */
export function formatApiError(payload: unknown, fallback = 'Requête échouée'): string {
  if (payload == null || typeof payload !== 'object') return fallback;
  const p = payload as { error?: unknown };
  const e = p.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const o = e as { formErrors?: unknown[]; fieldErrors?: Record<string, string[] | undefined> };
    const fe = Array.isArray(o.formErrors) ? o.formErrors.filter((x): x is string => typeof x === 'string') : [];
    const fieldParts: string[] = [];
    if (o.fieldErrors && typeof o.fieldErrors === 'object') {
      for (const [k, msgs] of Object.entries(o.fieldErrors)) {
        if (Array.isArray(msgs)) fieldParts.push(...msgs.map((m) => `${k}: ${m}`));
      }
    }
    const s = [...fe, ...fieldParts].join(' · ');
    if (s) return s;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return fallback;
  }
}
