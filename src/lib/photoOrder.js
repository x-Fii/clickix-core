/*
 * Photo orientation helpers.
 *
 * Photos always keep their own shape: portrait stays portrait, landscape stays
 * landscape. Landscape photos are grouped before portrait ones so rows of
 * photos stay neat, and the uploaded order is kept inside each group.
 */

export const isLandscapeImage = (image) =>
  (image?.naturalWidth || 0) >= (image?.naturalHeight || 0);

const orientationRank = (image) => (isLandscapeImage(image) ? 0 : 1);

/*
 * Re-orders the photos inside every photo row of a rendered report template,
 * landscape first, portrait last.
 */
export function sortPhotoContainers(root) {
  Array.from(root.querySelectorAll('div')).forEach((container) => {
    const children = Array.from(container.children);

    if (children.length < 2) return;
    if (!children.every((child) => child.tagName === 'IMG')) return;

    const display = window.getComputedStyle(container).display;
    if (display !== 'flex' && display !== 'grid') return;

    [...children]
      .sort((a, b) => orientationRank(a) - orientationRank(b))
      .forEach((child) => container.appendChild(child));
  });
}