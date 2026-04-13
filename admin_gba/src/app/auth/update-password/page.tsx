'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShell } from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Strength = { level: 1 | 2 | 3 | 4; label: 'Trop court' | 'Faible' | 'Bon' | 'Fort' };

function getStrength(password: string): Strength {
  if (password.length < 8) return { level: 1, label: 'Trop court' };
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (hasUpper && hasDigit && hasSpecial) return { level: 4, label: 'Fort' };
  if (hasUpper && hasDigit) return { level: 3, label: 'Bon' };
  return { level: 2, label: 'Faible' };
}

function segmentClass(index: number, level: number): string {
  if (index > level) return 'bg-border';
  if (level === 1) return 'bg-red-500';
  if (level === 2) return 'bg-amber-500';
  if (level === 3) return 'bg-blue-500';
  return 'bg-emerald-500';
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loadingSession, setLoadingSession] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const strength = useMemo(() => getStrength(password), [password]);
  const passwordsMatch = confirm.length === 0 || password === confirm;
  const canSubmit = password.length >= 8 && password === confirm && !saving;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        window.location.href = '/auth/error?message=Session+de+r%C3%A9initialisation+introuvable';
        return;
      }
      const uid = data.session.user.id;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
      setRole(String(profile?.role || '').toLowerCase() || null);
      setLoadingSession(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwdErr = password.length < 8 ? 'Le mot de passe doit contenir au moins 8 caractères' : null;
    const cfmErr = password !== confirm ? 'Les mots de passe ne correspondent pas' : null;
    setPasswordError(pwdErr);
    setConfirmError(cfmErr);
    if (pwdErr || cfmErr) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Mot de passe modifié avec succès');
      setDone(true);

      setTimeout(() => {
        if (role === 'admin' || role === 'superadmin' || role === 'super_admin') {
          window.location.href = '/dashboard';
          return;
        }
        window.location.href = '/login';
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur pendant la mise à jour du mot de passe';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col">
        <div className="mb-8 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground">G</div>
            <p className="font-heading text-sm font-semibold text-muted-foreground">GBA</p>
          </div>
        </div>

        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          Définir un nouveau mot de passe
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez un mot de passe sécurisé pour votre compte.
        </p>

        <AuthCard className="mt-8">
          {loadingSession ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vérification de la session…
            </div>
          ) : done && role !== 'admin' && role !== 'superadmin' && role !== 'super_admin' ? (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Mot de passe mis à jour. Ce compte est destiné à l’application mobile.</p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex h-11 min-h-11 w-full items-center justify-center')}
              >
                Retour à la connexion web admin
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <PasswordField
                id="new-password"
                label="Nouveau mot de passe"
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  if (passwordError) setPasswordError(null);
                }}
                error={passwordError}
                errorId="new-password-error"
                autoComplete="new-password"
                disabled={saving}
              />

              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className={cn('h-1.5 rounded-full transition-colors', segmentClass(n, strength.level))} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>

              <PasswordField
                id="confirm-password"
                label="Confirmer le mot de passe"
                value={confirm}
                onChange={(v) => {
                  setConfirm(v);
                  if (confirmError) setConfirmError(null);
                }}
                error={!passwordsMatch ? 'Les mots de passe ne correspondent pas' : confirmError}
                errorId="confirm-password-error"
                autoComplete="new-password"
                disabled={saving}
              />

              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-11 min-h-11 w-full bg-[var(--brand)] text-white hover:bg-[var(--brand)]/90"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  'Enregistrer le nouveau mot de passe'
                )}
              </Button>
            </form>
          )}
        </AuthCard>
      </div>
    </AuthShell>
  );
}
