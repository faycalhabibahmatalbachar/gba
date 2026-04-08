import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/_lib/require-admin';
import { getMailer } from '@/lib/email/mailer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const mailer = getMailer();
    return NextResponse.json({
      services: [{ service: 'email', status: 'ok', provider: mailer.provider }],
    });
  } catch (e) {
    return NextResponse.json({
      services: [{ service: 'email', status: 'error', provider: 'none', error: String((e as Error).message) }],
    });
  }
}
