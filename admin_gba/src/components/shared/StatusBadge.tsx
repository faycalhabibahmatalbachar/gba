import { cn } from '@/lib/utils';

type Variant = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

const STATUS_MAP: Record<string, { label: string; variant: Variant }> = {
  active: { label: 'Actif', variant: 'success' },
  published: { label: 'Publié', variant: 'success' },
  online: { label: 'En ligne', variant: 'success' },
  delivered: { label: 'Livrée', variant: 'success' },
  completed: { label: 'Terminé', variant: 'success' },
  in_stock: { label: 'En stock', variant: 'success' },
  confirmed: { label: 'Confirmé', variant: 'info' },
  processing: { label: 'En cours', variant: 'info' },
  pending: { label: 'En attente', variant: 'warning' },
  draft: { label: 'Brouillon', variant: 'neutral' },
  offline: { label: 'Hors ligne', variant: 'neutral' },
  inactive: { label: 'Inactif', variant: 'neutral' },
  suspended: { label: 'Suspendu', variant: 'danger' },
  archived: { label: 'Archivé', variant: 'neutral' },
  cancelled: { label: 'Annulé', variant: 'danger' },
  failed: { label: 'Échec', variant: 'danger' },
  out_of_stock: { label: 'Rupture', variant: 'danger' },
  low_stock: { label: 'Stock bas', variant: 'warning' },
  shipped: { label: 'Expédié', variant: 'info' },
};

const VARIANT_STYLES: Record<Variant, { fg: string; bg: string }> = {
  success: { fg: 'var(--success)', bg: 'color-mix(in srgb, var(--success) 14%, transparent)' },
  danger: { fg: 'var(--danger)', bg: 'color-mix(in srgb, var(--danger) 14%, transparent)' },
  warning: { fg: 'var(--warning)', bg: 'color-mix(in srgb, var(--warning) 16%, transparent)' },
  neutral: { fg: '#71717a', bg: 'rgba(113,113,122,0.12)' },
  info: { fg: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

export interface StatusBadgeProps {
  status: string;
  customLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, customLabel, size = 'md', className }: StatusBadgeProps) {
  const key = String(status || '').toLowerCase();
  const mapped = STATUS_MAP[key] ?? { label: customLabel || status || '—', variant: 'neutral' as Variant };
  const styles = VARIANT_STYLES[mapped.variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      style={{ background: styles.bg, color: styles.fg }}
    >
      <span className="rounded-full shrink-0 size-1.5" style={{ background: styles.fg }} />
      {customLabel || mapped.label}
    </span>
  );
}
