// Windows integration for the packaged DrDripVitrina.exe: install as a
// service (WinSW), firewall rule, single instance, kiosk launcher, uninstall.
//
// A Node single executable cannot speak the Windows service protocol by
// itself, so the folder ships WinSW as DrDripVitrinaService.exe. WinSW starts
// "DrDripVitrina.exe --servicio", watches it and restarts it if it dies.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { APP_VERSION } from '@drdrip/shared';
import { loadConfig, parseIni } from '../config.js';
import { lanAddresses } from '../services/network.js';

export const SERVICE_ID = 'DrDripVitrina';
export const TASK_NAME = 'DrDrip Vitrina';
export const FIREWALL_RULE = 'DrDrip Vitrina';
export const WRAPPER_NAME = 'DrDripVitrinaService.exe';
const KIOSK_STARTUP_FILE = 'DrDrip Vitrina Kiosko.cmd';

export type Command =
  | 'abrir' // default on double click: install if needed, then open the panel
  | 'servicio' // run the server (what the service starts)
  | 'consola' // run the server in this window, for diagnosis
  | 'instalar'
  | 'desinstalar'
  | 'reiniciar'
  | 'estado'
  | 'kiosko'
  | 'kiosko-auto'
  | 'ayuda';

export interface Args {
  command: Command;
  /** Screen number for the kiosk commands; "no" removes the automatic kiosk. */
  value: string;
  browser: boolean;
  pause: boolean;
}

const COMMANDS: Command[] = ['servicio', 'consola', 'instalar', 'desinstalar', 'reiniciar', 'estado', 'kiosko', 'kiosko-auto', 'ayuda'];

export function parseArgs(argv: string[]): Args {
  const args: Args = { command: 'abrir', value: '', browser: true, pause: true };
  for (let i = 0; i < argv.length; i++) {
    const word = argv[i].replace(/^--?/, '').toLowerCase();
    if (!argv[i].startsWith('-')) continue;
    if (word === 'sin-navegador') args.browser = false;
    else if (word === 'sin-pausa') args.pause = false;
    else if (word === 'help' || word === 'h' || word === '?') args.command = 'ayuda';
    else if ((COMMANDS as string[]).includes(word)) {
      args.command = word as Command;
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) args.value = argv[++i];
    }
  }
  return args;
}

// --- Command lines (pure, covered by tests) --------------------------------------

export function firewallAddArgs(port: number): string[] {
  // Private and domain networks only: the vitrina is never opened to public networks.
  return ['advfirewall', 'firewall', 'add', 'rule', `name=${FIREWALL_RULE}`, 'dir=in', 'action=allow', 'protocol=TCP', `localport=${port}`, 'profile=private,domain'];
}

export function firewallDeleteArgs(): string[] {
  return ['advfirewall', 'firewall', 'delete', 'rule', `name=${FIREWALL_RULE}`];
}

/** Scheduled task used only when the service cannot be installed. */
export function taskCreateArgs(exe: string): string[] {
  return ['/Create', '/TN', TASK_NAME, '/SC', 'ONSTART', '/RU', 'SYSTEM', '/RL', 'HIGHEST', '/TR', `"${exe}" --servicio`, '/F'];
}

