import { centsToInput, discountPercent, formatCents, formatPrice, parsePriceInput, type PriceMode } from '@drdrip/shared';
import { useMemo, useRef, useState } from 'preact/hooks';
import { api, download, type Category, type PriceChange, type Service } from '../api';
import { Field, ImagePicker, LinesInput, Loading, Modal, Page, Toggle, confirm, formatDate, run, showError, toast, useLoad, useUnsavedWarning } from '../ui';

const MODE_LABELS: Record<PriceMode, string> = { fixed: 'Precio fijo', from: 'Desde', ask: 'Consultar' };
const BADGES = ['', 'Nuevo', 'Popular'];

type Draft = Omit<Service, 'id' | 'updated_at' | 'sort_order'> & { id?: number; price_text: string; offer_text: string };

const toDraft = (s: Service): Draft => ({ ...s, price_text: centsToInput(s.price_cents), offer_text: s.offer_cents ? centsToInput(s.offer_cents) : '' });
const today = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10); // clinic date (UTC-4)
const offerActive = (s: Service) => s.price_mode !== 'ask' && discountPercent(s.price_cents, s.offer_cents) > 0 && (!s.offer_ends_at || s.offer_ends_at >= today());

function emptyDraft(categoryId: number | null): Draft {
  return {
    name: '', name_en: '', description: '', benefits: [], category_id: categoryId, price_cents: 0, price_text: '',
    offer_cents: 0, offer_text: '', offer_label: '', offer_ends_at: '',
    price_mode: 'fixed', duration_min: 0, image_path: '', badge: '', is_featured: false, available: true, visible: true,
  };
}

/** Asks before saving a price that looks like a typo. */
async function confirmPrice(name: string, oldCents: number | null, newCents: number, mode: PriceMode): Promise<boolean> {
  if (mode === 'ask') return true;
  if (newCents === 0) return confirm('¿Precio en $0?', `"${name}" quedará con precio $0. Si no quieres publicar el precio, usa el modo "Consultar".`, 'Guardar en $0');
  if (oldCents && oldCents > 0) {
    // Integer comparison: 50 % or more up or down.
    if (newCents * 2 >= oldCents * 3 || newCents * 2 <= oldCents) {
      return confirm('Cambio de precio grande', `"${name}" pasará de ${formatCents(oldCents)} a ${formatCents(newCents)}. ¿Es correcto?`, 'Sí, guardar');
    }
  }
  return true;
}

function PriceCell(props: { service: Service; onSaved: () => void }) {
  const { service } = props;
  const [text, setText] = useState(centsToInput(service.price_cents));
  const [state, setState] = useState<'' | 'invalid' | 'saved'>('');
  const original = useRef(service.price_cents);
  if (original.current !== service.price_cents) {
    original.current = service.price_cents;
    setText(centsToInput(service.price_cents));
  }

  const busy = useRef(false);
  const save = async () => {
    if (busy.current) return; // Enter and the blur it causes must not save twice
    const cents = parsePriceInput(text);
    if (cents === null) return setState('invalid');
    if (cents === service.price_cents) return setState('');
    busy.current = true;
    try {
      if (!(await confirmPrice(service.name, service.price_cents, cents, service.price_mode))) {
        setText(centsToInput(service.price_cents));
        return;
      }
      if (await run(() => api('PATCH', `/api/services/${service.id}`, { price_cents: cents }))) {
        setState('saved');
        setTimeout(() => setState(''), 1500);
        props.onSaved();
      }
    } finally {
      busy.current = false;
    }
  };

  if (service.price_mode === 'ask') return <span class="muted">Consultar</span>;
  return (
    <span class={`price-cell ${state}`}>
      <span class="price-sign">$</span>
      <input
        value={text}
        inputMode="decimal"
        aria-label={`Precio de ${service.name}`}
        title={state === 'invalid' ? 'Escribe un precio válido, por ejemplo 159 o 159.50' : 'Escribe el precio y pulsa Enter'}
        onInput={(e) => { setText(e.currentTarget.value); setState(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void save(); }
          if (e.key === 'Escape') { setText(centsToInput(service.price_cents)); setState(''); }
        }}
        onBlur={() => void save()}
      />
      {state === 'saved' && <span class="saved-mark">✓</span>}
    </span>
  );
}

