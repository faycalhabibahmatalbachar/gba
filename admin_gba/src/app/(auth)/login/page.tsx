'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { GateMessage } from '@/components/auth/GateMessage';
import { PasswordField } from '@/components/auth/PasswordField';
import { TrustFooter } from '@/components/auth/TrustFooter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatAuthError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Identifiants incorrects';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  function validate(): boolean {
    let ok = true;
    const em = email.trim();
    if (!em) {
      setEmailError('Saisissez votre adresse e-mail professionnelle.');
      ok = false;
    } else if (!EMAIL_RE.test(em)) {
      setEmailError('Format d’e-mail invalide.');
      ok = false;
    } else {
      setEmailError(null);
    }
    if (!password) {
      setPasswordError('Saisissez votre mot de passe.');
      ok = false;
    } else {
      setPasswordError(null);
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      const allowedRes = await fetch('/api/me/connection-allowed', { credentials: 'include' });
      const allowedJson = (await allowedRes.json()) as { allowed?: boolean; error?: string };
      if (!allowedRes.ok || allowedJson.allowed === false) {
        await supabase.auth.signOut();
        toast.error(
          typeof allowedJson.error === 'string'
            ? allowedJson.error
            : 'Accès non autorisé en dehors des horaires définis',
        );
        return;
      }
      void fetch('/api/security/login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          success: true,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      void fetch('/api/security/login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          success: false,
          reason: String(err instanceof Error ? err.message : 'invalid_credentials'),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      });
      toast.error(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col">
        <div className="mb-8 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground shadow-md shadow-primary/20">
              G
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-muted-foreground">GBA</p>
              <p className="text-xs text-muted-foreground">Back-office</p>
            </div>
          </div>
        </div>

        <div className="mb-8 hidden lg:block" aria-hidden />

        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          Connexion administrateur
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Gestion des commandes, catalogue et opérations.
        </p>

        <AuthCard className="mt-8">
          <Suspense fallback={null}>
            <GateMessage />
          </Suspense>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse e-mail professionnelle</Label>
              <Input
                id="email"
                type="email"
                placeholder="prenom.nom@entreprise.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                autoComplete="email"
                disabled={loading}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? 'email-error' : undefined}
                className={cn(
                  'h-11 min-h-11 transition-colors duration-150',
                  emailError && 'border-destructive',
                )}
              />
              {emailError ? (
                <p id="email-error" className="text-xs text-destructive" role="alert">
                  {emailError}
                </p>
              ) : null}
            </div>

            <PasswordField
              id="password"
              label="Mot de passe"
              value={password}
              onChange={(v) => {
                setPassword(v);
                if (passwordError) setPasswordError(null);
              }}
              error={passwordError}
              errorId="password-error"
              disabled={loading}
            />

            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline"
                onClick={() => setForgotOpen(true)}
                disabled={loading}
              >
                Mot de passe oublié ?
              </button>
            </div>

            <Button
              type="submit"
              className="h-11 min-h-11 w-full transition-colors duration-150"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Connexion…
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />
                  Se connecter
                </>
              )}
            </Button>
          </form>
        </AuthCard>

        <TrustFooter />
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} initialEmail={email} />
    </AuthShell>
  );
}
