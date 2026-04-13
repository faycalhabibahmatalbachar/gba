import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthShell } from '@/components/auth/AuthShell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  searchParams: Promise<{ message?: string }>;
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const message = params.message || 'Une erreur est survenue pendant la vérification du lien.';

  return (
    <AuthShell>
      <div className="flex flex-col">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          Erreur de vérification
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Le lien est invalide, expiré ou incomplet. Demandez un nouveau lien de réinitialisation.
        </p>

        <AuthCard className="mt-8">
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{message}</span>
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 inline-flex h-11 min-h-11 w-full items-center justify-center')}
          >
            Retour à la connexion
          </Link>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
