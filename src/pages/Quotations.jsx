import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FileText, Eye, Trash2 } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, isWithinInterval, parseISO } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle } from
'@/components/ui/alert-dialog';

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

const statusColors = {
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  submitted: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/25'
};

const STATUSES = ['all', 'draft', 'submitted', 'approved', 'rejected'];

export default function Quotations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations'],
    queryFn: () => base44.entities.Quotation.list('-created_date')
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quotation.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] })
  });

  const range = periodRange(periodFilter);
  const inPeriod = (q) => {
    if (!range) return true;
    const d = q.quotation_date ? parseISO(q.quotation_date) : (q.created_date ? parseISO(q.created_date) : null);
    return d && isWithinInterval(d, range);
  };

  const filtered = quotations.filter((q) =>
  (clientFilter === 'all' || q.client_id === clientFilter) &&
  (statusFilter === 'all' || q.status === statusFilter) &&
  inPeriod(q) &&
  (q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
  q.client_name?.toLowerCase().includes(search.toLowerCase()) ||
  q.sr_number?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">Quotations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">All quotations linked to service reports</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons
            data={filtered}
            fileName="quotations"
            title="Quotations"
            columns={[
              { header: 'Quotation No.', accessor: 'quotation_number' },
              { header: 'Linked Report', accessor: (r) => r.sr_number || r.ir_number || '' },
              { header: 'Client', accessor: 'client_name' },
              { header: 'Site', accessor: 'site_name' },
              { header: 'Date', accessor: 'quotation_date' },
              { header: 'Total (MYR)', accessor: (r) => (r.grand_total != null ? r.grand_total.toFixed(2) : '') },
              { header: 'Status', accessor: 'status' },
            ]}
          />
          <Button onClick={() => navigate('/quotations/new')} className="gap-2">
            <Plus size={14} /> New Quotation
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by quotation no., client, or SR no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background" />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-44 bg-background">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) =>
            <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ?
      <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div> :
      filtered.length === 0 ?
      <div className="text-center py-20 text-muted-foreground">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No quotations found</p>
        </div> :

      <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Quotation No.</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Linked Report</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Site</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Total (MYR)</th>
                <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) =>
            <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary cursor-pointer hover:underline" onClick={() => navigate(`/quotations/${q.id}`)}>{q.quotation_number}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {q.sr_number ? <span className="font-mono text-blue-400">{q.sr_number}</span> : q.ir_number ? <span className="font-mono text-indigo-400">{q.ir_number}</span> : '—'}
                  </td>
                  <td className="px-4 py-3">{q.client_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{q.site_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{q.quotation_date ? format(new Date(q.quotation_date), 'dd MMM yyyy') : '—'}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{q.grand_total != null ? q.grand_total.toFixed(2) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex justify-center w-20 py-0.5 text-[11px] font-mono border rounded-full ${statusColors[q.status] || statusColors.draft}`}>
                      {q.status?.charAt(0).toUpperCase() + q.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      

                  
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(q.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
            )}
            </tbody>
          </table>
        </div>
      }

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {deleteMutation.mutate(deleteId);setDeleteId(null);}} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}