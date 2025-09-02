import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useSnackbar } from 'notistack';

// Mode développement pour contourner les problèmes Supabase temporairement
const DEV_MODE = true;
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
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

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
        let { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // Si l'utilisateur n'existe pas, le créer automatiquement
        if (error && error.message.includes('Invalid login credentials')) {
          console.log('Utilisateur non trouvé, création automatique...');
          const signUpResult = await signUp(email, password);
          
          if (signUpResult.error) {
            throw signUpResult.error;
          }
          
          // Réessayer la connexion après création
          const signInResult = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          data = signInResult.data;
          error = signInResult.error;
        }

        if (error) throw error;

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
