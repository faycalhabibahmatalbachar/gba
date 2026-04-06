import { Suspense } from 'react';
import { NotificationsHubPage } from './_components/NotificationsHubPage';

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement…</div>}>
      <NotificationsHubPage />
    </Suspense>
  );
}
