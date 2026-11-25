import { PDFDocument } from 'pdf-lib';
import { base44 } from '@/api/base44Client';

// Appends the uploaded PDF attachments as extra pages after the claim document.
export async function appendPdfAttachments({ basePdf, attachments }) {
  if (!attachments.length) return null;
  const merged = await PDFDocument.load(basePdf.output('arraybuffer'));
  for (const att of attachments) {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: att.file_uri, expires_in: 600 });
    const res = await fetch(signed_url);
    const bytes = await res.arrayBuffer();
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

export function downloadPdfBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}