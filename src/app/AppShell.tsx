import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut, Menu as MenuIcon, Moon, Plus, Settings, Sun, UserRound } from 'lucide-react';
import { Avatar, Button, Logo, Menu, cn } from '../ui';
import { useAuth } from './auth';
import { can, ROLE_LABELS } from './permissions';
import { SETTINGS_ITEM, visibleSections, type NavItem } from './nav';
import { useTheme } from './theme';
import { useStaff } from './queries';

function SideLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'focus-ring group flex items-center gap-3 rounded-md px-3 py-2 text-[15px] font-semibold transition-colors',
          isActive ? 'bg-subtle text-fg' : 'text-fg-2 hover:bg-hover hover:text-fg'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-brand-500' : 'text-fg-4 group-hover:text-fg-3')} />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { staff, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const name = staff?.full_name || 'Staff member';
  return (
    <Menu
      align={compact ? 'right' : 'left'}
      direction={compact ? 'down' : 'up'}
      header={
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{name}</p>
          <p className="truncate text-sm text-fg-3">{staff?.email}</p>
        </div>
      }
      items={[
        { label: 'Profile & password', icon: <UserRound className="h-4 w-4" />, onSelect: () => navigate('/settings') },
        { label: isDark ? 'Light mode' : 'Dark mode', icon: isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />, onSelect: toggle },
        { label: 'Sign out', icon: <LogOut className="h-4 w-4" />, onSelect: signOut, danger: true },
      ]}
      trigger={({ toggle: open }) =>
        compact ? (
          <button type="button" onClick={open} className="focus-ring cursor-pointer rounded-full" aria-label="Account menu">
            <Avatar name={name} size="sm" />
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            className="focus-ring flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left hover:bg-hover"
          >
            <Avatar name={name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{name}</span>
              <span className="block truncate text-sm text-fg-3">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-fg-4" />
          </button>
        )
      }
    />
  );
}

function PendingBadge() {
  const { role } = useAuth();
  const { data } = useStaff();
  if (!can.manageStaff(role)) return null;
  const pending = (data || []).filter(s => s.approval_status === 'pending').length;
  if (!pending) return null;
  return (
    <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
      {pending}
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const sections = visibleSections(role);
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-6">
        <Logo className="h-14" />
      </div>
      {can.createOrders(role) && (
        <div className="px-4 pt-4">
          <Button
            variant="primary"
            className="w-full"
            icon={<Plus className="h-5 w-5" />}
            onClick={() => {
              onNavigate?.();
              navigate('/orders/new');
            }}
          >
            New order
          </Button>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-4 pt-5" aria-label="Main">
        {sections.map((section, i) => (
          <div key={i} className={i > 0 ? 'mt-6' : ''}>
            {section.title && <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-fg-4">{section.title}</p>}
            <div className="flex flex-col gap-0.5">
              {section.items.map(item =>
                item.to === '/staff' ? (
                  <div key={item.to} className="relative">
                    <SideLink item={item} onNavigate={onNavigate} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <PendingBadge />
                    </span>
                  </div>
                ) : (
                  <SideLink key={item.to} item={item} onNavigate={onNavigate} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-4">
        <SideLink item={SETTINGS_ITEM} onNavigate={onNavigate} />
        <div className="mt-3">
          <UserMenu />
        </div>
      </div>
    </div>
  );
}

/** Phone bottom bar: the main sections, a "New order" button and "More". */
function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const primary = visibleSections(role)
    .flatMap(s => s.items)
    .filter(i => i.mobilePrimary);
  const showNew = can.createOrders(role);
  const items = showNew ? [primary[0], primary[1], null, ...primary.slice(2)] : primary;

  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item, i) =>
          item === null ? (
            <div key="new" className="flex items-center justify-center px-1">
              <button
                type="button"
                onClick={() => navigate('/orders/new')}
                className="focus-ring -mt-5 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-4 ring-surface"
                aria-label="New order"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          ) : item ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn('flex min-w-[64px] flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', isActive ? 'text-fg' : 'text-fg-4')
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-5 w-5', isActive && 'text-brand-500')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ) : null
        )}
        <button
          type="button"
          onClick={onMore}
          className="flex min-w-[64px] cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-fg-4"
        >
          <MenuIcon className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the phone drawer whenever the route changes
  React.useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh bg-page">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] border-r border-line bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <NavLink to="/settings" className="focus-ring rounded-lg p-2 text-fg-3" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </NavLink>
          <UserMenu compact />
        </div>
      </header>

      {/* Phone "More" drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="animate-fade-in absolute inset-0 bg-gray-950/60" onClick={() => setDrawerOpen(false)} />
          <div className="animate-slide-in-right absolute inset-y-0 right-0 w-[85%] max-w-xs bg-surface shadow-xl">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-[280px]">
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-12">
          <Outlet />
        </div>
      </main>

      <MobileTabBar onMore={() => setDrawerOpen(true)} />
    </div>
  );
}

