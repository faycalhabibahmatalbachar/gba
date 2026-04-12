/**
 * Audit Logs Page
 *
 * Traçabilité admin : KPIs, graphiques, journal virtualisé.
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Gauge, Layers, Shield, Users } from 'lucide-react';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { AuditChartsSection } from '@/components/audit/AuditChartsSection';
import { AuditPageHeader } from '@/components/audit/AuditPageHeader';
import { AuditAdvancedSection } from '@/components/audit/AuditAdvancedSection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditPageKpis } from '@/lib/hooks/useAuditLog';
import { Skeleton } from '@/components/ui/skeleton';

function AuditLogSection() {
  const sp = useSearchParams();
  const initialEntityType = sp.get('entity_type')?.trim() || undefined;
  const initialEntityId = sp.get('entity_id')?.trim() || undefined;
  return <AuditLogViewer initialEntityType={initialEntityType} initialEntityId={initialEntityId} />;
}

export default function AuditPage() {
  const { data, isLoading, error } = useAuditPageKpis();
  const kpis = data?.kpis;
  const lat = data?.latency_ms;

  const deltaStr =
    kpis?.delta_total_pct == null ? '—' : `${kpis.delta_total_pct > 0 ? '+' : ''}${kpis.delta_total_pct}%`;

  return (
    <div className="space-y-6">
      <AuditPageHeader
        subtitle="Traçabilité complète des actions administratives, enrichie par les profils et les métadonnées."
        totalLabel={
          kpis ? `${kpis.total_events.toLocaleString('fr-FR')} événements` : isLoading ? '…' : '—'
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total événements</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : error ? (
              <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Erreur'}</p>
            ) : (
              <div className="text-2xl font-bold">{kpis?.total_events.toLocaleString('fr-FR') ?? '—'}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              vs période précédente : {deltaStr} (N-1 : {kpis?.prev_total_events?.toLocaleString('fr-FR') ?? '—'})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acteurs distincts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{kpis?.distinct_actors ?? '—'}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Utilisateurs (user_id non nuls), période KPI</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de succès</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{kpis ? `${kpis.success_rate_pct}%` : '—'}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Sur la fenêtre sélectionnée côté API</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {kpis?.failed_count ?? '—'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">status = failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rôles (valeurs distinctes)</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{kpis?.distinct_role_values ?? '—'}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Voir aussi l’onglet graphiques « Rôles »</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latence (metadata)</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {lat?.p95 != null ? `${lat.p95} ms` : lat?.avg != null ? `${lat.avg} ms` : '—'}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              p95 / moyenne sur metadata.duration_ms (échantillon {lat?.sample_size ?? 0})
            </p>
          </CardContent>
        </Card>
      </div>

      <AuditChartsSection />

      <AuditAdvancedSection />

      <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement du journal…</div>}>
        <AuditLogSection />
      </Suspense>
    </div>
  );
}