/** PowerShell line that relaunches this program with administrator rights. */
export function elevateCommand(exe: string, args: string[]): string {
  const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;
  return `$p = Start-Process -FilePath ${quote(exe)} -ArgumentList ${args.map(quote).join(',')} -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
}

/** Reads the numeric state from `sc query`, which is the same in every Windows language. */
export function parseScState(status: number | null, output: string): 'missing' | 'running' | 'stopped' | 'starting' {
  if (status === 1060 || /1060/.test(output)) return 'missing';
  const match = /:\s*(\d)\s+[A-Z_]+/.exec(output);
  if (!match) return 'missing';
  if (match[1] === '4') return 'running';
  if (match[1] === '2') return 'starting';
  return 'stopped';
}

export function kioskArgs(url: string, profileDir: string): string[] {
  return ['--kiosk', url, '--edge-kiosk-type=fullscreen', '--no-first-run', '--no-default-browser-check', '--disable-session-crashed-bubble', '--noerrdialogs', `--user-data-dir=${profileDir}`];
}

export function browserCandidates(env: NodeJS.ProcessEnv): string[] {
  const roots = [env['ProgramFiles(x86)'], env.ProgramFiles, env.LOCALAPPDATA].filter((r): r is string => Boolean(r));
  const tails = [
    ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
    ['Google', 'Chrome', 'Application', 'chrome.exe'],
  ];
  return tails.flatMap((tail) => roots.map((root) => path.win32.join(root, ...tail)));
}

// --- Helpers that touch the system ------------------------------------------------

function sh(file: string, args: string[]): { status: number | null; output: string } {
  const result = spawnSync(file, args, { encoding: 'utf8', windowsHide: true });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function say(text = ''): void {
  console.log(text);
}

function isElevated(): boolean {
  return sh('fltmc', []).status === 0;
}

function serviceState(): ReturnType<typeof parseScState> {
  const { status, output } = sh('sc', ['query', SERVICE_ID]);
  return parseScState(status, output);
}

function taskExists(): boolean {
  return sh('schtasks', ['/Query', '/TN', TASK_NAME]).status === 0;
}

/** Version of the vitrina answering on this port, or null when nothing of ours answers. */
export function runningVersion(port: number, timeoutMs = 1500): Promise<string | null> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const health = JSON.parse(body) as { app?: string; version?: string };
          resolve(health.app === 'drdrip-vitrina' ? String(health.version ?? '') : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

export async function isVitrinaRunning(port: number, timeoutMs = 1500): Promise<boolean> {
  return (await runningVersion(port, timeoutMs)) !== null;
}

async function waitUntilStopped(port: number, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if (!(await isVitrinaRunning(port, 800))) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Program registered for the service, read from `sc qc`. The labels change
 * with the Windows language, so it looks for the quoted .exe path instead.
 */
export function parseScBinaryPath(output: string): string | null {
  const quoted = /"([^"\r\n]+\.exe)"/i.exec(output);
  if (quoted) return quoted[1];
  const bare = /:\s*([A-Za-z]:\\[^\r\n]*?\.exe)/i.exec(output);
  return bare ? bare[1] : null;
}

export function samePath(a: string, b: string): boolean {
  return path.win32.resolve(a).toLowerCase() === path.win32.resolve(b).toLowerCase();
}

function registeredWrapper(): string | null {
  if (serviceState() === 'missing') return null;
  return parseScBinaryPath(sh('sc', ['qc', SERVICE_ID]).output);
}

/** Data folder of another installation, honouring its config.ini. */
function dataDirOf(root: string): string {
  const ini = path.join(root, 'config.ini');
  const custom = existsSync(ini) ? parseIni(readFileSync(ini, 'utf8')).data_dir : undefined;
  return path.resolve(root, custom || 'data');
}

/**
 * An installation from another folder (usually an older version) is stopped
 * and unregistered so this one can take its place. When this folder has no
 * database yet, the other installation's data comes along.
 */
async function replaceOtherInstall(otherWrapper: string, root: string, dataDir: string, port: number): Promise<void> {
  const otherRoot = path.dirname(otherWrapper);
  say(`Se encontró otra instalación en ${otherRoot}.`);
  say('Se detiene y se reemplaza por esta versión.');
  if (existsSync(otherWrapper)) {
    sh(otherWrapper, ['stop']);
    sh(otherWrapper, ['uninstall']);
  }
  if (serviceState() !== 'missing') {
    sh('sc', ['stop', SERVICE_ID]);
    sh('sc', ['delete', SERVICE_ID]);
  }
  await waitUntilStopped(port, 30);

  const otherData = dataDirOf(otherRoot);
  if (!existsSync(path.join(dataDir, 'drdrip.db')) && existsSync(path.join(otherData, 'drdrip.db'))) {
    cpSync(otherData, dataDir, { recursive: true, filter: (src) => !src.includes(`${path.sep}logs`) });
    say(`Tus datos se copiaron desde ${otherData}.`);
  }
  const otherIni = path.join(otherRoot, 'config.ini');
  if (!existsSync(path.join(root, 'config.ini')) && existsSync(otherIni)) cpSync(otherIni, path.join(root, 'config.ini'));
  say(`Cuando compruebes que todo funciona puedes borrar ${otherRoot}.\n`);
}

async function waitUntilRunning(port: number, seconds: number): Promise<boolean> {
  for (let i = 0; i < seconds * 2; i++) {
    if (await isVitrinaRunning(port, 800)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
}

function openInBrowser(url: string): void {
  spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function finish(args: Args, ok: boolean): Promise<number> {
  if (!args.pause) return ok ? 0 : 1;
  if (ok) {
    say('\nEsta ventana se cerrará sola en unos segundos.');
    await new Promise((r) => setTimeout(r, 6000));
  } else if (process.stdin.isTTY) {
    say('\nPulsa Enter para cerrar esta ventana.');
    await new Promise((r) => process.stdin.once('data', r));
  }
  return ok ? 0 : 1;
}

/** Runs this same command again with administrator rights (one UAC prompt). */
function elevate(argv: string[]): number {
  say('Windows pedirá permiso de administrador. Acepta para continuar.');
  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', elevateCommand(process.execPath, argv)], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return result.status ?? 1;
}

function networkIsPublic(): boolean {
  const { output } = sh('powershell', ['-NoProfile', '-Command', '(Get-NetConnectionProfile).NetworkCategory -join ","']);
  return /Public/i.test(output);
}

// --- Commands ------------------------------------------------------------------------

async function install(args: Args): Promise<number> {
  const config = loadConfig();
  const root = config.rootDir;
  const wrapper = path.join(root, WRAPPER_NAME);
  const panel = `http://localhost:${config.port}/admin/`;
  const passthrough = ['--instalar', ...(args.browser ? [] : ['--sin-navegador']), ...(args.pause ? [] : ['--sin-pausa'])];

  if (!isElevated()) return elevate(passthrough);

  say(`DrDrip Vitrina v${APP_VERSION}: instalación`);
  say(`Carpeta: ${root}\n`);

  const other = registeredWrapper();
  if (other && !samePath(other, wrapper)) await replaceOtherInstall(other, root, config.dataDir, config.port);
  // Only one way of starting the program may exist: a task left by an older install would fight for the port.
  if (taskExists()) {
    sh('schtasks', ['/End', '/TN', TASK_NAME]);
    sh('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']);
    await waitUntilStopped(config.port, 15);
  }

  const version = await runningVersion(config.port);
  if (version !== null && version !== APP_VERSION) {
    say(`Sigue funcionando la versión ${version || 'anterior'} desde otra carpeta.`);
    say('Ejecuta Desinstalar.cmd en la carpeta de esa versión y vuelve a abrir este programa.');
    return finish(args, false);
  }
  let running = version !== null;
  const state = serviceState();
  if (!running && state === 'missing' && !taskExists() && !(await isPortFree(config.port))) {
    say(`El puerto ${config.port} ya lo está usando otro programa.`);
    say('Cierra ese programa, o copia config.example.ini como config.ini, cambia "port" y vuelve a intentarlo.');
    return finish(args, false);
  }

  mkdirSync(path.join(config.dataDir, 'logs'), { recursive: true });

  if (!running) {
    let viaService = false;
    if (existsSync(wrapper)) {
      if (state === 'missing') {
        const installed = sh(wrapper, ['install']);
        say(installed.status === 0 ? 'Servicio de Windows registrado.' : `No se pudo registrar el servicio: ${installed.output}`);
      }
      if (serviceState() !== 'missing') {
        sh(wrapper, ['start']);
        viaService = await waitUntilRunning(config.port, 40);
        if (!viaService) {
          say('El servicio no arrancó. Se usará una tarea programada como alternativa.');
          sh(wrapper, ['stop']);
          sh(wrapper, ['uninstall']);
        }
      }
    } else {
      say(`No se encontró ${WRAPPER_NAME}. Se usará una tarea programada como alternativa.`);
    }

    if (!viaService) {
      const created = sh('schtasks', taskCreateArgs(process.execPath));
      if (created.status !== 0) {
        say(`No se pudo crear la tarea programada: ${created.output}`);
        return finish(args, false);
      }
      sh('schtasks', ['/Run', '/TN', TASK_NAME]);
      if (!(await waitUntilRunning(config.port, 40))) {
        say(`El programa no respondió. Revisa los registros en ${path.join(config.dataDir, 'logs')}.`);
        return finish(args, false);
      }
      say('Tarea programada creada: el programa arranca solo al encender el equipo.');
    } else {
      say('Servicio iniciado: arranca solo al encender el equipo, sin ventana y sin iniciar sesión.');
    }
    running = true;
  } else {
    say('El programa ya estaba funcionando.');
  }

  sh('netsh', firewallDeleteArgs());
  const rule = sh('netsh', firewallAddArgs(config.port));
  say(rule.status === 0 ? `Firewall: puerto ${config.port} abierto para redes privadas.` : `No se pudo crear la regla del firewall: ${rule.output}`);
  if (networkIsPublic()) {
    say('\nAVISO: Windows tiene esta red marcada como "Pública", y así bloquea a los televisores.');
    say('Cámbiala en Configuración > Red e Internet > propiedades de la red > Perfil de red: "Privada".');
  }

  say(`\nPanel de administración: ${panel}`);
  for (const { address } of lanAddresses()) say(`Dirección para las pantallas: http://${address}:${config.port}/1`);
  if (args.browser) openInBrowser(panel);
  return finish(args, running);
}

