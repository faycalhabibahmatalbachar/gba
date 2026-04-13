import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//')) return '/dashboard';
  return raw;
}

function redirectWithError(requestUrl: string, message: string) {
  const u = new URL('/auth/error', requestUrl);
  u.searchParams.set('message', message);
  return NextResponse.redirect(u);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeNextPath(url.searchParams.get('next'));
  const code = url.searchParams.get('code');

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });

    if (error) {
      return redirectWithError(request.url, error.message || 'Lien de confirmation invalide ou expiré.');
    }

    const destination =
      type === 'recovery' ? '/auth/update-password' : type === 'signup' ? '/dashboard' : safeNextPath(next);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectWithError(request.url, error.message || 'Code de confirmation invalide.');
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return redirectWithError(request.url, 'Lien de confirmation incomplet.');
}
