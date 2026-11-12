# DrDrip Vitrina: plan de trabajo

**Cliente:** DrDrip — Infusion Services & More (Vega Baja, Puerto Rico)
**Proyecto:** cartelería digital local (offline-first) para mostrar el menú de servicios y precios en las pantallas de la clínica
**Versión objetivo:** 0.3.x (servicio de Windows funcionando, pantallas detectadas y conectadas)
**Estado:** v0.2.0 construida (fases 0 a 5 y 9 completas; 6, 7, 10 y 11 parciales; 8 pendiente). El detalle está en el `README.md`.
**Fuentes del análisis:** manual de identidad del rebrand, sitio web `drdrippr.com` (inicio y menú de servicios) e Instagram `@drdrippr`

> **Sobre las fuentes:** Instagram bloquea la lectura automática, así que no se pudo revisar su contenido. Para lo visual la fuente de verdad es el **manual de identidad del rebrand**, y para los servicios y precios es el **menú del sitio web**, que debe confirmarse con el cliente antes de cargarse.

---

## 1. Resumen

La aplicación muestra en las pantallas de la clínica el menú de servicios con su duración y su precio en dólares, con el estilo sereno y elegante del rebrand de DrDrip. Todo corre en un PC de la clínica y funciona con o sin internet, porque internet solo se usa para extras opcionales como el respaldo en la nube. El cliente puede **crear y configurar las pantallas que quiera** desde un panel, sin depender de un programador.

| Componente | Qué hace | Dónde se abre |
|---|---|---|
| **Servidor** | Guarda los datos, formatea los precios, publica la configuración y avisa a las pantallas en tiempo real | Programa `DrDripVitrina.exe` |
| **Panel de administración** | Servicios, complementos, categorías, promociones, constructor de pantallas, marca, tasa de respaldo y sistema | `http://localhost:3000/admin/` (también desde el celular) |
| **Pantallas** | Muestran las diapositivas configuradas con animaciones suaves | `http://drdrip.local:3000/1` o `http://IP-DEL-PC:3000/1` |

---

## 2. Análisis de la marca DrDrip

### 2.1 Identidad del rebrand

| Elemento | Detalle |
|---|---|
| Nombre y descriptor | **DrDrip** · *Medical Aesthetics and Wellness* |
| Símbolo | Gota con una hoja dorada en su interior; hay versión principal, versión clara y símbolo solo en círculo |
| Frases de marca | **Ciencia · Belleza · Bienestar**, **Vitalidad · Bienestar · Equilibrio** y *"Tu bienestar, nuestra especialidad."* |
| Tono | Elegante, calmado, médico-estético y premium |
| Tipografía principal | **Bodoni Moda SemiBold** (serif editorial de alto contraste; el logotipo es lettering propio) |
| Tipografía secundaria | **Montserrat Regular**, para textos de apoyo y descriptores en mayúsculas con letras muy espaciadas |
| Aplicaciones del manual | Fachada con letrero iluminado, uniformes en verde salvia y arena, tarjetería y bolsa de infusión con el logo |

### 2.2 Paleta oficial

| Nombre | HEX | Uso en pantalla |
|---|---|---|
| Verde salvia | `#687568` | Color de marca: fondos principales, franjas y encabezados |
| Oliva suave | `#929985` | Apoyo: tarjetas secundarias, líneas y estados inactivos |
| Marfil cálido | `#F4F0E6` | Luz y calma: fondos claros y texto sobre salvia o carbón |
| Carbón | `#242522` | Legibilidad: fondo oscuro y texto principal sobre marfil |
| Oro champán | `#C6A66B` | **Solo pequeños acentos**: precios, filetes, estrellita ✦ y resaltados |

El manual lo resume así: el verde salvia define la marca, el marfil aporta luz y calma, el carbón sostiene la legibilidad y el oro se reserva para acentos. Por eso el diseño evita colores vivos, confeti y parpadeos.

### 2.3 Elementos gráficos reutilizables

- Silueta grande de la gota en baja opacidad como marca de agua, igual que en las portadas del manual.
- Filete dorado con estrellita central (✦) como separador bajo el descriptor.
- Descriptor en Montserrat, mayúsculas y letras espaciadas.
- Tres temas de fondo: **oscuro** (carbón con texto marfil), **salvia** (texto marfil) y **claro** (marfil con texto carbón o salvia).

### 2.4 Catálogo de servicios detectado en el sitio web

Precios en USD tal como aparecen publicados en el menú del sitio.

