import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Users, MapPin, UserCog, ChevronRight, ChevronLeft, Monitor, FileText, ShoppingCart, Receipt, CalendarDays, Wrench, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const navSegments = [
  [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
  [
    { path: '/reports', label: 'Service Reports', icon: ClipboardList },
    { path: '/installation', label: 'Installation Reports', icon: Wrench },
    { path: '/quotations', label: 'Quotations', icon: FileText },
    { path: '/pr', label: 'Purchase Requisitions', icon: ShoppingCart },
    { path: '/claims', label: 'Claims', icon: Receipt },
  ],
  [
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/sites', label: 'Sites', icon: MapPin },
    { path: '/staff', label: 'Staff', icon: UserCog },
  ],
];

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-border">
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-xs font-mono font-semibold text-primary tracking-widest truncate">CLICK IX</p>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider truncate">SERVICE MANAGEMENT</p>
          </div>
        )}
        {collapsed && <Monitor size={18} className="text-primary mx-auto" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors ml-auto hidden md:block"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors md:hidden"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 overflow-y-auto">
        {navSegments.map((segment, si) => (
          <div key={si} className={cn('space-y-0.5', si > 0 && 'mt-2 pt-2 border-t border-border')}>
            {segment.map(({ path, label, icon: Icon }) => {
              const active = path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(path);
              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                    active
                      ? 'bg-primary/15 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground font-mono">v1.0.0 · 2026</p>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col bg-card border-r border-border transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-card border-r border-border md:hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </>
      )}

      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-card border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="overflow-hidden">
            <p className="text-xs font-mono font-semibold text-primary tracking-widest truncate">CLICK IX</p>
            <p className="text-[10px] font-mono text-muted-foreground tracking-wider truncate">SERVICE MANAGEMENT</p>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}