import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findSimilarClients } from '@/lib/installationStaging';

const SLA_OPTIONS = ['subscribe', 'on-demand'];
const CMS_OPTIONS = ['CS Play', 'CS Sign Hub', 'CS Deals', 'CS Context', 'OmniBuy', 'DOTS'];
const HARDWARE_OPTIONS = ['PC', 'Cable', 'Controller', 'TV', 'LED', 'Network Device'];

const blank = () => ({
  company_name: '',
  contact_person: '',
  pic_designation: '',
  contact_email: '',
  contact_phone: '',
  company_website: '',
  sla: '',
  cms_subscriptions: [],
  hardware: [],
  address: '',
  notes: '',
});

export default function AddClientDialog({ open, onOpenChange, clients = [], onConfirm }) {
  const [draft, setDraft] = useState(blank());
  const [conflicts, setConflicts] = useState([]);

  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const toggleArray = (field, value) => setDraft(d => {
    const arr = d[field] || [];
    return { ...d, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
  });

  const handleConfirm = () => {
    if (!draft.company_name.trim()) return;
    const matches = findSimilarClients(draft.company_name, clients);
    setConflicts(matches);
    onConfirm({ ...draft, company_name: draft.company_name.trim() }, matches);
  };

  const handleClose = (open) => {
    if (!open) { setDraft(blank()); setConflicts([]); }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1 sm:col-span-2">
            <Label>Company Name *</Label>
            <Input value={draft.company_name} onChange={e => setField('company_name', e.target.value)} placeholder="Company name" />
            {conflicts.length > 0 && (
              <p className="text-xs text-amber-500">A client with this name already exists. Confirm to stage anyway.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Contact Person</Label>
            <Input value={draft.contact_person} onChange={e => setField('contact_person', e.target.value)} placeholder="Contact person" />
          </div>
          <div className="space-y-1">
            <Label>PIC Designation</Label>
            <Input value={draft.pic_designation} onChange={e => setField('pic_designation', e.target.value)} placeholder="Designation" />
          </div>
          <div className="space-y-1">
            <Label>Contact Email</Label>
            <Input type="email" value={draft.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder="Email" />
          </div>
          <div className="space-y-1">
            <Label>Contact Phone</Label>
            <Input value={draft.contact_phone} onChange={e => setField('contact_phone', e.target.value)} placeholder="Phone" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Company Website</Label>
            <Input value={draft.company_website} onChange={e => setField('company_website', e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1">
            <Label>SLA</Label>
            <Select value={draft.sla || undefined} onValueChange={v => setField('sla', v)}>
              <SelectTrigger><SelectValue placeholder="Select SLA" /></SelectTrigger>
              <SelectContent>{SLA_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>CMS Subscriptions</Label>
            <div className="flex flex-wrap gap-1.5 border border-input rounded-md p-2 min-h-9">
              {CMS_OPTIONS.map(o => (
                <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={(draft.cms_subscriptions || []).includes(o)} onChange={() => toggleArray('cms_subscriptions', o)} className="accent-primary" />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Hardware</Label>
            <div className="flex flex-wrap gap-1.5">
              {HARDWARE_OPTIONS.map(o => (
                <label key={o} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={(draft.hardware || []).includes(o)} onChange={() => toggleArray('hardware', o)} className="accent-primary" />
                  {o}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Address</Label>
            <Textarea value={draft.address} onChange={e => setField('address', e.target.value)} placeholder="Address" rows={2} className="text-sm" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={draft.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes" rows={2} className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={!draft.company_name.trim()}>Stage Client</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}