/**
 * Audit Logs Page
 * 
 * Complete audit trail viewer with statistics and analytics
 */

'use client';

import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { AuditHourlyChart } from '@/components/audit/AuditHourlyChart';
import { PageHeader } from '@/components/ui/custom/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditStatistics } from '@/lib/hooks/useAuditLog';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Activity, Users, AlertTriangle } from 'lucide-react';

export default function AuditPage() {
  const { statistics, isLoading } = useAuditStatistics();

  // Calculate summary stats
  const totalEvents = statistics.reduce((sum, stat) => sum + stat.event_count, 0);
  const uniqueUsers = new Set(statistics.map(s => s.user_role)).size;
  const failedEvents = statistics.reduce((sum, stat) => sum + stat.failed_count, 0);
  const successRate = totalEvents > 0 ? ((totalEvents - failedEvents) / totalEvents * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <PageHeader title="Journal d'Audit" subtitle="Traçabilité complète de toutes les actions administratives" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Événements</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{totalEvents.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">90 derniers jours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Actifs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{uniqueUsers}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Rôles distincts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de Succès</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{successRate}%</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Actions réussies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Échecs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{failedEvents}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Actions échouées</p>
          </CardContent>
        </Card>
      </div>

      <AuditHourlyChart hours={24} />

      <AuditLogViewer />
    </div>
  );
}
