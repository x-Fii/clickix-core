import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from
'@/components/ui/alert-dialog';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from 'date-fns';
import ExportButtons from '@/components/ExportButtons';

const STATUSES = ['all', 'pending', 'scheduled', 'completed', 'billed', 'cancelled'];
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

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  billed: { label: 'Billed', className: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-300 border-red-500/30' }
};

const TYPE_CONFIG = {
  commissioning: { label: 'Comm', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  decommissioning: { label: 'Decomm', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' }
};

export default function InstallationReports() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 200)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InstallationReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['installation-reports'])
  });

  const range = periodRange(periodFilter);
  const inPeriod = (r) => {
    if (!range) return true;
    const d = r.created_date ? parseISO(r.created_date) : null;
    return d && isWithinInterval(d, range);
  };

  const scoped = reports.filter((r) => {
    const matchClient = clientFilter === 'all' || r.client_id === clientFilter;
    const matchPeriod = inPeriod(r);
    return matchClient && matchPeriod;
  });

  const filtered = scoped.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchSearch = [r.report_number, r.client_name, r.site_name, r.attended_staff_name, r.do_number].
      join(' ').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    all: scoped.length,
    pending: scoped.filter((r) => r.status === 'pending').length,
    scheduled: scoped.filter((r) => r.status === 'scheduled').length,
    completed: scoped.filter((r) => r.status === 'completed').length,
    billed: scoped.filter((r) => r.status === 'billed').length,
    cancelled: scoped.filter((r) => r.status === 'cancelled').length
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold font-heading flex items-center gap-2">
            <Wrench size={22} className="text-primary" /> Installation Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Commissioning &amp; decommissioning of outlets</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            data={filtered}
            fileName="installation_reports"
            title="Installation Reports"
            columns={[
              { header: 'Report No.', accessor: 'report_number' },
              { header: 'Type', accessor: 'report_type' },
              { header: 'DO No.', accessor: 'do_number' },
              { header: 'Client', accessor: 'client_name' },
              { header: 'Site', accessor: 'site_name' },
              { header: 'Date', accessor: (r) => r.installation_date || r.scheduled_date || '' },
              { header: 'Technician', accessor: 'attended_staff_name' },
              { header: 'Status', accessor: 'status' },
            ]}
          />
          <Button asChild>
            <Link to="/installation/new"><Plus size={16} className="mr-1" /> New Report</Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
        { label: 'Total', value: counts.all, color: 'text-foreground', filter: 'all' },
        { label: 'Pending', value: counts.pending, color: 'text-slate-400', filter: 'pending' },
        { label: 'Scheduled', value: counts.scheduled, color: 'text-blue-400', filter: 'scheduled' },
        { label: 'Completed', value: counts.completed, color: 'text-emerald-400', filter: 'completed' },
        { label: 'Billed', value: counts.billed, color: 'text-pink-400', filter: 'billed' },
        { label: 'Cancelled', value: counts.cancelled, color: 'text-red-400', filter: 'cancelled' }].
        map((s) =>
        <div key={s.label} onClick={() => setStatusFilter(s.filter)} className={`bg-card border rounded-xl p-4 cursor-pointer transition-colors hover:border-primary/50 ${statusFilter === s.filter ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search reports…" className="pl-8 bg-card" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44 bg-card"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : STATUS_CONFIG[s]?.label || s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40 bg-card"><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {['Report No.', 'Type', 'DO No.', 'Client', 'Site', 'Date', 'Technician', 'Status', ''].map((h) =>
              <th key={h} className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ?
            <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">Loading…</td></tr> :
            filtered.length === 0 ?
            <tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">No installation reports found.</td></tr> :
            filtered.map((r) => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const tc = TYPE_CONFIG[r.report_type] || TYPE_CONFIG.commissioning;
              return (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-primary text-xs">
                    <Link to={`/installation/${r.id}`} className="hover:underline">{r.report_number || '—'}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] w-16 flex justify-center ${tc.className}`}>{tc.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.do_number || '—'}</td>
                  <td className="px-4 py-3 font-medium text-xs">{r.client_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.site_name || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.installation_date || r.scheduled_date || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.attended_staff_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] w-20 flex justify-center ${sc.className}`}>{sc.label}</Badge>
                  </td>
                  

















                  
                </tr>);

            })}
          </tbody>
        </table>
      </div>
    </div>);

}