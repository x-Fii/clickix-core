import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  emptyText = 'No matches found',
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const selected = options.find((o) => o.value === value);
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(q))
    : options;

  const pick = (v) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm',
            className
          )}>
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={14} className="opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-1.5 bg-popover border-border">
        <div className="relative mb-1.5">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search..."
            className="h-7 pl-6 text-xs bg-background"
          />
        </div>
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{emptyText}</p>}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              className="w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 text-xs rounded hover:bg-accent">
              <span className="truncate">
                {o.label}
                {o.sublabel ? <span className="text-muted-foreground"> · {o.sublabel}</span> : null}
              </span>
              {value === o.value && <Check size={12} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}