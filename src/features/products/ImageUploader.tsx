import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Star, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { ProductImage } from '../../types';
import { Button, Input, Spinner, cn, useToast } from '../../ui';

const MAX_SIDE = 1600;

/** Shrinks a photo to at most 1600px and re-encodes it as JPEG before upload. */
function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ImageUploader({ images, onChange, max = 4 }: { images: ProductImage[]; onChange: (images: ProductImage[]) => void; max?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState('');
  const [showLink, setShowLink] = useState(false);

  const add = (url: string, current: ProductImage[]) => [
    ...current,
    { id: crypto.randomUUID(), url, is_primary: current.length === 0 },
  ];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let next = images;
    try {
      for (const file of Array.from(files).slice(0, max - images.length)) {
        const dataUrl = await resize(file);
        const { url } = await api.uploadImage(dataUrl);
        next = add(url, next);
        onChange(next);
      }
    } catch (err: any) {
      toast(err.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setPrimary = (id: string) => onChange(images.map(i => ({ ...i, is_primary: i.id === id })));
  const remove = (id: string) => {
    const rest = images.filter(i => i.id !== id);
    if (rest.length && !rest.some(i => i.is_primary)) rest[0] = { ...rest[0], is_primary: true };
    onChange(rest);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map(img => (
          <div key={img.id} className={cn('group relative aspect-square overflow-hidden rounded-lg border bg-subtle', img.is_primary ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-line')}>
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5">
              <button
                type="button"
                title={img.is_primary ? 'Main photo' : 'Make main photo'}
                onClick={() => setPrimary(img.id)}
                className="cursor-pointer rounded p-1 text-white hover:bg-white/20"
              >
                <Star className={cn('h-4 w-4', img.is_primary && 'fill-current')} />
              </button>
              <button type="button" title="Remove" onClick={() => remove(img.id)} className="cursor-pointer rounded p-1 text-white hover:bg-white/20">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {images.length < max && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="focus-ring flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-fg-3 hover:bg-hover"
          >
            {uploading ? <Spinner /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Add photo'}</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={e => upload(e.target.files)} />
      {images.length < max &&
        (showLink ? (
          <div className="mt-3 flex items-end gap-2">
            <Input label="Image link" type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" containerClassName="flex-1" />
            <Button
              disabled={!/^https?:\/\//.test(link)}
              onClick={() => {
                onChange(add(link.trim(), images));
                setLink('');
                setShowLink(false);
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <Button variant="link" className="mt-2" icon={<Link2 className="h-4 w-4" />} onClick={() => setShowLink(true)}>
            Or add an image link
          </Button>
        ))}
    </div>
  );
}
