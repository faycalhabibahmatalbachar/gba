import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const filtersSchema = z.object({
  role: z.string().optional(),
  country: z.string().optional(),
  platform: z.enum(['ios', 'android', 'all']).optional(),
  valid_tokens_only: z.boolean().optional(),
});

const bodySchema = z.object({
  title: z.string().max(200),
  body: z.string().max(5000),
  filters: filtersSchema.optional().default({}),
});

const BATCH = 100;

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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    let pq = sb.from('profiles').select('id');
    const f = parsed.data.filters;
    if (f.role) pq = pq.eq('role', f.role);
    if (f.country) pq = pq.eq('country', f.country);

    const { data: profs, error: pe } = await pq.limit(5000);
    if (pe) throw pe;
    let userIds = (profs || []).map((p: { id: string }) => p.id);

    if (f.valid_tokens_only) {
      const { data: tok } = await sb.from('device_tokens').select('user_id').eq('is_valid', true);
      const set = new Set((tok || []).map((t: { user_id: string }) => t.user_id));
      userIds = userIds.filter((id) => set.has(id));
    }

    const text = [parsed.data.title, parsed.data.body].filter(Boolean).join('\n\n');
    let created = 0;

    for (let i = 0; i < userIds.length; i += BATCH) {
      const chunk = userIds.slice(i, i + BATCH);
      for (const uid of chunk) {
        const { data: conv, error: ce } = await sb
          .from('chat_conversations')
          .insert({
            user_id: uid,
            type: 'broadcast',
            status: 'active',
            title: parsed.data.title,
            metadata: { broadcast: true },
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (ce || !conv) continue;
        const { error: me } = await sb.from('chat_messages').insert({
          conversation_id: conv.id,
          sender_id: auth.userId,
          message: text,
          message_type: 'system',
          is_read: false,
        });
        if (!me) created += 1;
      }
    }

    const job_id = crypto.randomUUID();
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'send_notification',
      entityType: 'message',
      entityId: job_id,
      description: `Broadcast in-app: ${parsed.data.title.slice(0, 80)}`,
      changes: { after: { recipients: userIds.length, created } },
    });

    return NextResponse.json({ job_id, total: userIds.length, created });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