**Consulta**

| Servicio | Duración | Precio |
|---|---|---|
| Consulta médica | 30 min | Desde $45 |

**Drips (infusiones intravenosas), 1 h 30 min cada una**

| Servicio | Precio |
|---|---|
| Glutathione Drip | $59 |
| Multivitamin Drip | $100 |
| Vitamin C Drip 5,000 mg | $100 |
| Bariatric Drip | $119 |
| Anti-Migraine Drip | $129 |
| PMS Drip | $129 |
| Male Booster Drip | $139 |
| After Party Drip | $149 |
| Beauty Drip | $149 |
| Immune Booster Drip | $149 |
| Myers Drip | $159 |
| Pre-Workout Drip | $159 |
| Energy Booster Drip | $159 |
| Vitamin C Drip 10,000 mg | $159 |
| Skinny Drip | $159 |
| NAD 250 mg | $165 |
| Post-Workout Drip | $169 |
| NAD 500 mg | $219 |

**IV Add-ins (complementos que se agregan el día de la infusión)**

| Complemento | Precio |
|---|---|
| Ketorolac (Toradol®) | $10 |
| Famotidine (Pepcid®) | $10 |
| Ondansetron (Zofran®) | $10 |
| Dexamethasone (Decadron®) | $10 |
| Vitamina C | $15 |
| Biotina | $15 |
| Vitamina B12 | $15 |

**Inyectables / intramusculares**

| Servicio | Precio |
|---|---|
| Shot de Vitamina B12 | $25 |
| Shot de Vitamina D | $25 |
| Shot de Biotina | $25 |
| Tri-Immune Shot | $40 |
| Ultra Fat Burn Shot | Desde $40 |
| Relax Shot | Sin precio publicado |

**Servicios sin precio publicado (se cargan como "Consultar")**
- Control de peso: Semaglutide, Tirzepatide y Ultra Fat Burn.
- Remoción (con biopsia de ser necesario): verrugas, lunares y acrocordones.
- Lipólisis localizada: drenaje linfático, ultra cavitación, ultrasonido y corrientes rusas.
- Gift Cards ("¡Regala salud!").

**Beneficios que la marca ya comunica** (sirven como textos de apoyo): rápida absorción, personalizado a tus necesidades, directo al torrente sanguíneo, rehidratación y mínimos efectos secundarios.

**Datos de contacto para el pie de pantalla:** Calle Ramón E. Betances #56, Vega Baja, PR · Tel. 939-356-5275 · martes a viernes de 9:00 a. m. a 5:00 p. m. y sábados de 8:00 a. m. a 3:00 p. m. · `@DrDrippr`.

> **A validar con el cliente:** semaglutide y tirzepatide son medicamentos de prescripción, así que el director médico debe decidir si se muestran en pantallas públicas y con qué redacción. La app tendrá un campo para ocultar cualquier servicio y el modo "Consultar" para no publicar precio.

---

## 3. Tecnología

| Parte | Tecnología | Motivo |
|---|---|---|
| Servidor | Node.js + TypeScript + Fastify | Liviano, rápido y con poco consumo de memoria |
| Base de datos | SQLite (un solo archivo, `data/drdrip.db`) | Sin instalar nada aparte; resiste apagones (modo WAL) |
| Tiempo real | WebSocket | Un cambio publicado se ve en las pantallas en 1 o 2 segundos |
| Panel | Preact + Vite + SweetAlert2 | Interfaz ligera con alertas y validaciones |
| Pantallas | HTML, CSS y JavaScript sin librerías, con un **motor de plantillas por JSON** sobre CSS Grid | Compatible con Smart TVs, fácil de ampliar con plantillas nuevas |
| Tipografías | Bodoni Moda y Montserrat en WOFF2 **empaquetadas en la app** | Se ven igual sin internet |
| Imágenes | sharp | Reduce las fotos a 800 px en WebP para no saturar las pantallas |
| Pruebas | Vitest, incluidas pruebas de precios, API, WebSocket, mDNS y del motor de plantillas | Detectar errores antes de instalar |
| Empaquetado | Node SEA (ejecutable único) | Un `.exe` que no requiere instalar Node.js |
| Ejecución en segundo plano | **Servicio de Windows** con WinSW (envoltorio ligero), con tarea programada como alternativa | El programa corre solo al encender el PC, sin ventana de comandos y con reinicio automático si falla |
| Ícono de bandeja (opcional) | Proceso auxiliar pequeño que se inicia con la sesión | Mostrar el estado y abrir el panel sin tocar el servicio |
| Descubrimiento de pantallas | mDNS (`bonjour-service`), SSDP/UPnP, Google Cast (`castv2-client`) y ADB por red | Detectar dispositivos en la red y abrirles la vitrina |

