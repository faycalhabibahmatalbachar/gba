'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { StatusBadge } from '@/components/ui/custom/StatusBadge';
import type { OrderRow } from '@/lib/services/orders';

const PIPELINE: { status: string; label: string }[] = [
  { status: 'pending', label: 'En attente' },
  { status: 'confirmed', label: 'Confirmée' },
  { status: 'processing', label: 'En cours' },
  { status: 'shipped', label: 'Expédiée' },
  { status: 'delivered', label: 'Livrée' },
];

function normStatus(s: string | null | undefined) {
  return String(s || 'pending').toLowerCase();
}

function DraggableCard({
  order,
  fmtCurrency,
}: {
  order: OrderRow;
  fmtCurrency: (n: number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded-lg border border-border bg-card p-2.5 text-left shadow-sm cursor-grab active:cursor-grabbing"
    >
      <p className="font-mono text-[10px] text-muted-foreground truncate">#{order.order_number || order.id.slice(0, 8)}</p>
      <p className="text-sm font-medium truncate">{order.customer_name || '—'}</p>
      <p className="text-xs tabular-nums mt-1">{order.total_amount != null ? fmtCurrency(order.total_amount) : '—'}</p>
    </div>
  );
}

function Column({
  status,
  label,
  orders,
  fmtCurrency,
}: {
  status: string;
  label: string;
  orders: OrderRow[];
  fmtCurrency: (n: number) => string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[280px] min-w-[200px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors ${
        isOver ? 'border-primary/60 bg-primary/5' : 'border-border bg-muted/20'
      }`}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{orders.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <DraggableCard key={o.id} order={o} fmtCurrency={fmtCurrency} />
        ))}
      </div>
    </div>
  );
}

export type OrdersKanbanBoardProps = {
  orders: OrderRow[];
  fmtCurrency: (n: number) => string;
  onMoveToStatus: (orderId: string, newStatus: string) => void;
};

export function OrdersKanbanBoard({ orders, fmtCurrency, onMoveToStatus }: OrdersKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const byColumn = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const p of PIPELINE) map.set(p.status, []);
    const cancelled: OrderRow[] = [];
    for (const o of orders) {
      const s = normStatus(o.status);
      if (s === 'cancelled' || s === 'refunded') {
        cancelled.push(o);
        continue;
      }
      const col = PIPELINE.some((p) => p.status === s) ? s : 'pending';
      const list = map.get(col) ?? [];
      list.push(o);
      map.set(col, list);
    }
    if (cancelled.length) map.set('cancelled', cancelled);
    return map;
  }, [orders]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId || !e.active) return;
    const oid = String(overId);
    if (!oid.startsWith('col-')) return;
    const newStatus = oid.replace(/^col-/, '');
    const orderId = String(e.active.id);
    onMoveToStatus(orderId, newStatus);
  }

  const activeOrder = activeId ? orders.find((o) => o.id === activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE.map((p) => (
          <Column
            key={p.status}
            status={p.status}
            label={p.label}
            orders={byColumn.get(p.status) ?? []}
            fmtCurrency={fmtCurrency}
          />
        ))}
        {(byColumn.get('cancelled')?.length ?? 0) > 0 && (
          <Column
            status="cancelled"
            label="Annulée"
            orders={byColumn.get('cancelled') ?? []}
            fmtCurrency={fmtCurrency}
          />
        )}
      </div>
      <DragOverlay>
        {activeOrder ? (
          <div className="rounded-lg border border-border bg-card p-2.5 shadow-lg w-[200px]">
            <p className="font-mono text-[10px] text-muted-foreground">#{activeOrder.order_number}</p>
            <p className="text-sm font-medium truncate">{activeOrder.customer_name}</p>
            <StatusBadge status={activeOrder.status || 'pending'} size="sm" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
