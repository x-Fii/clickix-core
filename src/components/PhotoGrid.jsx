import { useState } from 'react';

/*
 * Photo gallery that keeps every photo in its own shape.
 * Landscape photos come first, then portrait ones.
 */
export default function PhotoGrid({ photos = [], height = 150 }) {
  const [ratios, setRatios] = useState({});

  const ordered = photos
    .map((url, index) => ({ url, index, ratio: ratios[url] }))
    .sort(
      (a, b) =>
        Number(a.ratio < 1) - Number(b.ratio < 1) || a.index - b.index
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ordered.map(({ url, index }) => (
        <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={`Photo ${index + 1}`}
            style={{ height, width: 'auto' }}
            className="max-w-full rounded border border-border bg-white object-contain hover:opacity-80 transition-opacity"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (!image.naturalWidth || !image.naturalHeight) return;
              const ratio = image.naturalWidth / image.naturalHeight;
              setRatios((prev) => (prev[url] ? prev : { ...prev, [url]: ratio }));
            }}
          />
        </a>
      ))}
    </div>
  );
}