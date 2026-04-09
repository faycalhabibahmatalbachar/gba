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
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Multipart requis' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Champ file manquant' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 180);
  const path = `${auth.userId}/${Date.now()}-${safeName}`;
  // `chat` matches mobile Supabase paths (/storage/v1/object/public/chat/...).
  const buckets = ['chat', 'chat-attachments', 'gba-chat', 'admin-uploads', 'public'] as const;
  const contentType = file.type || 'application/octet-stream';

  let lastErr: Error | null = null;
  for (const bucket of buckets) {
    let { error: upErr } = await sb.storage.from(bucket).upload(path, buf, {
      contentType,
      upsert: false,
    });
    if (upErr && /bucket.*not found/i.test(upErr.message)) {
      await sb.storage.createBucket(bucket, { public: true }).catch(() => null);
      const retry = await sb.storage.from(bucket).upload(path, buf, {
        contentType,
        upsert: false,
      });
      upErr = retry.error;
    }
    if (!upErr) {
      const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
      return NextResponse.json({
        url: pub.publicUrl,
        name: file.name,
        size: file.size,
        type: contentType,
        bucket,
      });
    }
    lastErr = new Error(upErr.message);
  }

  return NextResponse.json(
    {
      error: lastErr ? String(lastErr.message) : 'Upload impossible',
      hint: 'Créez au moins un bucket public parmi: chat, chat-attachments, gba-chat, admin-uploads.',
    },
    { status: 500 },
  );
}
