import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X } from 'lucide-react';

export default function PhotoPairUploader({ label, value = [], onChange, max = 2 }) {
  const [uploading, setUploading] = useState(false);
  const photos = value || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = Math.max(0, max - photos.length);
    const toUpload = files.slice(0, remaining);
    if (!toUpload.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        toUpload.map((file) => base44.integrations.Core.UploadFile({ file }).then((r) => r.file_url))
      );
      onChange([...photos, ...urls.filter(Boolean)]);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = (i) => onChange(photos.filter((_, j) => j !== i));
  const full = photos.length >= max;

  return (
    <div>
      <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-3 items-start">
        {photos.map((url, i) => (
          <div key={i} className="relative group">
            <img src={url} alt="" className="w-24 h-24 object-cover rounded border border-border" />
            <button type="button" onClick={() => remove(i)}
              className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 hidden group-hover:flex items-center justify-center">
              <X size={10} />
            </button>
          </div>
        ))}
        {!full && (
          <label className="w-24 h-24 border border-dashed border-border rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors gap-1">
            {uploading
              ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              : <Upload size={16} className="text-muted-foreground" />}
            <span className="text-[10px] text-muted-foreground">{uploading ? 'Uploading…' : 'Add Photo'}</span>
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={handleUpload} />
          </label>
        )}
        <p className="text-[10px] text-muted-foreground self-end">{photos.length}/{max} photos</p>
      </div>
    </div>
  );
}