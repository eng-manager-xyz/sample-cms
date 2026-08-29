import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getInstancePage, type InstanceRow, type ScenarioFixture } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';
import { loadScenarioInstancePage } from '@/server-functions/cms.functions';

const columns: ColumnDef<InstanceRow>[] = [
  { accessorKey: 'canonicalUrl', header: 'Canonical URL' },
  { accessorKey: 'dimensionSummary', header: 'Dimensions' },
  { accessorKey: 'matchedLayers', header: 'Sheets' },
  { accessorKey: 'lifecycle', header: 'Camo Press' },
  { accessorKey: 'auteurState', header: 'Auteur' },
];

export function InstanceTable({
  scenario,
  onInspect,
}: Readonly<{ scenario: ScenarioFixture; onInspect: (row: InstanceRow) => void }>) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });
  const pageQuery = useQuery({
    queryKey: ['scenario-instance-page', scenario.id, pagination.pageIndex, pagination.pageSize],
    queryFn: () =>
      loadScenarioInstancePage({
        data: {
          templateId: scenario.id,
          pageIndex: pagination.pageIndex,
          pageSize: pagination.pageSize,
        },
      }),
    initialData: () => getInstancePage(scenario, pagination.pageIndex, pagination.pageSize),
    placeholderData: keepPreviousData,
  });
  const page = pageQuery.data;
  const table = useReactTable({
    data: page.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: page.rowCount,
    state: { pagination },
    onPaginationChange: setPagination,
  });
  const firstRow = page.rowCount === 0 ? 0 : page.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min(page.rowCount, firstRow + page.rows.length - 1);

  return (
    <div
      className="overflow-hidden rounded-lg border border-line bg-canvas"
      aria-busy={pageQuery.isFetching}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold text-ink">Precise instance lookup</p>
          <p className="text-[9px] text-ink-faint">
            TanStack server-function page · at most 10 fixture rows returned
          </p>
        </div>
        <Badge tone="neutral" className="font-mono text-[9px]">
          indexed canonical_url
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-line bg-surface-subtle">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
                <th scope="col" className="w-10 px-2 py-2">
                  <span className="sr-only">Inspect</span>
                </th>
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-line last:border-0 hover:bg-surface-subtle',
                  row.original.conflict && 'bg-danger-soft/45'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="max-w-[260px] truncate px-3 py-2.5 text-[10px] text-ink-muted"
                  >
                    {cell.column.id === 'canonicalUrl' ? (
                      <button
                        type="button"
                        onClick={() => onInspect(row.original)}
                        className="max-w-full truncate font-mono font-medium text-accent-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {String(cell.getValue())}
                      </button>
                    ) : cell.column.id === 'matchedLayers' ? (
                      <Badge
                        tone={row.original.conflict ? 'danger' : 'info'}
                        className="h-5 text-[9px]"
                      >
                        {String(cell.getValue())}
                        {row.original.conflict ? ' · conflict' : ''}
                      </Badge>
                    ) : cell.column.id === 'lifecycle' ? (
                      <Badge
                        tone={cell.getValue() === 'live' ? 'success' : 'neutral'}
                        className="h-5 text-[9px]"
                      >
                        {String(cell.getValue()).replace('_', ' ')}
                      </Badge>
                    ) : cell.column.id === 'auteurState' ? (
                      <Badge
                        tone={
                          cell.getValue() === 'published'
                            ? 'success'
                            : cell.getValue() === 'missing'
                              ? 'danger'
                              : 'warning'
                        }
                        className="h-5 text-[9px]"
                      >
                        {String(cell.getValue()).replace('_', ' ')}
                      </Badge>
                    ) : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Inspect ${row.original.canonicalUrl}`}
                    onClick={() => onInspect(row.original)}
                    className="size-7"
                  >
                    <MapPin aria-hidden="true" className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2">
        <p className="text-[10px] tabular-nums text-ink-faint">
          {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of {page.rowCount.toLocaleString()}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Previous instance page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          </Button>
          <span className="min-w-20 text-center text-[10px] tabular-nums text-ink-muted">
            Page {pagination.pageIndex + 1} / {table.getPageCount().toLocaleString()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Next instance page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