**Regla clave del dinero:** los precios se guardan como **centavos enteros** (`price_cents`) y nunca se usan decimales de coma flotante. Cada servicio tiene un modo de precio: `fixed` ($159), `from` (Desde $45) o `ask` (Consultar).

**Zona horaria:** `America/Puerto_Rico` (UTC-4, sin horario de verano), necesaria para los horarios de las diapositivas y los respaldos.

---

## 4. Constructor de pantallas (requisito central)

El cliente debe poder crear, duplicar, ordenar y borrar tantas pantallas como quiera.

| Opción | Detalle |
|---|---|
| **Pantallas (TV)** | Crear TV 1, 2, 3… con nombre ("Sala de espera", "Recepción"), orientación y resolución |
| **Diapositivas** | Cada TV tiene su secuencia con orden, duración y transición |
| **Plantilla** | Se elige de un catálogo y se rellena con contenido |
| **Contenido** | Una categoría completa, servicios elegidos a mano, una promoción, texto libre o una imagen |
| **Tema** | Oscuro, salvia o claro, por TV o por diapositiva |
| **Horarios** | Diapositivas que solo salen en ciertos días u horas, y contenido distinto dentro y fuera del horario de la clínica |
| **Elementos fijos** | Encabezado con logo, pie con teléfono, horario y dirección, reloj y mensajes rotativos, cada uno activable |
| **Vista previa** | Se ve cómo queda antes de publicar; hay borrador y botón **Publicar** |
| **Duplicar** | Copiar toda la configuración de una TV a otra |
| **Versiones** | Cada publicación se guarda y se puede volver a una anterior con un clic |
| **Pantalla de respaldo** | Portada de marca si una diapositiva se queda sin contenido |

### Plantillas iniciales

| Plantilla | Uso |
|---|---|
| **Portada de marca** | Logo, descriptor, filete dorado, silueta de la gota y frases de la marca |
| **Menú de drips** | Lista elegante a 1 o 2 columnas con nombre, duración y precio en oro |
| **Tarjetas de servicio** | Cuadrícula de 2x2 a 4x3 con ícono o foto, nombre, descripción corta y precio |
| **Servicio destacado** | Un servicio a pantalla completa con beneficios y precio |
| **Arma tu drip** | Drip base más complementos con sus precios |
| **Inyectables y control de peso** | Lista compacta con "Desde" y "Consultar" |
| **Promoción / Gift Card** | Banner con imagen, texto y fechas de vigencia |
| **Beneficios** | Los cinco beneficios de la infusión con íconos |
| **Equipo / testimonios** | Fotos y nombres del equipo o testimonios rotativos, solo con permiso del cliente |
| **Texto libre / imagen / video corto** | Para cualquier mensaje del cliente |

Cada diapositiva se guarda como un JSON (`template`, `slots`, `theme`, `duration`, `schedule`), de modo que agregar una plantilla nueva no obliga a reescribir el motor. El texto largo se reduce solo hasta caber, y las tarjetas se adaptan a 720p, 1080p, pantalla vertical y cuadrículas de 2x2 a 4x3.

---

## 5. Con y sin internet

El principio es **offline primero, con extras en línea**: ninguna función esencial depende de internet.

| Función | Sin internet | Con internet |
|---|---|---|
| Mostrar servicios y precios | ✅ | ✅ |
| Editar desde el panel (PC o celular en la misma red) | ✅ | ✅ |
| Constructor de pantallas y publicación | ✅ | ✅ |
| Fuentes, logo e imágenes | ✅ Guardados en la app | ✅ |
| Respaldo nocturno local (últimos 14) | ✅ | ✅ |
| Hora y fecha | ✅ Reloj del sistema | ✅ Sincronizada |
| **Respaldo en la nube** (copia cifrada diaria) | ❌ Se encola | ✅ Se envía al volver la conexión |
| **Aviso de actualizaciones** del programa | ❌ | ✅ |
| **Administración remota** | ❌ | ✅ Opcional, con túnel seguro y PIN |
| **Importar catálogo desde el sitio web** | ❌ | ✅ Opcional, con revisión antes de aplicar |

Las tareas en línea se reintentan solas, nunca bloquean las pantallas y el tablero muestra el estado de conexión sin alarmar cuando no hay internet.

