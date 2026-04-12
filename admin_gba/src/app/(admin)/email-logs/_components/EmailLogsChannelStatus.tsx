'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmailHealth = { service: string; status: 'ok' | 'error'; provider: string; error?: string } | undefined;

function providerLabel(p?: string | null): string {
  const k = String(p || '').toLowerCase();
  if (k === 'resend') return 'Resend';
  if (k === 'smtp') return 'SMTP';
  if (k === 'mock') return 'Simulé';
  if (k === 'none') return '—';
  return p || '—';
}

type Props = {
  emailSvc: EmailHealth;
  hasResendKey: boolean;
  resendReachable: boolean | null;
  onSendTest: () => void;
  sendTestPending: boolean;
};

/**
 * Indisponible : service email non configuré (health).
 * Dégradé : health OK + clé Resend présente mais test réseau api.resend.com en échec (réseau / pare-feu).
 * Opérationnel : sinon.
 */
export function EmailLogsChannelStatus({
  emailSvc,
  hasResendKey,
  resendReachable,
  onSendTest,
  sendTestPending,
}: Props) {
  const unavailable = emailSvc?.status === 'error';
  const degraded = !unavailable && hasResendKey && resendReachable === false;

  if (unavailable) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
        <AlertTriangle className="text-destructive h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-destructive text-sm">Canal email indisponible</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Définissez <code className="text-xs bg-background/80 px-1 rounded">RESEND_API_KEY</code> ou les variables{' '}
            <code className="text-xs bg-background/80 px-1 rounded">SMTP_*</code> dans l’environnement serveur, puis redémarrez.
          </p>
          {emailSvc?.error ? (
            <p className="text-xs font-mono text-destructive/90 break-all">{emailSvc.error}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors',
        degraded ? 'border-amber-500/35 bg-amber-500/8' : 'border-emerald-500/25 bg-emerald-500/8',
      )}
    >
      {degraded ? (
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
      ) : (
        <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium">
          {degraded ? 'Canal opérationnel (réseau Resend à vérifier)' : 'Canal opérationnel'}
        </p>
        <p className="text-xs text-muted-foreground">
          Fournisseur actif : <strong className="text-foreground">{providerLabel(emailSvc?.provider)}</strong>
          {degraded ? (
            <span className="block mt-1">
              Le test HEAD vers l’API Resend a échoué (pare-feu, DNS ou coupure). Les envois peuvent quand même passer si la
              clé est valide côté serveur.
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:ml-auto shrink-0">
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={onSendTest} disabled={sendTestPending}>
          <Send className="h-3.5 w-3.5" />
          {sendTestPending ? 'Envoi…' : 'Test email'}
        </Button>
      </div>
    </div>
  );
}
