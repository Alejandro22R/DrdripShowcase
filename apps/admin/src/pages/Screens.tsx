import { THEMES, THEME_LABELS } from '@drdrip/shared';
import { useState } from 'preact/hooks';
import { api, type Screen } from '../api';
import { Field, Loading, Modal, Page, confirm, formatDate, prompt, run, toast, useLoad } from '../ui';

export function Screens() {
  const { data, reload, error } = useLoad(() => api<Screen[]>('GET', '/api/screens'), [], 5000);
  const [creating, setCreating] = useState<{ name: string; orientation: string; theme: string } | null>(null);
  if (!data) return <Loading error={error} />;

  const create = async () => {
    if (!creating) return;
    if (!creating.name.trim()) return toast('Escribe un nombre, por ejemplo "Recepción"', 'warning');
    try {
      const screen = await api<Screen>('POST', '/api/screens', creating);
      window.location.hash = `#/pantallas/${screen.id}`;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  };
  const duplicate = async (s: Screen) => {
    const name = await prompt('Duplicar pantalla', 'Nombre de la copia', `${s.name} (copia)`);
    if (!name) return;
    await run(() => api('POST', `/api/screens/${s.id}/duplicate`, { name }), 'Pantalla duplicada. Revísala y pulsa Publicar.');
    void reload();
  };
  const remove = async (s: Screen) => {
    if (!(await confirm('Eliminar pantalla', `"${s.name}" y todas sus diapositivas y versiones se borrarán. Los televisores que la muestren verán la portada de marca.`, 'Eliminar', true))) return;
    await run(() => api('DELETE', `/api/screens/${s.id}`), 'Pantalla eliminada');
    void reload();
  };

  return (
    <Page title="Pantallas" subtitle="Cada pantalla tiene su propia secuencia de diapositivas y su dirección corta."
      actions={<button class="btn primary" onClick={() => setCreating({ name: '', orientation: 'landscape', theme: 'dark' })}>+ Nueva pantalla</button>}>
      <div class="grid-cards">
        {data.map((s) => (
          <article class="card screen-card" key={s.id}>
            <header>
              <span class="screen-num">{s.id}</span>
              <div>
                <h2>{s.name}</h2>
                <p class="muted small">{s.orientation === 'portrait' ? 'Vertical' : 'Horizontal'} · {s.slides} diapositivas · <code>/{s.id}</code></p>
              </div>
            </header>
            <div class="chips">
              <span class={`chip ${s.online ? 'ok' : ''}`}>{s.online ? `${s.online} en línea` : 'Sin televisores conectados'}</span>
              {!s.active && <span class="chip warn">Inactiva</span>}
              {s.published_at === null ? <span class="chip warn">Sin publicar</span> : s.dirty ? <span class="chip warn">Cambios sin publicar</span> : <span class="chip">Publicada {formatDate(s.published_at)}</span>}
            </div>
            <footer>
              <a class="btn primary small" href={`#/pantallas/${s.id}`}>Constructor</a>
              <a class="btn ghost small" href={`/${s.id}`} target="_blank" rel="noopener">Abrir</a>
              <button class="btn ghost small" onClick={() => void duplicate(s)}>Duplicar</button>
              <button class="btn ghost small danger" onClick={() => void remove(s)}>Eliminar</button>
            </footer>
          </article>
        ))}
        {data.length === 0 && <p class="muted pad">Todavía no hay pantallas. Crea la primera.</p>}
      </div>
      {creating && (
        <Modal title="Nueva pantalla" onClose={() => setCreating(null)}
          footer={<><button class="btn ghost" onClick={() => setCreating(null)}>Cancelar</button><button class="btn primary" onClick={() => void create()}>Crear y abrir constructor</button></>}>
          <div class="form-grid">
            <Field label="Nombre" wide><input value={creating.name} placeholder="Sala de espera" onInput={(e) => setCreating({ ...creating, name: e.currentTarget.value })} autofocus /></Field>
            <Field label="Orientación">
              <select value={creating.orientation} onChange={(e) => setCreating({ ...creating, orientation: e.currentTarget.value })}>
                <option value="landscape">Horizontal</option><option value="portrait">Vertical</option>
              </select>
            </Field>
            <Field label="Tema">
              <select value={creating.theme} onChange={(e) => setCreating({ ...creating, theme: e.currentTarget.value })}>
                {THEMES.map((t) => <option value={t}>{THEME_LABELS[t]}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </Page>
  );
}
