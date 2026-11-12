import { DAY_LABELS } from '@drdrip/shared';
import { useEffect, useState } from 'preact/hooks';
import { api, type Settings } from '../api';
import { Field, ImagePicker, LinesInput, Loading, Page, Toggle, run, toast, useUnsavedWarning } from '../ui';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function Brand() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => {
    void api<Settings>('GET', '/api/settings').then((s) => { setSaved(s); setDraft(s); });
  }, []);
  const dirty = saved !== null && draft !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  useUnsavedWarning(dirty);
  if (!draft || !saved) return <Loading />;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft({ ...draft, [key]: value });
  const setDay = (day: string, range: [string, string] | null) => set('clinic_hours', { ...draft.clinic_hours, [day]: range });

  const save = async () => {
    for (const [day, range] of Object.entries(draft.clinic_hours)) {
      if (range && (!TIME.test(range[0]) || !TIME.test(range[1]) || range[0] >= range[1])) {
        return toast(`Revisa el horario del ${DAY_LABELS[Number(day)]}: la apertura debe ser antes del cierre.`, 'warning');
      }
    }
    if (!draft.brand_name.trim()) return toast('El nombre de la marca no puede quedar vacío', 'warning');
    // Send only what changed, so nothing else is touched.
    const patch: Record<string, unknown> = {};
    for (const key of Object.keys(draft) as (keyof Settings)[]) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(saved[key])) patch[key] = draft[key];
    }
    await run(async () => {
      const next = await api<Settings>('PATCH', '/api/settings', patch);
      setSaved(next);
      setDraft(next);
    }, 'Guardado. Las pantallas ya muestran los cambios.');
  };

  const range = (key: 'logo_size' | 'transition_logo_size' | 'photo_size', label: string) => (
    <Field label={`${label}: ${draft[key]} %`}>
      <input type="range" min="60" max="160" step="5" value={draft[key]} onInput={(e) => set(key, Number(e.currentTarget.value))} />
    </Field>
  );

  return (
    <Page title="Marca y apariencia" subtitle="Estos datos se aplican a todas las pantallas al guardar."
      actions={<>
        {dirty && <button class="btn ghost" onClick={() => setDraft(saved)}>Deshacer</button>}
        <button class="btn primary" disabled={!dirty} onClick={() => void save()}>Guardar cambios</button>
      </>}>
      <div class="stack">
        <section class="card">
          <header class="card-head"><h2>Identidad</h2></header>
          <div class="form-grid">
            <Field label="Nombre"><input value={draft.brand_name} onInput={(e) => set('brand_name', e.currentTarget.value)} /></Field>
            <Field label="Descriptor"><input value={draft.descriptor} onInput={(e) => set('descriptor', e.currentTarget.value)} /></Field>
            <Field label="Lema" wide><input value={draft.tagline} onInput={(e) => set('tagline', e.currentTarget.value)} /></Field>
            <Field label="Frases de marca" hint="Una por línea. Rotan en la portada." wide><LinesInput value={draft.phrases} onChange={(v) => set('phrases', v)} rows={3} /></Field>
            <Field label="Logo" hint="PNG con fondo transparente. Sin archivo se usa el símbolo de la gota.">
              <ImagePicker value={draft.logo_path} onChange={(v) => set('logo_path', v)} />
            </Field>
            <div class="field">
              {range('logo_size', 'Tamaño del logo')}
              {range('transition_logo_size', 'Logo en la transición')}
              {range('photo_size', 'Tamaño de las fotos')}
            </div>
            <div class="field wide"><Toggle checked={draft.show_welcome} onChange={(v) => set('show_welcome', v)} label="Mostrar la bienvenida de marca al encender la pantalla" /></div>
          </div>
        </section>

        <section class="card">
          <header class="card-head"><h2>Contacto y pie de pantalla</h2></header>
          <div class="form-grid">
            <Field label="Teléfono"><input value={draft.phone} onInput={(e) => set('phone', e.currentTarget.value)} /></Field>
            <Field label="Instagram"><input value={draft.instagram} onInput={(e) => set('instagram', e.currentTarget.value)} /></Field>
            <Field label="Dirección" wide><input value={draft.address} onInput={(e) => set('address', e.currentTarget.value)} /></Field>
            <Field label="Horario (texto que se muestra)" wide><input value={draft.hours_text} onInput={(e) => set('hours_text', e.currentTarget.value)} /></Field>
            <Field label="Segundos por mensaje rotativo">
              <input type="number" min="3" max="60" value={draft.ticker_seconds} onInput={(e) => { const n = Number.parseInt(e.currentTarget.value, 10); if (n >= 3 && n <= 60) set('ticker_seconds', n); }} />
            </Field>
          </div>
        </section>

        <section class="card">
          <header class="card-head"><div><h2>Horario de la clínica</h2><p class="muted">Lo usan las diapositivas programadas "solo en horario de la clínica" o "fuera del horario".</p></div></header>
          <div class="hours">
            {DAY_LABELS.map((label, d) => {
              const value = draft.clinic_hours[String(d)] ?? null;
              return (
                <div class="hours-row">
                  <Toggle checked={value !== null} onChange={(open) => setDay(String(d), open ? ['09:00', '17:00'] : null)} label={label} />
                  {value ? (
                    <span>
                      <input type="time" value={value[0]} onInput={(e) => setDay(String(d), [e.currentTarget.value, value[1]])} />
                      {' a '}
                      <input type="time" value={value[1]} onInput={(e) => setDay(String(d), [value[0], e.currentTarget.value])} />
                    </span>
                  ) : <span class="muted">Cerrado</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section class="card">
          <header class="card-head"><h2>Beneficios de la infusión</h2></header>
          <div class="form-grid">
            <Field label="Textos de la plantilla Beneficios" hint="Uno por línea." wide><LinesInput value={draft.benefits} onChange={(v) => set('benefits', v)} rows={5} /></Field>
          </div>
        </section>
      </div>
    </Page>
  );
}
