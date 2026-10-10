import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ExternalLink, Megaphone, Plus } from 'lucide-react';
import { keys, useAction, usePosts, useProducts } from '../../app/queries';
import { api } from '../../lib/api';
import { formatMaldivesDate } from '../../lib/formatters';
import type { PostPlatform, PostStatus, ProductImage, SocialPost } from '../../types';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Tabs, Textarea, type BadgeColor } from '../../ui';
import { ImageUploader } from '../products/ImageUploader';

const PLATFORMS: Record<PostPlatform, string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', viber: 'Viber' };
const STATUSES: Record<PostStatus, { label: string; color: BadgeColor }> = {
  draft: { label: 'Draft', color: 'gray' },
  planned: { label: 'Scheduled', color: 'blue' },
  posted: { label: 'Posted', color: 'success' },
};
const CAPTION_LIMIT = 2200;

function PostModal({ post, productId, onClose }: { post?: SocialPost; productId?: string; onClose: () => void }) {
  const products = useProducts();
  const [form, setForm] = useState({
    product_id: post?.product_id || productId || '',
    platform: post?.platform || ('instagram' as PostPlatform),
    planned_date: post?.planned_date || new Date().toISOString().slice(0, 10),
    status: post?.status || ('draft' as PostStatus),
    caption: post?.caption || '',
    published_url: post?.published_url || '',
    notes: post?.notes || '',
  });
  const [images, setImages] = useState<ProductImage[]>(post?.image_url ? [{ id: 'img', url: post.image_url, is_primary: true }] : []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const body = () => ({ ...form, image_url: images[0]?.url || '' });
  const save = useAction(() => (post ? api.updateSocialPost(post.id, body()) : api.createSocialPost(body())), {
    invalidate: [keys.posts],
    success: 'Post saved.',
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={<Megaphone className="h-5 w-5" />}
      title={post ? 'Edit post' : 'Plan a post'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!form.product_id} onClick={() => save.mutate(undefined)}>
            Save post
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Product" required value={form.product_id} onChange={set('product_id')} containerClassName="sm:col-span-2">
          <option value="">Choose a product…</option>
          {(products.data || []).map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Platform" value={form.platform} onChange={set('platform')}>
          {(Object.keys(PLATFORMS) as PostPlatform[]).map(p => (
            <option key={p} value={p}>
              {PLATFORMS[p]}
            </option>
          ))}
        </Select>
        <Input label="Post date" type="date" value={form.planned_date} onChange={set('planned_date')} />
        <Select label="Status" value={form.status} onChange={set('status')}>
          {(Object.keys(STATUSES) as PostStatus[]).map(s => (
            <option key={s} value={s}>
              {STATUSES[s].label}
            </option>
          ))}
        </Select>
        <Input label="Live post link" type="url" value={form.published_url} onChange={set('published_url')} placeholder="https://instagram.com/p/…" />
        <Textarea
          label="Caption"
          rows={5}
          maxLength={CAPTION_LIMIT}
          value={form.caption}
          onChange={set('caption')}
          containerClassName="sm:col-span-2"
          hint={`${form.caption.length} / ${CAPTION_LIMIT}`}
        />
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-fg-2">Image</p>
          <ImageUploader images={images} onChange={setImages} max={1} />
        </div>
        <Textarea label="Notes" rows={2} value={form.notes} onChange={set('notes')} containerClassName="sm:col-span-2" />
      </div>
    </Modal>
  );
}

export function SocialPage() {
  const posts = usePosts();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<PostStatus | 'all'>('all');
  const [editing, setEditing] = useState<{ post?: SocialPost; productId?: string } | null>(null);

  // Opened from a product page: start a post for it
  useEffect(() => {
    const productId = params.get('product');
    if (productId) {
      setEditing({ productId });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const list = useMemo(
    () =>
      [...(posts.data || [])]
        .filter(p => tab === 'all' || p.status === tab)
        .sort((a, b) => (b.planned_date || '').localeCompare(a.planned_date || '')),
    [posts.data, tab]
  );

  return (
    <>
      <PageHeader
        title="Social posts"
        description="Plan product posts, captions and schedules, then save the live link."
        actions={
          <Button variant="primary" icon={<Plus className="h-5 w-5" />} onClick={() => setEditing({})}>
            Plan a post
          </Button>
        }
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'all', label: 'All', count: posts.data?.length },
          ...(Object.keys(STATUSES) as PostStatus[]).map(s => ({
            key: s,
            label: STATUSES[s].label,
            count: (posts.data || []).filter(p => p.status === s).length,
          })),
        ]}
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Megaphone className="h-6 w-6" />} title="No posts here" description="Plan a post for a product to keep your feed on schedule." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(p => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              <button type="button" onClick={() => setEditing({ post: p })} className="flex flex-1 cursor-pointer flex-col text-left">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="aspect-[16/10] w-full border-b border-line object-cover" />
                ) : (
                  <div className="flex aspect-[16/10] w-full items-center justify-center border-b border-line bg-subtle text-sm text-fg-4">No image yet</div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={STATUSES[p.status].color} dot>
                      {STATUSES[p.status].label}
                    </Badge>
                    <Badge>{PLATFORMS[p.platform] || p.platform}</Badge>
                  </div>
                  <p className="font-semibold text-fg">{p.product_name}</p>
                  <p className="line-clamp-3 text-sm text-fg-3">{p.caption || <span className="italic text-fg-4">No caption yet</span>}</p>
                  <p className="mt-auto flex items-center gap-1.5 pt-2 text-sm text-fg-4">
                    <CalendarDays className="h-4 w-4" /> {p.planned_date ? formatMaldivesDate(p.planned_date) : 'No date'}
                  </p>
                </div>
              </button>
              {p.published_url && (
                <a
                  href={p.published_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 border-t border-line px-4 py-3 text-sm font-semibold text-fg-2 hover:bg-hover"
                >
                  <ExternalLink className="h-4 w-4" /> View live post
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
      {editing && <PostModal post={editing.post} productId={editing.productId} onClose={() => setEditing(null)} />}
    </>
  );
}
