import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, ClipboardList } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { Badge } from '@/components/ui/badge';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, isWithinInterval, parseISO } from 'date-fns';

const STATUSES = ['all', 'open', 'reported', 'resolved', 'escalated', 'quote', 'approved', 'schedule', 'complete', 'completed', 'billed'];
const PERIODS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
];

function periodRange(period) {
  if (period === 'all') return null;
  const now = new Date();
  switch (period) {
    case 'today': return { start: startOfDay(now), end: endOfDay(now) };
    case '7d': return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case '30d': return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case 'this_week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'this_year': return { start: startOfYear(now), end: endOfYear(now) };
    default: return null;
  }
}

export default function ServiceReports() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [clientFilter, setClientFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const range = periodRange(periodFilter);
  const inPeriod = (r) => {
    if (!range) return true;
    const d = r.created_date ? parseISO(r.created_date) : null;
    return d && isWithinInterval(d, range);
  };

  const filtered = reports.filter((r) => {
    const matchStatus = statusFilter === 'all' ? true
      : statusFilter === 'open' ? !['resolved', 'complete', 'billed'].includes(r.status)
      : statusFilter === 'completed' ? ['complete', 'billed'].includes(r.status)
      : r.status === statusFilter;
    const matchClient = clientFilter === 'all' || r.client_id === clientFilter;
    const matchPeriod = inPeriod(r);
    const q = search.toLowerCase();
    const matchSearch = !q || [r.running_number, r.client_name, r.site_name, r.reported_by, r.do_number].
    some((f) => f?.toLowerCase().includes(q));
    return matchStatus && matchClient && matchPeriod && matchSearch;
  });

  // Base set for counts: respect client & period filters (status counts stay relative to that set)
  const scoped = reports.filter((r) => {
    const matchClient = clientFilter === 'all' || r.client_id === clientFilter;
    const matchPeriod = inPeriod(r);
    return matchClient && matchPeriod;
  });
  const counts = {
    all: scoped.length,
    reported: scoped.filter((r) => r.status === 'reported').length,
    resolved: scoped.filter((r) => r.status === 'resolved').length,
    escalated: scoped.filter((r) => r.status === 'escalated').length,
    quote: scoped.filter((r) => r.status === 'quote').length,
    approved: scoped.filter((r) => r.status === 'approved').length,
    schedule: scoped.filter((r) => r.status === 'schedule').length,
    complete: scoped.filter((r) => r.status === 'complete').length,
    billed: scoped.filter((r) => r.status === 'billed').length,
    l1Pending: scoped.filter((r) => r.l1_status === 'pending').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" /> Service Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">L1 remote support &amp; L2 onsite service records</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            data={filtered}
            fileName="service_reports"
            title="Service Reports"
            columns={[
              { header: 'Report No.', accessor: 'running_number' },
              { header: 'Response ID', accessor: 'whatsapp_response_id' },
              { header: 'DO No.', accessor: (r) => (r.status === 'resolved' ? 'N/A' : (r.do_number || '')) },
              { header: 'Work Order No.', accessor: (r) => (r.status === 'resolved' ? 'N/A' : (r.l2_work_order_number || '')) },
              { header: 'Client', accessor: 'client_name' },
              { header: 'Site', accessor: 'site_name' },
              { header: 'Reported By', accessor: 'reported_by' },
              { header: 'Status', accessor: 'status' },
              { header: 'Date', accessor: (r) => (r.created_date ? r.created_date.slice(0, 10) : '') },
            ]}
          />
          <Link to="/reports/new">
            <Button className="gap-2"><Plus size={16} /> New Report</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
        { label: 'Total',     value: counts.all,      color: 'text-foreground' },
        { label: 'Resolved At L1',  value: counts.resolved,  color: 'text-teal-400' },
        { label: 'Escalated', value: counts.escalated, color: 'text-amber-400' },
        { label: 'Quote',     value: counts.quote,     color: 'text-yellow-400' },
        { label: 'Approved',  value: counts.approved,  color: 'text-purple-400' },
        { label: 'Schedule',  value: counts.schedule,  color: 'text-blue-400' },
        { label: 'Complete',  value: counts.complete,  color: 'text-emerald-400' },
        { label: 'Billed',    value: counts.billed,    color: 'text-pink-400' },
        { label: 'L1 Pending', value: counts.l1Pending, color: 'text-cyan-400' },
        ].map((s) =>
        <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by report no., client, site..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card" />
          
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) =>
            <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s === 'open' ? 'Open Jobs' : s === 'completed' ? 'Completed' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {['Report No.', 'Response ID', 'DO No.', 'Work Order No.', 'Client', 'Site', 'Reported By', 'Status', 'Date'].map((h) =>
              <th key={h} className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ?
            <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">Loading reports…</td></tr> :
            filtered.length === 0 ?
            <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">No reports found.</td></tr> :

            filtered.map((r) =>
            <tr key={r.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/reports/${r.id}`)}>
                <td className="px-4 py-3 font-mono text-primary text-xs">
                  <Link to={`/reports/${r.id}`} className="hover:underline">{r.running_number || '—'}</Link>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.whatsapp_response_id || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.status === 'resolved' ? 'N/A' : (r.do_number || '—')}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.status === 'resolved' ? 'N/A' : (r.l2_work_order_number || '—')}</td>
                <td className="px-4 py-3 font-medium text-xs">{r.client_name || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.site_name || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.reported_by || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                  {r.created_date ? format(new Date(r.created_date), 'dd MMM yyyy') : '—'}
                </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>);

}