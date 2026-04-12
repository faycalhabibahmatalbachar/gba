'use client';

import * as React from 'react';
import { AlertTriangle, Ban, CheckCircle, Send } from 'lucide-react';
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
  hasSmtp: boolean;
  enableOutboundEmail: boolean;
  resendReachable: boolean | null;
  onSendTest: () => void;
  sendTestPending: boolean;
};

/**
 * Indisponible : service email non configuré (health).
 * Envoi bloqué : clés présentes mais ENABLE_OUTBOUND_EMAIL≠true.
 * Dégradé : health OK + clé Resend + test réseau Resend en échec.
 * Opérationnel : sinon.
 */
export function EmailLogsChannelStatus({
  emailSvc,
  hasResendKey,
  hasSmtp,
  enableOutboundEmail,
  resendReachable,
  onSendTest,
  sendTestPending,
}: Props) {
  const unavailable = emailSvc?.status === 'error';
  const mailConfigured = hasResendKey || hasSmtp;
  const outboundBlocked = !unavailable && mailConfigured && !enableOutboundEmail;
  const degraded =
    !unavailable && !outboundBlocked && hasResendKey && resendReachable === false;

  if (unavailable) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3 shadow-sm">
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

  if (outboundBlocked) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
        <Ban className="h-5 w-5 text-amber-700 dark:text-amber-500 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Envoi réel désactivé sur le serveur</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Les clés sont présentes (fournisseur : <strong className="text-foreground">{providerLabel(emailSvc?.provider)}</strong>
            ), mais <code className="text-[11px] bg-background/70 px-1 rounded">ENABLE_OUTBOUND_EMAIL</code> n’est pas à{' '}
            <code className="text-[11px] bg-background/70 px-1 rounded">true</code>. Définissez-la sur Vercel (ou votre hôte),
            puis redéployez.
          </p>
        </div>
        <Button size="sm" variant="secondary" className="gap-1.5 shrink-0" disabled title="Activez ENABLE_OUTBOUND_EMAIL sur le serveur">
          <Send className="h-3.5 w-3.5" />
          Test email
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors shadow-sm',
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
