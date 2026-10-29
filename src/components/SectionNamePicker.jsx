import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronDown } from 'lucide-react';

export default function SectionNamePicker({ value, options = [], onChange, placeholder = 'Select license name' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = options.filter((option) => option.toLowerCase().includes(search.toLowerCase()));

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="relative flex-1 min-w-0">
      <div className="relative">
        <Input
          value={open ? search : (value || '')}
          onFocus={() => { if (!open) { setSearch(''); setOpen(true); } }}
          onClick={() => { if (!open) { setSearch(''); setOpen(true); } }}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          onBlur={() => setTimeout(close, 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="bg-background text-xs h-8 font-semibold pr-9"
        />
        <ChevronDown
          size={16}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.length ? filtered.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(name); close(); }}
              className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
            >
              {name}
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">No license found</div>
          )}
        </div>
      )}
    </div>
  );
}