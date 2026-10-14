import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findSimilarSites } from '@/lib/installationStaging';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 're-instating', label: 'Re-Instating' },
  { value: 're-instated', label: 'Re-Instated' },
];

export default function AddSiteDialog({ open, onOpenChange, clients = [], stagedClients = [], sites = [], isAdmin = false, linkedClientId = '', linkedStagedClientTempId = '', onConfirm }) {
  const build = () => ({
    client_id: linkedClientId || '',
    staged_client_temp_id: linkedStagedClientTempId || '',
    site_name: '',
    site_location: '',
    region: '',
    state: '',
    pic_name: '',
    pic_phone: '',
    notes: '',
    status: ['active'],
  });
  const [draft, setDraft] = useState(build);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    if (open) {
      setDraft(d => ({
        ...build(),
        client_id: linkedClientId || d.client_id,
        staged_client_temp_id: linkedStagedClientTempId || d.staged_client_temp_id,
      }));
      setConflicts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkedClientId, linkedStagedClientTempId]);

  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  // Combine existing + staged clients for the dropdown.
  const clientOptions = [
    ...clients.map(c => ({ id: c.id, name: c.company_name, kind: 'existing' })),
    ...stagedClients.map(c => ({ id: c.temp_id, name: c.company_name, kind: 'staged' })),
  ];
  const selectedClient = clientOptions.find(c => c.id === draft.client_id);
  const selectedClientName = selectedClient?.name || '';

  const handleConfirm = () => {
    if (!draft.client_id || !draft.site_name.trim()) return;
    const matches = findSimilarSites(draft.site_name, draft.client_id, sites);
    setConflicts(matches);
    onConfirm({ ...draft, site_name: draft.site_name.trim(), client_name: selectedClientName }, matches);
  };

  const handleClose = (open) => {
    if (!open) { setDraft(build()); setConflicts([]); }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add New Site</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1 sm:col-span-2">
            <Label>Client *</Label>
            <Select value={draft.client_id || undefined} onValueChange={v => setField('client_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clientOptions.map(c => (
                  <SelectItem key={`${c.kind}-${c.id}`} value={c.id}>
                    {c.name}{c.kind === 'staged' ? ' (staged)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Site / Outlet Name *</Label>
            <Input value={draft.site_name} onChange={e => setField('site_name', e.target.value)} placeholder="Site name" />
            {conflicts.length > 0 && (
              <p className="text-xs text-amber-500">A site with this name already exists under this client. Confirm to stage anyway.</p>
            )}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Site Location</Label>
            <Input value={draft.site_location} onChange={e => setField('site_location', e.target.value)} placeholder="Address" />
          </div>
          <div className="space-y-1">
            <Label>Region</Label>
            <Input value={draft.region} onChange={e => setField('region', e.target.value)} placeholder="Region" />
          </div>
          <div className="space-y-1">
            <Label>State</Label>
            <Input value={draft.state} onChange={e => setField('state', e.target.value)} placeholder="State" />
          </div>
          <div className="space-y-1">
            <Label>PIC Name</Label>
            <Input value={draft.pic_name} onChange={e => setField('pic_name', e.target.value)} placeholder="Person in charge" />
          </div>
          <div className="space-y-1">
            <Label>PIC Phone</Label>
            <Input value={draft.pic_phone} onChange={e => setField('pic_phone', e.target.value)} placeholder="Phone" />
          </div>
          {isAdmin && (
            <div className="space-y-1 sm:col-span-2">
              <Label>Status (admin override)</Label>
              <Select value={(draft.status || ['active'])[0]} onValueChange={v => setField('status', [v])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea value={draft.notes} onChange={e => setField('notes', e.target.value)} placeholder="Notes" rows={2} className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={!draft.client_id || !draft.site_name.trim()}>Stage Site</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}