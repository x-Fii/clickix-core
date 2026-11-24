import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const QUOTATION_SCHEMA = {
  type: 'object',
  properties: {
    quotation_number: { type: 'string', description: 'The quotation / reference number printed on the document' },
    client_name: { type: 'string', description: 'The client or company the quotation is addressed to' },
    site_name: { type: 'string' },
    project_name: { type: 'string', description: 'The project name printed on the quotation, if any' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item_code: {
            type: 'string',
            description: 'The exact product / item / part code printed in the code column of that row, for example "60020691" or "MSV-042". Never the row number.',
          },
          item_type: { type: 'string', description: 'The category or unit printed for the row, for example Hardware, Software, Services, Unit' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unit_cost: { type: 'number' },
          total: { type: 'number' },
        },
      },
    },
  },
};

const DETAILS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          item_code: { type: 'string' },
          item_type: { type: 'string' },
        },
      },
    },
  },
};

const readCode = (it) => {
  const raw = it.item_code ?? it.code ?? it.itemCode ?? it.part_no ?? it.part_number ?? it.sku ?? it.item_ref ?? '';
  return String(raw).trim();
};

const readType = (it) => {
  const raw = it.item_type ?? it.type ?? it.itemType ?? it.category ?? it.uom ?? it.unit ?? '';
  return String(raw).trim();
};

// Second pass: re-read the PDF for the code and type columns of rows the first pass left blank.
async function fillMissingDetails(items, fileUri) {
  const rows = items.map((it, index) => ({
    index,
    description: it.description,
    quantity: it.quantity,
    unit_cost: it.unit_cost,
    total: it.total,
  }));

  const res = await base44.integrations.Core.InvokeLLM({
    prompt: `This PDF is a supplier quotation with a table of line items. For every row listed below return:\n- item_code: the product / item / part code printed in that row's code column, exactly as written (examples: "60020691", "MSV-042", "TV-65-4K"). Never the row number.\n- item_type: the type, category or unit printed for that row (examples: Hardware, Software, Services, Unit).\nUse an empty string when a row does not print one. Return one entry per row, repeating the given index exactly.\n\nRows:\n${JSON.stringify(rows)}`,
    file_urls: [fileUri],
    response_json_schema: DETAILS_SCHEMA,
  });

  (res?.items || []).forEach(entry => {
    const idx = Number(entry?.index);
    const target = Number.isInteger(idx) ? items[idx] : null;
    if (!target) return;
    const code = String(entry?.item_code || '').trim();
    const type = String(entry?.item_type || '').trim();
    if (!target.item_code && code) target.item_code = code;
    if (!target.item_type && type) target.item_type = type;
  });
}

// Reads a supplier's PDF quotation and returns its header details and line items.
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
        json_schema: QUOTATION_SCHEMA,
      });
      if (result?.status !== 'success') throw new Error(result?.details || 'Could not read the PDF');

      const out = Array.isArray(result.output) ? { items: result.output } : (result.output || {});
      const items = (out.items || [])
        .filter(it => it && (it.description || readCode(it)))
        .map(it => {
          const quantity = Number(it.quantity) || 0;
          const unitCost = Number(it.unit_cost) || 0;
          return {
            item_code: readCode(it),
            item_type: readType(it),
            description: it.description || '',
            quantity,
            unit_cost: unitCost,
            total: Number(it.total) || quantity * unitCost,
            taxable: true,
          };
        });

      if (!items.length) throw new Error('No line items found in this PDF');

      let missingCodes = items.filter(it => !it.item_code).length;
      let missingTypes = items.filter(it => !it.item_type).length;
      if (missingCodes || missingTypes) {
        try {
          await fillMissingDetails(items, file_uri);
          missingCodes = items.filter(it => !it.item_code).length;
          missingTypes = items.filter(it => !it.item_type).length;
        } catch {
          // keep the items as read rather than failing the whole import
        }
      }

      onImported({
        items,
        header: {
          quotation_number: (out.quotation_number || '').trim(),
          client_name: (out.client_name || '').trim(),
          site_name: (out.site_name || '').trim(),
          project_name: (out.project_name || '').trim(),
        },
      });

      const gaps = [
        missingCodes ? `${missingCodes} without a code` : '',
        missingTypes ? `${missingTypes} without a type` : '',
      ].filter(Boolean).join(', ');
      toast.success(`${items.length} line item${items.length === 1 ? '' : 's'} imported${gaps ? ` (${gaps})` : ''}`);
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