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
import {
  CompactTreeChildren,
  CompactTreeDisclosure,
  CompactTreeRow,
  compactTreeRowClassName,
} from '@/components/ui/compact-tree';
import { Separator } from '@/components/ui/separator';
import type { ScenarioId } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

type ShellSection = 'maps' | 'content' | 'tutorial' | 'template' | 'publications';

interface AppShellProps {
  children: ReactNode;
  section?: ShellSection;
  breadcrumb?: string;
  headerContent?: ReactNode;
  headerActions?: ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  templateId?: ScenarioId;
}

interface NavigationItem {
  label: string;
  icon: LucideIcon;
  section: ShellSection;
}

interface NavigationBranch extends NavigationItem {
  children: readonly NavigationItem[];
}

export const sidebarNavigation = [
  {
    label: 'Tutorial',
    icon: BookOpen,
    section: 'tutorial',
    children: [{ label: 'Wall of Maps', icon: MapIcon, section: 'maps' }],
  },
  {
    label: 'Content explorer',
    icon: FolderTree,
    section: 'content',
    children: [
      { label: 'Template workspace', icon: FileStack, section: 'template' },
      { label: 'Publications', icon: Database, section: 'publications' },
    ],
  },
] as const satisfies readonly NavigationBranch[];

export function flattenSidebarNavigation(
  navigation: readonly NavigationBranch[] = sidebarNavigation
): readonly NavigationItem[] {
  return navigation.flatMap((branch) => [branch, ...branch.children]);
}

export function isNavigationBranchActive(
  branch: NavigationBranch,
  activeSection: ShellSection
): boolean {
  return (
    branch.section === activeSection ||
    branch.children.some((item) => item.section === activeSection)
  );
}

export function isNavigationItemUnavailable(
  item: NavigationItem,
  templateId?: ScenarioId
): boolean {
  return !templateId && (item.section === 'template' || item.section === 'publications');
}

export function getContentExplorerNavigationSearch(templateId?: ScenarioId) {
  return { template: templateId ?? 'stores', view: 'tree' as const, q: '' };
}

const expandedBranches = {
  tutorial: true,
  content: true,
} satisfies Record<(typeof sidebarNavigation)[number]['section'], boolean>;

type NavigationBranchSection = keyof typeof expandedBranches;

const collapsedNavigation = flattenSidebarNavigation();

const navigationBranchIds = {
  tutorial: 'tutorial',
  content: 'content-explorer',
} satisfies Record<NavigationBranchSection, string>;

function NavigationIcon({ item }: Readonly<{ item: NavigationItem }>) {
  const Icon = item.icon;
  return <Icon aria-hidden="true" strokeWidth={1.8} className="size-3.5 shrink-0" />;
}

