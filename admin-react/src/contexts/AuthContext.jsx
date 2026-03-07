import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useSnackbar } from 'notistack';

// Mode développement pour contourner les problèmes Supabase temporairement
const DEV_MODE = (import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === 'true');
const DEV_USERS = [
  { email: 'faycalhabibahmat@gmail.com', password: 'faycalhabibahmat@gmail.com', name: 'Faycal Admin' },
  { email: 'admin@test.com', password: 'admin123', name: 'Test Admin' }
];

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (DEV_MODE) {
      // Mode développement - vérifier le localStorage pour la session
      const savedUser = localStorage.getItem('dev-user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setSession({ user: userData });
      }
      setLoading(false);
    } else {
      // Mode production - utiliser Supabase
      // Handle PKCE code exchange (e.g. from reset password email link)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      const initSession = async () => {
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code);
            console.log('[Auth] PKCE code exchanged successfully');
          } catch (e) {
            console.warn('[Auth] PKCE code exchange failed:', e.message);
          }
        }
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      };
      initSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const signUp = async (email, password) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'admin'
          }
        }
      });

      if (error) throw error;

      enqueueSnackbar('Account created successfully!', { variant: 'success' });
      return { data, error: null };
    } catch (error) {
      console.error('SignUp error:', error);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      
      if (DEV_MODE) {
        // Mode développement - vérifier les utilisateurs de test
        const devUser = DEV_USERS.find(u => u.email === email && u.password === password);
        if (devUser) {
          const mockUser = {
            id: 'dev-user-' + Date.now(),
            email: devUser.email,
            user_metadata: { name: devUser.name }
          };
          setUser(mockUser);
          setSession({ user: mockUser });
          localStorage.setItem('dev-user', JSON.stringify(mockUser));
          enqueueSnackbar(`Bienvenue ${devUser.name}!`, { variant: 'success' });
          navigate('/dashboard');
          return { data: { user: mockUser }, error: null };
        } else {
          throw new Error('Identifiants invalides. Utilisez: faycalhabibahmat@gmail.com');
        }
      } else {
        // Mode production - utiliser Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // Stamp role:admin dans user_metadata pour que is_admin() RLS retourne true
        try {
          await supabase.auth.updateUser({ data: { role: 'admin' } });
          console.info('[Auth] user_metadata.role → admin OK');
        } catch (e) { console.warn('[Auth] updateUser meta failed:', e.message); }

        // Synchronise profiles.role = 'admin' en base
        try {
          await supabase.rpc('ensure_admin_profile');
          console.info('[Auth] ensure_admin_profile() → OK');
        } catch (e) { console.warn('[Auth] ensure_admin_profile failed:', e.message); }

        // Garde-fou: refuser l'accès si l'utilisateur n'est pas admin
        try {
          const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
          if (userErr) throw userErr;
          const role = freshUser?.user_metadata?.role;
          if (role !== 'admin') {
            await supabase.auth.signOut();
            throw new Error('Accès refusé: compte non admin');
          }
        } catch (e) {
          throw e;
        }

        enqueueSnackbar('Connexion réussie!', { variant: 'success' });
        navigate('/dashboard');
        return { data, error: null };
      }
    } catch (error) {
      console.error('SignIn error:', error);
      enqueueSnackbar(`Erreur de connexion: ${error.message}`, { variant: 'error' });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      if (DEV_MODE) {
        // Mode développement - nettoyer le localStorage
        localStorage.removeItem('dev-user');
        setUser(null);
        setSession(null);
        enqueueSnackbar('Déconnexion réussie!', { variant: 'info' });
        navigate('/login');
      } else {
        // Mode production - utiliser Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        enqueueSnackbar('Déconnexion réussie!', { variant: 'info' });
        navigate('/login');
      }
    } catch (error) {
      enqueueSnackbar(error.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
