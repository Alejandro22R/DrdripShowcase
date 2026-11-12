import { centsToInput, formatCents, parsePriceInput } from '@drdrip/shared';
import { useState } from 'preact/hooks';
import { api, type Addon, type Category, type Promo } from '../api';
import { Field, ImagePicker, Loading, Modal, Page, Toggle, confirm, run, toast, useLoad } from '../ui';

const ICONS: [string, string][] = [
  ['drop', 'Gota'], ['syringe', 'Jeringa'], ['stethoscope', 'Estetoscopio'], ['scale', 'Báscula'],
  ['sparkle', 'Destello'], ['wave', 'Ondas'], ['gift', 'Regalo'], ['shield', 'Escudo'], ['bolt', 'Rayo'],
];

function Addons() {
  const { data, reload, error } = useLoad(() => api<Addon[]>('GET', '/api/addons'));
  const [editing, setEditing] = useState<(Partial<Addon> & { price_text: string }) | null>(null);
  if (!data) return <Loading error={error} />;

  const save = async () => {
    if (!editing) return;
    const name = (editing.name ?? '').trim();
    const cents = parsePriceInput(editing.price_text);
    if (!name || cents === null) return toast('Completa el nombre y un precio válido', 'warning');
    const body = { name, price_cents: cents, description: editing.description ?? '' };
    const ok = await run(() => (editing.id ? api('PATCH', `/api/addons/${editing.id}`, body) : api('POST', '/api/addons', { ...body, sort_order: data.length })), 'Complemento guardado');
    if (ok) { setEditing(null); void reload(); }
  };
  const remove = async (a: Addon) => {
    if (await confirm('Eliminar complemento', `"${a.name}" dejará de mostrarse.`, 'Eliminar', true)) {
      await run(() => api('DELETE', `/api/addons/${a.id}`));
      void reload();
    }
  };

  return (
    <section class="card">
      <header class="card-head">
        <div><h2>Complementos (IV Add-ins)</h2><p class="muted">Se agregan el día de la infusión. Aparecen en la plantilla "Arma tu drip".</p></div>
        <button class="btn primary small" onClick={() => setEditing({ price_text: '' })}>+ Complemento</button>
      </header>
      <table class="table">
        <thead><tr><th>Nombre</th><th>Precio</th><th>Activo</th><th /></tr></thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} class={a.active ? '' : 'dim'}>
              <td data-label="Nombre"><button class="link" onClick={() => setEditing({ ...a, price_text: centsToInput(a.price_cents) })}>{a.name}</button></td>
              <td data-label="Precio">{formatCents(a.price_cents)}</td>
              <td data-label="Activo"><Toggle checked={a.active} onChange={(v) => void run(() => api('PATCH', `/api/addons/${a.id}`, { active: v })).then(reload)} /></td>
              <td class="row-actions"><button class="icon-btn danger" title="Eliminar" onClick={() => void remove(a)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={editing.id ? 'Editar complemento' : 'Nuevo complemento'} onClose={() => setEditing(null)}
          footer={<><button class="btn ghost" onClick={() => setEditing(null)}>Cancelar</button><button class="btn primary" onClick={() => void save()}>Guardar</button></>}>
          <div class="form-grid">
            <Field label="Nombre"><input value={editing.name ?? ''} onInput={(e) => setEditing({ ...editing, name: e.currentTarget.value })} autofocus /></Field>
            <Field label="Precio (USD)"><input value={editing.price_text} inputMode="decimal" placeholder="10" onInput={(e) => setEditing({ ...editing, price_text: e.currentTarget.value })} /></Field>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Categories() {
  const { data, reload, error } = useLoad(() => api<Category[]>('GET', '/api/categories'));
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  if (!data) return <Loading error={error} />;

  const save = async () => {
    if (!editing) return;
    const name = (editing.name ?? '').trim();
    if (!name) return toast('Escribe el nombre de la categoría', 'warning');
    if (data.some((c) => c.id !== editing.id && c.name.toLowerCase() === name.toLowerCase())) return toast('Ya existe una categoría con ese nombre', 'warning');
    const body = { name, icon: editing.icon ?? 'drop' };
    const ok = await run(() => (editing.id ? api('PATCH', `/api/categories/${editing.id}`, body) : api('POST', '/api/categories', { ...body, sort_order: data.length })), 'Categoría guardada');
    if (ok) { setEditing(null); void reload(); }
  };
  const move = async (index: number, delta: number) => {
    const other = data[index + delta];
    if (!other) return;
    await run(async () => {
      await api('PATCH', `/api/categories/${data[index].id}`, { sort_order: index + delta });
      await api('PATCH', `/api/categories/${other.id}`, { sort_order: index });
    });
    void reload();
  };
  const remove = async (c: Category) => {
    if (await confirm('Eliminar categoría', `Los servicios de "${c.name}" no se borran: quedan sin categoría.`, 'Eliminar', true)) {
      await run(() => api('DELETE', `/api/categories/${c.id}`));
      void reload();
    }
  };

  return (
    <section class="card">
      <header class="card-head">
        <div><h2>Categorías</h2><p class="muted">Una categoría inactiva no se muestra en ninguna pantalla.</p></div>
        <button class="btn primary small" onClick={() => setEditing({ icon: 'drop' })}>+ Categoría</button>
      </header>
      <table class="table">
        <thead><tr><th>Nombre</th><th>Ícono</th><th>Activa</th><th /></tr></thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={c.id} class={c.active ? '' : 'dim'}>
              <td data-label="Nombre"><button class="link" onClick={() => setEditing(c)}>{c.name}</button></td>
              <td data-label="Ícono">{ICONS.find(([id]) => id === c.icon)?.[1] ?? '—'}</td>
              <td data-label="Activa"><Toggle checked={c.active} onChange={(v) => void run(() => api('PATCH', `/api/categories/${c.id}`, { active: v })).then(reload)} /></td>
              <td class="row-actions">
                <button class="icon-btn" title="Subir" disabled={i === 0} onClick={() => void move(i, -1)}>↑</button>
                <button class="icon-btn" title="Bajar" disabled={i === data.length - 1} onClick={() => void move(i, 1)}>↓</button>
                <button class="icon-btn danger" title="Eliminar" onClick={() => void remove(c)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <Modal title={editing.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setEditing(null)}
          footer={<><button class="btn ghost" onClick={() => setEditing(null)}>Cancelar</button><button class="btn primary" onClick={() => void save()}>Guardar</button></>}>
          <div class="form-grid">
            <Field label="Nombre"><input value={editing.name ?? ''} onInput={(e) => setEditing({ ...editing, name: e.currentTarget.value })} autofocus /></Field>
            <Field label="Ícono" hint="Se usa en las tarjetas cuando el servicio no tiene foto.">
              <select value={editing.icon ?? 'drop'} onChange={(e) => setEditing({ ...editing, icon: e.currentTarget.value })}>
                {ICONS.map(([id, label]) => <option value={id}>{label}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Promos() {
  const { data, reload, error } = useLoad(() => api<Promo[]>('GET', '/api/promos'));
  const [editing, setEditing] = useState<Partial<Promo> | null>(null);
  if (!data) return <Loading error={error} />;

  const save = async () => {
    if (!editing) return;
    const title = (editing.title ?? '').trim();
    if (!title) return toast('Escribe el título de la promoción', 'warning');
    if (editing.starts_at && editing.ends_at && editing.starts_at > editing.ends_at) return toast('La fecha de fin es anterior a la de inicio', 'warning');
    const body = { title, subtitle: editing.subtitle ?? '', image_path: editing.image_path ?? '', starts_at: editing.starts_at ?? '', ends_at: editing.ends_at ?? '' };
    const ok = await run(() => (editing.id ? api('PATCH', `/api/promos/${editing.id}`, body) : api('POST', '/api/promos', body)), 'Promoción guardada');
    if (ok) { setEditing(null); void reload(); }
  };
  const remove = async (p: Promo) => {
    if (await confirm('Eliminar promoción', `"${p.title}" se quitará. Las diapositivas que la usen mostrarán la portada de marca.`, 'Eliminar', true)) {
      await run(() => api('DELETE', `/api/promos/${p.id}`));
      void reload();
    }
  };
  const validity = (p: Promo) => (!p.starts_at && !p.ends_at ? 'Siempre' : `${p.starts_at || '…'} → ${p.ends_at || '…'}`);

  return (
    <section class="card">
      <header class="card-head">
        <div><h2>Promociones y Gift Cards</h2><p class="muted">Fuera de sus fechas, la promoción deja de mostrarse sola. Para verla en una pantalla, agrega una diapositiva "Promoción".</p></div>
        <button class="btn primary small" onClick={() => setEditing({})}>+ Promoción</button>
      </header>
      <table class="table">
        <thead><tr><th>Título</th><th>Vigencia</th><th>Activa</th><th /></tr></thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} class={p.active ? '' : 'dim'}>
              <td data-label="Título"><button class="link" onClick={() => setEditing(p)}>{p.title}</button><div class="muted small">{p.subtitle}</div></td>
              <td data-label="Vigencia">{validity(p)}</td>
              <td data-label="Activa"><Toggle checked={p.active} onChange={(v) => void run(() => api('PATCH', `/api/promos/${p.id}`, { active: v })).then(reload)} /></td>
              <td class="row-actions"><button class="icon-btn danger" title="Eliminar" onClick={() => void remove(p)}>🗑</button></td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={4} class="muted pad">No hay promociones.</td></tr>}
        </tbody>
      </table>
      {editing && (
        <Modal title={editing.id ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setEditing(null)} wide
          footer={<><button class="btn ghost" onClick={() => setEditing(null)}>Cancelar</button><button class="btn primary" onClick={() => void save()}>Guardar</button></>}>
          <div class="form-grid">
            <Field label="Título" wide><input value={editing.title ?? ''} onInput={(e) => setEditing({ ...editing, title: e.currentTarget.value })} autofocus /></Field>
            <Field label="Texto" wide><textarea rows={2} value={editing.subtitle ?? ''} onInput={(e) => setEditing({ ...editing, subtitle: e.currentTarget.value })} /></Field>
            <Field label="Desde" hint="Vacío: sin fecha de inicio"><input type="date" value={editing.starts_at ?? ''} onInput={(e) => setEditing({ ...editing, starts_at: e.currentTarget.value })} /></Field>
            <Field label="Hasta" hint="Vacío: sin fecha de fin"><input type="date" value={editing.ends_at ?? ''} onInput={(e) => setEditing({ ...editing, ends_at: e.currentTarget.value })} /></Field>
            <Field label="Imagen (opcional)" wide><ImagePicker value={editing.image_path ?? ''} onChange={(v) => setEditing({ ...editing, image_path: v })} /></Field>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function Catalog() {
  return (
    <Page title="Complementos, categorías y promociones">
      <div class="stack">
        <Addons />
        <Categories />
        <Promos />
      </div>
    </Page>
  );
}
