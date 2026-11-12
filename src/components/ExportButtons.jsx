import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';

function escapeCSV(v) {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCSV(data, columns) {
  const header = columns.map((c) => escapeCSV(c.header)).join(',');
  const rows = data.map((row) =>
    columns.map((c) => escapeCSV(typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor])).join(',')
  );
  return [header, ...rows].join('\n');
}

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildPDF(title, data, columns) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 32;
  const tableW = pageW - margin * 2;
  const rowH = 20;
  const cellPad = 5;

  // Column widths weighted by how much text each column actually holds
  const weights = columns.map((c) => {
    let maxLen = String(c.header || '').length;
    data.slice(0, 300).forEach((row) => {
      const v = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      maxLen = Math.max(maxLen, String(v == null ? '' : v).length);
    });
    return Math.min(Math.max(maxLen, 7), 45);
  });
  const weightTotal = weights.reduce((s, w) => s + w, 0) || 1;
  const raw = weights.map((w) => Math.max(34, (tableW * w) / weightTotal));
  const rawTotal = raw.reduce((s, w) => s + w, 0);
  const widths = raw.map((w) => (w * tableW) / rawTotal);

  // Single-line cells: text that does not fit is trimmed with an ellipsis
  const fit = (value, maxW) => {
    let s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (doc.getTextWidth(s) <= maxW) return s;
    while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  };

  const drawHeaderRow = (startY, first) => {
    let y = startY;
    if (first) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(17, 24, 39);
      doc.text(title, margin, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(107, 114, 128);
      doc.text(`Generated ${new Date().toLocaleString()} · ${data.length} records`, margin, y);
      y += 16;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`${title} (continued)`, margin, y);
      y += 10;
    }
    doc.setFillColor(238, 241, 246);
    doc.rect(margin, y, tableW, rowH, 'F');
    doc.setTextColor(55, 65, 81);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    let x = margin;
    columns.forEach((c, i) => {
      const w = widths[i];
      const label = fit(c.header, w - cellPad * 2);
      if (c.align === 'right') doc.text(label, x + w - cellPad, y + 13, { align: 'right' });
      else doc.text(label, x + cellPad, y + 13);
      x += w;
    });
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, y + rowH, margin + tableW, y + rowH);
    return y + rowH;
  };

  let y = drawHeaderRow(40, true);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  data.forEach((row, ri) => {
    if (y + rowH > pageH - margin - 14) {
      doc.addPage();
      y = drawHeaderRow(40, false);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }
    if (ri % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, tableW, rowH, 'F');
    }
    doc.setTextColor(31, 41, 55);
    let x = margin;
    columns.forEach((c, i) => {
      const w = widths[i];
      const v = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      const text = fit(v, w - cellPad * 2);
      if (c.align === 'right') doc.text(text, x + w - cellPad, y + 13, { align: 'right' });
      else doc.text(text, x + cellPad, y + 13);
      x += w;
    });
    y += rowH;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin, pageH - 16, { align: 'right' });
  }

  return doc;
}

export default function ExportButtons({ data, columns, title, fileName = 'export' }) {
  const safe = fileName.replace(/[^a-z0-9_-]/gi, '_');
  const empty = !data || data.length === 0;

  const handleCSV = () => {
    const csv = buildCSV(data, columns);
    triggerDownload(`${safe}.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handlePDF = () => {
    const doc = buildPDF(title, data, columns);
    doc.save(`${safe}.pdf`);
  };

  return (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCSV} disabled={empty}>
        <FileSpreadsheet size={13} /> CSV
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePDF} disabled={empty}>
        <FileText size={13} /> PDF
      </Button>
    </div>
  );
}