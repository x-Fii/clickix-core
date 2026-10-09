import { useState, useMemo } from 'react';
import { Search, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getReliableEquipmentForContext, isLinkReliablyLinked, getLinkFor } from '@/lib/decommissionStaging';

// EquipmentPicker shows reliably linked Equipment records for the selected
// Client/Site/License first, and lets the user either link one (by id) or
// fall back to manual entry with explicit unmatched confirmation. No name
// inference; no record writes.
export default function EquipmentPicker({
  sectionIndex,
  itemIndex,
  item,
  links = [],
  equipment = [],
  clientId,
  siteId,
  inventoryId,
  onLinkEquipment,
  onConfirmUnmatched,
}) {
  const [search, setSearch] = useState('');

  const link = getLinkFor(links, sectionIndex, itemIndex);
  const linkedId = link?.equipment_id || '';
  const isLinked = isLinkReliablyLinked(link);

  const candidates = useMemo(() => {
    const list = getReliableEquipmentForContext({ equipment, clientId, siteId, inventoryId });
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(eq =>
      String(eq.device_name || '').toLowerCase().includes(q) ||
      String(eq.serial_number || '').toLowerCase().includes(q) ||
      String(eq.device_type || '').toLowerCase().includes(q)
    );
  }, [equipment, clientId, siteId, inventoryId, search]);

  return (
    <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 size={12} />
        <span className="font-semibold">Equipment Link (optional)</span>
      </div>

      {isLinked && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded px-2 py-1.5">
          <CheckCircle2 size={12} />
          <span>Linked to Equipment record. Status will update on official completion.</span>
        </div>
      )}

      {!isLinked && (item.device_name || item.serial_number) && link?.is_unmatched_confirmed && (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>Confirmed unmatched — recorded in report only. No Equipment or Inventory record will change.</span>
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 text-xs pl-8"
          placeholder="Search linked equipment (by name / serial / type)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {candidates.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {candidates.map(eq => (
            <button
              key={eq.id}
              type="button"
              onClick={() => onLinkEquipment(sectionIndex, itemIndex, eq.id)}
              className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 ${
                linkedId === eq.id ? 'bg-primary/10' : ''
              }`}
            >
              <span className="truncate">
                <span className="font-medium">{eq.device_name || eq.device_type || 'Unnamed'}</span>
                {eq.serial_number && <span className="text-muted-foreground font-mono ml-2">{eq.serial_number}</span>}
              </span>
              {linkedId === eq.id && <CheckCircle2 size={12} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {candidates.length === 0 && !isLinked && (
        <div className="text-xs text-muted-foreground py-1">
          {siteId ? 'No reliably linked Equipment found for this site/license. Enter details manually and confirm below.' : 'Select a site to search linked equipment.'}
        </div>
      )}

      {!isLinked && (item.device_name || item.serial_number) && !link?.is_unmatched_confirmed && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full text-xs"
          onClick={() => onConfirmUnmatched(sectionIndex, itemIndex)}
        >
          <AlertTriangle size={12} className="mr-1.5" /> Confirm this device is unmatched (record only)
        </Button>
      )}

      {isLinked && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="w-full text-xs text-muted-foreground"
          onClick={() => onLinkEquipment(sectionIndex, itemIndex, '')}
        >
          Unlink Equipment
        </Button>
      )}
    </div>
  );
}