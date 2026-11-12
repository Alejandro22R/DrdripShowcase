// Builds the folder that gets copied to the clinic PC:
//
//   release/DrDripVitrina/
//     DrDripVitrina.exe            the program (Node single executable)
//     DrDripVitrinaService.exe     WinSW, the Windows service wrapper
//     DrDripVitrinaService.xml     service definition
//     apps/                        player and panel files
//     node_modules/                sharp, for shrinking photos
//
// Usage: node scripts/build-windows.mjs            (Windows x64 build, from any OS)
//        node scripts/build-windows.mjs --host     (build for this machine, to smoke-test)
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inject } from 'postject';
import { stripSignature } from './pe-signature.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.argv.includes('--host');
const windows = !host || process.platform === 'win32';
const cache = path.join(root, 'dist', 'cache');
const out = path.join(root, 'release', 'DrDripVitrina');
const exeName = windows ? 'DrDripVitrina.exe' : 'DrDripVitrina';
const WINSW_URL = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe';
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const step = (text) => console.log(`\n> ${text}`);
const run = (file, args, cwd = root) => execFileSync(file, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

async function download(url, file) {
  if (existsSync(file)) return;
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

step('Building panel and server bundle');
run(npm, ['run', 'build']);

step('Preparing folders');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });

step('Creating the single-executable blob');
const blob = path.join(root, 'dist', 'sea-prep.blob');
const seaConfig = path.join(root, 'dist', 'sea-config.json');
writeFileSync(seaConfig, JSON.stringify({ main: path.join(root, 'dist', 'server.cjs'), output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, useSnapshot: false }));
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { cwd: root, stdio: 'inherit' });

step(`Preparing the Node runtime (${process.version})`);
let runtime;
if (process.platform === 'win32' || host) runtime = readFileSync(process.execPath);
else {
  // Cross-building: the blob must be injected into the Windows build of this same Node version.
  const file = path.join(cache, `node-${process.version}-win-x64.exe`);
  await download(`https://nodejs.org/dist/${process.version}/win-x64/node.exe`, file);
  runtime = readFileSync(file);
}
if (windows) {
  const { buffer, removed } = stripSignature(runtime);
  console.log(removed ? `  signature removed (${removed} bytes)` : '  the runtime was not signed');
  runtime = buffer;
}
const exe = path.join(out, exeName);
writeFileSync(exe, runtime);
if (!windows) chmodSync(exe, 0o755);

step('Injecting the program into the executable');
await inject(exe, 'NODE_SEA_BLOB', readFileSync(blob), { sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2' });

step('Copying player and panel');
cpSync(path.join(root, 'apps', 'player'), path.join(out, 'apps', 'player'), {
  recursive: true,
  filter: (src) => !/[\\/]test([\\/]|$)/.test(src) && !src.endsWith('package.json'),
});
cpSync(path.join(root, 'apps', 'admin', 'dist'), path.join(out, 'apps', 'admin', 'dist'), { recursive: true });
cpSync(path.join(root, 'config.example.ini'), path.join(out, 'config.example.ini'));

step('Adding sharp (photo resizing)');
const sharpVersion = JSON.parse(readFileSync(path.join(root, 'node_modules', 'sharp', 'package.json'), 'utf8')).version;
const sharpDir = path.join(cache, `sharp-${sharpVersion}-${windows ? 'win32-x64' : 'host'}`);
if (!existsSync(path.join(sharpDir, 'node_modules', 'sharp'))) {
  mkdirSync(sharpDir, { recursive: true });
  writeFileSync(path.join(sharpDir, 'package.json'), '{"name":"vitrina-runtime","private":true}');
  run(npm, ['install', '--no-audit', '--no-fund', '--omit=dev', ...(windows ? ['--os=win32', '--cpu=x64'] : []), `sharp@${sharpVersion}`], sharpDir);
}
cpSync(path.join(sharpDir, 'node_modules'), path.join(out, 'node_modules'), { recursive: true });

if (windows) {
  step('Adding the Windows service wrapper (WinSW)');
  const winsw = path.join(cache, 'WinSW-x64-2.12.0.exe');
  await download(WINSW_URL, winsw);
  cpSync(winsw, path.join(out, 'DrDripVitrinaService.exe'));
  cpSync(path.join(root, 'scripts', 'windows', 'DrDripVitrinaService.xml'), path.join(out, 'DrDripVitrinaService.xml'));

  // Launchers are plain ASCII with CRLF so they work under any console code page.
  const launchers = {
    'Abrir panel.cmd': 'start "" "%~dp0DrDripVitrina.exe"',
    'Pantalla 1 en kiosko.cmd': '"%~dp0DrDripVitrina.exe" --kiosko 1',
    'Kiosko automatico al iniciar sesion.cmd': '"%~dp0DrDripVitrina.exe" --kiosko-auto 1',
    'Quitar kiosko automatico.cmd': '"%~dp0DrDripVitrina.exe" --kiosko-auto no',
    'Reiniciar.cmd': '"%~dp0DrDripVitrina.exe" --reiniciar',
    'Desinstalar.cmd': '"%~dp0DrDripVitrina.exe" --desinstalar',
  };
  for (const [name, command] of Object.entries(launchers)) writeFileSync(path.join(out, name), `@echo off\r\n${command}\r\n`);
  writeFileSync(path.join(out, 'LEEME.txt'), readFileSync(path.join(root, 'scripts', 'windows', 'LEEME.txt'), 'utf8').replace(/\r?\n/g, '\r\n').replace('{version}', version));
}

console.log(`\nDone: ${out}`);
