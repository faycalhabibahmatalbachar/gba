import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';

export const dynamic = 'force-dynamic';

const schema = z.object({
  targets: z.array(z.string().min(8).max(2048)).max(12),
});

/** Teste la connectivité HTTP(S) vers des URLs (diagnostic réseau admin). */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const results: { url: string; ok: boolean; status?: number; ms: number; error?: string }[] = [];

  for (const url of parsed.data.targets) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(to);
      results.push({ url, ok: r.ok, status: r.status, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ url, ok: false, ms: Date.now() - t0, error: String((e as Error).message) });
    }
  }

  return NextResponse.json({ data: results });
}
