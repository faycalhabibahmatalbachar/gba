import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { toPostgresCidr } from '@/lib/ip/to-postgres-cidr';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  ip: z.string().min(1).optional(),
  cidr: z.string().min(1).optional(),
  description: z.string().optional(),
  expires_at: z.string().nullable().optional(),
});

const importSchema = z.object({
  import_csv: z.literal(true),
  csv: z.string().min(1),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data, error } = await sb.from('ip_whitelist').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const imp = importSchema.safeParse(body);
  if (imp.success) {
    const lines = imp.data.csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let ok = 0;
    const errors: string[] = [];
    for (const line of lines) {
      const [rawIp, ...rest] = line.split(/[,;]/).map((s) => s.trim());
      if (!rawIp) continue;
      try {
        const cidr = toPostgresCidr(rawIp);
        const description = rest.join(' ').slice(0, 500) || null;
        const { error } = await sb.from('ip_whitelist').insert({
          ip_cidr: cidr,
          description,
          added_by: auth.userId,
        });
        if (error) errors.push(`${rawIp}: ${error.message}`);
        else ok += 1;
      } catch (e) {
        errors.push(`${rawIp}: ${String((e as Error).message)}`);
      }
    }
    return NextResponse.json({ imported: ok, errors });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const raw = parsed.data.ip || parsed.data.cidr;
  if (!raw) return NextResponse.json({ error: 'ip ou cidr requis' }, { status: 422 });

  try {
    const cidr = toPostgresCidr(raw);
    const row: Record<string, unknown> = {
      ip_cidr: cidr,
      description: parsed.data.description ?? null,
      added_by: auth.userId,
    };
    if (parsed.data.expires_at !== undefined) row.expires_at = parsed.data.expires_at;

    const { data, error } = await sb.from('ip_whitelist').insert(row).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 422 });
  }
}
