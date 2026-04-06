import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { normalizeAuditRow } from '@/lib/audit/normalize-audit-row';
import { applyAuditLogFilters } from '@/app/api/audit/_lib/apply-filters';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  format: z.enum(['csv', 'json']),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  action_type: z.string().optional(),
  actor_id: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ip: z.string().optional(),
  limit: z.number().int().min(1).max(10_000).optional().default(5000),
});

function rowToCsvLine(cells: string[]): string {
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { format, limit, ...f } = parsed.data;
  const filterPayload = {
    entityType: f.entity_type ?? null,
    entityId: f.entity_id ?? null,
    actionType: f.action_type ?? null,
    actorId: f.actor_id ?? null,
    status: f.status ?? null,
    from: f.from ?? null,
    to: f.to ?? null,
    ip: f.ip ?? null,
  };

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const acc: Record<string, unknown>[] = [];
    let offset = 0;
    const batch = 800;
    while (acc.length < limit) {
      const take = Math.min(batch, limit - acc.length);
      let q = sb.from('audit_logs').select('*').order('created_at', { ascending: false });
      q = applyAuditLogFilters(q, filterPayload);
      q = q.range(offset, offset + take - 1);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Record<string, unknown>[];
      for (const r of rows) acc.push(normalizeAuditRow(r));
      if (rows.length < take) break;
      offset += take;
    }

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      const json = JSON.stringify(acc, null, 2);
      return new NextResponse(json, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-export-${stamp}.json"`,
        },
      });
    }

    const headers = [
      'created_at',
      'user_email',
      'user_role',
      'action_type',
      'entity_type',
      'entity_id',
      'entity_name',
      'action_description',
      'status',
      'error_message',
    ];
    const lines = [rowToCsvLine(headers)];
    for (const row of acc) {
      lines.push(
        rowToCsvLine(
          headers.map((h) => {
            const v = row[h];
            if (v === null || v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return String(v);
          }),
        ),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-export-${stamp}.csv"`,
      },
    });
  } catch (e) {
    console.error('[api/audit/export]', e);
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
