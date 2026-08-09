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
  let y = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} · ${data.length} records`, margin, y);
  y += 16;

  const tableW = pageW - margin * 2;
  const colW = tableW / columns.length;
  const rowH = 18;

  doc.setFillColor(230, 232, 236);
  doc.rect(margin, y, tableW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  columns.forEach((c, i) => {
    doc.text(String(c.header || ''), margin + i * colW + 4, y + 12, { maxWidth: colW - 8 });
  });
  y += rowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  data.forEach((row, ri) => {
    if (y > pageH - 30) { doc.addPage(); y = 40; }
    if (ri % 2 === 1) { doc.setFillColor(248, 249, 251); doc.rect(margin, y, tableW, rowH, 'F'); }
    columns.forEach((c, i) => {
      const v = typeof c.accessor === 'function' ? c.accessor(row) : row[c.accessor];
      const s = String(v == null ? '' : v).replace(/\n/g, ' ');
      doc.text(s.slice(0, 60), margin + i * colW + 4, y + 12, { maxWidth: colW - 8 });
    });
    y += rowH;
  });

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