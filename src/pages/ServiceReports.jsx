import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const STATUSES = ['all', 'reported', 'resolved', 'escalated', 'quote', 'approved', 'schedule', 'complete'];

export default function ServiceReports() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['service-reports'],
    queryFn: () => base44.entities.ServiceReport.list('-created_date', 500)
  });

  const filtered = reports.filter((r) => {
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || [r.running_number, r.client_name, r.site_name, r.reported_by].
    some((f) => f?.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  const counts = {
    all: reports.length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    escalated: reports.filter((r) => r.status === 'escalated').length,
    complete: reports.filter((r) => r.status === 'complete').length
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
        <Link to="/reports/new">
          <Button className="gap-2"><Plus size={16} /> New Report</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
        { label: 'Total', value: counts.all, color: 'text-foreground' },
        { label: 'Resolved', value: counts.resolved, color: 'text-emerald-400' },
        { label: 'Escalated', value: counts.escalated, color: 'text-amber-400' },
        { label: 'Complete', value: counts.complete, color: 'text-blue-400' }].
        map((s) =>
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) =>
            <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {['Report No.', 'Response ID', 'Work Order No.', 'Client', 'Site', 'Reported By', 'Status', 'Date'].map((h) =>
              <th key={h} className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ?
            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">Loading reports…</td></tr> :
            filtered.length === 0 ?
            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No reports found.</td></tr> :

            filtered.map((r) =>
            <tr key={r.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/reports/${r.id}`)}>
                <td className="px-4 py-3 font-mono text-primary text-xs">
                  <Link to={`/reports/${r.id}`} className="hover:underline">{r.running_number || '—'}</Link>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.l1_attended_staff_id || '—'}</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.l2_work_order_number || '—'}</td>
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