async function uninstall(args: Args): Promise<number> {
  const config = loadConfig();
  const wrapper = path.join(config.rootDir, WRAPPER_NAME);
  if (!isElevated()) return elevate(['--desinstalar', ...(args.pause ? [] : ['--sin-pausa'])]);

  say('DrDrip Vitrina: desinstalación\n');
  if (serviceState() !== 'missing') {
    if (existsSync(wrapper)) {
      sh(wrapper, ['stop']);
      sh(wrapper, ['uninstall']);
    } else {
      sh('sc', ['stop', SERVICE_ID]);
      sh('sc', ['delete', SERVICE_ID]);
    }
    say('Servicio de Windows eliminado.');
  }
  if (taskExists()) {
    sh('schtasks', ['/End', '/TN', TASK_NAME]);
    sh('schtasks', ['/Delete', '/TN', TASK_NAME, '/F']);
    say('Tarea programada eliminada.');
  }
  sh('netsh', firewallDeleteArgs());
  say('Regla del firewall eliminada.');
  removeKioskStartup();
  say(`\nTus datos se conservan en ${config.dataDir}.`);
  return finish(args, true);
}

async function restart(args: Args): Promise<number> {
  const config = loadConfig();
  const wrapper = path.join(config.rootDir, WRAPPER_NAME);
  if (!isElevated()) return elevate(['--reiniciar', ...(args.pause ? [] : ['--sin-pausa'])]);
  if (serviceState() !== 'missing' && existsSync(wrapper)) sh(wrapper, ['restart']);
  else if (taskExists()) {
    sh('schtasks', ['/End', '/TN', TASK_NAME]);
    sh('schtasks', ['/Run', '/TN', TASK_NAME]);
  } else {
    say('El programa no está instalado. Haz doble clic en DrDripVitrina.exe para instalarlo.');
    return finish(args, false);
  }
  const ok = await waitUntilRunning(config.port, 40);
  say(ok ? 'Programa reiniciado.' : 'El programa no respondió después de reiniciar.');
  return finish(args, ok);
}

