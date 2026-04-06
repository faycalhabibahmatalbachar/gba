import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';

const BUCKET = 'push-media';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data, error } = await sb
      .from('push_media')
      .select('id, url, filename, size_bytes, mime_type, used_in_campaigns, storage_path, created_at, uploaded_by')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

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
    return NextResponse.json({ error: 'Multipart attendu' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Champ file requis' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 180);
  const path = `${auth.userId}/${Date.now()}-${safeName}`;

  try {
    const { data: up, error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(up.path);
    const publicUrl = pub.publicUrl;

    const { data: row, error: insErr } = await sb
      .from('push_media')
      .insert({
        url: publicUrl,
        filename: file.name,
        size_bytes: file.size,
        mime_type: file.type || 'application/octet-stream',
        storage_path: up.path,
        uploaded_by: auth.userId,
      })
      .select('id, url, filename, size_bytes, mime_type, created_at')
      .single();

    if (insErr) throw insErr;

    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'notification',
      entityId: row?.id,
      description: `Média push: ${file.name}`,
    });

    return NextResponse.json({ data: row });
  } catch (e) {
    return NextResponse.json(
      {
        error: String((e as Error).message),
        hint: `Bucket storage « ${BUCKET} » requis (public recommandé pour URLs notification).`,
      },
      { status: 500 },
    );
  }
}