---

## 5.1 Ejecución como servicio de Windows (sin ventana de comandos)

El objetivo es que, al ejecutar el `.exe` una vez, la aplicación quede funcionando **hasta que se apague el PC y vuelva a arrancar sola**, sin ninguna ventana abierta.

| Aspecto | Diseño |
|---|---|
| **Instalación en un clic** | Al hacer doble clic en `DrDripVitrina.exe` por primera vez, Windows pide permiso de administrador una sola vez y el programa registra el servicio, crea la regla del firewall para la red privada, inicia el servicio y abre el panel en el navegador |
| **Segundo plano real** | El servicio corre sin ventana y **sin sesión iniciada**, de modo que arranca aunque nadie haya entrado a Windows tras un reinicio o un apagón |
| **Reinicio automático** | Si el programa se cierra por un error, el servicio lo vuelve a levantar en pocos segundos |
| **Un solo programa abierto** | Si se vuelve a hacer doble clic, el `.exe` detecta que ya hay uno corriendo y solo abre el panel (control de instancia única) |
| **Control desde el panel** | La sección *Sistema* permite ver el estado, reiniciar el servicio y descargar los logs |
| **Ícono de bandeja (opcional)** | Un proceso auxiliar junto al reloj con las opciones "Abrir panel", "Reiniciar" y "Desinstalar" |
| **Desinstalar limpio** | `DrDripVitrina.exe --desinstalar` quita el servicio y la regla del firewall sin borrar la carpeta `data` |
| **Logs** | Se guardan en `data\logs` con rotación para no llenar el disco |
| **Alternativa si el servicio falla** | Tarea programada de Windows "al iniciar el equipo", oculta y con reintentos, que logra el mismo resultado sin ventana |

**Detalle técnico importante:** un ejecutable de Node SEA no habla por sí solo el protocolo de servicios de Windows, por eso se empaqueta junto a **WinSW**, un envoltorio pequeño y de código abierto que se encarga de arrancarlo, vigilarlo y reiniciarlo. Un servicio tampoco puede abrir ventanas, así que el navegador en modo kiosko de una pantalla conectada por HDMI al mismo PC se lanza con una tarea aparte al iniciar sesión.

**Cuidados desde el inicio:** quitar la firma del `.exe` antes de empaquetar, usar `path.join` en todas las rutas, probar la instalación en un Windows limpio, validar que el puerto 3000 esté libre (con aviso claro si no lo está) y guardar los datos fuera de la carpeta del programa para que actualizar no borre nada.

---

## 5.2 Descubrimiento automático de pantallas

La app puede **encontrar** los dispositivos que están en la misma red y **ofrecerles** la vitrina, aunque cuánto se automatice depende de la marca. Se definen tres niveles, de más a menos automático.

### Nivel 1: Descubrimiento y reproducción automática

| Dispositivo | Cómo se detecta | Cómo se pone a reproducir |
|---|---|---|
| **Chromecast, Google TV y Android TV** | Anuncio mDNS de Google Cast (`_googlecast._tcp`) | La app se conecta por el protocolo Cast y abre la dirección de la vitrina (con un receptor tipo "carga una URL") |
| **Android TV y Fire TV** | mDNS y escaneo del puerto de depuración | Por ADB de red, con una orden que abre el navegador en la dirección de la vitrina; requiere activar la depuración por red una sola vez |

### Nivel 2: Descubrimiento con confirmación en el TV

| Dispositivo | Cómo se detecta | Observaciones |
|---|---|---|
| **LG webOS** | SSDP/UPnP | Se conecta y abre el navegador, pero el TV muestra una solicitud de permiso que alguien acepta una vez |
| **Samsung (Tizen)** | SSDP/UPnP | Igual que LG, con variaciones según el modelo y el año |
| **Roku** | SSDP y su interfaz de control en el puerto 8060 | Muy limitado, porque no ofrece un navegador libre |

### Nivel 3: Registro asistido (funciona con cualquier marca)

Cuando un televisor o un TV Box abre por primera vez `drdrip.local` o la IP del PC, el player se registra solo con un identificador único y en el panel aparece **"Pantalla nueva detectada"**. El cliente le asigna con un clic qué pantalla de la vitrina mostrar y el nombre ("Sala de espera"). Desde ese momento queda recordada, y cuando el TV se apaga y se enciende vuelve a abrir su vitrina.

### Cómo se ve en el panel