async function status(): Promise<number> {
  const config = loadConfig();
  const version = await runningVersion(config.port);
  const registered = registeredWrapper();
  const ours = registered !== null && samePath(registered, path.join(config.rootDir, WRAPPER_NAME));
  say(`DrDrip Vitrina v${APP_VERSION} (este programa)`);
  say(`Carpeta:             ${config.rootDir}`);
  say(`Servicio de Windows: ${{ missing: 'no instalado', running: 'en marcha', stopped: 'detenido', starting: 'arrancando' }[serviceState()]}`);
  if (registered) say(`Servicio instalado desde: ${path.dirname(registered)}${ours ? '' : '  <- OTRA CARPETA'}`);
  say(`Tarea programada:    ${taskExists() ? 'creada' : 'no'}`);
  say(`Responde en el puerto ${config.port}: ${version === null ? 'no' : `sí, versión ${version}`}`);
  if (registered && !ours) say('\nHaz doble clic en DrDripVitrina.exe de esta carpeta para que reemplace a la otra instalación.');
  return version === APP_VERSION && ours ? 0 : 1;
}

function kioskStartupPath(): string | null {
  const appData = process.env.APPDATA;
  return appData ? path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', KIOSK_STARTUP_FILE) : null;
}

function removeKioskStartup(): boolean {
  const file = kioskStartupPath();
  if (!file || !existsSync(file)) return false;
  unlinkSync(file);
  return true;
}

