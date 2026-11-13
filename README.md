# DrDrip Vitrina

Cartelería digital local para **DrDrip — Infusion Services & More** (Vega Baja, Puerto Rico). Muestra el menú de servicios y precios en las pantallas de la clínica, funciona con o sin internet y se administra desde un panel en el navegador.

Versión actual: **0.2.1**. El plan completo está en [`docs/plan-de-trabajo.md`](docs/plan-de-trabajo.md).

| Componente | Dónde se abre |
|---|---|
| Panel de administración | `http://localhost:3000/admin/` (también desde el celular, con la IP del PC) |
| Pantallas | `http://IP-DEL-PC:3000/1`, `/2`… o `http://drdrip.local:3000/1` |
| Página de selección para el control remoto | `http://IP-DEL-PC:3000/` |

El PIN de fábrica del panel es `1234`. El panel recuerda cambiarlo en *Sistema*.

## Cómo ejecutarlo

Requiere Node.js **24 LTS** (o 22 LTS). Las versiones impares, como la 25, no tienen soporte largo y algunas dependencias no las admiten.

En Windows, clona el proyecto **fuera de OneDrive** (por ejemplo en `C:\Proyectos`). OneDrive sincroniza `node_modules` mientras se instala y puede dejar archivos incompletos, lo que produce errores como `is not a valid Win32 application` al compilar.

Usa `npm ci` en lugar de `npm install`: instala exactamente las versiones de `package-lock.json`.

```bash
npm ci
```

```bash
npm run build
```

```bash
npm start
```

Para desarrollar, `npm run dev` levanta el servidor con recarga automática y `npm run dev:admin` el panel con Vite en el puerto 5173.

La primera vez se carga el catálogo del sitio web (35 servicios y 7 complementos) y una pantalla de ejemplo ya publicada. El puerto y la carpeta de datos se cambian copiando `config.example.ini` como `config.ini`.

## Estado del plan

| Fase | Estado | Notas |
|---|---|---|
| 0. Preparación | Hecha | Monorepo, TypeScript, paleta y tipografías del rebrand empaquetadas |
| 1. Núcleo de datos | Hecha | SQLite (WAL), precios en centavos enteros, modos `fixed`/`from`/`ask`, catálogo inicial |
| 2. API + WebSocket | Hecha | CRUD con PATCH parcial, subida de fotos, avisos en vivo |
| 3. Motor de plantillas | Hecha | Las 10 plantillas del plan más galería de imágenes, productos con foto en columnas, ofertas y tablero de promociones |
| 4. Panel de administración | Hecha | Servicios (con precio de oferta), complementos, categorías, promociones, marca, sistema. Menú lateral por grupos y barra inferior en teléfono |
| 5. Constructor de pantallas | Hecha | Borrador, vista previa en vivo, Publicar, duplicar, versiones, horarios |
| 6. Animaciones | Hecha, falta medir en TVs | Fundido, cortina con la gota, bienvenida y calidad automática. No se ha medido en un televisor real |
| 7. Robustez offline | Parcial | Caché de la última versión, reconexión, horarios y respaldos nocturnos. Si el servidor está apagado y el TV se reinicia, la página no carga |
| 8. Módulo en línea | Pendiente | Respaldo en la nube, aviso de actualizaciones, importación web, acceso remoto |
| 9. Servicio de Windows y `.exe` | Hecha, falta el ícono de bandeja | `DrDripVitrina.exe` se instala como servicio con un doble clic (WinSW), abre el firewall, se reinicia si falla y se controla desde *Sistema*. GitHub lo compila y lo prueba en Windows en cada cambio. El ícono de bandeja (opcional en el plan) no está hecho |
| 10. Descubrimiento de pantallas | Parcial | Registro asistido y sección *Dispositivos*. Faltan los adaptadores de Cast, ADB, webOS, Tizen y Roku, que necesitan equipos reales |
| 11. Pulido | Parcial | CSV, ajuste masivo, historial de precios, PIN y alertas. Falta la semana de uso real |

