import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  // Handle PKCE code exchange on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      setExchanging(true);
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error: err }) => {
          if (err) {
            console.error('[ResetPassword] code exchange error:', err);
            setError(`Lien expiré ou invalide. Veuillez demander un nouveau lien de réinitialisation.`);
          } else {
            console.log('[ResetPassword] session established');
            setSessionReady(true);
            // Clean the URL
            window.history.replaceState({}, '', '/reset-password');
          }
        })
        .catch((e) => {
          console.error('[ResetPassword] unexpected error:', e);
          setError('Une erreur inattendue est survenue.');
        })
        .finally(() => setExchanging(false));
    } else {
      // No code — check if already authenticated (e.g. hash fragment flow)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          setError('Lien invalide. Veuillez demander un nouveau lien de réinitialisation.');
        }
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
      });
      if (updateErr) throw updateErr;
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900 p-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg"
            >
              <Lock className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900">Nouveau mot de passe</h1>
            <p className="text-sm text-gray-500 mt-1">Choisissez un nouveau mot de passe sécurisé</p>
          </div>

          {/* Exchanging code spinner */}
          {exchanging && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="text-sm text-gray-500">Vérification du lien...</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Mot de passe modifié !</h2>
              <p className="text-sm text-gray-500">Redirection vers la connexion...</p>
            </motion.div>
          )}

          {/* Error message */}
          {error && !success && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-700">{error}</p>
                {!sessionReady && (
                  <button
                    onClick={() => navigate('/login')}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium mt-2 underline"
                  >
                    Retour à la connexion
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          {sessionReady && !exchanging && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le mot de passe"
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Mettre à jour le mot de passe'
                )}
              </button>
            </form>
          )}

          {/* Back to login link */}
          {!success && !exchanging && (
            <div className="text-center mt-6">
              <button
                onClick={() => navigate('/login')}
                className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default ResetPassword;
