'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

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
        'Lien invalide ou expiré. Demandez un nouveau lien depuis l’application (Mot de passe oublié).',
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-500 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            G
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">GBA</h1>
            <p className="text-xs text-zinc-500">Nouveau mot de passe</p>
          </div>
        </div>

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
            <p className="text-sm text-zinc-600">Vérification du lien sécurisé…</p>
            {hint ? <p className="text-xs text-amber-700">{hint}</p> : null}
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 py-4">
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{hint}</span>
            </div>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              Retour connexion admin
            </Link>
          </div>
        )}

        {phase === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-zinc-600">
              Choisissez un mot de passe fort (8 caractères minimum). Vous pourrez vous connecter
              ensuite dans l’application GBA.
            </p>
            {hint && !submitting ? (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {hint}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="np">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="np"
                  type="password"
                  autoComplete="new-password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="npc">Confirmer</Label>
              <Input
                id="npc"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer le mot de passe'}
            </Button>
          </form>
        )}

        {phase === 'done' && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <p className="font-medium text-zinc-900">Mot de passe mis à jour</p>
            <p className="text-sm text-zinc-600">
              Vous pouvez fermer cette page et ouvrir l’application GBA pour vous connecter.
            </p>
            <Link
              href="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              Connexion admin (si besoin)
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
