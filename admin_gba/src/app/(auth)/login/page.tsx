'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';

function GateMessage() {
  const sp = useSearchParams();
  const code = sp.get('error');
  const reason = sp.get('reason');
  if (!code && !reason) return null;
  return (
    <div className="mb-4 space-y-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-3 text-xs text-destructive">
      <p className="font-medium">{reason || `Accès refusé (${code})`}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-destructive/40"
        onClick={() => void supabase.auth.signOut().then(() => window.location.replace('/login'))}
      >
        Déconnecter cette session
      </Button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    } catch (err: any) {
      void fetch('/api/security/login-attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          success: false,
          reason: String(err?.message || 'invalid_credentials'),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      });
      toast.error(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <span className="text-2xl font-black text-primary-foreground">G</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">GBA Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Connectez-vous pour accéder au panneau</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <Suspense fallback={null}>
            <GateMessage />
          </Suspense>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@gba.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connexion...</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-2" />Se connecter</>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Accès réservé aux administrateurs GBA
        </p>
      </div>
    </div>
  );
}
