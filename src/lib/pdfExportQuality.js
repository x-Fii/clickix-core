/*
 * Shared size control for the Installation Report and Service Report exports.
 *
 * Both reports are exported as JPEG snapshots of an on-page A4 template, so the
 * file size is driven by the capture scale and the JPEG quality. We start with
 * sharp settings and only step down when a report would otherwise be too large.
 */

export const PDF_MAX_BYTES = 15 * 1024 * 1024;

export const PDF_QUALITY_STEPS = [
  { scale: 1.75, quality: 0.85 },
  { scale: 1.4, quality: 0.72 },
  { scale: 1.15, quality: 0.6 },
];

export const pdfByteSize = (pdf) => pdf.output('blob').size;

/*
 * Builds the PDF, then rebuilds it with lighter capture settings while the
 * result is still larger than the limit. buildPdf receives { scale, quality }.
 */
export async function buildPdfWithinLimit(buildPdf) {
  let pdf = await buildPdf(PDF_QUALITY_STEPS[0]);

  for (const step of PDF_QUALITY_STEPS.slice(1)) {
    if (pdfByteSize(pdf) <= PDF_MAX_BYTES) break;
    pdf = await buildPdf(step);
  }

  return pdf;
}