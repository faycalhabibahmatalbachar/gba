export function decodeCursor(s: string | null): { c: string; i: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { c?: string; i?: string };
    if (j.c && j.i) return { c: j.c, i: j.i };
  } catch {
    /* ignore */
  }
  return null;
}

export function encodeCursor(c: string, i: string): string {
  return Buffer.from(JSON.stringify({ c, i }), 'utf8').toString('base64url');
}
