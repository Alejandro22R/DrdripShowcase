import { api, type Screen, type Settings, type Status } from '../api';
import { Loading, Page, formatDate, useLoad } from '../ui';

export function Dashboard() {
  const status = useLoad(() => api<Status>('GET', '/api/system/status'), [], 5000);
  const screens = useLoad(() => api<Screen[]>('GET', '/api/screens'), [], 5000);
  const settings = useLoad(() => api<Settings>('GET', '/api/settings'));
  if (!status.data || !screens.data || !settings.data) return <Loading error={status.error || screens.error} />;
  const s = status.data;
  const lastBackup = s.backups[0];

  const reminders: { text: string; href: string; action: string }[] = [];
  if (s.factory_pin) reminders.push({ text: 'El panel sigue con el PIN de fábrica (1234).', href: '#/sistema', action: 'Cambiar PIN' });
  if (!settings.data.phone || !settings.data.address) reminders.push({ text: 'Faltan datos de contacto para el pie de las pantallas.', href: '#/marca', action: 'Completar' });
  if (s.counts.unassigned_devices) reminders.push({ text: `${s.counts.unassigned_devices === 1 ? 'Hay una pantalla nueva' : `Hay ${s.counts.unassigned_devices} pantallas nuevas`} sin asignar.`, href: '#/dispositivos', action: 'Asignar' });
  const dirty = screens.data.filter((x) => x.dirty);
  if (dirty.length) reminders.push({ text: `${dirty.map((x) => `"${x.name}"`).join(', ')} ${dirty.length === 1 ? 'tiene' : 'tienen'} cambios sin publicar.`, href: `#/pantallas/${dirty[0].id}`, action: 'Revisar' });
  if (s.counts.hidden_services) reminders.push({ text: `${s.counts.hidden_services} servicios están ocultos (por ejemplo, los medicamentos de control de peso hasta que el director médico los apruebe).`, href: '#/servicios', action: 'Ver servicios' });

  return (
    <Page title="Tablero" subtitle="Resumen de la vitrina de la clínica.">
      <div class="stats">
        <a class="stat" href="#/servicios"><strong>{s.counts.services}</strong><span>Servicios</span></a>
        <a class="stat" href="#/catalogo"><strong>{s.counts.addons}</strong><span>Complementos</span></a>
        <a class="stat" href="#/pantallas"><strong>{s.counts.screens}</strong><span>Pantallas</span></a>
        <a class="stat" href="#/dispositivos"><strong>{s.online.length}</strong><span>Televisores en línea</span></a>
      </div>

      {reminders.length > 0 && (
        <section class="card">
          <header class="card-head"><h2>Recordatorios</h2></header>
          <ul class="reminders">
            {reminders.map((r) => <li><span>{r.text}</span><a class="btn small ghost" href={r.href}>{r.action}</a></li>)}
          </ul>
        </section>
      )}

      <section class="card">
        <header class="card-head"><h2>Pantallas</h2><a class="btn small ghost" href="#/pantallas">Ver todas</a></header>
        <table class="table">
          <thead><tr><th>Pantalla</th><th>Conexión</th><th>Publicación</th><th /></tr></thead>
          <tbody>
            {screens.data.map((x) => (
              <tr>
                <td data-label="Pantalla"><strong>{x.id}. {x.name}</strong></td>
                <td data-label="Conexión"><span class={`chip ${x.online ? 'ok' : ''}`}>{x.online ? `${x.online} en línea` : 'Sin televisores conectados'}</span></td>
                <td data-label="Publicación">{x.published_at === null ? <span class="chip warn">Sin publicar</span> : x.dirty ? <span class="chip warn">Cambios sin publicar</span> : formatDate(x.published_at)}</td>
                <td class="row-actions"><a class="btn small ghost" href={`#/pantallas/${x.id}`}>Constructor</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="card">
        <header class="card-head"><h2>Servidor</h2><a class="btn small ghost" href="#/sistema">Sistema</a></header>
        <dl class="facts">
          <div><dt>Dirección para los televisores</dt><dd><code>{s.urls[0] ?? 'Sin red'}</code></dd></div>
          <div><dt>Último respaldo</dt><dd>{lastBackup ? formatDate(lastBackup.created_at) : 'Todavía ninguno'}</dd></div>
          <div><dt>Internet</dt><dd>{navigator.onLine ? 'Disponible' : 'Sin conexión. Todo sigue funcionando.'}</dd></div>
        </dl>
      </section>
    </Page>
  );
}
