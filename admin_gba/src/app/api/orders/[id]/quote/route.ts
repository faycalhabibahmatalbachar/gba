import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/app/api/_lib/admin-permission';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  amount_xof: z.number().nonnegative().optional(),
  message: z.string().max(4000).optional(),
  quote_status: z.enum(['envoye', 'en_attente', 'accepte', 'refuse']).optional(),
});

function parsePayload(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (typeof j === 'object' && j !== null && !Array.isArray(j)) return j as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminPermission('orders', 'update');
  if (!auth.ok) return auth.response;

  const { id: orderId } = await ctx.params;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'Identifiant commande invalide' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return NextResponse.json(
      { error: 'Validation', formErrors: flat.fieldErrors },
      { status: 400 },
    );
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const { data: row, error: fetchErr } = await sb
    .from('orders')
    .select('id, notes, metadata')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });

  const r = row as { notes?: unknown; metadata?: unknown };
  const meta = parsePayload(r.metadata);
  const fromNotes = parsePayload(r.notes);
  const payload: Record<string, unknown> = { ...fromNotes, ...meta };
  const now = new Date().toISOString();

  if (parsed.data.amount_xof != null) payload.quote_amount_xof = parsed.data.amount_xof;
  if (parsed.data.message != null) payload.quote_message = parsed.data.message;
  payload.quote_status = parsed.data.quote_status ?? 'envoye';
  payload.quote_sent_at = now;
  payload.quote_updated_at = now;

  const tryMeta = await sb
    .from('orders')
    .update({ metadata: payload, updated_at: now })
    .eq('id', orderId);

  if (!tryMeta.error) {
    return NextResponse.json({ ok: true, quote: payload });
  }

  if (String(tryMeta.error.message).includes('metadata')) {
    const tryNotes = await sb
      .from('orders')
      .update({ notes: JSON.stringify(payload), updated_at: now })
      .eq('id', orderId);
    if (tryNotes.error) return NextResponse.json({ error: tryNotes.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, quote: payload });
  }

  return NextResponse.json({ error: tryMeta.error.message }, { status: 500 });
}
