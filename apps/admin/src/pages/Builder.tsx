import {
  DAY_LABELS, GRID_OPTIONS, TEMPLATES, THEMES, THEME_LABELS, TRANSITIONS, TRANSITION_LABELS, getTemplate,
  type Person, type SlideSchedule, type SlideSlots, type SourceType, type Transition,
} from '@drdrip/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { api, getToken, type Category, type Promo, type Screen, type Service, type Slide, type Version } from '../api';
import { Field, ImagePicker, LinesInput, Loading, Modal, Toggle, confirm, formatDate, prompt, run, showError, toast, useLoad } from '../ui';

const SOURCE_LABELS: Record<SourceType, string> = { category: 'Una categoría completa', services: 'Servicios elegidos a mano', promo: 'Una promoción' };

// --- Live preview ----------------------------------------------------------------

function Preview(props: { screen: Screen; slideKey: string | null; version: number }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const portrait = props.screen.orientation === 'portrait';
  const [w, h] = portrait ? [720, 1280] : [1280, 720];
  const src = useRef(`/player/player.html?pantalla=${props.screen.id}&borrador=1&calidad=media&token=${getToken()}${props.slideKey ? `&diapositiva=${props.slideKey}` : ''}`);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(Math.min((el.clientWidth - 32) / w, (portrait ? 620 : 2000) / h)); // 32 = padding
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [w, h]);

  // Tell the player which slide to hold, and to refetch the draft after each save.
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'vitrina-preview', slideKey: props.slideKey }, window.location.origin);
  }, [props.slideKey, props.version]);

  return (
    <div class="preview" ref={box}>
      <div class="preview-frame" style={{ width: `${w * scale}px`, height: `${h * scale}px` }}>
        <iframe ref={frame} src={src.current} title="Vista previa" style={{ width: `${w}px`, height: `${h}px`, transform: `scale(${scale})` }} />
      </div>
    </div>
  );
}

// --- Slide editor ------------------------------------------------------------------

