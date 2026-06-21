import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ShoppingCart, Eye, Trash2, Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';
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
  disburse: { label: 'Disbursed', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/25', dot: 'bg-violet-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-400' }
};

const STAT_CARDS = [
{ key: 'all', label: 'Total PRs', color: 'border-primary/40 bg-primary/5', textColor: 'text-primary' },
{ key: 'draft', label: 'Draft', color: 'border-slate-500/30 bg-slate-500/5', textColor: 'text-slate-400' },
{ key: 'submitted', label: 'Submitted', color: 'border-blue-500/30 bg-blue-500/5', textColor: 'text-blue-400' },
{ key: 'approved', label: 'Approved', color: 'border-emerald-500/30 bg-emerald-500/5', textColor: 'text-emerald-400' },
{ key: 'disburse', label: 'Disbursed', color: 'border-violet-500/30 bg-violet-500/5', textColor: 'text-violet-400' },
{ key: 'rejected', label: 'Rejected', color: 'border-red-500/30 bg-red-500/5', textColor: 'text-red-400' }];


function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center justify-center w-24 text-[11px] font-mono border rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>);

}

function CalendarView({ prs, onSelect }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startPad = startOfMonth(month).getDay(); // 0=Sun

  const getPRsForDay = (day) => prs.filter((pr) => pr.pr_date && isSameDay(parseISO(pr.pr_date), day));

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
        <h3 className="font-semibold text-sm">{format(month, 'MMMM yyyy')}</h3>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) =>
        <div key={d} className="text-center text-[10px] font-mono text-muted-foreground uppercase tracking-wider py-1">{d}</div>
        )}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {Array.from({ length: startPad }).map((_, i) =>
        <div key={`pad-${i}`} className="bg-background/50 min-h-[72px]" />
        )}
        {days.map((day) => {
          const dayPRs = getPRsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`bg-card min-h-[72px] p-1.5 ${!isSameMonth(day, month) ? 'opacity-40' : ''}`}>
              <div className={`text-xs font-mono w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayPRs.slice(0, 3).map((pr) => {
                  const cfg = STATUS_CONFIG[pr.status] || STATUS_CONFIG.draft;
                  return (
                    <button
                      key={pr.id}
                      onClick={() => onSelect(pr)}
                      className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded truncate font-mono border ${cfg.cls} hover:opacity-80 transition-opacity`}>
                      
                      {pr.pr_number}
                    </button>);

                })}
                {dayPRs.length > 3 &&
                <p className="text-[9px] text-muted-foreground font-mono px-1">+{dayPRs.length - 3} more</p>
                }
              </div>
            </div>);

        })}
      </div>
      {/* Legend */}
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

export default function PurchaseRequisitions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: prs = [], isLoading } = useQuery({
    queryKey: ['purchase-requisitions'],
    queryFn: () => base44.entities.PurchaseRequisition.list('-created_date')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseRequisition.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-requisitions'] })
  });

  const counts = {
    all: prs.length,
    draft: prs.filter((p) => p.status === 'draft').length,
    submitted: prs.filter((p) => p.status === 'submitted').length,
    approved: prs.filter((p) => p.status === 'approved').length,
    disburse: prs.filter((p) => p.status === 'disburse').length,
    rejected: prs.filter((p) => p.status === 'rejected').length
  };

  const totalValue = prs.reduce((s, p) => s + (p.grand_total || 0), 0);
  const approvedValue = prs.filter((p) => ['approved', 'disburse'].includes(p.status)).reduce((s, p) => s + (p.approved_amount ?? p.grand_total ?? 0), 0);
  const disburseValue = prs.filter((p) => p.status === 'disburse').reduce((s, p) => s + (p.disburse_amount ?? p.approved_amount ?? p.grand_total ?? 0), 0);

  const filtered = prs.filter((p) => {
    const matchSearch = !search ||
    p.pr_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.requester_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
    p.sr_number?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Purchase Requisitions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">PR documents linked to quotations and service reports</p>
        </div>
        <Button onClick={() => navigate('/pr/new')} className="gap-2">
          <Plus size={14} /> New PR
        </Button>
      </div>

      {/* Status Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {STAT_CARDS.map(({ key, label, color, textColor }) =>
        <button
          key={key}
          onClick={() => setStatusFilter(key)}
          className={`p-4 rounded-xl border text-left transition-all ${color} ${statusFilter === key ? 'ring-2 ring-primary/60 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
          
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${textColor}`}>{counts[key]}</p>
          </button>
        )}
      </div>

      {/* Value Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Total PR Value</p>
          <p className="text-xl font-bold text-foreground mt-1">MYR {totalValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Approved Value</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">MYR {approvedValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-card border border-violet-500/30 bg-violet-500/5 rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Disbursed Value</p>
          <p className="text-xl font-bold text-violet-400 mt-1">MYR {disburseValue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* View Toggle + Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by PR no., requester, quotation, or SR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background" />
          
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-2 flex items-center gap-1.5 text-xs transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
            
            <List size={13} /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-2 flex items-center gap-1.5 text-xs transition-colors ${view === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
            
            <Calendar size={13} /> Calendar
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'calendar' &&
      <CalendarView prs={filtered} onSelect={(pr) => navigate(`/pr/${pr.id}`)} />
      }

      {/* List View */}
      {view === 'list' && (
      isLoading ?
      <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div> :
      filtered.length === 0 ?
      <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No purchase requisitions found</p>
          </div> :

      <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">PR No.</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Quotation</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">SR / IR No.</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Requester</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Total (MYR)</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Approved (MYR)</th>
                  <th className="text-right px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Disbursed (MYR)</th>
                  <th className="text-left px-4 py-3 text-xs font-mono text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pr) =>
            <tr key={pr.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => navigate(`/pr/${pr.id}`)}>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{pr.pr_number}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{pr.quotation_number || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{pr.sr_number || pr.ir_number || '—'}</td>
                    <td className="px-4 py-3">{pr.requester_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{pr.pr_date ? format(parseISO(pr.pr_date), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{pr.grand_total != null ? pr.grand_total.toFixed(2) : '—'}</td>
                    <td className="text-right font-mono text-sm text-emerald-400 pt-3 pr-3 pb-3 pl-12">{pr.approved_amount != null ? pr.approved_amount.toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-violet-400">{pr.disburse_amount != null ? pr.disburse_amount.toFixed(2) : '—'}</td>
                    <td className="pt-3 pb-3 pl-4"><StatusBadge status={pr.status} /></td>
                    <td className="py-3 px-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        

                  
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(pr.id)}>
                          <Trash2 size={13} />
                        </Button>
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
            <AlertDialogTitle>Delete Purchase Requisition?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {deleteMutation.mutate(deleteId);setDeleteId(null);}}
              className="bg-destructive hover:bg-destructive/90">
              
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}