function SidebarLink({
  item,
  collapsed,
  activeSection,
  templateId,
  onNavigate,
  nested = false,
}: Readonly<{
  item: NavigationItem;
  collapsed: boolean;
  activeSection: ShellSection;
  templateId?: ScenarioId;
  onNavigate?: () => void;
  nested?: boolean;
}>) {
  const active = item.section === activeSection;
  const unavailable = isNavigationItemUnavailable(item, templateId);
  const className = cn(
    compactTreeRowClassName,
    'focus-visible:ring-2 focus-visible:ring-focus',
    'w-full',
    collapsed ? 'justify-center px-2' : nested ? 'gap-2 px-2' : 'gap-2 px-1.5',
    active
      ? 'bg-canvas text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_1px_rgba(0,0,0,0.03)]'
      : unavailable
        ? 'cursor-not-allowed text-ink-faint opacity-55'
        : 'text-ink-muted hover:bg-canvas hover:text-ink'
  );
  const contents = (
    <>
      <NavigationIcon item={item} />
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
        aria-current={active ? 'page' : undefined}
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
        search={getContentExplorerNavigationSearch(templateId)}
        aria-current={active ? 'page' : undefined}
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
        aria-current={active ? 'page' : undefined}
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
        to="/author/$templateId"
        params={{ templateId }}
        aria-current={active ? 'page' : undefined}
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
        aria-current={active ? 'page' : undefined}
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

function NavigationTree({
  activeSection,
  templateId,
  onNavigate,
  idPrefix,
}: Readonly<{
  activeSection: ShellSection;
  templateId?: ScenarioId;
  onNavigate?: () => void;
  idPrefix: string;
}>) {
  const [openBranches, setOpenBranches] = useState(expandedBranches);

  return (
    <ul className="space-y-1">
      {sidebarNavigation.map((branch) => {
        const branchSection = branch.section;
        const branchOpen = openBranches[branchSection];
        const branchActive = isNavigationBranchActive(branch, activeSection);
        const branchSelfActive = branch.section === activeSection;
        const branchId = `${idPrefix}-${navigationBranchIds[branchSection]}-items`;

        return (
          <li key={branch.section}>
            <CompactTreeRow activeAncestor={branchActive && !branchSelfActive}>
              <CompactTreeDisclosure
                expanded={branchOpen}
                label={branch.label}
                controls={branchId}
                onClick={() =>
                  setOpenBranches((current) => ({
                    ...current,
                    [branchSection]: !current[branchSection],
                  }))
                }
              />
              <SidebarLink
                item={branch}
                collapsed={false}
                activeSection={activeSection}
                templateId={templateId}
                onNavigate={onNavigate}
              />
              {branchActive && !branchSelfActive ? (
                <span
                  aria-hidden="true"
                  className="mr-2 size-1.5 shrink-0 rounded-full bg-accent"
                />
              ) : null}
            </CompactTreeRow>

            {branchOpen ? (
              <CompactTreeChildren id={branchId} label={`${branch.label} destinations`}>
                {branch.children.map((item) => (
                  <li key={item.section}>
                    <SidebarLink
                      item={item}
                      collapsed={false}
                      activeSection={activeSection}
                      templateId={templateId}
                      onNavigate={onNavigate}
                      nested
                    />
                  </li>
                ))}
              </CompactTreeChildren>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SidebarContents({
  collapsed,
  onCollapse,
  activeSection,
  templateId,
  onNavigate,
  idPrefix,
}: Readonly<{
  collapsed: boolean;
  onCollapse?: () => void;
  activeSection: ShellSection;
  templateId?: ScenarioId;
  onNavigate?: () => void;
  idPrefix: string;
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

      <nav aria-label="Primary" className="flex-1 overflow-y-auto p-2.5">
        <p
          className={cn(
            'px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint',
            collapsed && 'sr-only'
          )}
        >
          Workspace
        </p>
        {collapsed ? (
          <ul className="space-y-1">
            {collapsedNavigation.map((item) => (
              <li key={item.section}>
                <SidebarLink
                  item={item}
                  collapsed
                  activeSection={activeSection}
                  templateId={templateId}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        ) : (
          <NavigationTree
            activeSection={activeSection}
            templateId={templateId}
            onNavigate={onNavigate}
            idPrefix={idPrefix}
          />
        )}
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
  section = 'maps',
  breadcrumb = 'Wall of Maps',
  headerContent,
  headerActions,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  templateId,
}: Readonly<AppShellProps>) {
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const collapsed = sidebarCollapsed ?? uncontrolledCollapsed;
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
          onCollapse={() => {
            const nextCollapsed = !collapsed;
            setUncontrolledCollapsed(nextCollapsed);
            onSidebarCollapsedChange?.(nextCollapsed);
          }}
          activeSection={section}
          templateId={templateId}
          idPrefix="desktop-navigation"
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
              idPrefix="mobile-navigation"
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-2 overflow-x-clip border-b border-line bg-canvas/92 px-3 backdrop-blur-md sm:h-[52px] sm:flex-nowrap sm:px-4 lg:px-5">
          <div className="flex h-[52px] min-w-0 flex-1 items-center gap-2">
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
            {headerContent ?? (
              <span className="truncate text-xs font-medium text-ink">{breadcrumb}</span>
            )}
          </div>

          {headerActions ? (
            <div className="flex h-11 w-full shrink-0 items-center justify-end border-t border-line bg-canvas/92 sm:ml-auto sm:h-full sm:w-auto sm:border-l sm:border-t-0 sm:pl-2">
              {headerActions}
            </div>
          ) : null}
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
