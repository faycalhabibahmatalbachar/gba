import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  user_ids: z.array(z.string().uuid()).optional(),
  specific_tokens: z.array(z.string().min(10)).max(500).optional(),
  data: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().url().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation', details: parsed.error.flatten() }, { status: 422 });
  }

  const { title, body, user_ids, specific_tokens, data, imageUrl } = parsed.data;
  if (!user_ids?.length && !specific_tokens?.length) {
    return NextResponse.json({ error: 'Fournissez user_ids ou specific_tokens' }, { status: 422 });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) {
    return NextResponse.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
  }

  const payload: Record<string, unknown> = {
    type: 'admin_manual_push',
    title,
    body,
    data: data ?? {},
    image_url: imageUrl ?? undefined,
  };
  if (user_ids?.length) payload.user_ids = user_ids;
  if (specific_tokens?.length) payload.specific_tokens = specific_tokens;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Edge function error', status: res.status, result },
        { status: 502 },
      );
    }

    try {
      const sb = getServiceSupabase();
      await sb.from('audit_logs').insert({
        user_id: auth.userId,
        user_email: auth.email,
        user_role: 'admin',
        action_type: 'send_notification',
        action_description: `Push admin: ${title.slice(0, 80)}`,
        entity_type: 'notification',
        changes: { after: { user_ids: user_ids?.length ?? 0, tokens: specific_tokens?.length ?? 0 } },
        metadata: { ip: req.headers.get('x-forwarded-for') || undefined },
        status: 'success',
      } as never);
    } catch {
      /* audit best-effort */
    }

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
