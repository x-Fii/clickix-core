import { Link, useLocation, Outlet } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Users, MapPin, UserCog, ChevronRight, ChevronLeft, Monitor, FileText, ShoppingCart, Receipt } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reports', label: 'Service Reports', icon: ClipboardList },
  { path: '/quotations', label: 'Quotations', icon: FileText },
  { path: '/pr', label: 'Purchase Requisitions', icon: ShoppingCart },
  { path: '/claims', label: 'Claims', icon: Receipt },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/sites', label: 'Sites', icon: MapPin },
  { path: '/staff', label: 'Staff', icon: UserCog },
];

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={cn(
        'flex flex-col bg-card border-r border-border transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
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
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors ml-auto"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
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
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-mono">v1.0.0 · 2026</p>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}