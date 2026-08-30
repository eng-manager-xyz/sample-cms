import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ChevronDown,
  Database,
  FileStack,
  FolderTree,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ScenarioId } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

type ShellSection = 'maps' | 'content' | 'tutorial' | 'template' | 'publications';

interface AppShellProps {
  children: ReactNode;
  databaseHealthy?: boolean;
  schemaVersion?: number;
  section?: ShellSection;
  breadcrumb?: string;
  templateId?: ScenarioId;
}

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  section: ShellSection;
}

const baseNavigation: NavigationItem[] = [
  { label: 'Wall of Maps', icon: MapIcon, section: 'maps' },
  { label: 'Content explorer', icon: FolderTree, section: 'content' },
  { label: 'Tutorial', icon: BookOpen, section: 'tutorial' },
  { label: 'Template workspace', icon: FileStack, section: 'template' },
  { label: 'Publications', icon: Database, section: 'publications' },
];

function SidebarLink({
  item,
  collapsed,
  activeSection,
  templateId,
  onNavigate,
}: Readonly<{
  item: NavigationItem;
  collapsed: boolean;
  activeSection: ShellSection;
  templateId?: ScenarioId;
  onNavigate?: () => void;
}>) {
  const Icon = item.icon;
  const active = item.section === activeSection;
  const unavailable =
    !templateId && (item.section === 'template' || item.section === 'publications');
  const className = cn(
    'flex h-9 w-full items-center rounded-lg px-2 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
    collapsed ? 'justify-center' : 'gap-2.5',
    active
      ? 'bg-canvas text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_1px_rgba(0,0,0,0.03)]'
      : unavailable
        ? 'cursor-not-allowed text-ink-faint opacity-55'
        : 'text-ink-muted hover:bg-canvas hover:text-ink'
  );
  const contents = (
    <>
      <Icon aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0" />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </>
  );

  if (unavailable) {
    return (
      <span aria-disabled="true" title={collapsed ? item.label : undefined} className={className}>
        {contents}
      </span>
    );
  }

  if (item.section === 'maps') {
    return (
      <Link
        to="/"
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  if (item.section === 'content') {
    return (
      <Link
        to="/content"
        search={{ view: 'tree', template: 'stores', q: '' }}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  if (item.section === 'tutorial') {
    return (
      <Link
        to="/tutorial"
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  if (item.section === 'template' && templateId) {
    return (
      <Link
        to="/templates/$templateId"
        params={{ templateId }}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  if (item.section === 'publications' && templateId) {
    return (
      <Link
        to="/publications/$templateId"
        params={{ templateId }}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  return null;
}

function SidebarContents({
  collapsed,
  onCollapse,
  activeSection,
  templateId,
  onNavigate,
}: Readonly<{
  collapsed: boolean;
  onCollapse?: () => void;
  activeSection: ShellSection;
  templateId?: ScenarioId;
  onNavigate?: () => void;
}>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn('flex h-[68px] items-center px-3', collapsed ? 'justify-center' : 'gap-3')}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink text-canvas shadow-sm">
          <span aria-hidden="true" className="text-sm font-semibold tracking-[-0.06em]">
            A
          </span>
        </div>
        <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-ink">
              Auteur
            </span>
            <ChevronDown aria-hidden="true" className="size-3.5 text-ink-faint" />
          </div>
          <p className="truncate text-[11px] text-ink-faint">CMS prototype</p>
        </div>
      </div>

      <Separator />

      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto p-2.5">
        <p
          className={cn(
            'px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint',
            collapsed && 'sr-only'
          )}
        >
          Workspace
        </p>
        {baseNavigation.map((item) => (
          <SidebarLink
            key={item.label}
            item={item}
            collapsed={collapsed}
            activeSection={activeSection}
            templateId={templateId}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="p-2.5">
        <div className={cn('relative flex items-center', collapsed ? 'justify-center' : 'gap-2')}>
          <div className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong">
            MH
          </div>
          <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
            <p className="truncate text-xs font-medium text-ink">Prototype workspace</p>
            <p className="truncate text-[10px] text-ink-faint">Local SQLite</p>
          </div>
          {onCollapse ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="desktop-sidebar"
              className={cn(
                'size-7',
                collapsed && 'absolute bottom-9 left-[43px] bg-canvas shadow-sm'
              )}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" className="size-3.5" />
              ) : (
                <PanelLeftClose aria-hidden="true" className="size-3.5" />
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  databaseHealthy = false,
  schemaVersion,
  section = 'maps',
  breadcrumb = 'Wall of Maps',
  templateId,
}: Readonly<AppShellProps>) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const mobileOpenButtonRef = useRef<HTMLButtonElement>(null);
  const mobileWasOpenRef = useRef(false);

  useEffect(() => {
    if (mobileOpen) {
      mobileWasOpenRef.current = true;
      mobileDialogRef.current?.focus();
      return;
    }

    if (mobileWasOpenRef.current) {
      mobileWasOpenRef.current = false;
      mobileOpenButtonRef.current?.focus();
    }
  }, [mobileOpen]);

  return (
    <div className="flex min-h-svh bg-surface text-ink">
      <aside
        id="desktop-sidebar"
        className={cn(
          'sticky top-0 hidden h-svh shrink-0 border-r border-line bg-sidebar transition-[width] duration-200 ease-out md:block',
          collapsed ? 'w-[68px]' : 'w-[232px]'
        )}
      >
        <SidebarContents
          collapsed={collapsed}
          onCollapse={() => setCollapsed((value) => !value)}
          activeSection={section}
          templateId={templateId}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Dismiss navigation backdrop"
            tabIndex={-1}
            className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={mobileDialogRef}
            id="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setMobileOpen(false);
                return;
              }

              if (event.key !== 'Tab') return;
              const focusable = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
              );
              const first = focusable.at(0);
              const last = focusable.at(-1);
              if (!first || !last) return;

              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
            className="relative h-full w-[248px] border-r border-line bg-sidebar shadow-2xl"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-2 z-10 size-8"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
            <SidebarContents
              collapsed={false}
              activeSection={section}
              templateId={templateId}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between border-b border-line bg-canvas/92 px-3 backdrop-blur-md sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              ref={mobileOpenButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
              className="md:hidden"
            >
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            </Button>
            <Link
              to="/"
              className="hidden text-xs text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus sm:inline"
            >
              CMS
            </Link>
            <span aria-hidden="true" className="hidden text-ink-faint sm:inline">
              /
            </span>
            <span className="truncate text-xs font-medium text-ink">{breadcrumb}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className="ml-1 flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-1 pr-2 text-[11px] font-medium text-ink-muted"
              title={
                databaseHealthy
                  ? `SQLite schema v${schemaVersion ?? 'unknown'}`
                  : 'SQLite unavailable'
              }
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-2 rounded-full',
                  databaseHealthy
                    ? 'bg-success shadow-[0_0_0_3px_var(--color-success-soft)]'
                    : 'bg-danger shadow-[0_0_0_3px_var(--color-danger-soft)]'
                )}
              />
              {databaseHealthy ? 'SQLite live' : 'SQLite offline'}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
