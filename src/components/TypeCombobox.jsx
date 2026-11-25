import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TypeCombobox({ value, onChange, options = [], placeholder = 'Type', className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim();
  const lower = q.toLowerCase();
  const matches = lower ? options.filter((o) => o.toLowerCase().includes(lower)) : options;
  const exact = options.some((o) => o.toLowerCase() === lower);

  const commit = (v) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (q) commit(q);
      else if (matches[0]) commit(matches[0]);
    }
    if (e.key === 'Escape') setOpen(false);
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
          title={value || placeholder}
          className={cn(
            'flex h-8 items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-xs',
            className
          )}>
          <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
          <ChevronsUpDown size={12} className="opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5 bg-popover border-border">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or pick a type..."
          className="h-7 text-xs mb-1.5 bg-background"
        />
        <div className="max-h-56 overflow-y-auto">
          {q && !exact && (
            <button
              type="button"
              onClick={() => commit(q)}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-primary truncate">
              Use "{q}"
            </button>
          )}
          {matches.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => commit(o)}
              className="w-full flex items-center justify-between gap-2 text-left px-2 py-1.5 text-xs rounded hover:bg-accent">
              <span className="truncate">{o}</span>
              {value === o && <Check size={12} className="text-primary shrink-0" />}
            </button>
          ))}
          {matches.length === 0 && !q && <p className="px-2 py-2 text-xs text-muted-foreground">No options</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}