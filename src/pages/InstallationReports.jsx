import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from
'@/components/ui/alert-dialog';

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  scheduled: { label: 'Scheduled', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  completed: { label: 'Completed', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-red-500/20 text-red-300 border-red-500/30' }
};

const TYPE_CONFIG = {
  commissioning: { label: 'Commissioning', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  decommissioning: { label: 'Decommissioning', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' }
};

export default function InstallationReports() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['installation-reports'],
    queryFn: () => base44.entities.InstallationReport.list('-created_date', 200)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InstallationReport.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['installation-reports'])
  });

  const filtered = reports.filter((r) =>
  [r.report_number, r.client_name, r.site_name, r.attended_staff_name].
  join(' ').toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    scheduled: reports.filter((r) => r.status === 'scheduled').length,
    completed: reports.filter((r) => r.status === 'completed').length
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
        <Button asChild>
          <Link to="/installation/new"><Plus size={16} className="mr-1" /> New Report</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
        { label: 'Total', value: counts.all, color: 'text-foreground' },
        { label: 'Pending', value: counts.pending, color: 'text-slate-400' },
        { label: 'Scheduled', value: counts.scheduled, color: 'text-blue-400' },
        { label: 'Completed', value: counts.completed, color: 'text-emerald-400' }].
        map((s) =>
        <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search reports…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              {['Report No.', 'Type', 'Client', 'Site', 'Date', 'Technician', 'Status', ''].map((h) =>
              <th key={h} className="text-left px-4 py-3 text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ?
            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">Loading…</td></tr> :
            filtered.length === 0 ?
            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No installation reports found.</td></tr> :
            filtered.map((r) => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const tc = TYPE_CONFIG[r.report_type] || TYPE_CONFIG.commissioning;
              return (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-primary text-xs">
                    <Link to={`/installation/${r.id}`} className="hover:underline">{r.report_number || '—'}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${tc.className}`}>{tc.label}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-xs">{r.client_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.site_name || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.installation_date || r.scheduled_date || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.attended_staff_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${sc.className}`}>{sc.label}</Badge>
                  </td>
                  

















                  
                </tr>);

            })}
          </tbody>
        </table>
      </div>
    </div>);

}