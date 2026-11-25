import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/SearchableSelect';
import { fetchNextRunningNumber } from '@/lib/runningNumber';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EMPTY = () => ({
  quotation_number: '',
  quotation_date: format(new Date(), 'yyyy-MM-dd'),
  client_name: '',
  site_name: '',
  grand_total: ''
});

export default function NewQuotationDialog({ open, onOpenChange, clients = [], sites = [], onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY());
    const yy = String(new Date().getFullYear()).slice(-2);
    fetchNextRunningNumber('Quotation', 'quotation_number', `QT${yy}-`).then((num) =>
      setForm((f) => (f.quotation_number ? f : { ...f, quotation_number: num }))
    );
  }, [open]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const siteOptions = sites
    .filter((s) => !form.client_name || s.client_name === form.client_name)
    .map((s) => ({ value: s.site_name, label: s.site_name, sublabel: s.client_name }));

  const handleCreate = async () => {
    if (!form.quotation_number.trim()) {
      toast.error('Quotation number is required');
      return;
    }
    setSaving(true);
    const amount = parseFloat(form.grand_total) || 0;
    const created = await base44.entities.Quotation.create({
      quotation_number: form.quotation_number.trim(),
      quotation_date: form.quotation_date,
      client_name: form.client_name,
      site_name: form.site_name,
      status: 'draft',
      items: [],
      subtotal: amount,
      grand_total: amount
    });
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
    onCreated(created);
    toast.success(`Quotation ${created.quotation_number} registered and linked`);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Register New Quotation</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Quotation No.</Label>
            <Input value={form.quotation_number} onChange={(e) => setF('quotation_number', e.target.value)} className="bg-background font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Quotation Date</Label>
            <Input type="date" value={form.quotation_date} onChange={(e) => setF('quotation_date', e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Client</Label>
            <SearchableSelect
              value={form.client_name}
              onChange={(v) => setForm((f) => ({ ...f, client_name: v, site_name: '' }))}
              options={clients.map((c) => ({ value: c.company_name, label: c.company_name, sublabel: c.contact_person }))}
              placeholder="Select client..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Site</Label>
            <SearchableSelect
              value={form.site_name}
              onChange={(v) => setF('site_name', v)}
              options={siteOptions}
              placeholder="Select site..."
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-mono">Quotation Amount (MYR)</Label>
            <Input type="text" inputMode="decimal" value={form.grand_total} onChange={(e) => setF('grand_total', e.target.value)} className="bg-background text-right font-mono" placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create & Link'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}