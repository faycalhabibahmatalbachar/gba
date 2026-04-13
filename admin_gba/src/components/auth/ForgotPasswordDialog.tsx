'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'Une erreur est survenue';
  }
}

type ForgotPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Préremplissage depuis le champ email de la page connexion */
  initialEmail?: string;
};

export function ForgotPasswordDialog({ open, onOpenChange, initialEmail = '' }: ForgotPasswordDialogProps) {
  const [email, setEmail] = React.useState(initialEmail);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) setEmail(initialEmail);
  }, [open, initialEmail]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error('Saisissez une adresse e-mail.');
      return;
    }
    setLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = `${origin}/auth/confirm?next=/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (error) throw error;
      toast.success(
        'Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé.',
      );
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mot de passe oublié</DialogTitle>
            <DialogDescription>
              Indiquez l’e-mail du compte administrateur. Vous recevrez un lien pour définir un nouveau mot de
              passe. L’URL de retour doit être autorisée dans Supabase (Authentication → URL Configuration).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Adresse e-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemple.com"
                disabled={loading}
                className="min-h-11"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading} className="min-h-11 min-w-[9rem] transition-colors duration-150">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi…
                </>
              ) : (
                'Envoyer le lien'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
