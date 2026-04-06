import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'FormData attendu' }, { status: 400 });
  }

  const file = form.get('file');
  const pathRaw = form.get('path');
  if (!(file instanceof File) || typeof pathRaw !== 'string' || !pathRaw.trim()) {
    return NextResponse.json({ error: 'file et path requis' }, { status: 400 });
  }

  const path = pathRaw.replace(/^\/+/, '');
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const { data, error } = await sb.storage.from('products').upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: pub } = sb.storage.from('products').getPublicUrl(data.path);

    return NextResponse.json({ path: data.path, publicUrl: pub.publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur upload';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
