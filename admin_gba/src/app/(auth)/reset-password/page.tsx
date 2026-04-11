'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
type Phase = 'loading' | 'ready' | 'done' | 'error';

export default function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        setPhase('ready');
        setHint(null);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setPhase('ready');
        return;
      }
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
        setHint(
          'Si le formulaire ne s’affiche pas, ouvrez ce lien dans le même navigateur ou relancez la demande depuis l’application.',
        );
        setPhase('loading');
        return;
      }
      setPhase('error');
      setHint(
        'Lien invalide ou expiré. Demandez un nouveau lien depuis la page de connexion (Mot de passe oublié).',
      );
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setHint('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setHint('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setHint(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPhase('done');
      await supabase.auth.signOut();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mise à jour impossible';
      setHint(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col">
        <div className="mb-6 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-base font-black text-primary-foreground shadow-md shadow-primary/20">
              G
            </div>
            <div>
              <p className="font-heading text-sm font-semibold text-muted-foreground">GBA</p>
              <p className="text-xs text-muted-foreground">Réinitialisation</p>
            </div>
          </div>
        </div>

        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          Nouveau mot de passe
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Définissez un mot de passe fort pour votre compte administrateur GBA.
        </p>

        <AuthCard className="mt-8">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">Vérification du lien sécurisé…</p>
              {hint ? <p className="text-xs text-amber-800 dark:text-amber-200">{hint}</p> : null}
            </div>
          )}

          {phase === 'error' && (
            <div className="space-y-4 py-2">
              <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{hint}</span>
              </div>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex h-11 min-h-11 w-full items-center justify-center')}
              >
                Retour à la connexion
              </Link>
            </div>
          )}

          {phase === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Choisissez un mot de passe d’au moins 8 caractères. Vous pourrez ensuite ouvrir une session dans
                l’administration GBA.
              </p>
              {hint && !submitting ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                  {hint}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="np">Nouveau mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="np"
                    type="password"
                    autoComplete="new-password"
                    className="h-11 min-h-11 pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="npc">Confirmer le mot de passe</Label>
                <Input
                  id="npc"
                  type="password"
                  autoComplete="new-password"
                  className="h-11 min-h-11"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={submitting} className="h-11 min-h-11 w-full transition-colors duration-150">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Enregistrer le mot de passe'}
              </Button>
            </form>
          )}

          {phase === 'done' && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <p className="font-medium text-foreground">Mot de passe mis à jour</p>
              <p className="text-sm text-muted-foreground">
                Vous pouvez fermer cette page et retourner à la connexion administrateur pour vous identifier.
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex h-11 min-h-11 w-full items-center justify-center')}
              >
                Connexion administrateur
              </Link>
            </div>
          )}
        </AuthCard>
      </div>
    </AuthShell>
  );
}
