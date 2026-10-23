/*
 * Native jsPDF drawing for Installation Report equipment tables.
 *
 * The Equipment Installed / Equipment Decommissioned tables are drawn
 * directly with the PDF engine instead of being captured from the hidden
 * HTML template, so the equipment details always render and long tables
 * paginate row by row instead of being scaled down.
 */

// Matches the order the form displays device types: CMS, PC, TV, HDMI Extender, Cable, Others.
export const DEVICE_TYPE_ORDER = ['CMS', 'PC', 'TV', 'HDMI Extender', 'Cable', 'Others'];
export const deviceTypeRank = (type) => {
  const index = DEVICE_TYPE_ORDER.indexOf(type);
  return index === -1 ? DEVICE_TYPE_ORDER.length : index;
};
export const sortEquipmentItems = (items) =>
  (items || [])
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => deviceTypeRank(a.item.device_type) - deviceTypeRank(b.item.device_type) || a.idx - b.idx)
    .map((entry) => entry.item);

const hexToRgb = (hex) => {
  const clean = String(hex || '').replace('#', '');
  return [parseInt(clean.slice(0, 2), 16) || 0, parseInt(clean.slice(2, 4), 16) || 0, parseInt(clean.slice(4, 6), 16) || 0];
};

const COLORS = {
  bandBg: '#eff6ff', bandAccent: '#2563eb', bandText: '#1d4ed8',
  subBg: '#f0f9ff', subAccent: '#60a5fa', subText: '#1d4ed8',
  headerBg: '#f3f4f6', border: '#e5e7eb',
  text: '#111827', muted: '#374151', altRow: '#f9fafb', white: '#ffffff',
};

const PT_TO_MM = 0.352778;

const buildSpecs = (item) => [
  item.model && `Model: ${item.model}`,
  item.sku && `SKU: ${item.sku}`,
  item.anydesk && `Anydesk: ${item.anydesk}`,
  item.length && `Length: ${item.length}`,
  (item.quantity != null && item.quantity !== '') && `Qty: ${item.quantity}`,
  (item.num_ports != null && item.num_ports !== '') && `Ports: ${item.num_ports}`,
  (item.num_gang != null && item.num_gang !== '') && `Gang: ${item.num_gang}`,
  item.hdmi_rx && `RX HDMI: ${item.hdmi_rx_length || '—'}`,
  item.hdmi_tx && `TX HDMI: ${item.hdmi_tx_length || '—'}`,
].filter(Boolean).join('\n');

const INSTALLED_COLUMNS = [
  { header: '#', width: 8 },
  { header: 'Device Type', width: 24 },
  { header: 'Device Name', width: 36 },
  { header: 'Serial Number', width: 30, mono: true },
  { header: 'Specifications', width: 52, small: true },
  { header: 'Notes', width: 40 },
];

const DECOMMISSION_COLUMNS = [
  { header: '#', width: 8 },
  { header: 'Device Type', width: 26 },
  { header: 'Device Name / Model', width: 56 },
  { header: 'Serial Number', width: 40, mono: true },
  { header: 'Reason', width: 60 },
];

/*
 * Draws one equipment block (band + sections, each with a subsection
 * heading and a table) onto the given jsPDF document.
 *
 * Returns { y, pageHasContent } so the caller can continue the shared
 * pagination flow.
 */
