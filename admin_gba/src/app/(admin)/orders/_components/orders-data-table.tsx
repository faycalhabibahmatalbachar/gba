'use client';

import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/custom/EmptyState';
import { ShoppingBag, Eye, Truck } from 'lucide-react';
import type { OrderRow } from '@/lib/services/orders';

const columnHelper = createColumnHelper<OrderRow>();

const ACTION_STATUSES = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmée' },
  { value: 'processing', label: 'En cours' },
  { value: 'shipped', label: 'Expédiée' },
  { value: 'delivered', label: 'Livrée' },
  { value: 'cancelled', label: 'Annulée' },
];

function isSpecialOrder(order: Pick<OrderRow, 'order_number' | 'notes' | 'is_special_mobile'>): boolean {
  if (order.is_special_mobile) return true;
  const n = String(order.notes || '').toLowerCase();
  const num = String(order.order_number || '').toLowerCase();
  return num.startsWith('sp-') || n.includes('special') || n.includes('devis') || n.includes('quote');
}

export type OrdersDataTableProps = {
  orders: OrderRow[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onRowOpen: (id: string) => void;
  onItemsModal: (order: OrderRow) => void;
  onStatusChange: (id: string, status: string) => void;
  fmtCurrency: (n: number) => string;
  fmtDate: (iso: string) => string;
  emptyDescription: string;
};

export function OrdersDataTable({
  orders,
  loading,
  selected,
  onToggle,
  onToggleAll,
  onRowOpen,
  onItemsModal,
  onStatusChange,
  fmtCurrency,
  fmtDate,
  emptyDescription,
}: OrdersDataTableProps) {
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={selected.size === orders.length && orders.length > 0}
            onChange={onToggleAll}
            className="rounded border-border"
            aria-label="Tout sélectionner"
          />
        ),
        cell: (ctx) => (
          <input
            type="checkbox"
            checked={selected.has(ctx.row.original.id)}
            onChange={() => onToggle(ctx.row.original.id)}
            className="rounded border-border"
            onClick={(e) => e.stopPropagation()}
            aria-label="Sélectionner la ligne"
          />
        ),
        size: 40,
      }),
      columnHelper.accessor('order_number', {
        header: 'N° / type',
        cell: (ctx) => {
          const order = ctx.row.original;
          const spec = isSpecialOrder(order);
          return (
            <div className="font-mono text-xs text-muted-foreground">
              #{order.order_number || order.id.slice(0, 8)}
              {spec ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-400">
                  spéciale
                </span>
              ) : (
                <span className="ml-2 text-[10px] text-muted-foreground">standard</span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('customer_name', {
        header: 'Client',
        cell: (ctx) => (
          <div>
            <div className="font-medium truncate max-w-[160px]">{ctx.row.original.customer_name || '—'}</div>
            {ctx.row.original.customer_phone ? (
              <div className="text-xs text-muted-foreground">{ctx.row.original.customer_phone}</div>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Statut',
        cell: (ctx) => <StatusBadge status={ctx.row.original.status || 'pending'} size="sm" />,
      }),
      columnHelper.display({
        id: 'articles',
        header: () => <span className="hidden md:inline">Articles</span>,
        cell: (ctx) => {
          const order = ctx.row.original;
          const items = order.items ?? [];
          const count = order.item_count ?? order.total_items ?? items.length;
          return (
            <div className="text-right hidden md:block" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onItemsModal(order)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <ShoppingBag size={14} className="shrink-0" />
                <span className="font-medium text-foreground tabular-nums">{count}</span>
                <Eye size={12} className="shrink-0 text-muted-foreground" />
              </button>
            </div>
          );
        },
      }),
      columnHelper.accessor('total_amount', {
        header: () => <span className="text-right">Montant</span>,
        cell: (ctx) => (
          <div className="text-right font-medium tabular-nums">
            {ctx.row.original.total_amount != null ? fmtCurrency(ctx.row.original.total_amount) : '—'}
          </div>
        ),
      }),
      columnHelper.accessor('driver_name', {
        header: () => (
          <span className="hidden lg:flex items-center justify-end gap-1">
            <Truck className="h-3 w-3" />
            Livreur
          </span>
        ),
        cell: (ctx) => (
          <div className="text-right text-xs text-muted-foreground hidden lg:table-cell max-w-[120px] truncate">
            {ctx.row.original.driver_name || '—'}
          </div>
        ),
      }),
      columnHelper.accessor('created_at', {
        header: () => <span className="hidden lg:inline text-right">Date</span>,
        cell: (ctx) => (
          <div className="text-right text-xs text-muted-foreground hidden lg:table-cell">
            {fmtDate(ctx.row.original.created_at)}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (ctx) => (
          <div className="text-right" onClick={(e) => e.stopPropagation()}>
            <Select
              value={ctx.row.original.status || ''}
              onValueChange={(v) => v && onStatusChange(ctx.row.original.id, v)}
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ),
      }),
    ],
    [fmtCurrency, fmtDate, onItemsModal, onStatusChange, onToggle, onToggleAll, orders, selected],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {/* Desktop / table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={9}>
                    <Skeleton className="h-9 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted/20 transition-colors cursor-pointer ${
                    selected.has(row.original.id) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => onRowOpen(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState title="Aucune commande" description={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {loading &&
          [...Array(5)].map((_, i) => (
            <div key={i} className="p-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        {!loading &&
          orders.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => onRowOpen(order.id)}
              className="w-full text-left p-4 hover:bg-muted/30 transition-colors rounded-none border-0 bg-background"
            >
              <div className="flex justify-between gap-2 items-start">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    #{order.order_number || order.id.slice(0, 8)}
                  </p>
                  <p className="font-medium">{order.customer_name || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isSpecialOrder(order) ? 'Spéciale' : 'Standard'} ·{' '}
                    {order.total_amount != null ? fmtCurrency(order.total_amount) : '—'}
                  </p>
                </div>
                <StatusBadge status={order.status || 'pending'} size="sm" />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  {order.driver_name || 'Pas de livreur'}
                </span>
                <span>{fmtDate(order.created_at)}</span>
              </div>
            </button>
          ))}
        {!loading && orders.length === 0 && (
          <div className="p-6">
            <EmptyState title="Aucune commande" description={emptyDescription} />
          </div>
        )}
      </div>
    </>
  );
}
