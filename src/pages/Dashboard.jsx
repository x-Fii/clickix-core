import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import StatusBadge from '@/components/StatusBadge';
import { ClipboardList, CheckCircle, AlertTriangle, Clock, TrendingUp, Users } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import ScheduleCalendarWidget from '@/components/ScheduleCalendarWidget';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];
const DEVICE_COLORS = { PC: '#3b82f6', TV: '#10b981', 'Network Device': '#f59e0b', Cabling: '#8b5cf6', 'CMS Software': '#06b6d4', Other: '#6b7280' };

export default function Dashboard() {
  const { data: reports = [] } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500),
  });

  // KPIs
  const total = reports.length;
  const open = reports.filter(r => !['resolved', 'complete'].includes(r.status)).length;
  const complete = reports.filter(r => r.status === 'complete').length;
  const escalated = reports.filter(r => r.status === 'escalated').length;

  // By status
  const statusCounts = ['reported', 'resolved', 'escalated', 'quote', 'approved', 'schedule', 'complete'].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: reports.filter(r => r.status === s).length,
  }));

  // By device type
  const deviceMap = {};
  reports.forEach(r => {
    (r.l1_affected_items || []).forEach(item => {
      const dt = item.device_type || 'Other';
      deviceMap[dt] = (deviceMap[dt] || 0) + 1;
    });
  });
  const deviceData = Object.entries(deviceMap).map(([name, value]) => ({ name, value }));

  // By client
  const clientMap = {};
  reports.forEach(r => {
    if (r.client_name) clientMap[r.client_name] = (clientMap[r.client_name] || 0) + 1;
  });
  const clientData = Object.entries(clientMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  // Last 7 days trend
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'MMM d');
    const count = reports.filter(r => {
      const cd = new Date(r.created_date);
      return format(cd, 'MMM d') === dateStr;
    }).length;
    return { date: dateStr, jobs: count };
  });

  const recentReports = reports.slice(0, 8);

  // Staff performance
  const [perfMonth, setPerfMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: installReports = [] } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 500),
  });

  const staffPerfData = (() => {
    const [year, month] = perfMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(new Date(year, month - 1));
    const inMonth = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr.slice(0, 10));
      return d >= monthStart && d <= monthEnd;
    };

    const staffMap = {};
    // Count SR L1
    reports.forEach(r => {
      if (inMonth(r.l1_date) && r.l1_attended_staff_name) {
        const key = r.l1_attended_staff_name;
        if (!staffMap[key]) staffMap[key] = { name: key, sr_l1: 0, sr_l2: 0, ir: 0 };
        staffMap[key].sr_l1++;
      }
      if (inMonth(r.l2_attend_date) && r.l2_attended_staff_name) {
        const key = r.l2_attended_staff_name;
        if (!staffMap[key]) staffMap[key] = { name: key, sr_l1: 0, sr_l2: 0, ir: 0 };
        staffMap[key].sr_l2++;
      }
    });
    // Count IR
    installReports.forEach(r => {
      if (inMonth(r.installation_date) && r.attended_staff_name) {
        const key = r.attended_staff_name;
        if (!staffMap[key]) staffMap[key] = { name: key, sr_l1: 0, sr_l2: 0, ir: 0 };
        staffMap[key].ir++;
      }
    });

    return Object.values(staffMap)
      .map(s => ({ ...s, total: s.sr_l1 + s.sr_l2 + s.ir }))
      .sort((a, b) => b.total - a.total);
  })();

  const kpis = [
    { label: 'Total Reports', value: total, icon: ClipboardList, color: 'text-blue-400' },
    { label: 'Open Jobs', value: open, icon: Clock, color: 'text-amber-400' },
    { label: 'Completed', value: complete, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Escalated', value: escalated, icon: AlertTriangle, color: 'text-orange-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold font-heading">Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Click IX Sdn Bhd — Service Management Overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</p>
              <Icon size={16} className={color} />
            </div>
            <p className="text-3xl font-bold font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-medium mb-4">Jobs by Status</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusCounts} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-medium mb-4">Issues by Device Type</p>
          {deviceData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {deviceData.map((entry, i) => (
                    <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {deviceData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: DEVICE_COLORS[d.name] || COLORS[i % COLORS.length] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-medium mb-4">Jobs by Client</p>
          {clientData.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={clientData} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-primary" /> 7-Day Job Trend
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="jobGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="jobs" stroke="#3b82f6" fill="url(#jobGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Users size={14} className="text-primary" /> Staff Performance by Cases Attended
          </p>
          <input
            type="month"
            value={perfMonth}
            onChange={e => setPerfMonth(e.target.value)}
            className="text-xs font-mono bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {staffPerfData.length === 0 ? (
          <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">No staff activity for this month.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={staffPerfData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="sr_l1" name="SR L1" stackId="a" fill="#3b82f6" />
                <Bar dataKey="sr_l2" name="SR L2" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="ir" name="Installation" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {staffPerfData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right">{i + 1}.</span>
                  <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    {s.sr_l1 > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">L1: {s.sr_l1}</span>}
                    {s.sr_l2 > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">L2: {s.sr_l2}</span>}
                    {s.ir > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">IR: {s.ir}</span>}
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold">{s.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />SR L1 (Remote)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" />SR L2 (Onsite)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Installation</span>
        </div>
      </div>

      {/* Schedule Calendar */}
      <ScheduleCalendarWidget />

      {/* Recent Reports */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <p className="text-sm font-medium">Recent Activity</p>
        </div>
        <div className="divide-y divide-border">
          {recentReports.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No reports yet. Create the first service report to get started.</p>
          ) : recentReports.map(r => (
            <a key={r.id} href={`/reports/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-muted/50 transition-colors">
              <span className="font-mono text-xs text-muted-foreground w-28 flex-shrink-0">{r.running_number}</span>
              <span className="text-sm font-medium min-w-0 flex-1 break-words">{r.client_name || '—'}</span>
              <span className="text-sm text-muted-foreground min-w-0 flex-1 break-words hidden md:block">{r.site_name || '—'}</span>
              <StatusBadge status={r.status} />
              <span className="text-xs text-muted-foreground hidden lg:block font-mono flex-shrink-0">{r.created_date ? format(new Date(r.created_date), 'dd MMM yy') : ''}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}