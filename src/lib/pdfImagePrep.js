/*
 * Prepares the photos inside a hidden report template before it is captured.
 *
 * html2canvas has to download and draw every photo at its original size, which
 * is what makes a report with many phone photos take minutes. Replacing each
 * photo with a small, already-loaded JPEG makes the capture close to instant,
 * and still leaves more than enough detail for the printed photo size.
 */

const MAX_DIM = 1100;
const JPEG_QUALITY = 0.78;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const shrink = (source, width, height) => {
  const ratio = Math.min(1, MAX_DIM / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));

  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

export async function shrinkTemplateImages(root) {
  const images = Array.from(root.querySelectorAll('img'));

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') || '';

      /*
       * Signatures and stamps are already small data URLs,
       * so they are left untouched.
       */
      if (!/^https?:/i.test(src)) return;

      try {
        const loaded = await loadImage(src);
        const width = loaded.naturalWidth || loaded.width;
        const height = loaded.naturalHeight || loaded.height;
        if (!width || !height) return;

        img.src = shrink(loaded, width, height);

        await new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = resolve;
          img.onerror = resolve;
        });
      } catch {
        // Keep the original photo when it cannot be re-read.
      }
    })
  );
}