import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LogFile, isLogName, listLogs } from '../src/services/logfile.js';
import { browserCandidates, elevateCommand, firewallAddArgs, kioskArgs, parseArgs, parseScBinaryPath, parseScState, samePath, taskCreateArgs } from '../src/windows/cli.js';
import { stripSignature } from '../../../scripts/pe-signature.mjs';

describe('command line of the .exe', () => {
  it('defaults to "install if needed and open the panel"', () => {
    expect(parseArgs([])).toEqual({ command: 'abrir', value: '', browser: true, pause: true });
  });

  it('understands the commands and their flags', () => {
    expect(parseArgs(['--servicio']).command).toBe('servicio');
    expect(parseArgs(['--desinstalar', '--sin-pausa'])).toMatchObject({ command: 'desinstalar', pause: false });
    expect(parseArgs(['--instalar', '--sin-navegador'])).toMatchObject({ command: 'instalar', browser: false });
    expect(parseArgs(['--kiosko', '2'])).toMatchObject({ command: 'kiosko', value: '2' });
    expect(parseArgs(['--kiosko-auto', 'no'])).toMatchObject({ command: 'kiosko-auto', value: 'no' });
    expect(parseArgs(['--DESINSTALAR']).command).toBe('desinstalar');
    expect(parseArgs(['-h']).command).toBe('ayuda');
    expect(parseArgs(['--algo-raro']).command).toBe('abrir');
  });

  it('opens the firewall only for private and domain networks', () => {
    const args = firewallAddArgs(3000);
    expect(args).toContain('localport=3000');
    expect(args).toContain('profile=private,domain');
    expect(args.join(' ')).not.toMatch(/public/i);
  });

  it('builds the fallback task to run at boot as SYSTEM', () => {
    const args = taskCreateArgs('C:\\DrDripVitrina\\DrDripVitrina.exe');
    expect(args).toEqual(expect.arrayContaining(['/SC', 'ONSTART', '/RU', 'SYSTEM']));
    expect(args[args.indexOf('/TR') + 1]).toBe('"C:\\DrDripVitrina\\DrDripVitrina.exe" --servicio');
  });

  it('quotes paths safely when asking for administrator rights', () => {
    const cmd = elevateCommand("C:\\Users\\O'Neil\\DrDripVitrina.exe", ['--instalar', '--sin-pausa']);
    expect(cmd).toContain("-FilePath 'C:\\Users\\O''Neil\\DrDripVitrina.exe'");
    expect(cmd).toContain("-ArgumentList '--instalar','--sin-pausa'");
    expect(cmd).toContain('-Verb RunAs');
  });

  it('reads the service state in any Windows language', () => {
    expect(parseScState(0, 'SERVICE_NAME: DrDripVitrina\r\n        ESTADO             : 4  RUNNING')).toBe('running');
    expect(parseScState(0, '        STATE              : 1  STOPPED')).toBe('stopped');
    expect(parseScState(0, '        STATE              : 2  START_PENDING')).toBe('starting');
    expect(parseScState(1060, '[SC] EnumQueryServicesStatus:OpenService FAILED 1060')).toBe('missing');
    expect(parseScState(null, '')).toBe('missing');
  });

  it('finds which folder the service was installed from, in any Windows language', () => {
    const es = '        TIPO_INICIO        : 2   AUTO_START\r\n        NOMBRE_RUTA_BINARIO: "C:\\proyectos\\DrdripShowcase-main\\DrDripVitrinaService.exe"\r\n        GRUPO_ORDEN_CARGA  :';
    const en = '        BINARY_PATH_NAME   : C:\\DrDripVitrina\\DrDripVitrinaService.exe\r\n        LOAD_ORDER_GROUP   :';
    expect(parseScBinaryPath(es)).toBe('C:\\proyectos\\DrdripShowcase-main\\DrDripVitrinaService.exe');
    expect(parseScBinaryPath(en)).toBe('C:\\DrDripVitrina\\DrDripVitrinaService.exe');
    expect(parseScBinaryPath('[SC] OpenService FAILED 1060')).toBeNull();
    expect(samePath('C:\\DrDripVitrina\\DrDripVitrinaService.exe', 'c:\\drdripvitrina\\DrDripVitrinaService.EXE')).toBe(true);
    expect(samePath('C:\\proyectos\\DrdripShowcase-main\\DrDripVitrinaService.exe', 'C:\\DrDripVitrina\\DrDripVitrinaService.exe')).toBe(false);
  });

  it('looks for Edge first, then Chrome', () => {
    const list = browserCandidates({ 'ProgramFiles(x86)': 'C:\\Program Files (x86)', ProgramFiles: 'C:\\Program Files' });
    expect(list[0]).toBe('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
    expect(list[list.length - 1]).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(kioskArgs('http://localhost:3000/1', 'C:\\perfil').slice(0, 2)).toEqual(['--kiosk', 'http://localhost:3000/1']);
  });
});

describe('rotating log file', () => {
  it('rotates by size and keeps only the newest files', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'drdrip-log-'));
    try {
      const log = new LogFile(dir, 200, 2);
      for (let i = 0; i < 40; i++) log.write(`line ${String(i).padStart(3, '0')} ${'x'.repeat(30)}`);
      const names = listLogs(dir).map((l) => l.name);
      expect(names).toEqual(['vitrina.1.log', 'vitrina.2.log', 'vitrina.log']);
      expect(readFileSync(path.join(dir, 'vitrina.log'), 'utf8')).toContain('line 039');
      expect(listLogs(dir).every((l) => l.size <= 200)).toBe(true);
      expect(isLogName('vitrina.1.log')).toBe(true);
      expect(isLogName('..\\drdrip.db')).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('removing the Authenticode signature', () => {
  /** Smallest PE32+ layout that has a certificate table at the end of the file. */
  function fakeExe(certSize: number): Buffer {
    const peOffset = 0x80;
    const optional = peOffset + 24;
    const body = Buffer.alloc(0x400);
    body.write('MZ', 0, 'latin1');
    body.writeUInt32LE(peOffset, 0x3c);
    body.write('PE\0\0', peOffset, 'latin1');
    body.writeUInt16LE(0x20b, optional); // PE32+
    body.writeUInt32LE(0xdeadbeef, optional + 64); // checksum
    body.writeUInt32LE(16, optional + 108); // number of data directories
    if (certSize) {
      body.writeUInt32LE(body.length, optional + 112 + 4 * 8);
      body.writeUInt32LE(certSize, optional + 112 + 4 * 8 + 4);
    }
    return Buffer.concat([body, Buffer.alloc(certSize, 0xcc)]);
  }

  it('drops the certificate table and clears its directory entry', () => {
    const { buffer, removed } = stripSignature(fakeExe(0x180));
    expect(removed).toBe(0x180);
    expect(buffer.length).toBe(0x400);
    const dir = 0x80 + 24 + 112 + 4 * 8;
    expect(buffer.readUInt32LE(dir)).toBe(0);
    expect(buffer.readUInt32LE(dir + 4)).toBe(0);
    expect(buffer.readUInt32LE(0x80 + 24 + 64)).toBe(0); // checksum reset
  });

  it('leaves unsigned files alone and rejects non-executables', () => {
    const unsigned = fakeExe(0);
    expect(stripSignature(unsigned)).toEqual({ buffer: unsigned, removed: 0 });
    expect(() => stripSignature(Buffer.from('#!/bin/sh'))).toThrow();
  });
});
