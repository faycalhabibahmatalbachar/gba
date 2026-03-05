'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

function toast(type: 'success' | 'error' | 'info', content: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('gba-toast', { detail: { type, content } }));
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ── Heartbeat interval (ms) ──────────────────────────────────────────
const HEARTBEAT_INTERVAL = 3 * 60 * 1000; // every 3 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Presence update ──────────────────────────────────────────────
  const updatePresence = useCallback(async (userId: string, online: boolean) => {
    try {
      await supabase.from('profiles').update({
        last_seen_at: new Date().toISOString(),
        is_online: online,
      }).eq('id', userId);
    } catch {
      // Silently ignore — columns may not exist yet on older deployments
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Heartbeat: update presence while logged in ───────────────────
  useEffect(() => {
    if (!user?.id) return;

    // Immediate ping on mount
    void updatePresence(user.id, true);

    // Periodic heartbeat
    const interval = setInterval(() => {
      void updatePresence(user.id, true);
    }, HEARTBEAT_INTERVAL);

    // Mark offline on unmount / sign-out
    return () => {
      clearInterval(interval);
      void updatePresence(user.id, false);
    };
  }, [user?.id, updatePresence]);

  // ── Update presence on navigation ────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    void updatePresence(user.id, true);
  }, [pathname, user?.id, updatePresence]);

  useEffect(() => {
    if (loading) return;
    const isLogin = pathname === '/login';
    if (!user && !isLogin) router.replace('/login');
    if (user && isLogin) router.replace('/dashboard');
  }, [loading, user, pathname, router]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast('success', 'Connexion réussie');
      router.replace('/dashboard');
    } catch (e: any) {
      toast('error', e?.message || 'Erreur de connexion');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast('info', 'Déconnecté');
      router.replace('/login');
    } catch (e: any) {
      toast('error', e?.message || 'Erreur');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({ user, session, loading, signIn, signOut }), [user, session, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
