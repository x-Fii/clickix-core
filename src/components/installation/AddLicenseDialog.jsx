import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findLicenseNumberConflict } from '@/lib/installationStaging';

export default function AddLicenseDialog({ open, onOpenChange, inventoryItems = [], stagedLicenses = [], linkedClientId = '', linkedClientName = '', linkedStagedClientTempId = '', linkedSiteId = '', linkedSiteName = '', linkedStagedSiteTempId = '', outlet = '', onConfirm }) {
  const build = () => ({
    license_name: '',
    license_number: '',
    pc_sku: '',
    tv_sku: '',
    processor: '',
    anydesk: '',
    outlet: '',
    client_id: linkedClientId || '',
    client_name: linkedClientName || '',
    staged_client_temp_id: linkedStagedClientTempId || '',
    site_id: linkedSiteId || '',
    site_name: linkedSiteName || '',
    staged_site_temp_id: linkedStagedSiteTempId || '',
  });
  const [draft, setDraft] = useState(build);
  const [conflict, setConflict] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(d => ({
        ...build(),
        client_id: linkedClientId || d.client_id,
        client_name: linkedClientName || d.client_name,
        staged_client_temp_id: linkedStagedClientTempId || d.staged_client_temp_id,
        site_id: linkedSiteId || d.site_id,
        site_name: linkedSiteName || d.site_name,
        staged_site_temp_id: linkedStagedSiteTempId || d.staged_site_temp_id,
        outlet: outlet || d.outlet,
      }));
      setConflict(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkedClientId, linkedClientName, linkedStagedClientTempId, linkedSiteId, linkedSiteName, linkedStagedSiteTempId, outlet]);

  const setField = (field, value) => setDraft(d => ({ ...d, [field]: value }));

  const checkAndConfirm = () => {
    if (!draft.license_number.trim()) return;
    const found = findLicenseNumberConflict(draft.license_number, { inventoryItems, stagedLicenses });
    setConflict(found);
    if (found) return; // block; user must resolve before confirming
    onConfirm({ ...draft, license_number: draft.license_number.trim() });
  };

  const handleClose = (open) => {
    if (!open) { setDraft(build()); setConflict(null); }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add New License</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1 sm:col-span-2">
            <Label>License Name</Label>
            <Input value={draft.license_name} onChange={e => setField('license_name', e.target.value)} placeholder="License / system name" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>License Number *</Label>
            <Input value={draft.license_number} onChange={e => { setField('license_number', e.target.value); setConflict(null); }} placeholder="Globally unique license number" />
            {conflict && (
              <p className="text-xs text-destructive">
                {conflict.kind === 'inventory' ? 'An existing inventory license' : 'A staged license'} already uses this number: {conflict.record.license_name || conflict.record.company_name}. Resolve the conflict before staging.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>PC SKU</Label>
            <Input value={draft.pc_sku} onChange={e => setField('pc_sku', e.target.value)} placeholder="PC SKU" />
          </div>
          <div className="space-y-1">
            <Label>TV SKU</Label>
            <Input value={draft.tv_sku} onChange={e => setField('tv_sku', e.target.value)} placeholder="TV SKU" />
          </div>
          <div className="space-y-1">
            <Label>Processor</Label>
            <Input value={draft.processor} onChange={e => setField('processor', e.target.value)} placeholder="Processor / model" />
          </div>
          <div className="space-y-1">
            <Label>AnyDesk</Label>
            <Input value={draft.anydesk} onChange={e => setField('anydesk', e.target.value)} placeholder="AnyDesk ID" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Outlet</Label>
            <Input value={draft.outlet} onChange={e => setField('outlet', e.target.value)} placeholder="Outlet (distinct from site name)" />
          </div>
          <div className="space-y-1 sm:col-span-2 text-xs text-muted-foreground border-t border-border pt-2">
            Linked to {draft.client_name || '—'} · {draft.site_name || '—'}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button type="button" onClick={checkAndConfirm} disabled={!draft.license_number.trim() || !!conflict}>Stage License</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}