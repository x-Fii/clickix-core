import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Receipt, Eye, Trash2, Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from 'date-fns';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle } from
'@/components/ui/alert-dialog';

const STATUS_CONFIG = {
  draft: { label: 'Draft', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/25', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25', dot: 'bg-blue-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-400' },
  paid: { label: 'Paid', cls: 'bg-teal-500/15 text-teal-400 border-teal-500/25', dot: 'bg-teal-400' }
};

const STAT_CARDS = [
{ key: 'all', label: 'Total Claims', color: 'border-primary/40 bg-primary/5', textColor: 'text-primary' },
{ key: 'draft', label: 'Draft', color: 'border-slate-500/30 bg-slate-500/5', textColor: 'text-slate-400' },
{ key: 'submitted', label: 'Submitted', color: 'border-blue-500/30 bg-blue-500/5', textColor: 'text-blue-400' },
{ key: 'approved', label: 'Approved', color: 'border-emerald-500/30 bg-emerald-500/5', textColor: 'text-emerald-400' },
{ key: 'paid', label: 'Paid', color: 'border-teal-500/30 bg-teal-500/5', textColor: 'text-teal-400' },
{ key: 'rejected', label: 'Rejected', color: 'border-red-500/30 bg-red-500/5', textColor: 'text-red-400' }];


function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono border rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>);

}

function CalendarView({ claims, onSelect }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startPad = startOfMonth(month).getDay();

  const getClaimsForDay = (day) => claims.filter((c) => c.claim_date && isSameDay(parseISO(c.claim_date), day));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
        <h3 className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</h3>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) =>
        <div key={d} className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider py-1">{d}</div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: startPad }).map((_, i) =>
        <div key={`pad-${i}`} className="bg-background/50 min-h-[72px]" />
        )}
        {days.map((day) => {
          const dayClaims = getClaimsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`bg-card min-h-[72px] p-1.5 ${!isSameMonth(day, month) ? 'opacity-40' : ''}`}>
              <div className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayClaims.slice(0, 3).map((c) => {
                  const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
                  return (
                    <button key={c.id} onClick={() => onSelect(c)}
                    className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded truncate font-mono border ${cfg.cls} hover:opacity-80 transition-opacity`}>
                      {c.claim_number}
                    </button>);

                })}
                {dayClaims.length > 3 && <p className="text-[9px] text-muted-foreground font-mono px-1">+{dayClaims.length - 3} more</p>}
              </div>
            </div>);

        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-border">
        {Object.entries(STATUS_CONFIG).map(([k, v]) =>
        <div key={k} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${v.dot}`} />
            <span className="text-xs text-muted-foreground">{v.label}</span>
          </div>
        )}
      </div>
    </div>);

}

export default function Claims() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState('list');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list('-created_date')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Claim.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['claims'] })
  });

  const counts = {
    all: claims.length,
    draft: claims.filter((c) => c.status === 'draft').length,
    submitted: claims.filter((c) => c.status === 'submitted').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    paid: claims.filter((c) => c.status === 'paid').length,
    rejected: claims.filter((c) => c.status === 'rejected').length
  };

  const totalValue = claims.reduce((s, c) => s + (c.grand_total || 0), 0);
  const paidValue = claims.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.grand_total || 0), 0);

  const filtered = claims.filter((c) => {
    const matchSearch = !search ||
    c.claim_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.claimant_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.pr_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.sr_number?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_name?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Claims</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Reimbursement and payment claims linked to PRs</p>
        </div>
        <Button onClick={() => navigate('/claims/new')} className="gap-2">
          <Plus size={14} /> New Claim
        </Button>
      </div>

      {/* Status Dashboard */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {STAT_CARDS.map(({ key, label, color, textColor }) =>
        <button key={key} onClick={() => setStatusFilter(key)}
        className={`p-4 rounded-xl border text-left transition-all ${color} ${statusFilter === key ? 'ring-2 ring-primary/60 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider leading-tight">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${textColor}`}>{counts[key]}</p>
          </button>
        )}
      </div>

      {/* Value Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Total Claim Value</p>
          <p className="text-xl font-bold text-foreground mt-1">MYR {totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Paid Value</p>
          <p className="text-xl font-bold text-teal-400 mt-1">MYR {paidValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* View Toggle + Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by claim no., claimant, PR, SR, or client..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background" />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setView('list')}
          className={`px-3 py-2 flex items-center gap-1.5 text-xs transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
            <List size={13} /> List
          </button>
          <button onClick={() => setView('calendar')}
          className={`px-3 py-2 flex items-center gap-1.5 text-xs transition-colors ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
            <Calendar size={13} /> Calendar
          </button>
        </div>
      </div>

      {view === 'calendar' && <CalendarView claims={filtered} onSelect={(c) => navigate(`/claims/${c.id}`)} />}

      {view === 'list' && (
      isLoading ?
      <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div> :
      filtered.length === 0 ?
      <div className="text-center py-20 text-muted-foreground">
            <Receipt size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No claims found</p>
          </div> :

      <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Claim No.', 'PR No.', 'SR No.', 'Claimant', 'Type', 'Date', 'Total (MYR)', 'Status', ''].map((h) =>
              <th key={h} className={`px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider ${h === 'Total (MYR)' ? 'text-right' : h === '' ? '' : 'text-left'}`}>{h}</th>
              )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) =>
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{c.claim_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.pr_number || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.sr_number || '—'}</td>
                    <td className="px-4 py-3">{c.claimant_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.claim_type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.claim_date ? format(parseISO(c.claim_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{c.grand_total != null ? c.grand_total.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
            )}
              </tbody>
            </table>
          </div>)

      }

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Claim?</AlertDialogTitle>
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