/** A service cannot open windows, so the kiosk browser is started from the user session. */
async function kiosk(args: Args): Promise<number> {
  const config = loadConfig();
  const screen = /^\d{1,4}$/.test(args.value) ? args.value : '1';
  const browser = browserCandidates(process.env).find((file) => existsSync(file));
  if (!browser) {
    say('No se encontró Microsoft Edge ni Google Chrome en este equipo.');
    return finish(args, false);
  }
  // At logon the service may still be starting.
  await waitUntilRunning(config.port, 60);
  const profile = path.join(process.env.LOCALAPPDATA ?? config.dataDir, 'DrDripVitrina', 'kiosko');
  mkdirSync(profile, { recursive: true });
  spawn(browser, kioskArgs(`http://localhost:${config.port}/${screen}`, profile), { detached: true, stdio: 'ignore' }).unref();
  return 0;
}

async function kioskAuto(args: Args): Promise<number> {
  const file = kioskStartupPath();
  if (!file) {
    say('No se encontró la carpeta de inicio de Windows.');
    return finish(args, false);
  }
  if (!/^\d{1,4}$/.test(args.value)) {
    say(removeKioskStartup() ? 'El kiosko ya no se abrirá al iniciar sesión.' : 'El kiosko automático no estaba activado.');
    return finish(args, true);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `@echo off\r\nstart "" "${process.execPath}" --kiosko ${args.value} --sin-pausa\r\n`);
  say(`Listo: al iniciar sesión en este equipo se abrirá la pantalla ${args.value} a pantalla completa.`);
  say('Para salir del kiosko pulsa Alt+F4.');
  return finish(args, true);
}

function help(): number {
  say(`DrDrip Vitrina v${APP_VERSION}

  DrDripVitrina.exe                 Instala el servicio (la primera vez) y abre el panel
  DrDripVitrina.exe --estado        Muestra si el programa está en marcha
  DrDripVitrina.exe --reiniciar     Reinicia el servicio
  DrDripVitrina.exe --desinstalar   Quita el servicio y la regla del firewall (conserva los datos)
  DrDripVitrina.exe --kiosko 1      Abre la pantalla 1 a pantalla completa en este equipo
  DrDripVitrina.exe --kiosko-auto 1 Abre ese kiosko cada vez que se inicia sesión ("no" lo quita)
  DrDripVitrina.exe --consola       Ejecuta el programa en esta ventana, para diagnosticar`);
  return 0;
}

/**
 * Handles the Windows-only commands. Returns an exit code, or null when the
 * caller should go on and run the server itself.
 */
export async function runWindowsCommand(argv: string[]): Promise<number | null> {
  const args = parseArgs(argv);
  if (args.command === 'servicio' || args.command === 'consola') return null;
  if (args.command === 'ayuda') return help();

  spawnSync('cmd', ['/c', 'chcp', '65001'], { stdio: 'ignore', windowsHide: true }); // accents in the console

  switch (args.command) {
    case 'instalar':
      return install(args);
    case 'desinstalar':
      return uninstall(args);
    case 'reiniciar':
      return restart(args);
    case 'estado':
      return status();
    case 'kiosko':
      return kiosk(args);
    case 'kiosko-auto':
      return kioskAuto(args);
    default: {
      // Double click. When this same installation is already running, this is
      // the single-instance check: just open the panel. Anything else (nothing
      // running, another version, or a service registered from another folder)
      // goes through the installer, which takes over.
      const config = loadConfig();
      const version = await runningVersion(config.port);
      const registered = registeredWrapper();
      const ours = registered === null || samePath(registered, path.join(config.rootDir, WRAPPER_NAME));
      if (version === APP_VERSION && ours) {
        if (args.browser) openInBrowser(`http://localhost:${config.port}/admin/`);
        return 0;
      }
      return install(args);
    }
  }
}

/** Restart requested from the panel. Works without a console and without a prompt. */
export function restartFromInside(rootDir: string): boolean {
  const wrapper = path.join(rootDir, WRAPPER_NAME);
  if (process.platform !== 'win32') return false;
  if (existsSync(wrapper) && serviceState() !== 'missing') {
    // "restart!" is WinSW's command for a service that restarts itself.
    spawn(wrapper, ['restart!'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return true;
  }
  if (taskExists()) {
    spawn('cmd', ['/c', `timeout /t 2 /nobreak >nul & schtasks /Run /TN "${TASK_NAME}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    setTimeout(() => process.exit(0), 500);
    return true;
  }
  return false;
}
