import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabaseService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session au démarrage
    checkSession();

    // Écouter les changements d'authentification
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        setSession(session);
        
        if (session?.user) {
          // Récupérer le profil utilisateur
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          const userData = {
            ...session.user,
            ...profile
          };
          
          setUser(userData);
          await AsyncStorage.setItem('@user', JSON.stringify(userData));
        } else {
          setUser(null);
          await AsyncStorage.removeItem('@user');
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        const userData = {
          ...session.user,
          ...profile
        };
        
        setUser(userData);
        setSession(session);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData) => {
    setUser(userData);
    await AsyncStorage.setItem('@user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.clear();
      Toast.show({
        type: 'success',
        text1: 'Déconnexion réussie',
        text2: 'À bientôt!'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: error.message
      });
    }
  };

  const updateUser = async (userData) => {
    setUser(userData);
    await AsyncStorage.setItem('@user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        login,
        logout,
        updateUser,
        loading,
        isAuthenticated: !!user,
        refreshSession: checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
