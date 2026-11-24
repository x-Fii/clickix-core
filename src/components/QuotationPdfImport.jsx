import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LINE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_code: { type: 'string' },
          item_type: { type: 'string' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unit_cost: { type: 'number' },
          total: { type: 'number' },
        },
      },
    },
  },
};

// Reads a supplier's PDF quotation and turns its line items into quotation items.
export default function QuotationPdfImport({ onImported, hasItems }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (hasItems && !window.confirm('Replace the current line items with the ones found in this PDF?')) return;

    setBusy(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_uri,
        json_schema: LINE_ITEM_SCHEMA,
      });
      if (result?.status !== 'success') throw new Error(result?.details || 'Could not read the PDF');

      const raw = Array.isArray(result.output) ? result.output : (result.output?.items || []);
      const imported = raw
        .filter(it => it && (it.description || it.item_code))
        .map(it => {
          const quantity = Number(it.quantity) || 0;
          const unitCost = Number(it.unit_cost) || 0;
          return {
            item_code: it.item_code || '',
            item_type: it.item_type || '',
            description: it.description || '',
            quantity,
            unit_cost: unitCost,
            total: Number(it.total) || quantity * unitCost,
            taxable: true,
          };
        });

      if (!imported.length) throw new Error('No line items found in this PDF');
      onImported(imported);
      toast.success(`${imported.length} line item${imported.length === 1 ? '' : 's'} imported`);
    } catch (err) {
      toast.error(err?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
        {busy ? 'Reading PDF...' : 'Import PDF'}
      </Button>
    </>
  );
}