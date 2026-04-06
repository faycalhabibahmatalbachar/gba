import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const f = form?.get('file');
  if (!(f instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (!f.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Image attendue' }, { status: 422 });
  }
  if (f.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image > 5MB non autorisée' }, { status: 422 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${id}/avatar-${Date.now()}.${ext}`;
  const up = await sb.storage.from('avatars').upload(path, f, {
    contentType: f.type,
    upsert: true,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const pub = sb.storage.from('avatars').getPublicUrl(path);
  const avatar_url = pub.data.publicUrl;
  const { error } = await sb.from('profiles').update({ avatar_url }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, avatar_url });
}

