import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <p className="text-sm text-muted-foreground">Page introuvable. Le lien est peut-être invalide ou la ressource a été déplacée.</p>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Retour au dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