- Sección **Dispositivos** con la lista de equipos detectados en la red, su marca estimada, su IP y su estado (en línea, sin conectar o esperando permiso).
- Botones **Buscar en la red**, **Reproducir aquí**, **Detener** y **Asignar pantalla**.
- Aviso claro cuando un equipo requiere un paso manual en el TV, con las instrucciones en pantalla.
- Reconexión: si un dispositivo se reinicia, la app detecta que volvió y le reenvía la vitrina.

### Límites que conviene conocer

- Los televisores deben estar en la **misma red y subred**, y las redes de invitados de muchos routers aíslan los equipos y bloquean el descubrimiento.
- Casi siempre hay una **autorización inicial en el TV** que ninguna app puede saltarse.
- La app no puede encender un televisor apagado, salvo en modelos que aceptan encendido por red o por HDMI-CEC.
- Los receptores de terceros para Cast y los comandos de cada marca pueden cambiar con las actualizaciones de los fabricantes, por eso cada adaptador se construye como un módulo independiente y con pruebas sobre equipos reales.

### Recomendación de hardware

Para lograr automatización real con cualquier televisor, la opción más fiable es colocar en cada pantalla un **Chromecast con Google TV o una caja Android TV**, que suelen costar entre $30 y $50. Antes de elegir qué adaptadores desarrollar primero, hay que confirmar la marca y el modelo de los televisores de la clínica o si se comprarán dispositivos nuevos.

---

## 6. Fases del plan y su estado

| Fase | Entregable | Estado |
|---|---|---|
| 0. Preparación | Proyecto, TypeScript, `CLAUDE.md`, paleta y tipografías del rebrand | ✅ Hecha |
| 1. Núcleo de datos | Base de datos, formato de precios y carga inicial del catálogo, con pruebas | ✅ Hecha |
| 2. API + WebSocket | Servicios, complementos, pantallas, diapositivas, subida de fotos y avisos en vivo | ✅ Hecha |
| 3. Motor de plantillas | Lector de JSON y plantillas base de la marca | ✅ Hecha |
| 4. Panel de administración | Servicios, complementos, categorías, promociones, marca y ajustes | ✅ Hecha |
| 5. Constructor de pantallas | Diapositivas, vista previa, publicación, duplicado y versiones | ✅ Hecha |
| 6. Animaciones | Transiciones suaves, bienvenida de marca, calidad automática y rendimiento | 🟡 Hecha, falta medir en televisores reales |
| 7. Robustez offline | Caché en las pantallas, reconexión, horarios y respaldos | 🟡 Parcial |
| 8. Módulo en línea | Respaldo en la nube, actualizaciones e importación opcional | ⬜ Pendiente |
| 9. Servicio de Windows y empaquetado | `.exe` único que se instala como servicio, sin ventana de comandos, con inicio automático, reinicio si falla, firewall, kiosko y nombre `drdrip.local` | ✅ Hecha (sin el ícono de bandeja, que es opcional) |
| 10. Descubrimiento de pantallas | Detección de dispositivos en la red, registro asistido de TVs y adaptadores para Cast y Android TV (luego LG, Samsung y Roku) | 🟡 Parcial: registro asistido y sección Dispositivos |
| 11. Pulido | CSV, ajuste masivo, historial, PIN, alertas y una semana de uso real | 🟡 Parcial: falta la semana de uso real |

---

## 7. Plan de trabajo por etapas

Cada etapa termina con una versión que se prueba antes de pasar a la siguiente. El orden sigue el camino que conviene recorrer: primero lo que funciona, luego lo que se ve bien, después lo que resiste el uso diario y al final lo que se instala sin sorpresas.

### Etapa 1: Versión inicial (v0.1)
- Servidor con base de datos, modelo de servicios, complementos, categorías y promociones.
- Formato de precios (`fixed`, `from`, `ask`) y duración de cada servicio, con pruebas automáticas.
- Carga inicial del catálogo de la sección 2.4.
- Pantallas con tres plantillas base: portada de marca, menú de drips y tarjetas de servicio.
- Panel con edición de precio en línea (escribir y Enter), categorías, servicios y ajustes de contacto y horario.
- Respaldo automático cada noche (se guardan los últimos 14), exportar e importar CSV, historial de precios y PIN de acceso.

### Etapa 2: Constructor de pantallas
- Crear, nombrar, duplicar y borrar pantallas, y armar la secuencia de diapositivas con plantilla, contenido, duración y transición.
- Vista previa en vivo, borrador, botón **Publicar** y versiones para volver atrás.
- Horarios por día y hora, y encabezado, pie, reloj y mensajes rotativos activables.
- Resto de plantillas: servicio destacado, arma tu drip, inyectables, promoción, beneficios y equipo.

