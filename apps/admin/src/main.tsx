import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, getToken, setToken, setUnauthorizedHandler, type Screen, type Status } from './api';
import { Catalog } from './pages/Catalog';
import { Brand } from './pages/Brand';
import { Builder } from './pages/Builder';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { Screens } from './pages/Screens';
import { Services } from './pages/Services';
import { System } from './pages/System';
import { run } from './ui';
import './styles.css';

interface NavItem { path: string; label: string; short: string; icon: string; badge?: 'devices' | 'screens' }

const ITEMS: Record<string, NavItem> = {
  home: { path: '', label: 'Tablero', short: 'Inicio', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  services: { path: 'servicios', label: 'Servicios y precios', short: 'Servicios', icon: 'M12 3s-6.5 7.2-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3Z' },
  catalog: { path: 'catalogo', label: 'Promociones y extras', short: 'Promos', icon: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7s-1-4-3.5-4a2 2 0 0 0 0 4H12ZM12 7s1-4 3.5-4a2 2 0 0 1 0 4H12Z' },
  screens: { path: 'pantallas', label: 'Pantallas', short: 'Pantallas', icon: 'M3 5h18v12H3zM8 21h8M12 17v4', badge: 'screens' },
  devices: { path: 'dispositivos', label: 'Dispositivos', short: 'TVs', icon: 'M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 19h.01', badge: 'devices' },
  brand: { path: 'marca', label: 'Marca y apariencia', short: 'Marca', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z' },
  system: { path: 'sistema', label: 'Sistema', short: 'Sistema', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z' },
};

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [ITEMS.home] },
  { title: 'Contenido', items: [ITEMS.services, ITEMS.catalog] },
  { title: 'Pantallas', items: [ITEMS.screens, ITEMS.devices] },
  { title: 'Ajustes', items: [ITEMS.brand, ITEMS.system] },
];
/** Bottom bar on phones; everything else lives under "Más". */
const TABS: NavItem[] = [ITEMS.home, ITEMS.services, ITEMS.screens, ITEMS.devices];
const MORE: NavItem[] = [ITEMS.catalog, ITEMS.brand, ITEMS.system];
const ICON_MORE = 'M5 12h.01M12 12h.01M19 12h.01';
const ICON_LOGOUT = 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10';
const ICON_COLLAPSE = 'M14 6l-6 6 6 6';

function Icon(props: { d: string }) {
  return <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={props.d} /></svg>;
}

interface Pulse { online: number; devices: number; screens: number; version: string }

/** Live counters for the menu badges and the connection footer. */
function usePulse(enabled: boolean): Pulse | null {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const [status, screens] = await Promise.all([api<Status>('GET', '/api/system/status'), api<Screen[]>('GET', '/api/screens')]);
        if (alive) setPulse({ online: status.online.length, devices: status.counts.unassigned_devices, screens: screens.filter((s) => s.dirty).length, version: status.version });
      } catch {
        /* the pages themselves report connection problems */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [enabled]);
  return pulse;
}

function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

function Login(props: { onDone: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    try {
      const res = await api<{ token: string }>('POST', '/api/auth/login', { pin });
      setToken(res.token);
      props.onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setPin('');
    }
  };
  return (
    <div class="login">
      <form class="login-card" onSubmit={submit}>
        <img src="/player/img/symbol.svg" alt="" class="login-symbol" />
        <h1>DrDrip</h1>
        <p class="descriptor">Vitrina · Panel de administración</p>
        <input
          type="password"
          inputMode="numeric"
          autocomplete="current-password"
          placeholder="PIN de acceso"
          value={pin}
          onInput={(e) => { setPin(e.currentTarget.value); setError(''); }}
          class={error ? 'invalid' : ''}
          autofocus
        />
        {error && <p class="field-error">{error}</p>}
        <button class="btn primary" type="submit" disabled={!pin}>Entrar</button>
      </form>
    </div>
  );
}

function App() {
  const [logged, setLogged] = useState(Boolean(getToken()));
  const [moreOpen, setMoreOpen] = useState(false);
  const [rail, setRail] = useState(() => (localStorage.getItem('drdrip.rail') ?? (window.innerWidth < 1180 ? '1' : '0')) === '1');
  const route = useRoute();
  const pulse = usePulse(logged);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken('');
      setLogged(false);
    });
  }, []);
  useEffect(() => setMoreOpen(false), [route.join('/')]);

  if (!logged) return <Login onDone={() => setLogged(true)} />;

  const [section = '', param] = route;
  const logout = () =>
    run(async () => {
      await api('POST', '/api/auth/logout');
      setToken('');
      setLogged(false);
    });
  const toggleRail = () => {
    localStorage.setItem('drdrip.rail', rail ? '0' : '1');
    setRail(!rail);
  };
  const badge = (item: NavItem) => (item.badge && pulse ? pulse[item.badge] : 0);
  const current = Object.values(ITEMS).find((item) => item.path === section) ?? ITEMS.home;

  let page;
  if (section === 'servicios') page = <Services />;
  else if (section === 'catalogo') page = <Catalog />;
  else if (section === 'pantallas' && param) page = <Builder key={param} screenId={Number(param)} />;
  else if (section === 'pantallas') page = <Screens />;
  else if (section === 'dispositivos') page = <Devices />;
  else if (section === 'marca') page = <Brand />;
  else if (section === 'sistema') page = <System />;
  else page = <Dashboard />;

  const link = (item: NavItem, label: string, extra = '') => (
    <a href={`#/${item.path}`} class={`${section === item.path ? 'active' : ''} ${extra}`} title={item.label} aria-current={section === item.path ? 'page' : undefined}>
      <Icon d={item.icon} />
      <span class="nav-label">{label}</span>
      {badge(item) > 0 && <span class="nav-badge" aria-label={`${badge(item)} pendientes`}>{badge(item)}</span>}
    </a>
  );
  const online = pulse?.online ?? 0;

  return (
    <div class={`shell${rail ? ' rail' : ''}`}>
      <aside class="sidebar">
        <a class="sidebar-brand" href="#/" title="DrDrip Vitrina">
          <img src="/player/img/symbol-light.svg" alt="" />
          <span>
            <strong>DrDrip</strong>
            <small>Vitrina</small>
          </span>
        </a>
        <nav aria-label="Secciones">
          {GROUPS.map((group) => (
            <div class="nav-group">
              {group.title && <h2>{group.title}</h2>}
              {group.items.map((item) => link(item, item.label))}
            </div>
          ))}
        </nav>
        <div class="sidebar-foot">
          <a class={`pulse${online ? ' on' : ''}`} href="#/dispositivos" title={online ? `${online} en línea` : 'Sin televisores conectados'}>
            <span class="pulse-dot" />
            <span class="nav-label">{online ? `${online} ${online === 1 ? 'televisor' : 'televisores'} en línea` : 'Sin televisores conectados'}</span>
          </a>
          <div class="sidebar-foot-row">
            <button class="foot-btn" onClick={logout} title="Cerrar sesión"><Icon d={ICON_LOGOUT} /><span class="nav-label">Cerrar sesión</span></button>
            <button class="foot-btn collapse" onClick={toggleRail} title={rail ? 'Ampliar el menú' : 'Reducir el menú'} aria-label={rail ? 'Ampliar el menú' : 'Reducir el menú'}><Icon d={ICON_COLLAPSE} /></button>
          </div>
          {pulse && <small class="version nav-label">v{pulse.version}</small>}
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <img src="/player/img/symbol-light.svg" alt="" />
          <strong>{current.label}</strong>
          <a class={`pulse${online ? ' on' : ''}`} href="#/dispositivos"><span class="pulse-dot" />{online ? `${online} en línea` : 'Sin TVs'}</a>
        </header>
        {page}
      </div>

      <nav class="tabbar" aria-label="Secciones">
        {TABS.map((item) => link(item, item.short))}
        <button class={MORE.some((m) => m.path === section) || moreOpen ? 'active' : ''} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
          <Icon d={ICON_MORE} />
          <span class="nav-label">Más</span>
        </button>
      </nav>
      {moreOpen && (
        <div class="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div class="sheet" role="dialog" aria-label="Más secciones" onClick={(e) => e.stopPropagation()}>
            <div class="sheet-grip" />
            {MORE.map((item) => link(item, item.label, 'sheet-link'))}
            <button class="sheet-link" onClick={logout}><Icon d={ICON_LOGOUT} /><span class="nav-label">Cerrar sesión</span></button>
          </div>
        </div>
      )}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
