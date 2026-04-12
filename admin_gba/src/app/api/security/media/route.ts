import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/app/api/_lib/require-super-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { fetchActorRole, writeAuditLog } from '@/lib/audit/server-audit';

export const dynamic = 'force-dynamic';
const BUCKET = 'security-docs';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const sb = getServiceSupabase();
  await sb.storage.createBucket(BUCKET, { public: false }).catch(() => undefined);
  const list = await sb.storage.from(BUCKET).list(auth.userId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  if (list.error) return NextResponse.json({ error: list.error.message }, { status: 500 });

  const data = await Promise.all(
    (list.data || []).map(async (f) => {
      const path = `${auth.userId}/${f.name}`;
      const s = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
      return { path, name: f.name, size: f.metadata?.size || 0, created_at: f.created_at, url: s.data?.signedUrl || null };
    }),
  );
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const sb = getServiceSupabase();
  const fd = await req.formData();
  const mode = String(fd.get('mode') || 'upload');
  if (mode === 'link_incident') {
    const mediaPath = String(fd.get('media_path') || '');
    const note = String(fd.get('note') || '');
    const alertId = String(fd.get('alert_id') || '');
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'update',
      entityType: 'setting',
      entityId: alertId || undefined,
      description: 'Association media securite a incident',
      metadata: { media_path: mediaPath, note, alert_id: alertId || null },
    });
    return NextResponse.json({ ok: true });
  }

  const files = fd.getAll('files');
  if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });
  await sb.storage.createBucket(BUCKET, { public: false }).catch(() => undefined);
  const uploaded: Record<string, unknown>[] = [];
  for (const item of files) {
    if (!(item instanceof File)) continue;
    const path = `${auth.userId}/${Date.now()}_${item.name.replace(/\s+/g, '_')}`;
    const buff = Buffer.from(await item.arrayBuffer());
    const up = await sb.storage.from(BUCKET).upload(path, buff, { contentType: item.type || 'application/octet-stream' });
    if (up.error) continue;
    const signed = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
    uploaded.push({ path, name: item.name, size: item.size, type: item.type, url: signed.data?.signedUrl || null, created_at: new Date().toISOString() });
    const role = await fetchActorRole(auth.userId);
    await writeAuditLog({
      actorUserId: auth.userId,
      actorEmail: auth.email,
      actorRole: role,
      actionType: 'create',
      entityType: 'setting',
      entityId: path,
      description: 'Upload media securite',
      metadata: { bucket: BUCKET, path, size: item.size, mime: item.type },
    });
  }
  return NextResponse.json({ data: uploaded });
}

export async function DELETE(req: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const sb = getServiceSupabase();
  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path')?.trim();
  if (!path) return NextResponse.json({ error: 'path manquant' }, { status: 400 });
  const rm = await sb.storage.from(BUCKET).remove([path]);
  if (rm.error) return NextResponse.json({ error: rm.error.message }, { status: 500 });
  const role = await fetchActorRole(auth.userId);
  await writeAuditLog({
    actorUserId: auth.userId,
    actorEmail: auth.email,
    actorRole: role,
    actionType: 'delete',
    entityType: 'setting',
    entityId: path,
    description: 'Suppression media securite',
    metadata: { bucket: BUCKET, path },
  });
  return NextResponse.json({ ok: true });
}