### Etapa 3: Diseño de la tarjeta de servicio
- Tarjeta con ícono o foto, nombre en Bodoni Moda, descriptor en Montserrat, duración y precio en oro champán.
- Etiquetas de "Nuevo", "Popular" o "Desde" discretas, colocadas sin tapar el nombre.
- **Ajuste al tamaño:** nombres y precios largos se achican hasta caber, y las tarjetas se adaptan a 720p, 1080p, pantalla vertical y cuadrículas de 2x2 a 4x3.

### Etapa 4: Transiciones y bienvenida de marca
- Fondo con la silueta de la gota en baja opacidad y un brillo suave en tonos salvia y marfil.
- Transición entre diapositivas con fundido o cortina suave y el símbolo de la gota en el centro.
- Pantalla de bienvenida con el logo que aparece con calma, el descriptor letra por letra y el filete dorado con la estrellita ✦.
- Sin confeti, sin parpadeos y sin barra de progreso.

### Etapa 5: Fluidez en las pantallas
- Medir el rendimiento con un navegador sin aceleración gráfica y optimizar hasta lograr 50–60 cuadros por segundo.
- Calidad automática: si una pantalla no alcanza, baja sola a calidad media o baja. Se puede forzar con `?calidad=alta|media|baja`.
- Precarga de la siguiente imagen y animaciones solo con `transform` y `opacity`.

### Etapa 6: Panel completo y apariencia configurable
- Menú lateral con íconos y secciones, y un tablero con indicadores y el estado de conexión de cada pantalla.
- **Alertas con SweetAlert2:** campos faltantes resaltados, confirmación al eliminar, cambios de precio muy grandes o en $ 0, nombres repetidos, cambios sin guardar y recordatorios al entrar (PIN de fábrica, datos de contacto sin completar).
- **Configurable desde el panel:** tema (oscuro, salvia o claro), tamaño del logo del encabezado y de la transición, tamaño de las fotos, mensajes rotativos y textos del pie.
- Edición masiva por porcentaje y por categoría.

### Etapa 7: Robustez sin internet y módulo en línea
- Caché en las pantallas para seguir mostrando la última versión publicada si el servidor se apaga.
- Reconexión automática del WebSocket y pantalla de espera con el logo si no hay contenido.
- Respaldo en la nube cifrado, aviso de actualizaciones, importación opcional del catálogo desde el sitio web y administración remota con túnel y PIN.

### Etapa 8: Programa para Windows y nombre en la red (v0.2.x)
- `DrDripVitrina.exe`, sin necesidad de instalar Node.js.
- **Instalación como servicio de Windows** con un solo doble clic (WinSW), sin ventana de comandos, con inicio automático al encender el PC, reinicio si falla, instancia única y regla de firewall creada automáticamente.
- Lanzadores para abrir una pantalla en modo kiosko y archivo `config.ini`.
- Dirección `drdrip.local` anunciada en la red y direcciones cortas `/1`, `/2`…
- Página de selección para el control remoto que reabre sola la última pantalla usada.
- Ícono de bandeja opcional, desinstalación limpia y logs rotativos en `data\logs`.

### Etapa 9: Descubrimiento automático de pantallas (v0.3.x)
- Registro asistido: toda pantalla que abre la vitrina por primera vez aparece como "Pantalla nueva detectada" y se asigna con un clic.
- Sección **Dispositivos** en el panel con búsqueda en la red, estado y botones de reproducir y detener.
- Adaptadores independientes, en este orden: **Chromecast y Google TV**, **Android TV y Fire TV por ADB**, y después **LG webOS, Samsung Tizen y Roku**, según los televisores que tenga la clínica.
- Reenvío automático de la vitrina cuando un dispositivo se reinicia o vuelve a la red.
- Pruebas sobre equipos reales de cada marca antes de dar un adaptador por terminado.

### Controles de calidad desde el inicio

Estos puntos se vigilan desde la primera versión para no tener que corregirlos al final.

