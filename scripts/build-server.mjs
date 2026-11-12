// Bundles the server into a single CommonJS file (dist/server.cjs).
// This is the input for the Windows single-executable build (Node SEA).
import { build } from 'esbuild';

await build({
  entryPoints: ['apps/server/src/index.ts'],
  outfile: 'dist/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // sharp ships native binaries; it stays outside the bundle and is optional at runtime.
  external: ['sharp'],
  logLevel: 'info',
});
