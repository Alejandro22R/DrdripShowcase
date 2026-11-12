import { api, type Device, type Screen } from '../api';
import { Loading, Page, confirm, formatDate, prompt, run, useLoad } from '../ui';

function guessKind(ua: string): string {
  if (/Tizen|SMART-TV|SamsungBrowser/i.test(ua)) return 'Samsung TV';
  if (/Web0S|webOS/i.test(ua)) return 'LG TV';
  if (/AFT|Silk/i.test(ua)) return 'Fire TV';
  if (/Android TV|BRAVIA|GoogleTV|Chromecast/i.test(ua)) return 'Android / Google TV';
  if (/Roku/i.test(ua)) return 'Roku';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'PC con Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Navegador';
}

export function Devices() {
  const devices = useLoad(() => api<Device[]>('GET', '/api/devices'), [], 4000);
  const screens = useLoad(() => api<Screen[]>('GET', '/api/screens'));
  if (!devices.data || !screens.data) return <Loading error={devices.error || screens.error} />;

  const rename = async (d: Device) => {
    const name = await prompt('Nombre del televisor', 'Un nombre para reconocerlo, por ejemplo "Sala de espera"', d.name);
    if (name === null) return;
    await run(() => api('PATCH', `/api/devices/${d.id}`, { name }));
    void devices.reload();
  };
  const assign = async (d: Device, value: string) => {
    await run(() => api('PATCH', `/api/devices/${d.id}`, { screen_id: value ? Number(value) : null }), value ? 'Pantalla asignada' : 'Asignación quitada');
    void devices.reload();
  };
  const forget = async (d: Device) => {
    if (await confirm('Olvidar dispositivo', 'Si este televisor vuelve a abrir la vitrina aparecerá otra vez como pantalla nueva.', 'Olvidar', true)) {
      await run(() => api('DELETE', `/api/devices/${d.id}`));
      void devices.reload();
    }
  };
  const fresh = devices.data.filter((d) => d.screen_id === null);

  return (
    <Page title="Dispositivos" subtitle="Todo televisor o TV Box que abre la vitrina se registra aquí solo."
      actions={<button class="btn ghost" onClick={() => void devices.reload()}>Actualizar lista</button>}>
      {fresh.length > 0 && (
        <div class="banner">
          <strong>{fresh.length === 1 ? 'Pantalla nueva detectada.' : `${fresh.length} pantallas nuevas detectadas.`}</strong>{' '}
          Asígnale qué pantalla mostrar: quedará recordada aunque el televisor se apague.
        </div>
      )}
      <div class="card table-wrap">
        <table class="table">
          <thead><tr><th>Televisor</th><th>Estado</th><th>Tipo</th><th>IP</th><th>Pantalla asignada</th><th /></tr></thead>
          <tbody>
            {devices.data.map((d) => (
              <tr key={d.id}>
                <td data-label="Televisor">
                  <button class="link" onClick={() => void rename(d)}>{d.name || 'Sin nombre'}</button>
                  <div class="muted small">ID {d.id.slice(3, 9).toUpperCase()}</div>
                </td>
                <td data-label="Estado">
                  {d.online ? <span class="chip ok">En línea{d.showing_screen_id ? ` · /${d.showing_screen_id}` : ''}</span> : <span class="chip">Sin conectar</span>}
                  {!d.online && <div class="muted small">Visto {formatDate(d.last_seen)}</div>}
                </td>
                <td data-label="Tipo">{guessKind(d.user_agent)}</td>
                <td data-label="IP">{d.ip.replace('::ffff:', '')}</td>
                <td data-label="Pantalla">
                  <select class={`inline${d.screen_id === null ? ' attention' : ''}`} value={d.screen_id ?? ''} onChange={(e) => void assign(d, e.currentTarget.value)}>
                    <option value="">Sin asignar</option>
                    {screens.data!.map((s) => <option value={s.id}>{s.id}. {s.name}</option>)}
                  </select>
                </td>
                <td class="row-actions">
                  <button class="btn small ghost" disabled={!d.online} onClick={() => void run(() => api('POST', `/api/devices/${d.id}/reload`), 'Recarga enviada')}>Recargar</button>
                  <button class="icon-btn danger" title="Olvidar" onClick={() => void forget(d)}>🗑</button>
                </td>
              </tr>
            ))}
            {devices.data.length === 0 && <tr><td colSpan={6} class="muted pad">Todavía no se ha conectado ningún televisor.</td></tr>}
          </tbody>
        </table>
      </div>
      <section class="card help">
        <h2>Cómo conectar un televisor</h2>
        <ol>
          <li>Conecta el televisor o TV Box a la misma red que este PC (no a la red de invitados).</li>
          <li>Abre su navegador y escribe la dirección que aparece en <a href="#/sistema">Sistema</a>, sin número al final.</li>
          <li>El televisor aparecerá aquí como pantalla nueva. Asígnale una pantalla y guárdala como página de inicio.</li>
        </ol>
        <p class="muted">La búsqueda automática en la red y el envío directo a Chromecast, Android TV, LG, Samsung y Roku llegarán en la versión 0.3.</p>
      </section>
    </Page>
  );
}
