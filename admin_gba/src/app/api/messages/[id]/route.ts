import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { collectUrlsFromChatAttachments, storageRefFromPublicUrl } from '@/app/api/_lib/storage-from-public-url';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  read: z.boolean().optional(),
  deleted: z.boolean().optional(),
  important: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
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
    if (parsed.data.deleted === true) {
      const { data: row } = await sb
        .from('chat_messages')
        .select('attachments, image_url')
        .eq('id', id)
        .maybeSingle();
      const urls = collectUrlsFromChatAttachments(row?.attachments, row?.image_url as string | null);
      for (const u of urls) {
        const ref = storageRefFromPublicUrl(u);
        if (ref) await sb.storage.from(ref.bucket).remove([ref.path]);
      }
    }

    const upd: Record<string, unknown> = {};
    if (parsed.data.read === true) upd.is_read = true;
    if (parsed.data.deleted === true) {
      upd.deleted_at = new Date().toISOString();
      upd.deleted_by = auth.userId;
      upd.message = "[Message supprimé par l'administrateur]";
      upd.attachments = [] as unknown;
      upd.image_url = null;
    }
    if (parsed.data.important !== undefined) {
      upd.is_important = parsed.data.important;
      const { data: cur } = await sb.from('chat_messages').select('metadata').eq('id', id).maybeSingle();
      const meta = { ...((cur?.metadata as Record<string, unknown>) || {}), important: parsed.data.important };
      upd.metadata = meta;
    }

    if (Object.keys(upd).length === 0) {
      return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 });
    }

    const { error } = await sb.from('chat_messages').update(upd).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data: row } = await sb
      .from('chat_messages')
      .select('attachments, image_url')
      .eq('id', id)
      .maybeSingle();
    const urls = collectUrlsFromChatAttachments(row?.attachments, row?.image_url as string | null);
    for (const u of urls) {
      const ref = storageRefFromPublicUrl(u);
      if (ref) await sb.storage.from(ref.bucket).remove([ref.path]);
    }

    const { error } = await sb
      .from('chat_messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: auth.userId,
        message: "[Message supprimé par l'administrateur]",
        attachments: [] as unknown,
        image_url: null,
      })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
