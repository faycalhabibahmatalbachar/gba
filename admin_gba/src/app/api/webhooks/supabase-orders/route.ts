import { NextResponse } from 'next/server';
import { emitAdminNotification } from '@/lib/email/notification-dispatcher';

export const dynamic = 'force-dynamic';

function verifySecret(req: Request): boolean {
  const secret = process.env.ORDER_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() === secret;
  return req.headers.get('x-webhook-secret') === secret;
}

function isSpecialOrderRow(record: Record<string, unknown>): boolean {
  const notes = String(record.notes || '').toLowerCase();
  const num = String(record.order_number || '').toLowerCase();
  if (notes.includes('special') || notes.includes('devis') || notes.includes('quotation') || notes.includes('quote'))
    return true;
  if (num.startsWith('sp-')) return true;
  const meta = record.metadata;
  const ms = typeof meta === 'string' ? meta : JSON.stringify(meta ?? '');
  const m = ms.toLowerCase();
  return m.includes('special') || m.includes('quote') || m.includes('devis');
}

/**
 * Database Webhook (Supabase) on `orders` INSERT.
 * Configure URL: https://YOUR_ADMIN_ORIGIN/api/webhooks/supabase-orders
 * Header: Authorization: Bearer <ORDER_WEBHOOK_SECRET> or x-webhook-secret: <ORDER_WEBHOOK_SECRET>
 */
export async function POST(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const table = String(b.table || '');
  const type = String(b.type || '');
  if (table !== 'orders' || type !== 'INSERT') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const record = b.record;
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const row = record as Record<string, unknown>;
  const id = String(row.id || '');
  const orderNumber = String(row.order_number || id || 'N/A');
  const customer = String(row.customer_name || row.user_id || 'Client');
  const total = row.total_amount != null ? String(row.total_amount) : '0';
  const special = isSpecialOrderRow(row);
  const notesRaw = typeof row.notes === 'string' ? row.notes.trim() : '';
  const notesHint = notesRaw ? notesRaw.slice(0, 280) : '';

  const emailOut = await emitAdminNotification({
    type: special ? 'order_special_created' : 'order_created',
    entityId: id || orderNumber,
    payload: {
      order_number: orderNumber,
      customer_name: customer,
      total_amount: total,
      notes_hint: notesHint || undefined,
    },
    priority: 'normal',
  });

  return NextResponse.json({ ok: true, notification: emailOut });
}
