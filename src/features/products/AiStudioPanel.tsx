import React, { useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import type { AiInspection, AiPhotoResult, AiStudioSettings } from '../../types';
import { Button, Checkbox, Input, Spinner, Textarea, cn, useToast } from '../../ui';

/** Mirrors VIEWS in server/aiPhotoPrompt.ts. */
const VIEWS = [
  { id: 'hero', label: 'Front hero', hint: 'Front-facing, balanced soft light' },
  { id: 'three_quarter', label: 'Three-quarter view', hint: 'Front and one side visible' },
  { id: 'alt_light', label: 'Front, alternate light', hint: 'Different light direction and shadow' },
  { id: 'elevated', label: 'Elevated three-quarter', hint: 'Slightly from above, branding readable' },
];
const DEFAULT_VIEWS = ['hero', 'three_quarter', 'elevated'];

type Step = 'setup' | 'inspecting' | 'review' | 'generating' | 'results';

/** Photos sent to the AI: big enough for label text, small enough for the upload limit. */
const AI_INPUT_SIDE = 1536;

/**
 * AI studio photo: upload a raw product photo, let the AI describe what it sees (Stage 1),
 * correct that description, then approve to generate studio photos (Stage 2).
 */
export function AiStudioPanel({
  productName,
  roomLeft,
  remainingToday,
  onAdd,
  onClose,
}: {
  productName?: string;
  /** How many more photos the product can hold. */
  roomLeft: number;
  remainingToday: number;
  onAdd: (urls: string[]) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('setup');
  const [product, setProduct] = useState('');
  const [reference, setReference] = useState('');
  const [settings, setSettings] = useState<AiStudioSettings>({
    productName: productName || '',
    background: 'warm beige, subtle matte texture',
    lighting: 'soft directional studio lighting',
    productFill: '60–70%',
  });
  const [report, setReport] = useState<AiInspection | null>(null);
  const [views, setViews] = useState<string[]>(DEFAULT_VIEWS);
  const [photos, setPhotos] = useState<AiPhotoResult[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [left, setLeft] = useState(remainingToday);

  const input = () => ({ product, reference: reference || undefined, settings });
  const set = (k: keyof AiStudioSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setSettings(s => ({ ...s, [k]: e.target.value }));

  const inspect = async () => {
    setStep('inspecting');
    try {
      setReport(await api.inspectAiPhoto(input()));
      setStep('review');
    } catch (err: any) {
      toast(err.message || 'The product check failed.', 'error');
      setStep('setup');
    }
  };

  const generate = async () => {
    if (!report) return;
    setStep('generating');
    try {
      const result = await api.generateAiPhotos({ ...input(), approved: report, views });
      setPhotos(result.photos);
      setLeft(result.remaining_today);
      setPicked(result.photos.filter(p => p.url).slice(0, roomLeft).map(p => p.url!));
      setStep('results');
    } catch (err: any) {
      toast(err.message || 'The photos could not be made.', 'error');
      setStep('review');
    }
  };

  const updateText = (i: number, text: string) =>
    setReport(r => r && { ...r, visible_text: r.visible_text.map((t, j) => (j === i ? { ...t, text } : t)) });
  const removeText = (i: number) => setReport(r => r && { ...r, visible_text: r.visible_text.filter((_, j) => j !== i) });
  const addText = () => setReport(r => r && { ...r, visible_text: [...r.visible_text, { text: '', placement: 'on the product' }] });

  const togglePick = (url: string) =>
    setPicked(p => (p.includes(url) ? p.filter(u => u !== url) : p.length < roomLeft ? [...p, url] : p));

  const tooMany = views.length > left;

  return (
    // Enter inside these fields must not submit the surrounding product form
    <div
      className="mt-4 rounded-xl border border-line bg-subtle p-4"
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-500" />
          <div>
            <p className="text-sm font-semibold text-fg">AI studio photo</p>
            <p className="text-xs text-fg-3">{left} AI photo{left === 1 ? '' : 's'} left today</p>
          </div>
        </div>
        <Button variant="tertiary" size="sm" iconOnly icon={<X className="h-4 w-4" />} aria-label="Close AI studio" onClick={onClose} disabled={step === 'generating' || step === 'inspecting'} />
      </div>

      {(step === 'setup' || step === 'inspecting') && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PhotoPick label="Product photo" required value={product} onChange={setProduct} />
            <PhotoPick label="Style reference" hint="Optional" value={reference} onChange={setReference} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Product name" value={settings.productName} onChange={set('productName')} containerClassName="sm:col-span-2" />
            <Input label="Background" value={settings.background} onChange={set('background')} />
            <Input label="Lighting" value={settings.lighting} onChange={set('lighting')} />
            <Input label="Product size in frame" value={settings.productFill} onChange={set('productFill')} hint="Share of the photo's height" />
          </div>
          <div className="flex items-center justify-end gap-2">
            {step === 'inspecting' && <span className="text-sm text-fg-3">Checking the product…</span>}
            <Button variant="primary" loading={step === 'inspecting'} disabled={!product} onClick={inspect}>
              Check product
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && report && (
        <div className="space-y-4">
          <p className="text-sm text-fg-2">
            Check what the AI understood. Correct anything wrong, especially the wording, then approve.
          </p>
          {report.unclear.length > 0 && (
            <div className="flex gap-2.5 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Not clear in the photo</p>
                <ul className="mt-1 list-disc pl-4">
                  {report.unclear.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
                <p className="mt-1">Type the correct wording below, or use a clearer photo.</p>
              </div>
            </div>
          )}
          <Textarea
            label="The product"
            rows={4}
            value={report.product_description}
            onChange={e => setReport({ ...report, product_description: e.target.value })}
          />
          <div>
            <p className="mb-1.5 text-sm font-medium text-fg-2">Text on the product (must match exactly)</p>
            <div className="space-y-2">
              {report.visible_text.map((t, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Input value={t.text} onChange={e => updateText(i, e.target.value)} hint={t.placement} containerClassName="flex-1" aria-label={`Text ${i + 1}`} />
                  <Button variant="tertiary" iconOnly icon={<Trash2 className="h-4 w-4" />} aria-label="Remove" onClick={() => removeText(i)} className={t.placement ? 'mb-6' : ''} />
                </div>
              ))}
              {report.visible_text.length === 0 && <p className="text-sm text-fg-3">No text found on the product.</p>}
            </div>
            <Button variant="link" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={addText}>
              Add text
            </Button>
          </div>
          <Textarea label="Photography plan" rows={2} value={report.plan} onChange={e => setReport({ ...report, plan: e.target.value })} hint={report.style_notes} />
          <div>
            <p className="mb-2 text-sm font-medium text-fg-2">Photos to make</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {VIEWS.map(v => (
                <Checkbox
                  key={v.id}
                  label={v.label}
                  hint={v.hint}
                  checked={views.includes(v.id)}
                  onChange={() => setViews(vs => (vs.includes(v.id) ? vs.filter(x => x !== v.id) : [...vs, v.id]))}
                />
              ))}
            </div>
            {tooMany && <p className="mt-2 text-sm text-warning-700 dark:text-warning-500">Only {left} left today. Choose fewer photos.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep('setup')}>
              Back
            </Button>
            <Button variant="brand" icon={<Sparkles className="h-4 w-4" />} disabled={!views.length || tooMany || !report.product_description.trim()} onClick={generate}>
              Proceed: make {views.length} photo{views.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {step === 'generating' && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner className="h-8 w-8" />
          <p className="text-sm font-semibold text-fg">Making {views.length} studio photo{views.length === 1 ? '' : 's'}…</p>
          <p className="max-w-xs text-sm text-fg-3">This usually takes one to two minutes. Keep this window open.</p>
        </div>
      )}

      {step === 'results' && (
        <div className="space-y-4">
          <p className="text-sm text-fg-2">
            Check each photo, especially the wording on the product. Tap to choose the ones to keep
            {roomLeft < photos.length ? ` (room for ${roomLeft} more on this product)` : ''}.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map(p =>
              p.url ? (
                <button
                  key={p.view}
                  type="button"
                  onClick={() => togglePick(p.url!)}
                  className={cn(
                    'focus-ring relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg border bg-surface',
                    picked.includes(p.url) ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-line'
                  )}
                >
                  <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-left text-xs font-semibold text-white">{p.label}</span>
                  {picked.includes(p.url) && (
                    <span className="absolute right-2 top-2 rounded-full bg-brand-500 p-1 text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              ) : (
                <div key={p.view} className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong p-3 text-center text-xs text-fg-3">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold">{p.label}</span>
                  <span>{p.error}</span>
                </div>
              )
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setStep('review')}>
              Adjust and try again
            </Button>
            <Button
              variant="primary"
              disabled={!picked.length}
              onClick={() => {
                onAdd(picked);
                onClose();
              }}
            >
              Add {picked.length} to product photos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoPick({ label, hint, required, value, onChange }: { label: string; hint?: string; required?: boolean; value: string; onChange: (dataUrl: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      onChange(await resizeImage(file, AI_INPUT_SIDE, 0.9));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      if (ref.current) ref.current.value = '';
    }
  };
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-fg-2">
        {label}
        {required && <span className="text-brand-500"> *</span>}
        {hint && <span className="font-normal text-fg-4"> · {hint}</span>}
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="focus-ring flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface text-fg-3 hover:bg-hover"
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : loading ? (
            <Spinner />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="text-xs font-semibold">Choose photo</span>
            </>
          )}
        </button>
        {value && (
          <button type="button" aria-label={`Remove ${label}`} onClick={() => onChange('')} className="absolute right-1.5 top-1.5 cursor-pointer rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => pick(e.target.files?.[0])} />
    </div>
  );
}
