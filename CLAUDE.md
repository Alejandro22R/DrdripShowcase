# DrDrip Vitrina

- Cartelería digital offline-first para clínica de infusiones IV (Puerto Rico).
- Solo USD, en centavos enteros (`price_cents`). Nunca floats para dinero; los porcentajes van en puntos básicos.
- Modos de precio: fixed, from ("Desde"), ask ("Consultar").
- Player sin dependencias ni CDNs; fuentes empaquetadas localmente. ES2015 sin módulos, sin `?.` ni `??`,
  sin `gap` en flexbox ni `inset`: debe correr en navegadores de Smart TV antiguos.
- El texto del catálogo entra al DOM por `textContent` (helper `Vitrina.h`), nunca por `innerHTML`.
- Cada diapositiva es un JSON; agregar plantillas no debe tocar el motor (`apps/player/engine`).
- Borrador y publicación: `screens`/`slides` son el borrador; `config_versions` guarda lo publicado.
  El catálogo (nombres, precios) se resuelve en vivo en `buildPlayerPayload`.
- Marca: salvia #687568, oliva #929985, marfil #F4F0E6, carbón #242522,
  oro #C6A66B (solo acentos). Bodoni Moda SemiBold + Montserrat Regular.
- Tono visual sereno y premium: sin confeti, sin colores vivos, sin parpadeos. Animar solo `transform` y `opacity`.
- Zona horaria de la clínica: America/Puerto_Rico (UTC-4 fijo). Usar `clinicNow()` / `Vitrina.clinicTime()`.
- Rutas con path.join; probar en Windows. Quitar la firma del .exe antes de empaquetar.
- Base de datos con `node:sqlite` (sin módulos nativos). Migraciones en `apps/server/src/db/schema.ts`: solo agregar, nunca editar.
- El .exe se instala como servicio de Windows (WinSW, `apps/server/src/windows/cli.ts`): sin ventana, arranque automático,
  instancia única, reinicio si falla y regla de firewall. Datos fuera de la carpeta del programa.
- Descubrimiento de pantallas: un adaptador independiente por marca (Cast, ADB, webOS, Tizen, Roku)
  y registro asistido como respaldo universal. Nunca asumir que un TV acepta control remoto.
- Actualizaciones parciales (PATCH) nunca deben borrar campos no enviados.
- Interfaz en español; código y comentarios en inglés.
- Ejecutar `npm test`, `npm run typecheck` y `npm audit` antes de dar una tarea por terminada.

## Comandos

- `npm run dev`: servidor con recarga (puerto 3000). `npm run dev:admin`: panel con Vite.
- `npm run build`: compila el panel y empaqueta el servidor en `dist/server.cjs`. `npm start` lo ejecuta.
- `npm test`: Vitest (shared, server, player).
- `npm run build:windows`: genera `release/DrDripVitrina/` (exe con Node SEA, WinSW, player, panel y sharp).
  El flujo `.github/workflows/windows.yml` lo compila y prueba la instalación como servicio en Windows.