| Riesgo | Cómo se previene |
|---|---|
| El `.exe` no abre en Windows por una firma digital corrupta | Quitar la firma antes de empaquetar el ejecutable y probar el `.exe` en un Windows limpio |
| Rutas válidas en Linux pero no en Windows | Armar todas las rutas con `path.join` y correr las pruebas también en Windows |
| `drdrip.local` no responde en Windows, Android o TVs | Anunciar el nombre por mDNS en todas las interfaces, elegir la tarjeta de red correcta y mantener la dirección con IP como alternativa |
| Editar un solo campo borra los demás datos | Actualizaciones parciales (PATCH) con pruebas que verifican que no se pierde nada |
| Dependencias con avisos de seguridad | Correr `npm audit` en cada versión y actualizar a tiempo |
| El servicio no arranca o el puerto está ocupado | Validar el puerto al instalar, avisar con un mensaje claro y dejar la tarea programada como alternativa |
| Un televisor no se deja controlar por la red | Registro asistido como respaldo universal y recomendación de Chromecast o Android TV |
| Cambios de los fabricantes en sus protocolos | Un adaptador independiente por marca, con pruebas en equipos reales |
| Medicamentos o textos de salud sin aprobar | Campo `visible` por servicio y modo "Consultar", con aprobación del director médico |

---

## 8. Instalación en el PC de la clínica

1. **Copiar** la carpeta `DrDripVitrina` a `C:\DrDripVitrina`. No usar *Archivos de programa*.
2. **Hacer doble clic** en `DrDripVitrina.exe`.
   - SmartScreen: *Más información* → *Ejecutar de todas formas*.
   - Control de cuentas: aceptar el permiso de administrador (una sola vez).
3. **Listo:** el programa se instala como servicio, abre el firewall para la red privada y abre el panel en el navegador. No queda ninguna ventana abierta y arranca solo cada vez que se enciende el PC.
4. **Router:** reservar una **IP fija** para el PC.
5. **Pantallas:** abrir la dirección y guardarla como página de inicio.

| Requisito | Detalle |
|---|---|
| Sistema | Windows 10 u 11 de 64 bits |
| Red | PC y pantallas en el mismo router o WiFi |
| Hora | Fecha y zona horaria correctas (Puerto Rico) |
| Internet | No es necesario; solo se usa para los extras opcionales |

### Direcciones para las pantallas

| Dirección | Cuándo usarla |
|---|---|
| `http://IP-DEL-PC:3000/1` | Funciona en cualquier televisor. **Recomendada** con IP fija |
| `http://drdrip.local:3000/1` | En equipos que reconocen nombres `.local` (iPhone, PCs, muchos TV Box) |
| `http://drdrip:3000/1` | Solo si el router registra el nombre del PC o se crea en el DNS del router |

---

## 9. Operación diaria

- **Cambiar un precio:** *Servicios* → escribir el precio en USD → Enter, y las pantallas se actualizan en 1 o 2 segundos.
- **Ocultar o marcar no disponible:** columnas *Visible* y *Disponible* en Servicios.
- **Cambiar lo que muestra una pantalla:** *Pantallas* → *Constructor* → editar → *Publicar*.
- **Promociones y Gift Cards:** *Promociones*, con fechas de inicio y fin.
- **Apariencia:** *Marca y apariencia*, con vista previa.
- **Respaldos:** automáticos cada noche en `data\backups`, y de vez en cuando conviene descargarlos a un pendrive desde *Sistema*.
- **Actualizar el programa:** reemplazar todo **menos** `data` y `config.ini`.

---

## 10. Pendientes y recomendaciones

| Tema | Recomendación |
|---|---|
| Catálogo | Confirmar con el cliente que servicios y precios del sitio web están vigentes |
| Medicamentos | Que el director médico apruebe qué se muestra de control de peso |
| Cantidad y tipo de pantallas | Definir cuántas TVs, tamaño y orientación, y si serán Smart TV, mini PC o HDMI |
| Imágenes | El sitio no trae una foto por servicio, así que se propone una biblioteca de íconos en salvia y oro |
| Instagram | Pedir capturas o material gráfico de redes para afinar el estilo |
| Idioma | Decidir si las pantallas van en español, inglés o ambos |
| IP fija | Reservarla en el router de la clínica |
| Respaldos externos | Copia semanal a pendrive o a la nube |
| Televisores de la clínica | Confirmar marca y modelo, o decidir si se compran Chromecast o cajas Android TV, para priorizar los adaptadores de descubrimiento |
| Red WiFi | Verificar que los TVs y el PC estén en la misma subred y que el router no aísle dispositivos |
| Firma digital del `.exe` | Opcional: un certificado de firma de código evitaría el aviso de SmartScreen |
| Uso real | Probar una semana en la clínica y anotar ajustes |
| Ideas futuras | Código QR hacia la reserva en línea, integración con el sistema de citas del sitio, campañas por temporada, estadísticas y panel como app móvil |

