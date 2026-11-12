import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api, getToken, setToken, setUnauthorizedHandler } from './api';
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

const NAV: { path: string; label: string; icon: string }[] = [
  { path: '', label: 'Tablero', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { path: 'servicios', label: 'Servicios', icon: 'M12 3s-6.500 7.200-6.500 11.500a6.500 6.500 0 0 0 13 0C18.500 10.200 12 3 12 3Z' },
  { path: 'catalogo', label: 'Complementos y más', icon: 'M4 6h16M4 12h16M4 18h10' },
  { path: 'pantallas', label: 'Pantallas', icon: 'M3 5h18v12H3zM8 21h8M12 17v4' },
  { path: 'dispositivos', label: 'Dispositivos', icon: 'M5 12.500a10 10 0 0 1 14 0M8 15.500a6 6 0 0 1 8 0M12 19h.010' },
  { path: 'marca', label: 'Marca y apariencia', icon: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3Z' },
  { path: 'sistema', label: 'Sistema', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.100-1.200l2-1.600-2-3.400-2.400 1a7 7 0 0 0-2-1.200L14 3h-4l-.500 2.600a7 7 0 0 0-2 1.200l-2.400-1-2 3.400 2 1.600a7 7 0 0 0 0 2.400l-2 1.600 2 3.400 2.400-1a7 7 0 0 0 2 1.200L10 21h4l.500-2.600a7 7 0 0 0 2-1.200l2.400 1 2-3.400-2-1.600c.100-.400.100-.800.100-1.200Z' },
];

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
  const [menuOpen, setMenuOpen] = useState(false);
  const route = useRoute();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken('');
      setLogged(false);
    });
  }, []);
  useEffect(() => setMenuOpen(false), [route.join('/')]);

  if (!logged) return <Login onDone={() => setLogged(true)} />;

  const [section = '', param] = route;
  const logout = () =>
    run(async () => {
      await api('POST', '/api/auth/logout');
      setToken('');
      setLogged(false);
    });

  let page;
  if (section === 'servicios') page = <Services />;
  else if (section === 'catalogo') page = <Catalog />;
  else if (section === 'pantallas' && param) page = <Builder key={param} screenId={Number(param)} />;
  else if (section === 'pantallas') page = <Screens />;
  else if (section === 'dispositivos') page = <Devices />;
  else if (section === 'marca') page = <Brand />;
  else if (section === 'sistema') page = <System />;
  else page = <Dashboard />;

  return (
    <div class={`shell${menuOpen ? ' menu-open' : ''}`}>
      <aside class="sidebar">
        <a class="sidebar-brand" href="#/">
          <img src="/player/img/symbol.svg" alt="" />
          <span>
            <strong>DrDrip</strong>
            <small>Vitrina</small>
          </span>
        </a>
        <nav>
          {NAV.map((item) => (
            <a href={`#/${item.path}`} class={section === item.path ? 'active' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d={item.icon} /></svg>
              {item.label}
            </a>
          ))}
        </nav>
        <button class="sidebar-logout" onClick={logout}>Cerrar sesión</button>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">☰</button>
          <strong>DrDrip Vitrina</strong>
        </header>
        {page}
      </div>
      <div class="scrim" onClick={() => setMenuOpen(false)} />
    </div>
  );
}

render(<App />, document.getElementById('app')!);
