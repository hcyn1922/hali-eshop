import React, { useRef, useState } from 'react';
import { ImagePlus, Link2, Sparkles, Star, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import { useAuth } from '../../app/auth';
import { can } from '../../app/permissions';
import { useStatus } from '../../app/queries';
import type { ProductImage } from '../../types';
import { Button, Input, Spinner, cn, useToast } from '../../ui';
import { AiStudioPanel } from './AiStudioPanel';

export function ImageUploader({
  images,
  onChange,
  max = 8,
  productName,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  max?: number;
  /** Pre-fills the AI studio. */
  productName?: string;
}) {
  const { role } = useAuth();
  const status = useStatus();
  const ai = status.data?.aiPhotos;
  const [studioOpen, setStudioOpen] = useState(false);
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
        const dataUrl = await resizeImage(file);
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
      {ai?.enabled && can.uploadImages(role) && !studioOpen && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          icon={<Sparkles className="h-4 w-4 text-brand-500" />}
          disabled={images.length >= max}
          title={images.length >= max ? `Remove a photo first (up to ${max})` : undefined}
          onClick={() => setStudioOpen(true)}
        >
          Make AI studio photos
        </Button>
      )}
      {studioOpen && ai && (
        <AiStudioPanel
          productName={productName}
          roomLeft={max - images.length}
          remainingToday={Math.max(0, ai.dailyLimit - ai.usedToday)}
          onAdd={urls => onChange(urls.reduce((acc, url) => add(url, acc), images))}
          onClose={() => {
            setStudioOpen(false);
            status.refetch();
          }}
        />
      )}
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
