import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const fd = await req.formData();
  const file = fd.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  const sb = getServiceSupabase();
  const bucket = 'email-attachments';
  await sb.storage.createBucket(bucket, { public: false }).catch(() => undefined);
  const path = `${auth.userId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await sb.storage.from(bucket).upload(path, bytes, { upsert: false, contentType: file.type || 'application/octet-stream' });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  const signed = await sb.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl, path, name: file.name, size: file.size, type: file.type });
}