## Decisiones tomadas que conviene conocer

- **Semaglutide y Tirzepatide se cargan ocultos.** Aparecen en *Servicios* con *Visible* apagado hasta que el director médico decida si se muestran y con qué texto.
- **El isotipo y el logotipo oficiales están integrados** como trazos que toman el color de cada tema. Si el nombre de la marca se cambia en el panel, se usa texto en Bodoni.
- **Los televisores serán Google TV**, así que el primer adaptador de descubrimiento (fase 10) será el de Google Cast.
- **Los datos viven en `data`, dentro de la carpeta del programa.** Al actualizar se reemplaza todo menos `data` y `config.ini`. Otra ubicación se configura con `data_dir`.
- **El precio en oro usa un tono legible por tema.** El oro oficial `#C6A66B` se mantiene en filetes y acentos; sobre salvia y marfil el texto del precio usa un tono más claro o más oscuro del mismo oro para que se lea a distancia.
- **Base de datos con `node:sqlite`**, incluida en Node. Así el futuro `.exe` no necesita módulos nativos.
- **Una oferta no reemplaza el precio normal.** Se guarda aparte (`offer_cents`), debe ser menor que el precio, puede tener fecha de fin y se muestra con el precio normal tachado. El descuento se redondea hacia abajo.
- **Los precios cambian en vivo; la composición de una pantalla espera a *Publicar*.** Un cambio de precio llega a los televisores en uno o dos segundos sin publicar nada.
- **`sharp` es opcional en tiempo de ejecución.** Si no está disponible, la foto se guarda sin reducir.

## Programa para Windows

```bash
npm run build:windows
```

Genera `release/DrDripVitrina/`, la carpeta que se copia a `C:\DrDripVitrina` en el PC de la clínica. Se puede generar desde Windows, Linux o macOS. También se descarga ya compilada y probada desde GitHub: pestaña *Actions*, flujo *Windows build*, artefacto `DrDripVitrina-windows`.

| Acción | Cómo |
|---|---|
| Instalar | Doble clic en `DrDripVitrina.exe` y aceptar el permiso de administrador |
| Abrir el panel | Doble clic otra vez (no abre una segunda copia) |
| Kiosko en una pantalla conectada al PC | `Pantalla 1 en kiosko.cmd`, o `Kiosko automatico al iniciar sesion.cmd` |
| Reiniciar | *Sistema* en el panel, o `Reiniciar.cmd` |
| Desinstalar | `Desinstalar.cmd` (conserva `data`) |
| Diagnosticar | `DrDripVitrina.exe --estado`, y los registros en `data\logs\vitrina.log` |

Si el servicio no se puede registrar, el instalador crea una tarea programada que arranca el programa al encender el equipo.

## Estructura

```
apps/
  server/     Fastify + SQLite + WebSocket (src/routes, src/services, src/db)
  admin/      Panel en Preact + Vite + SweetAlert2
  player/     Pantallas en HTML, CSS y JS sin librerías
    engine/     motor: horarios, render, transiciones, conexión
    templates/  un archivo por plantilla
    fonts/      Bodoni Moda y Montserrat (WOFF2, licencia OFL)
packages/shared/   dinero, formato de precios y catálogo de plantillas
scripts/           empaquetado del servidor y del programa para Windows
docs/              plan de trabajo
```

Los datos (`drdrip.db`, `media/`, `backups/`) viven en `data/`, fuera del control de versiones.

## Agregar una plantilla

1. Añade su descripción a `packages/shared/src/templates.ts`.
2. Crea `apps/player/templates/mi-plantilla.js` y regístrala con `Vitrina.registerTemplate('mi-plantilla', { render })`.
3. Inclúyela en `apps/player/player.html` y añade sus estilos a `apps/player/css/player.css`.

El motor no cambia.

## Pruebas

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm audit
```

Las pruebas cubren dinero y formato de precios, API (PATCH parcial, historial, CSV, ajuste masivo, PIN), publicación y versiones, WebSocket, respaldos, elección de la tarjeta de red y el motor de plantillas.
