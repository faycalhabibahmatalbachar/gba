export function encodeProductCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt, i: id }), 'utf8').toString('base64url');
}

export function decodeProductCursor(s: string | null): { created_at: string; id: string } | null {
  if (!s) return null;
  try {
    const j = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as { c?: string; i?: string };
    if (j.c && j.i) return { created_at: j.c, id: j.i };
  } catch {
    try {
      const j = JSON.parse(Buffer.from(s, 'base64').toString('utf8')) as { c?: string; i?: string };
      if (j.c && j.i) return { created_at: j.c, id: j.i };
    } catch {
      return null;
    }
  }
  return null;
}
