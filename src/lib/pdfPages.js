import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const A4_W_MM = 210;
const A4_H_MM = 297;
export const A4_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = (A4_WIDTH_PX * A4_H_MM) / A4_W_MM; // ~1123 css px

async function waitForImages(el) {
  const imgs = Array.from(el.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    img.onload = res;
    img.onerror = res;
  }))));
}

/**
 * Safe places to end a page, in css px from the top of the element:
 * bottom edges of table rows and of the document's section blocks, so a row
 * is never sliced in half by a page break.
 */
function collectBreaks(el) {
  const root = el.getBoundingClientRect().top;
  const breaks = [];
  el.querySelectorAll('tr').forEach((node) => {
    const r = node.getBoundingClientRect();
    if (r.height > 0) breaks.push(r.bottom - root);
  });
  Array.from(el.children).forEach((child) => {
    Array.from(child.children).forEach((grandchild) => {
      const r = grandchild.getBoundingClientRect();
      if (r.height > 0) breaks.push(r.bottom - root);
    });
  });
  return breaks;
}

function paginate(totalHeight, breaks) {
  const safe = [...new Set(breaks.map((b) => Math.round(b)))]
    .filter((b) => b > 0 && b < totalHeight - 4)
    .sort((a, b) => a - b);

  const segments = [];
  let start = 0;
  while (start < totalHeight - 2) {
    const target = start + PAGE_HEIGHT_PX;
    if (target >= totalHeight) {
      segments.push({ start, end: totalHeight });
      break;
    }
    const candidates = safe.filter((b) => b > start + 120 && b <= target);
    const end = candidates.length ? candidates[candidates.length - 1] : Math.floor(target);
    segments.push({ start, end });
    start = end;
  }
  return segments;
}

/**
 * Renders an on-page A4 document element to a PDF, breaking pages on row and
 * section boundaries so items continue cleanly instead of being cut mid-line.
 */
export async function exportElementToPdf({ el, filename, scale = 2 }) {
  await waitForImages(el);
  await new Promise((r) => setTimeout(r, 60));

  const domHeight = el.getBoundingClientRect().height;
  const breaks = collectBreaks(el);
  const canvas = await html2canvas(el, { scale, useCORS: true, backgroundColor: '#ffffff', width: A4_WIDTH_PX });

  const ratio = canvas.height / domHeight;
  const segments = paginate(domHeight, breaks);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  segments.forEach((seg, idx) => {
    if (idx > 0) pdf.addPage();
    const sy = Math.round(seg.start * ratio);
    const sh = Math.max(1, Math.round((seg.end - seg.start) * ratio));
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sh;
    const ctx = slice.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    const imgHeightMm = Math.min((sh * A4_W_MM) / canvas.width, A4_H_MM);
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4_W_MM, imgHeightMm);
  });

  pdf.save(filename);
}