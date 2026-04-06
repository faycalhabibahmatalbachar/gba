import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const slug = new URL(req.url).searchParams.get('slug')?.trim() ?? '';
  const excludeId = new URL(req.url).searchParams.get('exclude_id');
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ available: false, error: 'Slug invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant' }, { status: 503 });
  }

  try {
    const { data } = await sb.from('products').select('id').eq('slug', slug).maybeSingle();
    if (!data) {
      return NextResponse.json({ available: true });
    }
    if (excludeId && z.string().uuid().safeParse(excludeId).success && data.id === excludeId) {
      return NextResponse.json({ available: true });
    }
    return NextResponse.json({ available: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
