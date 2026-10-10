import React, { useEffect, useId, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { HULHUMALE_DEVELOPMENTS, MALDIVES_ATOLLS, MALE_CARGO_JETTIES, POPULAR_HULHUMALE_LOTS } from '../../data/maldivesLocations';
import { HULHUMALE_STREETS, MALE_STREETS } from '../../data/maldivesStreets';
import { Input, Select, Segmented, Textarea } from '../../ui';

/** Address as stored on buyers and orders. */
export interface AddressValue {
  delivery_address: string;
  boat_name?: string;
  boat_phone?: string;
  boat_jetty?: string;
  atoll_code?: string;
  island_name?: string;
  hulhumale_lot?: string;
  /** Map pin for the courier. Kept apart from the address so it never prints for customers. */
  location_link?: string;
}

type Mode = 'saved' | 'male' | 'hulhumale' | 'vilimale' | 'island';

const MALE_DISTRICTS = ['Henveiru', 'Galolhu', 'Maafannu', 'Machangoalhi'];

/** A text input with built-in suggestions (native datalist works on phones too). */
function SuggestInput({ suggestions, ...props }: React.ComponentProps<typeof Input> & { suggestions: string[] }) {
  const listId = useId();
  return (
    <>
      <Input list={listId} autoComplete="off" {...props} />
      <datalist id={listId}>
        {suggestions.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Structured Maldives address entry: Malé, Hulhumalé, Vilimalé or an island by boat,
 * plus previously used addresses and an optional map pin link.
 */
export function AddressFields({
  value,
  onChange,
  savedAddresses = [],
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  savedAddresses?: string[];
}) {
  const [mode, setMode] = useState<Mode>(value.delivery_address ? 'saved' : 'male');
  const [parts, setParts] = useState({
    district: '',
    street: '',
    house: '',
    unit: '',
    phase: '2',
    lot: '',
    ward: '',
    atoll: '',
    island: '',
    boatName: value.boat_name || '',
    boatPhone: value.boat_phone || '',
    jetty: value.boat_jetty || '',
    landmark: '',
    mapLink: value.location_link || '',
  });
  const set = (k: keyof typeof parts) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setParts(p => ({ ...p, [k]: e.target.value }));

  const atoll = MALDIVES_ATOLLS.find(a => a.code === parts.atoll);
  const hulhumaleBuildings = useMemo(
    () => [
      ...POPULAR_HULHUMALE_LOTS.filter(l => String(l.phase) === parts.phase).map(l => `${l.name} (${l.lot})`),
      ...HULHUMALE_DEVELOPMENTS.filter(d => String(d.phase) === parts.phase).flatMap(d => d.towers?.map(t => `${d.name.replace(' Project', '')} ${t}`) || []),
    ],
    [parts.phase]
  );

  // Compose the address text whenever a structured field changes
  useEffect(() => {
    if (mode === 'saved') return;
    const join = (...xs: string[]) => xs.map(x => x.trim()).filter(Boolean).join(', ');
    const extra = parts.landmark ? `Near ${parts.landmark.trim()}` : '';
    let address = '';
    const next: AddressValue = { delivery_address: '', location_link: parts.mapLink.trim() || undefined };
    if (mode === 'male') {
      address = join(parts.unit, parts.house, parts.street, parts.district, 'Malé');
    } else if (mode === 'hulhumale') {
      address = join(parts.unit, parts.house, parts.lot, parts.street, `Hulhumalé Phase ${parts.phase}`);
      next.hulhumale_lot = parts.lot || undefined;
    } else if (mode === 'vilimale') {
      address = join(parts.unit, parts.house, parts.ward, 'Vilimalé');
    } else if (mode === 'island') {
      address = join(parts.house, parts.island, atoll ? `${atoll.code}. ${atoll.name}` : '');
      const jetty = MALE_CARGO_JETTIES.find(j => j.id === parts.jetty);
      Object.assign(next, {
        atoll_code: parts.atoll || undefined,
        island_name: parts.island || undefined,
        boat_name: parts.boatName || undefined,
        boat_phone: parts.boatPhone || undefined,
        boat_jetty: jetty?.name || parts.jetty || undefined,
      });
      if (parts.boatName) address = join(address, `by boat "${parts.boatName}"${jetty ? ` from ${jetty.name}` : ''}`);
    }
    next.delivery_address = join(address, extra);
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parts]);

  const modes: Array<{ key: Mode; label: string }> = [
    ...(savedAddresses.length > 0 || value.delivery_address ? [{ key: 'saved' as Mode, label: 'Saved' }] : []),
    { key: 'male', label: 'Malé' },
    { key: 'hulhumale', label: 'Hulhumalé' },
    { key: 'vilimale', label: 'Vilimalé' },
    { key: 'island', label: 'Island' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <Segmented items={modes} value={mode} onChange={setMode} />
      </div>

      {mode === 'saved' && (
        <>
          {savedAddresses.length > 0 && (
            <Select
              label="Previously used"
              value=""
              onChange={e => e.target.value && onChange({ ...value, delivery_address: e.target.value })}
            >
              <option value="">Choose a saved address…</option>
              {savedAddresses.map(a => (
                <option key={a} value={a}>
                  {a.length > 80 ? a.slice(0, 80) + '…' : a}
                </option>
              ))}
            </Select>
          )}
          <Textarea
            label="Delivery address"
            required
            rows={3}
            value={value.delivery_address}
            onChange={e => onChange({ ...value, delivery_address: e.target.value })}
            placeholder="House, street, area"
          />
          <Input
            label="Map pin link"
            type="url"
            value={value.location_link || ''}
            onChange={e => onChange({ ...value, location_link: e.target.value || undefined })}
            placeholder="Paste a Google Maps or WhatsApp location link"
            leading={<MapPin className="h-4 w-4" />}
            hint="For the courier only. Never shown on invoices."
          />
        </>
      )}

      {mode === 'male' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="District" value={parts.district} onChange={set('district')}>
            <option value="">Select…</option>
            {MALE_DISTRICTS.map(d => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <SuggestInput label="Street (magu / goalhi / hingun)" suggestions={MALE_STREETS} value={parts.street} onChange={set('street')} placeholder="Start typing…" />
          <Input label="House / building name" required value={parts.house} onChange={set('house')} placeholder="e.g. H. Blue Lagoon" />
          <Input label="Floor / flat" value={parts.unit} onChange={set('unit')} placeholder="e.g. 3rd floor" />
        </div>
      )}

      {mode === 'hulhumale' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Phase" value={parts.phase} onChange={set('phase')}>
            <option value="1">Phase 1</option>
            <option value="2">Phase 2</option>
          </Select>
          <SuggestInput label="Building / lot" suggestions={hulhumaleBuildings} value={parts.lot} onChange={set('lot')} placeholder="e.g. Hiyaa Tower H7" />
          <SuggestInput label="Street" suggestions={HULHUMALE_STREETS} value={parts.street} onChange={set('street')} placeholder="Optional" />
          <Input label="Flat / house" required value={parts.house} onChange={set('house')} placeholder="e.g. Flat 1404" />
        </div>
      )}

      {mode === 'vilimale' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Ward" value={parts.ward} onChange={set('ward')}>
            <option value="">Select…</option>
            <option>Ward 1</option>
            <option>Ward 2</option>
          </Select>
          <Input label="House / building" required value={parts.house} onChange={set('house')} />
          <Input label="Floor / flat" value={parts.unit} onChange={set('unit')} containerClassName="sm:col-span-2" />
        </div>
      )}

      {mode === 'island' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Atoll" value={parts.atoll} onChange={e => setParts(p => ({ ...p, atoll: e.target.value, island: '' }))}>
            <option value="">Select…</option>
            {MALDIVES_ATOLLS.map(a => (
              <option key={a.code} value={a.code}>
                {a.code}. {a.name}
              </option>
            ))}
          </Select>
          <Select label="Island" value={parts.island} onChange={set('island')} disabled={!atoll}>
            <option value="">{atoll ? 'Select…' : 'Choose the atoll first'}</option>
            {atoll?.islands.map(i => (
              <option key={i}>{i}</option>
            ))}
          </Select>
          <Input label="House name" required value={parts.house} onChange={set('house')} containerClassName="sm:col-span-2" />
          <Input label="Boat name" value={parts.boatName} onChange={set('boatName')} placeholder="Cargo / ferry boat" />
          <Input label="Boat captain phone" type="tel" value={parts.boatPhone} onChange={set('boatPhone')} />
          <Select label="Handover jetty in Malé" value={parts.jetty} onChange={set('jetty')} containerClassName="sm:col-span-2">
            <option value="">Select…</option>
            {MALE_CARGO_JETTIES.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {mode !== 'saved' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Landmark" value={parts.landmark} onChange={set('landmark')} placeholder="Optional, e.g. opposite the mosque" />
            <Input
              label="Map pin link"
              type="url"
              value={parts.mapLink}
              onChange={set('mapLink')}
              placeholder="Paste a Google Maps or WhatsApp location link"
              leading={<MapPin className="h-4 w-4" />}
              hint="For the courier only. Never shown on invoices."
            />
          </div>
          <div className="rounded-lg border border-line bg-subtle px-3.5 py-3 text-sm">
            <p className="text-xs font-medium text-fg-4">Delivers to</p>
            <p className="mt-0.5 text-fg-2">{value.delivery_address || '—'}</p>
          </div>
        </>
      )}
    </div>
  );
}