function SourceEditor(props: { slots: SlideSlots; allowed: SourceType[]; services: Service[]; categories: Category[]; promos: Promo[]; onChange: (slots: SlideSlots) => void; single?: boolean }) {
  const { slots, allowed } = props;
  const type = slots.source && allowed.includes(slots.source.type) ? slots.source.type : null;
  const setSource = (source: SlideSlots['source']) => props.onChange({ ...slots, source });
  const ids = slots.source?.serviceIds ?? [];
  const toggle = (id: number) => setSource({ type: 'services', serviceIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });

  return (
    <div class="field wide">
      <span class="field-label">Contenido</span>
      {allowed.length > 1 && (
        <div class="segmented">
          {allowed.map((t) => (
            <button class={type === t ? 'active' : ''} onClick={() => setSource(t === 'category' ? { type: t, categoryId: props.categories[0]?.id } : t === 'services' ? { type: t, serviceIds: [] } : { type: t, promoId: props.promos[0]?.id })}>
              {SOURCE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {type === null && allowed.length > 1 && <span class="field-error">Elige qué mostrará esta diapositiva.</span>}
      {(type === 'category') && (
        <select value={slots.source?.categoryId ?? ''} onChange={(e) => setSource({ type: 'category', categoryId: Number(e.currentTarget.value) })}>
          {props.categories.map((c) => <option value={c.id}>{c.name} ({props.services.filter((s) => s.category_id === c.id && s.visible).length} visibles)</option>)}
        </select>
      )}
      {(type === 'services' || (allowed.length === 1 && allowed[0] === 'services')) && (
        <div class="checklist">
          {props.categories.map((c) => {
            const list = props.services.filter((s) => s.category_id === c.id);
            if (!list.length) return null;
            return (
              <div>
                <strong>{c.name}</strong>
                {list.map((s) => (
                  <label class={s.visible ? '' : 'dim'}>
                    <input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} />
                    {s.name}{!s.visible && ' (oculto)'}
                    {ids.includes(s.id) && <em>{ids.indexOf(s.id) + 1}</em>}
                  </label>
                ))}
              </div>
            );
          })}
          <p class="field-hint">Se muestran en el orden en que los marcas.{props.single ? ' Con varios, cada vuelta destaca el siguiente.' : ''}</p>
        </div>
      )}
      {(type === 'promo' || (allowed.length === 1 && allowed[0] === 'promo')) && (
        props.promos.length === 0 ? <span class="field-error">No hay promociones. Créalas en "Complementos y más".</span> : (
          <select value={slots.source?.promoId ?? ''} onChange={(e) => setSource({ type: 'promo', promoId: Number(e.currentTarget.value) })}>
            {!slots.source?.promoId && <option value="">Elige una promoción…</option>}
            {props.promos.map((p) => <option value={p.id}>{p.title}</option>)}
          </select>
        )
      )}
    </div>
  );
}

function PeopleEditor(props: { value: Person[]; onChange: (value: Person[]) => void }) {
  const people = props.value;
  const set = (i: number, patch: Partial<Person>) => props.onChange(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div class="field wide">
      <span class="field-label">Personas o testimonios</span>
      <p class="field-hint">Usa fotos y nombres solo con permiso de cada persona.</p>
      {people.map((p, i) => (
        <div class="person-row">
          <ImagePicker value={p.image ?? ''} onChange={(v) => set(i, { image: v })} label="Foto" />
          <div class="person-fields">
            <input placeholder="Nombre" value={p.name} onInput={(e) => set(i, { name: e.currentTarget.value })} />
            <input placeholder="Cargo (opcional)" value={p.role ?? ''} onInput={(e) => set(i, { role: e.currentTarget.value })} />
            <input placeholder="Testimonio (opcional)" value={p.quote ?? ''} onInput={(e) => set(i, { quote: e.currentTarget.value })} />
          </div>
          <button class="icon-btn danger" title="Quitar" onClick={() => props.onChange(people.filter((_, j) => j !== i))}>🗑</button>
        </div>
      ))}
      <button class="btn small ghost" onClick={() => props.onChange([...people, { name: '' }])}>+ Agregar persona</button>
    </div>
  );
}

function ScheduleEditor(props: { value: SlideSchedule; onChange: (value: SlideSchedule) => void }) {
  const s = props.value;
  const days = s.days ?? [];
  const toggleDay = (d: number) => props.onChange({ ...s, days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });
  return (
    <fieldset class="field wide schedule">
      <legend class="field-label">Horario (hora de Puerto Rico)</legend>
      <div class="days">
        {DAY_LABELS.map((label, d) => <button class={days.includes(d) ? 'active' : ''} onClick={() => toggleDay(d)}>{label}</button>)}
        <span class="field-hint">{days.length ? '' : 'Todos los días'}</span>
      </div>
      <div class="inline-fields">
        <label>Desde <input type="time" value={s.from ?? ''} onInput={(e) => props.onChange({ ...s, from: e.currentTarget.value || undefined })} /></label>
        <label>Hasta <input type="time" value={s.to ?? ''} onInput={(e) => props.onChange({ ...s, to: e.currentTarget.value || undefined })} /></label>
        <select value={s.clinic ?? 'any'} onChange={(e) => props.onChange({ ...s, clinic: e.currentTarget.value as SlideSchedule['clinic'] })}>
          <option value="any">Con la clínica abierta o cerrada</option>
          <option value="open">Solo en horario de la clínica</option>
          <option value="closed">Solo fuera del horario de la clínica</option>
        </select>
      </div>
    </fieldset>
  );
}

function SlideEditor(props: { slide: Slide; screen: Screen; services: Service[]; categories: Category[]; promos: Promo[]; onChange: (patch: Partial<Slide>) => void }) {
  const { slide } = props;
  const meta = getTemplate(slide.template);
  if (!meta) return <p class="muted">Plantilla desconocida.</p>;
  const slots = slide.config_json ?? {};
  const setSlots = (next: SlideSlots) => props.onChange({ config_json: next });
  const has = (field: string) => (meta.fields as string[]).includes(field);

  return (
    <div class="form-grid">
      <p class="muted wide">{meta.description}</p>
      {has('title') && <Field label="Título"><input value={slots.title ?? ''} onInput={(e) => setSlots({ ...slots, title: e.currentTarget.value })} /></Field>}
      {has('subtitle') && <Field label="Subtítulo"><input value={slots.subtitle ?? ''} onInput={(e) => setSlots({ ...slots, subtitle: e.currentTarget.value })} /></Field>}
      {meta.sources.length > 0 && (
        <SourceEditor slots={slots} allowed={meta.sources} services={props.services} categories={props.categories} promos={props.promos} onChange={setSlots} single={meta.id === 'featured-service'} />
      )}
      {has('columns') && (
        <Field label="Columnas">
          <select value={slots.columns ?? 1} onChange={(e) => setSlots({ ...slots, columns: Number(e.currentTarget.value) })}>
            <option value="1">1 columna</option><option value="2">2 columnas</option>
          </select>
        </Field>
      )}
      {has('grid') && (
        <Field label="Cuadrícula" hint="Columnas x filas. Si hay más servicios, se reparten en páginas.">
          <select value={slots.grid ?? '3x2'} onChange={(e) => setSlots({ ...slots, grid: e.currentTarget.value })}>
            {GRID_OPTIONS.map((g) => <option value={g}>{g}</option>)}
          </select>
        </Field>
      )}
      {has('body') && <Field label="Texto" wide><textarea rows={4} value={slots.body ?? ''} onInput={(e) => setSlots({ ...slots, body: e.currentTarget.value })} /></Field>}
      {has('items') && <Field label="Beneficios" hint="Uno por línea. Vacío: usa los de Marca y apariencia." wide><LinesInput value={slots.items ?? []} onChange={(v) => setSlots({ ...slots, items: v })} /></Field>}
      {has('image') && <Field label="Imagen"><ImagePicker value={slots.image ?? ''} onChange={(v) => setSlots({ ...slots, image: v })} /></Field>}
      {has('video') && <Field label="Video corto (MP4 o WebM, sin sonido)"><ImagePicker value={slots.video ?? ''} accept="video/mp4,video/webm" onChange={(v) => setSlots({ ...slots, video: v })} /></Field>}
      {has('people') && <PeopleEditor value={slots.people ?? []} onChange={(v) => setSlots({ ...slots, people: v })} />}

      <Field label="Tema">
        <select value={slide.theme} onChange={(e) => props.onChange({ theme: e.currentTarget.value })}>
          <option value="">El de la pantalla ({THEME_LABELS[props.screen.theme as keyof typeof THEME_LABELS]})</option>
          {THEMES.map((t) => <option value={t}>{THEME_LABELS[t]}</option>)}
        </select>
      </Field>
      <Field label="Duración (segundos)">
        <input type="number" min="3" max="600" value={slide.duration_s} onInput={(e) => {
          const n = Number.parseInt(e.currentTarget.value, 10);
          if (Number.isInteger(n) && n >= 3 && n <= 600) props.onChange({ duration_s: n });
        }} />
      </Field>
      <Field label="Transición de entrada">
        <select value={slide.transition} onChange={(e) => props.onChange({ transition: e.currentTarget.value })}>
          {TRANSITIONS.map((t: Transition) => <option value={t}>{TRANSITION_LABELS[t]}</option>)}
        </select>
      </Field>
      <ScheduleEditor value={slide.schedule_json ?? {}} onChange={(v) => props.onChange({ schedule_json: v })} />
    </div>
  );
}

// --- Builder page ---------------------------------------------------------------------

export function Builder(props: { screenId: number }) {
  const id = props.screenId;
  const [screen, setScreen] = useState<Screen | null>(null);
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [fullLoop, setFullLoop] = useState(false);
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<'' | 'add' | 'versions' | 'settings'>('');
  const [missing, setMissing] = useState(false);
  const catalog = useLoad(async () => ({
    services: await api<Service[]>('GET', '/api/services'),
    categories: await api<Category[]>('GET', '/api/categories'),
    promos: await api<Promo[]>('GET', '/api/promos'),
  }));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, Record<string, unknown>>());

  const refreshScreen = async () => setScreen((await api<Screen[]>('GET', '/api/screens')).find((s) => s.id === id) ?? null);
  const load = async () => {
    try {
      const list = await api<Slide[]>('GET', `/api/screens/${id}/slides`);
      setSlides(list);
      setSelected((current) => (list.some((s) => s.id === current) ? current : (list[0]?.id ?? null)));
      await refreshScreen();
      setVersion((v) => v + 1);
    } catch {
      setMissing(true);
    }
  };
  useEffect(() => { void load(); }, [id]);

  /** Draft edits are saved by themselves a moment after typing stops. */
  const queueSave = (key: string, url: string, patch: Record<string, unknown>) => {
    pending.current.set(key, { ...pending.current.get(key), ...patch });
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(async () => {
      const body = pending.current.get(key);
      pending.current.delete(key);
      try {
        await api('PATCH', url, body);
        setVersion((v) => v + 1);
        await refreshScreen();
      } catch (err) {
        showError(err);
        void load();
      }
    }, 450));
  };

  if (missing) return <div class="page"><p class="pad">Esta pantalla no existe. <a href="#/pantallas">Volver a Pantallas</a></p></div>;
  if (!screen || !slides || !catalog.data) return <Loading error={catalog.error} />;

  const current = slides.find((s) => s.id === selected) ?? null;
  const slideKey = fullLoop || !current || !current.active ? null : `s${slides.indexOf(current)}`;

  const patchSlide = (slide: Slide, patch: Partial<Slide>) => {
    setSlides(slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)));
    queueSave(`slide-${slide.id}`, `/api/slides/${slide.id}`, patch);
  };
  const patchScreen = (patch: Partial<Screen>) => {
    setScreen({ ...screen, ...patch });
    queueSave('screen', `/api/screens/${id}`, patch);
  };

  const addSlide = async (template: string) => {
    setDialog('');
    try {
      const slide = await api<Slide>('POST', `/api/screens/${id}/slides`, { template });
      await load();
      setSelected(slide.id);
      setFullLoop(false);
    } catch (err) {
      showError(err);
    }
  };
  const move = async (index: number, delta: number) => {
    const next = [...slides];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setSlides(next);
    await run(() => api('POST', `/api/screens/${id}/slides/reorder`, { ids: next.map((s) => s.id) }));
    void load();
  };
  const removeSlide = async (slide: Slide) => {
    if (!(await confirm('Eliminar diapositiva', `Se quitará "${getTemplate(slide.template)?.label ?? slide.template}" de esta pantalla.`, 'Eliminar', true))) return;
    await run(() => api('DELETE', `/api/slides/${slide.id}`));
    void load();
  };
  const duplicateSlide = async (slide: Slide) => {
    await run(() => api('POST', `/api/slides/${slide.id}/duplicate`));
    void load();
  };

  const publish = async () => {
    const empty = slides.filter((s) => s.active).length === 0;
    if (empty && !(await confirm('Pantalla sin diapositivas', 'No hay diapositivas activas: los televisores mostrarán solo la portada de marca.', 'Publicar igual'))) return;
    const note = await prompt('Publicar en los televisores', 'Nota para identificar esta versión (opcional)', '', 'Ej.: Precios de diciembre');
    if (note === null) return;
    if (await run(() => api('POST', `/api/screens/${id}/publish`, { note }), 'Publicado. Las pantallas se actualizan en segundos.')) void load();
  };
  const discard = async () => {
    if (!(await confirm('Descartar cambios', 'El borrador volverá a lo que está publicado ahora en los televisores.', 'Descartar', true))) return;
    if (await run(() => api('POST', `/api/screens/${id}/discard`), 'Borrador descartado')) void load();
  };

  return (
    <div class="page builder">
      <header class="page-head">
        <div>
          <a class="back" href="#/pantallas">← Pantallas</a>
          <h1>{screen.name} <code class="addr">/{screen.id}</code></h1>
          <p class="muted">
            {screen.published_at === null ? 'Todavía no se ha publicado.' : screen.dirty ? 'Hay cambios en el borrador que los televisores aún no muestran.' : `Publicada ${formatDate(screen.published_at)}. Sin cambios pendientes.`}
          </p>
        </div>
        <div class="actions">
          <button class="btn ghost" onClick={() => setDialog('settings')}>Ajustes de pantalla</button>
          <button class="btn ghost" onClick={() => setDialog('versions')}>Versiones</button>
          {screen.dirty && screen.published_at !== null && <button class="btn ghost" onClick={() => void discard()}>Descartar</button>}
          <button class={`btn primary${screen.dirty ? ' pulse' : ''}`} disabled={!screen.dirty} onClick={() => void publish()}>Publicar</button>
        </div>
      </header>

      <div class="builder-grid">
        <section class="card slides-panel">
          <header class="card-head"><h2>Diapositivas</h2><button class="btn primary small" onClick={() => setDialog('add')}>+ Agregar</button></header>
          <ol class="slide-list">
            {slides.map((s, i) => {
              const meta = getTemplate(s.template);
              return (
                <li key={s.id} class={`${s.id === selected && !fullLoop ? 'selected' : ''}${s.active ? '' : ' dim'}`}>
                  <button class="slide-pick" onClick={() => { setSelected(s.id); setFullLoop(false); }}>
                    <span class="slide-pos">{i + 1}</span>
                    <span>
                      <strong>{meta?.label ?? s.template}</strong>
                      <small>{s.config_json?.title || meta?.defaults.title || ''} · {s.duration_s} s</small>
                    </span>
                  </button>
                  <span class="slide-tools">
                    <Toggle checked={s.active} onChange={(v) => patchSlide(s, { active: v })} title="Activa" />
                    <button class="icon-btn" title="Subir" disabled={i === 0} onClick={() => void move(i, -1)}>↑</button>
                    <button class="icon-btn" title="Bajar" disabled={i === slides.length - 1} onClick={() => void move(i, 1)}>↓</button>
                    <button class="icon-btn" title="Duplicar" onClick={() => void duplicateSlide(s)}>⧉</button>
                    <button class="icon-btn danger" title="Eliminar" onClick={() => void removeSlide(s)}>🗑</button>
                  </span>
                </li>
              );
            })}
            {slides.length === 0 && <li class="muted pad">Sin diapositivas: se muestra la portada de marca.</li>}
          </ol>
        </section>

        <div class="builder-main">
          <section class="card">
            <header class="card-head">
              <h2>Vista previa del borrador</h2>
              <Toggle checked={fullLoop} onChange={setFullLoop} label="Ver la secuencia completa" />
            </header>
            <Preview key={`${screen.orientation}`} screen={screen} slideKey={slideKey} version={version} />
          </section>
          {current && !fullLoop && (
            <section class="card">
              <header class="card-head"><h2>{slides.indexOf(current) + 1}. {getTemplate(current.template)?.label}</h2></header>
              <SlideEditor key={current.id} slide={current} screen={screen} services={catalog.data.services} categories={catalog.data.categories} promos={catalog.data.promos} onChange={(patch) => patchSlide(current, patch)} />
            </section>
          )}
        </div>
      </div>

      {dialog === 'add' && (
        <Modal title="Agregar diapositiva" onClose={() => setDialog('')} wide>
          <div class="template-grid">
            {TEMPLATES.map((t) => (
              <button class="template-card" onClick={() => void addSlide(t.id)}>
                <strong>{t.label}</strong>
                <span>{t.description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'settings' && (
        <Modal title="Ajustes de pantalla" onClose={() => setDialog('')} wide footer={<button class="btn primary" onClick={() => setDialog('')}>Listo</button>}>
          <div class="form-grid">
            <Field label="Nombre"><input value={screen.name} onInput={(e) => e.currentTarget.value.trim() && patchScreen({ name: e.currentTarget.value })} /></Field>
            <Field label="Tema">
              <select value={screen.theme} onChange={(e) => patchScreen({ theme: e.currentTarget.value })}>
                {THEMES.map((t) => <option value={t}>{THEME_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Orientación" hint="Vertical gira la imagen si el televisor está colgado de lado.">
              <select value={screen.orientation} onChange={(e) => patchScreen({ orientation: e.currentTarget.value as Screen['orientation'] })}>
                <option value="landscape">Horizontal</option><option value="portrait">Vertical</option>
              </select>
            </Field>
            <Field label="Resolución">
              <select value={screen.resolution} onChange={(e) => patchScreen({ resolution: e.currentTarget.value })}>
                <option value="720p">720p (HD)</option><option value="1080p">1080p (Full HD)</option><option value="4k">4K</option>
              </select>
            </Field>
            <div class="field wide toggles">
              <Toggle checked={screen.show_header} onChange={(v) => patchScreen({ show_header: v })} label="Encabezado con logo" />
              <Toggle checked={screen.show_clock} onChange={(v) => patchScreen({ show_clock: v })} label="Reloj" />
              <Toggle checked={screen.show_footer} onChange={(v) => patchScreen({ show_footer: v })} label="Pie con teléfono y mensajes" />
              <Toggle checked={screen.active} onChange={(v) => patchScreen({ active: v })} label="Pantalla activa" />
            </div>
            <Field label="Mensajes rotativos del pie" hint="Uno por línea. Después rotan el horario y la dirección." wide>
              <textarea rows={4} value={screen.ticker_text} onInput={(e) => patchScreen({ ticker_text: e.currentTarget.value })} />
            </Field>
            <p class="muted wide">El nombre y "Pantalla activa" se aplican al instante. Lo demás se aplica al pulsar Publicar.</p>
          </div>
        </Modal>
      )}
      {dialog === 'versions' && <Versions screenId={id} onClose={() => setDialog('')} onRestored={() => { setDialog(''); void load(); }} />}
    </div>
  );
}

function Versions(props: { screenId: number; onClose: () => void; onRestored: () => void }) {
  const { data } = useLoad(() => api<Version[]>('GET', `/api/screens/${props.screenId}/versions`));
  const restore = async (v: Version) => {
    if (!(await confirm('Volver a esta versión', `Los televisores mostrarán de nuevo la versión del ${formatDate(v.published_at)}. El borrador actual se reemplaza.`, 'Restaurar'))) return;
    try {
      await api('POST', `/api/versions/${v.id}/restore`);
      toast('Versión restaurada y publicada');
      props.onRestored();
    } catch (err) {
      showError(err);
    }
  };
  return (
    <Modal title="Versiones publicadas" onClose={props.onClose} wide>
      {!data ? <Loading /> : data.length === 0 ? <p class="muted">Esta pantalla todavía no se ha publicado.</p> : (
        <table class="table">
          <thead><tr><th>Fecha</th><th>Nota</th><th>Diapositivas</th><th /></tr></thead>
          <tbody>
            {data.map((v, i) => (
              <tr>
                <td>{formatDate(v.published_at)}</td><td>{v.note || '—'}</td><td>{v.slides}</td>
                <td class="row-actions">{i === 0 ? <span class="chip ok">En pantalla</span> : <button class="btn small ghost" onClick={() => void restore(v)}>Restaurar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
