/*
 * Builds one neat row of photos for a report PDF.
 *
 * Every photo keeps its own aspect ratio. The row gets a single height that
 * fits the available width, so portrait photos stay portrait, landscape photos
 * stay landscape, and nothing is cropped or stretched.
 */

const GAP = 8;
const MIN_HEIGHT = 90;
const MAX_HEIGHT = 240;

export function createPhotoRow(images, containerWidth) {
  const row = document.createElement('div');

  Object.assign(row.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${containerWidth}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${GAP}px`,
    backgroundColor: '#ffffff',
  });

  const ratios = images.map((image) => {
    const width = image.naturalWidth || 1;
    const height = image.naturalHeight || 1;
    return width / height;
  });

  const availableWidth = containerWidth - GAP * (images.length - 1);
  const fittedHeight = availableWidth / ratios.reduce((sum, ratio) => sum + ratio, 0);
  const rowHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, fittedHeight));

  images.forEach((image) => {
    const clone = image.cloneNode(true);

    Object.assign(clone.style, {
      width: 'auto',
      height: `${rowHeight}px`,
      maxWidth: '100%',
      maxHeight: 'none',
      objectFit: 'contain',
      border: '1px solid #e5e7eb',
      borderRadius: '4px',
      backgroundColor: '#ffffff',
      display: 'block',
    });

    row.appendChild(clone);
  });

  return row;
}