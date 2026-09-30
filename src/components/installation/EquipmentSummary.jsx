import { useMemo, useState } from 'react';
import { Copy, Check, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function EquipmentSummary({ sections = [] }) {
  const [copied, setCopied] = useState(false);

  const { byType, totalQty, totalItems, text } = useMemo(() => {
    const flat = [];
    sections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        flat.push({ section: sec.section_name || '', ...item });
      });
    });

    const map = {};
    flat.forEach((item) => {
      const type = item.device_type || 'Unspecified';
      if (!map[type]) map[type] = { type, count: 0, qty: 0 };
      map[type].count += 1;
      map[type].qty += num(item.quantity);
    });

    const byTypeArr = Object.values(map).sort((a, b) => b.qty - a.qty);
    const totalQty = byTypeArr.reduce((s, t) => s + t.qty, 0);
    const totalItems = flat.length;

    const lines = [];
    lines.push(`EQUIPMENT INSTALLED SUMMARY`);
    lines.push(`Total items: ${totalItems} | Total quantity: ${totalQty}`);
    lines.push('');
    if (byTypeArr.length) {
      lines.push('By device type:');
      byTypeArr.forEach((t) => lines.push(`  - ${t.type}: ${t.count} item(s), qty ${t.qty}`));
      lines.push('');
    }
    sections.forEach((sec) => {
      const items = sec.items || [];
      if (!items.length) return;
      lines.push(`[${sec.section_name || 'Section'}]`);
      items.forEach((item, i) => {
        const parts = [
          item.device_type,
          item.device_name,
          item.model && `Model: ${item.model}`,
          item.sku && `SKU: ${item.sku}`,
          item.serial_number && `S/N: ${item.serial_number}`,
          item.anydesk && `Anydesk: ${item.anydesk}`,
          item.length && `Length: ${item.length}`,
          (item.quantity !== undefined && item.quantity !== '') && `Qty: ${item.quantity}`,
          (item.num_ports !== undefined && item.num_ports !== '') && `Ports: ${item.num_ports}`,
          (item.num_gang !== undefined && item.num_gang !== '') && `Gang: ${item.num_gang}`,
          item.notes && `Notes: ${item.notes}`,
        ].filter(Boolean);
        lines.push(`  ${i + 1}. ${parts.join(' | ')}`);
      });
      lines.push('');
    });

    return { byType: byTypeArr, totalQty, totalItems, text: lines.join('\n').trim() };
  }, [sections]);

  if (!totalItems) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/10 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-primary" />
          <h3 className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">Equipment Summary</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <><Check size={14} className="text-emerald-400" /> Copied</> : <><Copy size={14} /> Copy Summary</>}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total Items</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">{totalItems}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total Quantity</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">{totalQty}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Device Types</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">{byType.length}</p>
        </div>
      </div>

      {byType.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border">
              <tr className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pr-4">Device Type</th>
                <th className="py-2 pr-4">Items</th>
                <th className="py-2">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byType.map((t) => (
                <tr key={t.type}>
                  <td className="py-2 pr-4 font-medium">{t.type}</td>
                  <td className="py-2 pr-4 font-mono">{t.count}</td>
                  <td className="py-2 font-mono">{t.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}