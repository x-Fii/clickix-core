import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// FullSiteConfirmDialog requires explicit confirmation before a full-site
// decommission is allowed. No Site or Equipment status changes happen here.
export default function FullSiteConfirmDialog({ open, onOpenChange, siteName, activeEquipmentCount, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" /> Confirm Full Site Decommission
          </DialogTitle>
          <DialogDescription>
            This will decommission the entire site <span className="font-semibold text-foreground">{siteName || 'this site'}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground py-2">
          <p>After official report completion:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The Site status will be set to <span className="font-semibold text-foreground">Inactive</span>.</li>
            <li>All reliably linked Active Equipment records for this site will be set to <span className="font-semibold text-foreground">Inactive</span>, including grouped quantity records.</li>
            <li>Unmatched historical equipment recorded in this report will <span className="font-semibold text-foreground">not</span> be inferred or modified.</li>
            <li>Absence of Equipment records does not mean the site had no installed equipment.</li>
          </ul>
          <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
            Only administrators may override the default Site status after completion.
          </p>
          {activeEquipmentCount > 0 && (
            <p className="text-xs text-primary pt-1">{activeEquipmentCount} active Equipment record(s) reliably linked to this site.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={() => { onConfirm(); onOpenChange(false); }}>Confirm Full Site Decommission</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}