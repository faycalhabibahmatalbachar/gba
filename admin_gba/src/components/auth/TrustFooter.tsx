import { Lock, ScrollText } from 'lucide-react';

export function TrustFooter() {
  return (
    <div className="mt-8 space-y-3 text-center">
      <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span>Connexion sécurisée</span>
      </p>
      <p className="text-xs text-muted-foreground">Accès réservé aux comptes autorisés</p>
      <p className="inline-flex items-center justify-center gap-2 text-[11px] text-muted-foreground/90">
        <ScrollText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span>Activité journalisée</span>
      </p>
    </div>
  );
}
