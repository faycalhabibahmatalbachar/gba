import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';

export const dynamic = 'force-dynamic';

async function checkHead(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(to);
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: String((e as Error).message) };
  }
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const targets = [
    { name: 'supabase_rest', url: supabaseUrl ? `${supabaseUrl}/rest/v1/` : '' },
    { name: 'supabase_auth', url: supabaseUrl ? `${supabaseUrl}/auth/v1/health` : '' },
    { name: 'resend_api', url: 'https://api.resend.com' },
    { name: 'brevo_smtp_doc', url: 'https://smtp-relay.brevo.com' },
  ].filter((t) => t.url);

  const data: Record<string, unknown> = {
    env: {
      has_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      has_supabase_service_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_resend_key: Boolean(process.env.RESEND_API_KEY),
      has_smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
      enable_outbound_email: String(process.env.ENABLE_OUTBOUND_EMAIL || '')
        .trim()
        .toLowerCase() === 'true',
    },
    checks: [] as Record<string, unknown>[],
  };

  for (const t of targets) {
    const result = await checkHead(t.url, 5000);
    (data.checks as Record<string, unknown>[]).push({ target: t.name, url: t.url, ...result });
  }
  return NextResponse.json({ data });
}
