import { useState } from 'preact/hooks';
import { api, download, type Status } from '../api';
import { Field, Loading, Page, confirm, formatBytes, formatDate, run, toast, useLoad } from '../ui';

function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export function System() {
  const { data, reload, error } = useLoad(() => api<Status>('GET', '/api/system/status'), [], 10000);
  const [pin, setPin] = useState({ current: '', next: '', repeat: '' });
  if (!data) return <Loading error={error} />;

  const changePin = async () => {
    if (!/^\d{4,8}$/.test(pin.next)) return toast('El PIN nuevo debe tener entre 4 y 8 dígitos', 'warning');
    if (pin.next !== pin.repeat) return toast('Los dos PIN nuevos no coinciden', 'warning');
    if (await run(() => api('POST', '/api/system/pin', { current: pin.current, next: pin.next }), 'PIN cambiado')) {
      setPin({ current: '', next: '', repeat: '' });
      void reload();
    }
  };
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast('Dirección copiada'), () => toast('No se pudo copiar', 'error'));
  const restart = async () => {
    if (!(await confirm('Reiniciar el programa', 'Las pantallas se quedan con lo último que mostraban y se reconectan solas en unos segundos.', 'Reiniciar'))) return;
    if (await run(() => api('POST', '/api/system/restart'), 'Reiniciando. El panel volverá en unos segundos.')) setTimeout(() => void reload(), 8000);
  };
  const modes = { servicio: 'Servicio de Windows (arranca solo con el equipo)', consola: 'Ventana de consola', desarrollo: 'Desarrollo' };
  const reloadScreens = async () => {
    if (await confirm('Recargar pantallas', 'Todos los televisores conectados volverán a cargar la vitrina.', 'Recargar')) {
      await run(() => api('POST', '/api/system/reload-screens'), 'Recarga enviada');
    }
  };

  return (
    <Page title="Sistema" subtitle={`DrDrip Vitrina v${data.version} · encendido hace ${uptime(data.uptime_s)}`}>
      <div class="stack">
        <section class="card">
          <header class="card-head"><div><h2>Direcciones para las pantallas</h2><p class="muted">Escribe una de estas direcciones en el navegador del televisor. Agrega <code>/1</code>, <code>/2</code>… para ir directo a una pantalla.</p></div></header>
          <ul class="url-list">
            {data.urls.map((url, i) => (
              <li>
                <code>{url}</code>
                {i === 0 && <span class="chip ok">Recomendada</span>}
                {url.includes('.local') && <span class="chip">Solo equipos compatibles con .local</span>}
                <button class="btn small ghost" onClick={() => void copy(url)}>Copiar</button>
              </li>
            ))}
            {data.urls.length === 0 && <li class="muted">Este PC no está conectado a ninguna red.</li>}
          </ul>
          <p class="muted">Reserva una IP fija para este PC en el router, así la dirección no cambia.</p>
        </section>

        <section class="card">
          <header class="card-head">
            <div><h2>Respaldos</h2><p class="muted">Cada noche se guarda una copia y se conservan las últimas 14. De vez en cuando descarga una a un pendrive.</p></div>
            <button class="btn primary small" onClick={() => void run(() => api('POST', '/api/system/backup'), 'Respaldo creado').then(reload)}>Crear respaldo ahora</button>
          </header>
          <table class="table">
            <thead><tr><th>Archivo</th><th>Fecha</th><th>Tamaño</th><th /></tr></thead>
            <tbody>
              {data.backups.map((b) => (
                <tr><td data-label="Archivo"><code>{b.name}</code></td><td data-label="Fecha">{formatDate(b.created_at)}</td><td data-label="Tamaño">{formatBytes(b.size)}</td>
                  <td class="row-actions"><a class="btn small ghost" href={download(`/api/system/backups/${b.name}`)}>Descargar</a></td></tr>
              ))}
              {data.backups.length === 0 && <tr><td colSpan={4} class="muted pad">Todavía no hay respaldos.</td></tr>}
            </tbody>
          </table>
        </section>

        <section class="card">
          <header class="card-head"><div><h2>PIN de acceso</h2>{data.factory_pin && <p class="field-error">Sigues usando el PIN de fábrica (1234). Cámbialo.</p>}</div></header>
          <div class="form-grid three">
            <Field label="PIN actual"><input type="password" inputMode="numeric" autocomplete="current-password" value={pin.current} onInput={(e) => setPin({ ...pin, current: e.currentTarget.value })} /></Field>
            <Field label="PIN nuevo" hint="De 4 a 8 dígitos"><input type="password" inputMode="numeric" autocomplete="new-password" value={pin.next} onInput={(e) => setPin({ ...pin, next: e.currentTarget.value })} /></Field>
            <Field label="Repite el PIN nuevo"><input type="password" inputMode="numeric" autocomplete="new-password" value={pin.repeat} onInput={(e) => setPin({ ...pin, repeat: e.currentTarget.value })} /></Field>
          </div>
          <div class="card-foot"><button class="btn primary" disabled={!pin.current || !pin.next} onClick={() => void changePin()}>Cambiar PIN</button></div>
        </section>

        <section class="card">
          <header class="card-head">
            <h2>Estado</h2>
            <div class="actions">
              <button class="btn ghost small" onClick={() => void reloadScreens()}>Recargar todas las pantallas</button>
              <button class="btn ghost small" disabled={!data.can_restart} title={data.can_restart ? '' : 'Disponible cuando el programa está instalado como servicio de Windows'} onClick={() => void restart()}>Reiniciar el programa</button>
            </div>
          </header>
          <dl class="facts">
            <div><dt>Ejecución</dt><dd>{modes[data.run_mode]}</dd></div>
            <div><dt>Fotos</dt><dd>{data.image_resizer ? 'Se reducen a 800 px (WebP)' : 'Se guardan sin reducir'}</dd></div>
            <div><dt>Versión</dt><dd>{data.version}</dd></div>
            <div><dt>Zona horaria</dt><dd>{data.timezone}</dd></div>
            <div><dt>Puerto</dt><dd>{data.port}</dd></div>
            <div><dt>Base de datos</dt><dd>{formatBytes(data.db_size)}</dd></div>
            <div><dt>Televisores en línea</dt><dd>{data.online.length}</dd></div>
            <div><dt>Internet</dt><dd>{navigator.onLine ? 'Disponible' : 'Sin conexión (no es necesaria)'}</dd></div>
          </dl>
          {data.logs.length > 0 && (
            <div class="card-foot">
              <p class="muted small">Registros del programa (para soporte):{' '}
                {data.logs.map((l) => <a class="log-link" href={download(`/api/system/logs/${l.name}`)}>{l.name} ({formatBytes(l.size)})</a>)}
              </p>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