export function drawEquipmentBlock(pdf, { sections = [], mode = 'installed', startY, pageHasContent, metrics, startNewPage }) {
  const installed = mode === 'installed';
  const columns = installed ? INSTALLED_COLUMNS : DECOMMISSION_COLUMNS;
  const { contentTop, contentBottom, sideMargin, contentWidth, blockGap, paginationSafetyGap } = metrics;

  const padX = 1.9;
  const padY = 1.6;
  const lineH = 2.9;
  const minRowH = 6.5;
  const headerRowH = 6.5;
  const bandH = 7;
  const subH = 6;

  let y = startY;
  let hasContent = pageHasContent;

  const remaining = () => contentBottom - y - paginationSafetyGap;

  const newPage = () => {
    startNewPage();
    y = contentTop;
    hasContent = false;
  };

  const fillRect = (x, ry, w, h, color) => {
    const [r, g, b] = hexToRgb(color);
    pdf.setFillColor(r, g, b);
    pdf.rect(x, ry, w, h, 'F');
  };

  const strokeRect = (x, ry, w, h) => {
    const [r, g, b] = hexToRgb(COLORS.border);
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.2);
    pdf.rect(x, ry, w, h, 'S');
  };

  const setColFont = (col) => {
    pdf.setFont(col.mono ? 'courier' : 'helvetica', 'normal');
    pdf.setFontSize(col.small ? 7 : 8);
  };

  // Section band ("Equipment Installed" / "Equipment Decommissioned")
  if (hasContent && remaining() < 45) newPage();
  fillRect(sideMargin, y, contentWidth, bandH, COLORS.bandBg);
  fillRect(sideMargin, y, 1.1, bandH, COLORS.bandAccent);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...hexToRgb(COLORS.bandText));
  pdf.text(installed ? 'Equipment Installed' : 'Equipment Decommissioned', sideMargin + 3.2, y + 4.6);
  y += bandH + 3.2;
  hasContent = true;

  const drawTableHeader = () => {
    fillRect(sideMargin, y, contentWidth, headerRowH, COLORS.headerBg);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...hexToRgb(COLORS.text));
    let x = sideMargin;
    columns.forEach((col) => {
      pdf.text(col.header, x + padX, y + 4.3);
      x += col.width;
    });
    x = sideMargin;
    columns.forEach((col) => {
      strokeRect(x, y, col.width, headerRowH);
      x += col.width;
    });
    y += headerRowH;
  };

  sections.forEach((sec, si) => {
    const items = installed ? sortEquipmentItems(sec.items) : (sec.items || []);

    // Subsection heading (section name + license key)
    if (hasContent && items.length && remaining() < 25) newPage();
    fillRect(sideMargin, y, contentWidth, subH, COLORS.subBg);
    fillRect(sideMargin, y, 0.8, subH, COLORS.subAccent);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...hexToRgb(COLORS.subText));
    pdf.text(String(sec.section_name || `Section ${si + 1}`), sideMargin + 2.7, y + 4.1);
    if (sec.license_key) {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...hexToRgb(COLORS.muted));
      pdf.text(`License Key: ${sec.license_key}`, sideMargin + contentWidth - 2.7, y + 4.1, { align: 'right' });
    }
    y += subH + 2.1;
    hasContent = true;

    drawTableHeader();

    items.forEach((item, ii) => {
      const rawCells = installed
        ? [
          String(ii + 1),
          item.device_type || '',
          item.device_name || '',
          item.serial_number || '—',
          buildSpecs(item) || '—',
          item.notes || '',
        ]
        : [
          String(ii + 1),
          item.device_type || '',
          item.device_name || '',
          item.serial_number || '',
          item.reason_for_decommission || '',
        ];

      const wrapped = rawCells.map((value, ci) => {
        const col = columns[ci];
        setColFont(col);
        return String(value ?? '')
          ? pdf.splitTextToSize(String(value), col.width - padX * 2)
          : [''];
      });

      const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length));
      const rowH = Math.max(minRowH, maxLines * lineH + padY * 2 + 0.5);

      if (hasContent && y + rowH > contentBottom - paginationSafetyGap) {
        newPage();
        drawTableHeader();
      }

      fillRect(sideMargin, y, contentWidth, rowH, ii % 2 === 0 ? COLORS.white : COLORS.altRow);

      let x = sideMargin;
      columns.forEach((col, ci) => {
        strokeRect(x, y, col.width, rowH);
        setColFont(col);
        pdf.setTextColor(...hexToRgb(col.small ? COLORS.muted : COLORS.text));
        let ty = y + padY + (col.small ? 7 : 8) * PT_TO_MM;
        wrapped[ci].forEach((line) => {
          pdf.text(line, x + padX, ty);
          ty += lineH;
        });
        x += col.width;
      });

      y += rowH;
      hasContent = true;
    });

    y += 4.2; // section spacing
  });

  y += blockGap;
  return { y, pageHasContent: hasContent };
}