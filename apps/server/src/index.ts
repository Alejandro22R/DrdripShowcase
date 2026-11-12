import { APP_VERSION } from '@drdrip/shared';
import { buildApp } from './app.js';
import { isPackaged } from './config.js';
import { startBackupScheduler } from './services/backup.js';
import { lanAddresses, startMdns } from './services/network.js';
import { runWindowsCommand } from './windows/cli.js';

async function main(): Promise<void> {
  // The packaged .exe on Windows doubles as its own installer and launcher.
  if (process.platform === 'win32' && isPackaged()) {
    const code = await runWindowsCommand(process.argv.slice(2));
    if (code !== null) process.exit(code);
  }

  const { app, ctx } = await buildApp();
  const { config } = ctx;

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.error(
        `\nEl puerto ${config.port} ya está en uso. Cierra el otro programa que lo usa o cambia "port" en config.ini.\n`,
      );
      process.exit(2);
    }
    throw err;
  }

  const stopBackups = startBackupScheduler(ctx.db, ctx.backupDir, (err) => app.log.error(err));
  const stopMdns = config.mdns ? await startMdns(config.mdnsName, config.port, (msg) => app.log.warn(msg)) : () => {};

  console.log(`DrDrip Vitrina v${APP_VERSION} (${config.runMode})`);
  console.log(`  Panel:     http://localhost:${config.port}/admin/`);
  for (const { address } of lanAddresses()) console.log(`  Pantallas: http://${address}:${config.port}/1`);
  if (config.mdns) console.log(`             http://${config.mdnsName}.local:${config.port}/1`);
  console.log(`  Datos:     ${config.dataDir}`);

  const shutdown = async () => {
    stopBackups();
    stopMdns();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// A crash is written to the log before the service restarts the program.
process.on('uncaughtException', (err) => {
  console.error('Error no controlado:', err);
  process.exit(1);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
