'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: TData, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  exportFilename?: string;
  cursorFooter?: React.ReactNode;
  className?: string;
}

function rowsToCsv<TData>(rows: Row<TData>[], columns: ColumnDef<TData, unknown>[]): string {
  const headers = columns
    .filter((c) => c.id !== '__select')
    .map((c) => (typeof c.header === 'string' ? c.header : c.id || 'col'))
    .filter(Boolean);
  const lines: string[][] = [headers as string[]];
  for (const row of rows) {
    const cells = row.getVisibleCells().filter((c) => c.column.id !== '__select');
    lines.push(
      cells.map((cell) => {
        const v = cell.getValue();
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }),
    );
  }
  return lines.map((r) => r.join(',')).join('\n');
}

export function DataTable<TData>({
  columns,
  data,
  enableRowSelection = false,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  getRowId,
  isLoading,
  emptyTitle = 'Aucune donnée',
  emptyDescription = 'Ajustez les filtres ou créez un nouvel élément.',
  emptyAction,
  exportFilename = 'export.csv',
  cursorFooter,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalSelection, setInternalSelection] = React.useState<RowSelectionState>({});
  const rowSelection = controlledSelection ?? internalSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalSelection;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    getRowId:
      getRowId ??
      ((row, i) => {
        const r = row as Record<string, unknown>;
        if (r && typeof r.id === 'string') return r.id;
        if (r && typeof r.id === 'number') return String(r.id);
        return String(i);
      }),
  });

  const rows = table.getRowModel().rows;

  const exportCsv = React.useCallback(() => {
    const csv = rowsToCsv(table.getFilteredRowModel().rows, columns);
    const bom = '\ufeff';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, table]);

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-border bg-card p-4 space-y-3', className)}>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center',
          className,
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <PackageSearch className="h-7 w-7" />
        </div>
        <div className="space-y-1 max-w-sm">
          <p className="font-semibold text-foreground">{emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden min-w-0 flex flex-col', className)}>
      <div className="flex justify-end gap-2 px-3 py-2 border-b border-border bg-muted/20">
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto max-h-[min(640px,70vh)] overflow-y-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent border-b border-border">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs uppercase tracking-wide text-muted-foreground sticky top-0 bg-card z-10 backdrop-blur-sm">
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 shrink-0"
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label="Trier"
                          >
                            {{
                              asc: <ArrowUp className="h-3.5 w-3.5" />,
                              desc: <ArrowDown className="h-3.5 w-3.5" />,
                            }[header.column.getIsSorted() as string] ?? (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined} className="border-border">
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {cursorFooter}
    </div>
  );
}

export function dataTableSelectColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: '__select',
    header: ({ table }) => (
      <input
        type="checkbox"
        role="checkbox"
        aria-label="Tout sélectionner"
        className="h-4 w-4 rounded border border-border accent-[var(--brand)]"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        role="checkbox"
        aria-label="Sélectionner"
        className="h-4 w-4 rounded border border-border accent-[var(--brand)]"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
    enableSorting: false,
    size: 40,
  };
}