function ServiceForm(props: { draft: Draft; categories: Category[]; services: Service[]; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(props.draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const close = async () => {
    if (!dirty || (await confirm('Cambios sin guardar', 'Si cierras ahora se perderán los cambios de este servicio.', 'Descartar cambios', true))) props.onClose();
  };

  const save = async () => {
    const found: Record<string, string> = {};
    const name = draft.name.trim();
    if (!name) found.name = 'Escribe el nombre del servicio.';
    let cents = 0;
    if (draft.price_mode !== 'ask') {
      const parsed = parsePriceInput(draft.price_text);
      if (parsed === null) found.price_text = 'Escribe un precio válido, por ejemplo 159 o 159.50.';
      else cents = parsed;
    }
    let offerCents = 0;
    if (draft.offer_text.trim() && draft.price_mode !== 'ask') {
      const parsed = parsePriceInput(draft.offer_text);
      if (parsed === null) found.offer_text = 'Escribe un precio de oferta válido, o déjalo vacío.';
      else if (parsed > 0 && parsed >= cents) found.offer_text = 'La oferta debe ser menor que el precio normal.';
      else offerCents = parsed;
    }
    if (!Number.isInteger(draft.duration_min) || draft.duration_min < 0 || draft.duration_min > 1440) found.duration_min = 'Entre 0 y 1440 minutos.';
    setErrors(found);
    if (Object.keys(found).length) return toast('Revisa los campos resaltados', 'warning');

    const repeated = props.services.find((s) => s.id !== draft.id && s.name.trim().toLowerCase() === name.toLowerCase());
    if (repeated && !(await confirm('Nombre repetido', `Ya existe un servicio llamado "${repeated.name}". ¿Guardar de todos modos?`, 'Guardar'))) return;
    const before = props.services.find((s) => s.id === draft.id);
    if (!(await confirmPrice(name, before ? before.price_cents : null, cents, draft.price_mode))) return;

    const { id, price_text: _text, offer_text: _offer, ...rest } = draft;
    const body = { ...rest, name, price_cents: draft.price_mode === 'ask' ? (before?.price_cents ?? 0) : cents, offer_cents: offerCents };
    const ok = await run(() => (id ? api('PATCH', `/api/services/${id}`, body) : api('POST', '/api/services', body)), 'Servicio guardado');
    if (ok) props.onSaved();
  };

  return (
    <Modal
      title={draft.id ? 'Editar servicio' : 'Nuevo servicio'}
      onClose={() => void close()}
      wide
      footer={<><button class="btn ghost" onClick={() => void close()}>Cancelar</button><button class="btn primary" onClick={() => void save()}>Guardar</button></>}
    >
      <div class="form-grid">
        <Field label="Nombre" error={errors.name}>
          <input value={draft.name} onInput={(e) => set('name', e.currentTarget.value)} autofocus />
        </Field>
        <Field label="Nombre en inglés (opcional)">
          <input value={draft.name_en} onInput={(e) => set('name_en', e.currentTarget.value)} />
        </Field>
        <Field label="Categoría">
          <select value={draft.category_id ?? ''} onChange={(e) => set('category_id', e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
            <option value="">Sin categoría</option>
            {props.categories.map((c) => <option value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Duración (minutos)" error={errors.duration_min} hint="0 si no aplica">
          <input type="number" min="0" max="1440" value={draft.duration_min} onInput={(e) => set('duration_min', Number.parseInt(e.currentTarget.value || '0', 10))} />
        </Field>
        <Field label="Modo de precio">
          <select value={draft.price_mode} onChange={(e) => set('price_mode', e.currentTarget.value as PriceMode)}>
            {(Object.keys(MODE_LABELS) as PriceMode[]).map((m) => <option value={m}>{MODE_LABELS[m]}</option>)}
          </select>
        </Field>
        <Field label="Precio (USD)" error={errors.price_text} hint={draft.price_mode === 'ask' ? 'En modo "Consultar" no se muestra precio.' : undefined}>
          <input value={draft.price_text} inputMode="decimal" placeholder="159" disabled={draft.price_mode === 'ask'} onInput={(e) => set('price_text', e.currentTarget.value)} />
        </Field>
        <fieldset class="field wide offer-box">
          <legend class="field-label">Oferta (opcional)</legend>
          <div class="form-grid three">
            <Field label="Precio de oferta" error={errors.offer_text} hint="Vacío: sin oferta. El precio normal se muestra tachado.">
              <input value={draft.offer_text} inputMode="decimal" placeholder="129" disabled={draft.price_mode === 'ask'} onInput={(e) => set('offer_text', e.currentTarget.value)} />
            </Field>
            <Field label="Texto del sello" hint="Vacío: muestra el descuento, por ejemplo -20 %.">
              <input value={draft.offer_label} maxLength={14} placeholder="2x1, Oferta…" onInput={(e) => set('offer_label', e.currentTarget.value)} />
            </Field>
            <Field label="Válida hasta" hint="Vacío: sin fecha de fin.">
              <input type="date" value={draft.offer_ends_at} onInput={(e) => set('offer_ends_at', e.currentTarget.value)} />
            </Field>
          </div>
        </fieldset>
        <Field label="Descripción corta" wide>
          <textarea rows={2} value={draft.description} onInput={(e) => set('description', e.currentTarget.value)} />
        </Field>
        <Field label="Beneficios" hint="Uno por línea. Se muestran en la plantilla de servicio destacado." wide>
          <LinesInput value={draft.benefits} onChange={(v) => set('benefits', v)} rows={3} />
        </Field>
        <Field label="Etiqueta">
          <select value={BADGES.includes(draft.badge) ? draft.badge : '__custom'} onChange={(e) => set('badge', e.currentTarget.value === '__custom' ? 'Promo' : e.currentTarget.value)}>
            <option value="">Sin etiqueta</option>
            <option value="Nuevo">Nuevo</option>
            <option value="Popular">Popular</option>
            <option value="__custom">Otra…</option>
          </select>
          {!BADGES.includes(draft.badge) && <input class="mt" value={draft.badge} maxLength={18} onInput={(e) => set('badge', e.currentTarget.value)} />}
        </Field>
        <Field label="Foto (opcional)" hint="Se reduce a 800 px. Sin foto se usa el ícono de la categoría.">
          <ImagePicker value={draft.image_path} onChange={(v) => set('image_path', v)} />
        </Field>
        <div class="field wide toggles">
          <Toggle checked={draft.visible} onChange={(v) => set('visible', v)} label="Visible en las pantallas" />
          <Toggle checked={draft.available} onChange={(v) => set('available', v)} label="Disponible" />
          <Toggle checked={draft.is_featured} onChange={(v) => set('is_featured', v)} label="Destacado" />
        </div>
      </div>
    </Modal>
  );
}

function BulkAdjust(props: { categories: Category[]; onClose: () => void; onDone: () => void }) {
  const [percent, setPercent] = useState('');
  const [category, setCategory] = useState('');
  const [round, setRound] = useState(true);
  const apply = async () => {
    const match = /^(-?\d{1,3})(?:[.,](\d{1,2}))?$/.exec(percent.trim());
    if (!match) return toast('Escribe un porcentaje, por ejemplo 5 o -2.5', 'warning');
    const negative = match[1].startsWith('-');
    const whole = Math.abs(Number.parseInt(match[1], 10));
    const basisPoints = (whole * 100 + Number.parseInt((match[2] ?? '0').padEnd(2, '0'), 10)) * (negative ? -1 : 1);
    if (basisPoints === 0) return toast('El porcentaje no puede ser 0', 'warning');
    const where = category ? `de "${props.categories.find((c) => String(c.id) === category)?.name}"` : 'de TODAS las categorías';
    const verb = basisPoints > 0 ? 'subirán' : 'bajarán';
    if (!(await confirm('Ajuste masivo de precios', `Los precios ${where} ${verb} ${percent.replace('-', '')} %. Los servicios en "Consultar" no cambian.`, 'Aplicar ajuste', true))) return;
    try {
      const res = await api<{ updated: number }>('POST', '/api/services/bulk-adjust', {
        basis_points: basisPoints,
        category_id: category ? Number(category) : null,
        round_to_dollar: round,
      });
      toast(`${res.updated} precios actualizados`);
      props.onDone();
    } catch (err) {
      showError(err);
    }
  };
  return (
    <Modal title="Ajuste masivo de precios" onClose={props.onClose} footer={<><button class="btn ghost" onClick={props.onClose}>Cancelar</button><button class="btn primary" onClick={() => void apply()}>Aplicar</button></>}>
      <div class="form-grid">
        <Field label="Porcentaje" hint="Positivo sube, negativo baja. Ej.: 5 o -2.5">
          <input value={percent} inputMode="decimal" placeholder="5" onInput={(e) => setPercent(e.currentTarget.value)} autofocus />
        </Field>
        <Field label="Categoría">
          <select value={category} onChange={(e) => setCategory(e.currentTarget.value)}>
            <option value="">Todas</option>
            {props.categories.map((c) => <option value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div class="field wide"><Toggle checked={round} onChange={setRound} label="Redondear al dólar más cercano" /></div>
      </div>
    </Modal>
  );
}

function History(props: { onClose: () => void }) {
  const { data } = useLoad(() => api<PriceChange[]>('GET', '/api/price-history'));
  const show = (mode: PriceMode, cents: number) => {
    const p = formatPrice(mode, cents);
    return `${p.prefix} ${p.text}`.trim();
  };
  return (
    <Modal title="Historial de precios" onClose={props.onClose} wide>
      {!data ? <Loading /> : data.length === 0 ? <p class="muted">Todavía no hay cambios de precio.</p> : (
        <table class="table">
          <thead><tr><th>Fecha</th><th>Servicio</th><th>Antes</th><th>Después</th></tr></thead>
          <tbody>
            {data.map((h) => (
              <tr><td>{formatDate(h.changed_at)}</td><td>{h.service_name}</td><td>{show(h.old_mode, h.old_cents)}</td><td><strong>{show(h.new_mode, h.new_cents)}</strong></td></tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function Services() {
  const services = useLoad(() => api<Service[]>('GET', '/api/services'));
  const categories = useLoad(() => api<Category[]>('GET', '/api/categories'));
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [dialog, setDialog] = useState<'' | 'bulk' | 'history'>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Group by category, in the same order the categories have.
    const order = new Map((categories.data ?? []).map((c, i) => [c.id, i]));
    const rank = (s: Service) => (s.category_id === null ? 9999 : (order.get(s.category_id) ?? 9998));
    return (services.data ?? [])
      .filter((s) => (!filter || String(s.category_id ?? 'none') === filter) && (!term || s.name.toLowerCase().includes(term)))
      .sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order || a.id - b.id);
  }, [services.data, categories.data, filter, search]);

  if (!services.data || !categories.data) return <Loading error={services.error || categories.error} />;
  const cats = categories.data;
  const catName = (id: number | null) => cats.find((c) => c.id === id)?.name ?? '—';
  const patch = (s: Service, body: Partial<Service>, message?: string) =>
    run(() => api('PATCH', `/api/services/${s.id}`, body), message).then(() => services.reload());

  const remove = async (s: Service) => {
    if (!(await confirm('Eliminar servicio', `"${s.name}" se quitará del catálogo y de las pantallas. Esta acción no se puede deshacer.`, 'Eliminar', true))) return;
    await run(() => api('DELETE', `/api/services/${s.id}`), 'Servicio eliminado');
    void services.reload();
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    if (!(await confirm('Importar CSV', `Se actualizarán los servicios que coincidan por nombre y se crearán los nuevos desde "${file.name}".`, 'Importar'))) return;
    try {
      const res = await api<{ created: number; updated: number; price_changes: number }>('POST', '/api/services/import', text, { type: 'text/csv' });
      toast(`${res.updated} actualizados, ${res.created} nuevos, ${res.price_changes} cambios de precio`);
      void services.reload();
      void categories.reload();
    } catch (err) {
      showError(err);
    }
  };

  return (
    <Page
      title="Servicios"
      subtitle="Escribe un precio y pulsa Enter: las pantallas se actualizan en uno o dos segundos."
      actions={
        <>
          <button class="btn ghost" onClick={() => setDialog('history')}>Historial</button>
          <button class="btn ghost" onClick={() => setDialog('bulk')}>Ajuste masivo</button>
          <a class="btn ghost" href={download('/api/services/export.csv')}>Exportar CSV</a>
          <button class="btn ghost" onClick={() => fileRef.current?.click()}>Importar CSV</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void importCsv(f); }} />
          <button class="btn primary" onClick={() => setEditing(emptyDraft(filter && filter !== 'none' ? Number(filter) : null))}>+ Nuevo servicio</button>
        </>
      }
    >
      <div class="toolbar">
        <input type="search" placeholder="Buscar servicio…" value={search} onInput={(e) => setSearch(e.currentTarget.value)} />
        <select value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">Todas las categorías</option>
          {cats.map((c) => <option value={c.id}>{c.name}</option>)}
          <option value="none">Sin categoría</option>
        </select>
        <span class="muted">{rows.length} servicios</span>
      </div>
      <div class="card table-wrap">
        <table class="table services-table">
          <thead>
            <tr><th>Servicio</th><th>Categoría</th><th>Modo</th><th>Precio</th><th>Duración</th><th>Visible</th><th>Disponible</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} class={s.visible ? '' : 'dim'}>
                <td data-label="Servicio" class="cell-name">
                  {s.image_path ? <img class="row-thumb" src={s.image_path} alt="" /> : <span class="row-thumb empty" />}
                  <button class="link" onClick={() => setEditing(toDraft(s))}>{s.name}</button>
                  {s.badge && <span class="chip gold">{s.badge}</span>}
                  {offerActive(s) && <span class="chip offer">Oferta {formatCents(s.offer_cents)}</span>}
                </td>
                <td data-label="Categoría">{catName(s.category_id)}</td>
                <td data-label="Modo">
                  <select class="inline" value={s.price_mode} onChange={(e) => void patch(s, { price_mode: e.currentTarget.value as PriceMode })}>
                    {(Object.keys(MODE_LABELS) as PriceMode[]).map((m) => <option value={m}>{MODE_LABELS[m]}</option>)}
                  </select>
                </td>
                <td data-label="Precio"><PriceCell service={s} onSaved={() => void services.reload()} /></td>
                <td data-label="Duración">{s.duration_min ? `${s.duration_min} min` : '—'}</td>
                <td data-label="Visible"><Toggle checked={s.visible} onChange={(v) => void patch(s, { visible: v })} title="Mostrar en las pantallas" /></td>
                <td data-label="Disponible"><Toggle checked={s.available} onChange={(v) => void patch(s, { available: v })} title="Marcar como disponible" /></td>
                <td class="row-actions">
                  <button class="icon-btn" title="Editar" onClick={() => setEditing(toDraft(s))}>✎</button>
                  <button class="icon-btn danger" title="Eliminar" onClick={() => void remove(s)}>🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} class="muted pad">No hay servicios con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <ServiceForm
          draft={editing}
          categories={cats}
          services={services.data}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void services.reload(); }}
        />
      )}
      {dialog === 'bulk' && <BulkAdjust categories={cats} onClose={() => setDialog('')} onDone={() => { setDialog(''); void services.reload(); }} />}
      {dialog === 'history' && <History onClose={() => setDialog('')} />}
    </Page>
  );
}
