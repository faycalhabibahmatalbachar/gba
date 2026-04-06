import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';
import { normalizeAuditRow } from '@/lib/audit/normalize-audit-row';

export const dynamic = 'force-dynamic';

/**
 * Mini-timeline autour d’un événement : même acteur ou même entité, fenêtre ±minutes.
 * Query: user_id, entity_type, entity_id, created_at (ISO), minutes (default 5)
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id')?.trim();
  const entityType = searchParams.get('entity_type')?.trim();
  const entityId = searchParams.get('entity_id')?.trim();
  const createdAt = searchParams.get('created_at')?.trim();
  const minutes = Math.min(120, Math.max(1, parseInt(searchParams.get('minutes') || '5', 10) || 5));

  if (!createdAt) {
    return NextResponse.json({ error: 'created_at requis' }, { status: 400 });
  }

  const anchor = new Date(createdAt);
  if (Number.isNaN(anchor.getTime())) {
    return NextResponse.json({ error: 'created_at invalide' }, { status: 400 });
  }

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  const from = new Date(anchor.getTime() - minutes * 60000).toISOString();
  const to = new Date(anchor.getTime() + minutes * 60000).toISOString();

  try {
    const rows: Record<string, unknown>[] = [];

    if (userId) {
      const { data, error } = await sb
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: true })
        .limit(80);
      if (error) throw error;
      rows.push(...((data || []) as Record<string, unknown>[]));
    }

    if (entityType && entityId) {
      const { data, error } = await sb
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: true })
        .limit(80);
      if (error) throw error;
      rows.push(...((data || []) as Record<string, unknown>[]));
    }

    const seen = new Set<string>();
    const merged = rows.filter((r) => {
      const id = String(r.id ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    merged.sort(
      (a, b) =>
        new Date(String(a.created_at || 0)).getTime() - new Date(String(b.created_at || 0)).getTime(),
    );

    return NextResponse.json({
      data: merged.map(normalizeAuditRow),
    });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
