import { cn } from '@/lib/utils';

type StatusConfig = {
  label: string;
  color: string;
  bg: string;
};

const ORDER_STATUS: Record<string, StatusConfig> = {
  pending:    { label: 'En attente',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  confirmed:  { label: 'Confirmée',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  processing: { label: 'En cours',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  shipped:    { label: 'Expédiée',   color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
  delivered:  { label: 'Livrée',    color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  cancelled:  { label: 'Annulée',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  active:     { label: 'Actif',     color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  inactive:   { label: 'Inactif',   color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  online:     { label: 'En ligne',  color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  offline:    { label: 'Hors ligne',color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  suspended:  { label: 'Suspendu', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  open:       { label: 'Ouvert',   color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  closed:     { label: 'Fermé',    color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  resolved:   { label: 'Résolu',   color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, customLabel, size = 'md', className }: StatusBadgeProps) {
  const key = String(status || '').toLowerCase();
  const config = ORDER_STATUS[key] ?? {
    label: customLabel || status,
    color: '#6B7280',
    bg: 'rgba(107,114,128,0.12)',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{ background: config.bg, color: config.color }}
    >
      <span
        className="rounded-full shrink-0"
        style={{ width: 5, height: 5, background: config.color }}
      />
      {customLabel || config.label}
    </span>
  );
}