---

## 11. Historial de versiones (planificado)

| Versión | Contenido previsto |
|---|---|
| v0.1.0 | Servidor, datos, precios, catálogo inicial, pantallas base y panel |
| v0.1.1 | Constructor de pantallas con vista previa, versiones y horarios |
| v0.1.2 | Rediseño de tarjetas y textos que se ajustan al tamaño |
| v0.1.3 | Transiciones, fondo de marca y bienvenida |
| v0.1.4 | Fluidez en pantallas y calidad automática |
| v0.1.5 | Panel renovado, alertas y apariencia configurable |
| v0.1.6 | Robustez sin internet, módulo en línea y respaldos |
| v0.2.0 | `.exe` instalado como servicio de Windows, dirección `drdrip.local` e inicio automático |
| v0.2.x | Correcciones tras la prueba real en la clínica |
| v0.3.0 | Descubrimiento de pantallas: registro asistido, sección Dispositivos y adaptadores de Cast y Android TV |
| v0.3.x | Adaptadores de LG, Samsung y Roku según los televisores de la clínica |

---

## 12. Estructura del proyecto y `CLAUDE.md` sugerido

```
drdrip-vitrina/
├─ apps/
│  ├─ server/              # Fastify + SQLite + WebSocket
│  │  └─ src/
│  │     ├─ routes/        # services, addons, screens, slides, promos, settings, media
│  │     ├─ services/      # priceFormat, publisher, backup, scheduler, online
│  │     └─ db/            # schema, migraciones, repositorios
│  ├─ admin/               # Preact + Vite (incluye el constructor)
│  └─ player/
│     ├─ engine/           # lector de JSON y render con CSS Grid
│     ├─ templates/        # una carpeta por plantilla
│     └─ fonts/            # Bodoni Moda y Montserrat (WOFF2)
├─ packages/shared/        # tipos, dinero y formato de precios
├─ data/                   # drdrip.db, media/, backups/
├─ scripts/                # iniciar, inicio automático, kiosko
├─ CLAUDE.md
└─ README.md
```

```
# DrDrip Vitrina
- Cartelería digital offline-first para clínica de infusiones IV (Puerto Rico).
- Solo USD, en centavos enteros. Nunca floats para dinero.
- Modos de precio: fixed, from ("Desde"), ask ("Consultar").
- Player sin dependencias ni CDNs; fuentes empaquetadas localmente.
- Cada diapositiva es un JSON; agregar plantillas no debe tocar el motor.
- Marca: salvia #687568, oliva #929985, marfil #F4F0E6, carbón #242522,
  oro #C6A66B (solo acentos). Bodoni Moda SemiBold + Montserrat Regular.
- Tono visual sereno y premium: sin confeti, sin colores vivos, sin parpadeos.
- Rutas con path.join; probar en Windows. Quitar la firma del .exe antes de empaquetar.
- El .exe se instala como servicio de Windows (WinSW): sin ventana, arranque automático,
  instancia única, reinicio si falla y regla de firewall. Datos fuera de la carpeta del programa.
- Descubrimiento de pantallas: un adaptador independiente por marca (Cast, ADB, webOS, Tizen, Roku)
  y registro asistido como respaldo universal. Nunca asumir que un TV acepta control remoto.
- Actualizaciones parciales (PATCH) nunca deben borrar campos no enviados.
- Interfaz en español; código y comentarios en inglés.
- Ejecutar `npm test` y `npm audit` antes de dar una tarea por terminada.
```

### Modelo de datos (resumen)

```
categories      (id, name, slug, icon, sort_order, active)
services        (id, name, name_en, description, benefits, category_id,
                 price_cents, price_mode['fixed'|'from'|'ask'], duration_min,
                 image_path, badge, is_featured, available, visible, sort_order, updated_at)
addons          (id, name, price_cents, description, sort_order, active)
service_addons  (service_id, addon_id)
promos          (id, title, subtitle, image_path, starts_at, ends_at, active)
screens         (id, name, orientation, resolution, theme, show_header,
                 show_footer, show_clock, ticker_text, active)
slides          (id, screen_id, template, config_json, theme, duration_s,
                 transition, schedule_json, position, active)
config_versions (id, screen_id, snapshot_json, published_at, note)
settings        (key, value)
price_history   (id, service_id, old_cents, new_cents, changed_at)
```
