import { cn } from '@/lib/utils';

const statusConfig = {
  reported:  { label: 'Reported',  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  resolved:  { label: 'Resolved',  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
  escalated: { label: 'Escalated', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  quote:     { label: 'Quote',     cls: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  approved:  { label: 'Approved',  cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25' },
  schedule:  { label: 'Scheduled', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25' },
  complete:  { label: 'Complete',  cls: 'bg-green-500/15 text-green-400 border-green-500/25' },
};

export default function StatusBadge({ status, size = 'sm' }) {
  const cfg = statusConfig[status] || { label: status, cls: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={cn(
      'inline-flex items-center font-mono border rounded-full',
      size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
      cfg.cls
    )}>
      {cfg.label}
    </span>
  );
}