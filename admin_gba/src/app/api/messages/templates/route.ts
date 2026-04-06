import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getServiceSupabase } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const KEY = 'message_templates';

const DEFAULT_TEMPLATES = [
  {
    id: 'default-1',
    name: 'Commande confirmée',
    category: 'transactionnel',
    body: 'Bonjour {{prenom}}, votre commande #{{commande_id}} a été confirmée. Merci !',
  },
  {
    id: 'default-2',
    name: 'Livraison en cours',
    category: 'transactionnel',
    body: 'Votre commande est en route ! Suivez votre livraison : {{lien_suivi}}',
  },
  {
    id: 'default-3',
    name: 'Promo flash',
    category: 'promotionnel',
    body: '🔥 Offre exclusive : {{montant}} de réduction sur {{produit}} !',
  },
] as const;

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  body: z.string().max(5000),
  shortcut: z.string().max(40).optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let sb: ReturnType<typeof getServiceSupabase>;
  try {
    sb = getServiceSupabase();
  } catch {
    return NextResponse.json({ error: 'Service role manquant' }, { status: 503 });
  }

  try {
    const { data, error } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
    if (error) throw error;
    const arr = (data?.value as unknown[] | undefined) || [];
    const list = Array.isArray(arr) && arr.length > 0 ? arr : [...DEFAULT_TEMPLATES];
    return NextResponse.json({ templates: list });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const parsed = templateSchema.safeParse(body);
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
    const { data: cur } = await sb.from('settings').select('value').eq('key', KEY).maybeSingle();
    const raw = cur?.value;
    const list = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
    const id = parsed.data.id || crypto.randomUUID();
    const entry = {
      id,
      name: parsed.data.name,
      body: parsed.data.body,
      shortcut: parsed.data.shortcut ?? null,
    };
    const next = [...list.filter((t) => t.id !== id), entry];
    const { error } = await sb.from('settings').upsert({ key: KEY, value: next }, { onConflict: 'key' });
    if (error) throw error;
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
