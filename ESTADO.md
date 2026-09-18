# ESTADO — Muestra AAMI

App interna para organizar la muestra de fin de año de la escuela de música.
Reemplaza la planificación en papel que hoy lleva administración.
Vida útil: de ahora a fin de año. Prioridad: velocidad de carga y claridad visual.

---

## Stack

- Node.js + Express
- Supabase (proyecto compartido de GIZA, tablas con prefijo `muestra_`)
- Autenticación por contraseña sola + JWT en cookie httpOnly
- Deploy: GitHub → VPS Hostinger
- **Mobile-first**: se usa mayormente desde el celular

Escala: ~120 alumnos, 8 profesores, 3 muestras.

---

## Reglas de negocio

### Muestras
Son tres: **Niños**, **Adolescentes**, **Adultos**. Cada una tiene su propia grilla,
su propio catálogo de canciones y su propio orden de programa.

- Un **alumno** pertenece a una sola muestra.
- Un **profesor** puede participar en varias.

Existe una cuarta fila en `muestra_shows`, **Sin asignar**: es el destino de
las canciones que todavía no se clasificaron (no de alumnos). No tiene
grilla, ni horarios, ni alumnos — la app la excluye como pestaña de
cualquier pantalla organizada por alumnos (grilla, carga rápida, alumnos,
dashboard, programa) y solo la muestra en Canciones, donde funciona como
lista de pendientes. Desde el listado de canciones, cada una se puede mover
a Niños/Adolescentes/Adultos con un selector directo por fila.

### Personas vs. alumnos
Un alumno que estudia dos instrumentos (ej. Renata: canto y piano) es:
- **una** fila en `muestra_personas`
- **dos** filas en `muestra_alumnos` (una por instrumento)

En la interfaz siempre se muestra como `Renata — Canto` / `Renata — Piano`.

### Instrumentos
Catálogo cerrado + opción personalizada:
canto, guitarra, bajo, batería, piano, iniciación musical, sin asignar, otro.

`Sin asignar` (gris `#8A908C`) es un instrumento placeholder: sirve para
importar alumnos cuyo instrumento todavía no se definió. Igual que
`Iniciación musical`, queda excluido de los slots que se generan solos al
crear una canción (no son instrumentos de banda).

Cada instrumento tiene un **color fijo**, usado de forma consistente en toda la app
(grilla, fichas de banda, dashboard). Es el principal recurso visual del sistema.

### Canciones y bandas
- Una canción es una **banda** compuesta por *slots*.
- Un slot = instrumento + número (`Guitarra 1`, `Guitarra 2`, `Voz 1`, `Voz 2`).
- **No hay tope de integrantes.**
- No se puede repetir el mismo slot exacto (nunca dos `Guitarra 1`).
- Al agregar un segundo alumno del mismo instrumento, confirmación explícita:
  *"Ya hay alguien en guitarra en esta canción. ¿Agregar como Guitarra 2?"*
- **Una misma persona no puede ocupar dos slots de la misma canción.**
  (Renata no canta y toca piano en el mismo tema.) Enforced por índice único.
- Un alumno **sí** puede estar en muchas canciones distintas. Sin límite.
- Un **profesor** puede ocupar un slot. Se muestra distinguido:
  `Guitarra 2 — profe Jeremías`.
- Un slot vacío aparece **siempre** en el dashboard de faltantes, esté o no
  marcado. `se_busca = true` es una etiqueta aparte, para resaltar cuáles son
  más urgentes — no filtra ni oculta el resto. Cualquier profesor puede
  **registrar interés** en cubrir un slot vacío (tabla `muestra_slot_interes`),
  sin que eso lo ocupe: administración ve quién se ofreció y decide. Este
  mecanismo es independiente del interruptor `profes_pueden_ocupar_slots` —
  levantar la mano nunca modifica el slot.
- Las canciones **no alojan archivos**. El material vive en Google Drive y la app
  solo apunta: cada canción puede tener **varios links con etiqueta** (pista,
  partitura, audio de referencia, la versión en la tonalidad que se toca).
  Además hay un link general a la carpeta madre, en `muestra_config`.
- Cada canción registra la **tonalidad** en la que se hace y un campo de
  observaciones para los recortes o cambios de arreglo (ej. "sin el estribillo
  final"). Esto es distinto de las notas: acá va la versión acordada, en las notas
  va la discusión.
- Cada canción registra también el **país** de origen del tema o del arreglo.
  En el listado y en la ficha se muestra como `Título — Artista (País)`
  (ej. "Recordándote — Milo J (Argentina)").
- **Administración puede editar** título, artista, país, tonalidad y
  observaciones directamente desde la ficha, sin navegar a otra pantalla —
  pensado para corregir errores de carga sin perder los alumnos ya asignados
  a los slots (que se pierden si se borra y se vuelve a crear la canción). Si
  el nuevo título queda duplicado con otra canción de la misma muestra,
  mismo aviso que en el alta. Los profesores ven la ficha en modo lectura;
  su única forma de escritura ahí son las notas.

### Detección de duplicados
Es la razón de existir del proyecto. Al cargar una canción se normaliza el título
(minúsculas, sin tildes, sin espacios dobles) y se guarda en `titulo_norm`,
con índice único por muestra. La app avisa antes de guardar si ya existe algo parecido.

### Estado de banda
`incompleta` (naranja) / `completa` (verde). Lo marca **solo administración**.

### Horarios
- Ventana: **14:00 a 21:30**, en pasos de **15 minutos**.
- Una clase puede tener **1, 2 o 3 alumnos**.
- Duración **sugerida** por la interfaz: 1 alumno → 60 min, 2 o 3 → 75 min.
  Es autocompletado, no restricción: siempre hay excepciones y un formulario que
  pelea al usuario termina abandonado.
- Los horarios los carga **solo administración**. Los profesores no editan nada.

### Notas
- Van sobre la canción (opcionalmente sobre un slot).
- Son **técnicas**, no sugerencias de repertorio: tonalidad, recortes, arreglos.
- **Varias por canción**, visibles para todos los profesores.
- Un profesor puede **editar la propia dentro de los 15 minutos**; después queda fija.
- **Borrar: solo administración.**

---

## Roles y permisos

### Administración (`rol = 'admin'`)
CRUD completo de todo. Único rol que puede borrar notas y marcar estado de banda.

### Profesor (`rol = 'profesor'`)
Lectura de **toda** la escuela (todas las muestras, todos los profesores).
Siempre puede:
- agregar notas
- marcar interés en un slot vacío ("puedo cubrir esto")
- filtrar la grilla por día, profesor o instrumento

### Permisos configurables (tabla `muestra_config`)
Dos interruptores que administración enciende y apaga cuando quiere. Ambos
arrancan **apagados**. Sirven para abrir la carga durante el armado y volver a
cerrarla cuando el programa está cerrado.

| Interruptor | Encendido permite al profesor |
|---|---|
| `profes_pueden_ocupar_slots` | sumar alumnos a los instrumentos de una canción |
| `profes_pueden_editar_horarios` | cargar y completar **sus propios** horarios |

Un profesor nunca puede tocar los horarios de otro, ni borrar notas, ni cambiar
el estado de una banda, ni crear canciones. Esos permisos son solo de administración.
La interfaz muestra el estado del interruptor arriba ("La carga está abierta hasta
el 30 de octubre"), para que nadie descubra por prueba y error que no puede editar.

### Autenticación
- **Usuario + contraseña.** Los dos los crea y asigna administración. Sin autoregistro.
- Acceso de prueba `profesor` (creado por `scripts/seed.js`, contraseña por
  variable de entorno): desactivado, ya hay accesos reales (`profe1`..
  `profe8`, ver `scripts/seed-produccion.js`).
- `debe_cambiar = true` fuerza el cambio de contraseña en el primer ingreso.
- Hash con bcrypt. Nunca en texto plano.
- Sesión en JWT dentro de cookie httpOnly. Sin expiración corta: los profesores
  entran desde el celular y volver a loguearse cada vez los aleja de la herramienta.

---

## Pantallas

1. **Login** — un solo campo de contraseña.
2. **Grilla semanal** (por muestra). Desktop: tabla día × franja horaria.
   Mobile: selector de día arriba + columna única scrolleable.
   Cada celda con color de instrumento. Filtros por instrumento y profesor.
3. **Detalle de canción** — título, artista, país, tonalidad, observaciones de
   arreglo, **lista de links de Drive con etiqueta**, slots de la banda y
   panel de notas al costado (abajo en mobile). Los links se abren en
   pestaña nueva. Administración puede editar título/artista/país/tonalidad/
   observaciones sin salir de la ficha.
4. **Alumnos** — listado, filtros "sin canción asignada" y "sin instrumento
   asignado" (lista de pendientes para corregir el instrumento de una
   importación masiva), contador `faltan N de M`. Desde el popup de
   acciones de cada fila se puede cambiar el instrumento en un paso.
5. **Canciones** — catálogo por muestra (incluye la muestra administrativa
   "Sin asignar", que funciona como lista de pendientes de clasificación),
   con aviso de duplicados, acceso directo a la carpeta madre de Drive desde
   el encabezado, y un selector "Mover a" por fila para reclasificar una
   canción a Niños/Adolescentes/Adultos sin abrir otra pantalla.
6. **Dashboard de faltantes** — vista `muestra_v_faltantes`. Qué bandas necesitan
   qué instrumento. Es la pantalla que más van a usar los profesores.
7. **Orden del programa** — reordenar los números de cada muestra.
8. **Exportar / imprimir** — PDF del programa y de la grilla. Imprescindible:
   el día de la muestra alguien va a tener una hoja en la mano.
9. **Asignar horarios** (`asignar-horarios.html`) — la pantalla que resuelve
   la carga masiva de horarios después de una importación: lista de alumnos
   sin horario con buscador por nombre y contador `faltan N de M`, pensada
   para repetirse 100+ veces seguidas con el mínimo de pasos. Ver detalle
   en "Estado actual".

---

## Carga rápida (crítico)

La carga inicial de ~100 alumnos es el momento donde el proyecto se gana o se pierde.

Flujo optimizado:
1. Se elige un profesor y un día.
2. Formulario en línea: **nombre → instrumento → hora de inicio**.
3. Se suma el o los alumnos de ese bloque (hasta 3).
4. Recién entonces se define la **duración del bloque**: dos botones grandes,
   `1 h` y `1 h 15`, con el valor sugerido preseleccionado según cuántos alumnos
   se cargaron. Se puede cambiar a cualquier múltiplo de 15 minutos.
5. Al guardar, el foco vuelve al campo de nombre y la hora de inicio del bloque
   siguiente se **autocompleta** con el fin del anterior.
6. Se encadena bloque tras bloque sin tocar el mouse.

Atajos en teclado: Enter guarda y sigue, Esc cancela.
En tablet y celular los mismos pasos, con los botones de duración como elemento
táctil grande en lugar de un selector de hora.

**Importar CSV / Excel**: opción secundaria, en un costado. Sirve para pegar
listados transcriptos por IA desde los papeles actuales. Previsualización
obligatoria con corrección manual antes de confirmar la importación.
Columnas: `nombre, instrumento, profesor, muestra` (la muestra es Niños,
Adolescentes o Adultos) — cada fila puede ser de una muestra distinta, así
que un solo CSV puede cargar las tres de una vez. Nunca fusiona por nombre:
cada fila crea una persona nueva, aunque el nombre se repita entre
profesores o muestras (quien importa decide a mano si son la misma persona,
reusando la coincidencia que ofrece la previsualización).

---

## Dispositivos

Tres contextos reales, en este orden de prioridad:

1. **Celular (profesores, ~380px).** Consulta rápida: ver su horario, mirar el de
   otro, leer y dejar notas, revisar qué falta. Casi nunca cargan datos.
2. **iPad (administración).** Carga y asignación en horizontal, con teclado en
   pantalla ocupando la mitad inferior. Los objetivos táctiles no bajan de 44px,
   y el formulario de carga no puede quedar tapado por el teclado.
3. **Escritorio (administración).** Carga masiva y orden de programa, con atajos
   de teclado.

No es "responsive" como reducción del escritorio: la grilla en celular es una
columna por día con selector arriba, no una tabla encogida.

---

## Dirección visual

**Vigente desde:** 2026-09-18. Reemplaza por completo el brief anterior
("hoja de ruta de escenario", Barlow Condensed, radio 2px, prohibido
sombras/tarjetas) — quedó incompatible con la referencia nueva y no
conviven las dos direcciones.

**Referencia:** `design/AAPLY.md`, un sistema de diseño extraído de un
producto real (Aaply). No se copió tal cual — es una landing comercial de
57px de display, secciones separadas por 80-120px y mockups decorativos —
se tomó el carácter (canvas gris con superficies blancas flotando, radios
generosos, píldoras, una sombra sutil, tipografía con peso y tracking
negativo, amarillo como energía de marca) y se lo reescaló para una
herramienta interna densa que se usa desde el celular entre clase y clase.

### Regla innegociable: los ocho colores funcionales

El color no es decoración en esta app, es información:

- Los **seis colores de instrumento** identifican qué toca cada alumno y
  permiten detectar coincidencias de un vistazo (`muestra_instrumentos`).
  No se tocaron: siguen siendo los mismos seis valores, porque el contraste
  contra las superficies blancas no cambió (el canvas nuevo es casi
  idéntico en luminosidad al anterior) y ya eran claramente distinguibles
  entre sí.
- **Naranja** `#D98324` (incompleta) y **verde** `#3F8F5C` (completa) para
  estado de banda. Sin cambios, siguen reservados en exclusiva.
- El **amarillo de marca** (`#E6E51E`, tomado de la referencia) es color de
  **acción únicamente** — botones primarios, nunca dato. No compite con los
  instrumentos porque nunca aparece donde aparece un instrumento.
- Se **descartó** el durazno de la referencia (`#FF8562`): se confunde con
  el naranja de "incompleta".

### Tokens (`public/css/tokens.css`)

**Color**
| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#F1F1EE` | Canvas — el gris frío donde flotan las superficies |
| `--color-surface` | `#FFFFFF` | Paneles, nav, diálogos |
| `--color-surface-sunken` | `#F6F6F3` | Inputs y selects — un pelo "hundidos" respecto al panel |
| `--color-text` | `#15161A` | Texto principal |
| `--color-text-secondary` | `#6B6D70` | Texto secundario — más contraste que el valor anterior (`#8A908C`) |
| `--color-line` | `#E4E4E1` | Líneas de 1px, todavía la separación primaria dentro de un panel |
| `--color-accent` / `--color-accent-ink` | `#E6E51E` / `#15161A` | Acción — ver regla de arriba |
| `--color-estado-incompleta` / `--color-estado-completa` | `#D98324` / `#3F8F5C` | Sin cambios |

**Tipografía** — `--font-display` (Poppins 700, tracking -0.02em) para
títulos reales: marca de nav, h1 de ficha, nombre de pantalla. Todo lo
demás — nombres en listas, horarios, botones, labels — usa Inter, con el
énfasis dado por el *peso* (600 para nombres/botones, 500 para labels, 400
para texto corrido) en vez de por la familia. Se dejaron los tokens
`--font-condensed`/`--font-base` como alias históricos apuntando a Inter,
para no tener que tocar cada regla de golpe durante la propagación —
la distinción de "esto es un nombre" contra "esto es meta" la sigue dando
el peso, como antes.

Se migró de Barlow Condensed a Inter: la condensada ganaba línea por ancho
angosto, pero el carácter nuevo (geométrico, con peso) pide una familia
distinta. En mobile esto puede envolver nombres largos a dos líneas más
seguido que antes — es el costo aceptado del cambio de identidad, no un
bug.

**Radio y sombra** — generoso pero escalado para una herramienta, no una
landing: `--radius-sm` 8px (inputs, chips), `--radius-md` 14px (paneles,
diálogos), `--radius-pill` 999px (botones, tags, tabs). Una sola sombra,
`--shadow-surface`, sutil y sin apilar capas — se usa con moderación: nav,
el panel principal de cada pantalla, diálogos. Nunca en cada fila de una
lista.

**Espaciado** — misma escala de antes (4/8/12/16/24/32) más `--space-5`
(20px) y `--space-10` (40px) para el aire de formularios/catálogos. La
grilla semanal no lo usa: ahí la densidad sigue siendo la prioridad, el
aire se aplicó al panel que la contiene (margen, radio, sombra), no a las
filas de adentro.

### Cómo se ve esto en una pantalla

Cada pantalla es, puertas afuera, un panel blanco flotando sobre el canvas
gris (radio + sombra únicos, sin apilar), con el nav como una barra
flotante aparte arriba. Puertas adentro del panel, la densidad de antes se
mantiene: líneas de 1px separan secciones, no hay una tarjeta por fila. Las
pestañas (muestra, día) pasaron de subrayado a píldora — rellena y oscura
cuando están seleccionadas, fantasma cuando no —, tomando el lenguaje de
"Filled Black Pill" / "Ghost Pill" de la referencia para un uso funcional
(selección), no decorativo. En la grilla de escritorio, cada bloque de
clase es un chip con radio pequeño y un lavado sutil (12%) del color de
instrumento de fondo — la barra sólida de 3px sigue siendo el dato fuerte,
el lavado es identidad nueva encima.

### Estado del rollout

- [x] **Propagado a las 14 pantallas.** Se armó primero sobre la grilla
  semanal (la más difícil) para validar el lenguaje antes de tocar el
  resto; una vez aprobada, se aplicó igual a todas: login/cambiar
  contraseña, grilla, canciones, ficha de canción, alumnos, carga rápida,
  asignar horarios, dashboard, programa, profesores, accesos y
  configuración.
- Cada pantalla quedó con su contenido dentro de un panel flotante
  (`.panel`, o `.ficha`/`.admin`/`.auth` donde ya existía un contenedor
  propio) — blanco, radio 14px, la sombra única. El login usa el mismo
  patrón como tarjeta centrada sobre el canvas, que es donde más natural
  cae.
- Ya no queda ningún uso de los alias de transición: todo `var(--radius)`
  se reemplazó por `--radius-sm` (inputs/chips) o `--radius-pill`
  (botones/tags/tabs) explícito, y todo `var(--font-condensed)` por
  `--font-base`/`--font-display` explícito, pantalla por pantalla.
- El amarillo de acción quedó en los botones que de verdad confirman algo:
  "Agregar canción", "Guardar" de la ficha, "Agregar alumno" de carga
  rápida, "Confirmar" de asignar horarios, "Crear acceso/profesor",
  "Entrar", el interruptor encendido de Configuración. Los botones
  secundarios (Cancelar, Quitar, Borrar) quedaron en píldora fantasma —
  borde, sin relleno.
- `asignar-horarios.html` tenía un bug preexistente (no relacionado con el
  rediseño): usaba la clase `catalogo__vacio` para el estado vacío pero
  esa pantalla nunca cargó `canciones.css`, así que ese texto no tenía
  estilo. Se aprovechó el paso por el archivo para agregarla directo a
  `asignar-horarios.css` en vez de sumar una hoja de estilos completa por
  una sola regla.

---

## Estado actual

- [x] Relevamiento y definición de reglas de negocio
- [x] Esquema SQL (`muestra_schema.sql`)
- [x] Correr el esquema en Supabase
- [x] Scaffold Express + auth usuario/contraseña + `muestra_config`
- [x] Endpoints CRUD (auth, config, shows, instrumentos, profesores,
      personas, alumnos + importar CSV, clases, canciones + links +
      check-duplicado, slots + interés, notas, dashboard, programa, accesos).
      Pendiente: `log` (queda como placeholder, no hace falta todavía).
- [x] DELETE de profesores (solo si no tiene clases cargadas; si las tiene,
      409 y hay que desactivarlo en su lugar).
- [x] Login real (`login.html`) + cambio de contraseña forzado
      (`cambiar-password.html`) para `debe_cambiar = true`. Shell compartido
      (`auth.js`, `nav.js`, `muestra.js`) en todas las pantallas protegidas.
- [x] Carga rápida de alumnos (`carga-rapida.html`): un solo formulario en
      línea con muestra (tabs, siempre visibles), profesor, nombre,
      instrumento y hora de inicio (desplegable 14:00–21:30 cada 15 min, 24
      horas) — sin paso previo bloqueante. Al agregar el primer alumno del
      bloque, profesor y hora quedan fijos hasta guardarlo. Autocompletado
      por nombre existente, reutiliza persona/alumno si ya existe. Duración
      1h/1h15 sugerida según cantidad. Al guardar, muestra/profesor/día
      quedan fijos, la hora se autocompleta con el fin del bloque anterior
      y el foco vuelve al nombre. Import CSV/Excel al costado (preview +
      confirmación manual), con botón "Descargar modelo CSV" que baja un
      archivo de ejemplo (3 alumnos, profesores, instrumentos y muestras
      distintas) con los encabezados exactos que espera el importador:
      `nombre, instrumento, profesor, muestra` — una fila por alumno, cada
      una con su propia muestra, así que un solo CSV carga Niños,
      Adolescentes y Adultos de una vez. Nunca fusiona por nombre entre
      filas del mismo CSV (cada una crea una persona nueva salvo que ya
      exista y se reuse a mano la coincidencia). Alumnos (`alumnos.html`):
      catálogo con filtros "sin canción asignada" y "sin instrumento
      asignado" (pensado como lista de pendientes tras una importación
      masiva con el instrumento `Sin asignar`), contador "Faltan N de M... ·
      N sin instrumento asignado" y un popup por fila ("Acciones") para ver
      el profesor, cambiar el instrumento en un paso (select + Guardar,
      arriba de todo para no esperar a que carguen las bandas), marcar/
      desmarcar `participa` (admin), y asignar/quitar de una banda sin
      cambiar de pantalla.
- [x] Grilla semanal (mobile: columna única por día · iPad/desktop: tabla
      día × horario 14:00–21:30, con barra de color por alumno dentro de
      cada bloque). Filtros por muestra, profesor e instrumento. Control de
      zoom (+/−, 5 niveles) sobre la escala vertical de la tabla, con el
      nivel recordado durante la sesión (`sessionStorage`). Link de
      exportación a PDF. Cada bloque de clase es clickeable (mobile y
      desktop) y abre un popup con los alumnos del bloque: para cada uno,
      elegir la canción y confirmar en un clic, reutilizando las mismas
      reglas que `cancion.html` (aviso de instrumento duplicado, una
      persona no puede ocupar dos slots de la misma canción, slot vacío
      vs. crear uno nuevo según permisos). Evita tener que ir a la pantalla
      de canciones para asignar desde el horario.
- [x] Canciones: catálogo por muestra (incluye "Sin asignar") con alta +
      aviso de duplicado, formato `Título — Artista (País)`, tonalidad y
      observaciones visibles directo en el listado (`canciones.html`), y un
      selector "Mover a" por fila (solo admin) para reclasificar entre
      Niños/Adolescentes/Adultos sin abrir la ficha. Al crear una canción se
      generan automáticamente los slots vacíos de todos los instrumentos
      activos del catálogo (salvo Iniciación musical y Sin asignar), listos
      para asignar. Ficha de detalle (`cancion.html`): título, artista,
      país, tonalidad, observaciones, links de Drive, banda con aviso de
      instrumento repetido, selector de alumno ya filtrado por el
      instrumento del slot (menos pasos para asignar), `se_busca`, toggle de
      interés para profesores y — para admin — quién se ofreció por cada
      slot vacío ("Se ofrecieron: ..."), más panel de notas embebido (según
      ESTADO.md, no como pantalla aparte; edición de la nota propia dentro
      de los 15 minutos). Administración puede editar título/artista/país/
      tonalidad/observaciones desde la ficha sin navegar a otra pantalla —
      corrige errores de carga sin perder los alumnos ya asignados a los
      slots — con el mismo aviso de duplicado que en el alta; los
      profesores ven la ficha en modo lectura. Un profesor solo puede
      ocupar un slot vacío; reasignar o vaciar un slot ya ocupado es
      exclusivo de administración (ver `PATCH /api/slots/:id`). Un
      profesor logueado ve la grilla completa de la escuela y puede
      escribir notas en cualquier canción, como pide la regla de negocio.
- [x] Dashboard de faltantes (`dashboard.html`): instrumentos que faltan por
      canción (con `se_busca` y color de instrumento) + alumnos sin canción
      asignada.
- [x] Orden de programa (`programa.html`): reordenar con botones
      Subir/Bajar (se eligió esto en vez de drag-and-drop, más simple y
      confiable en touch sin sumar una librería) + link de exportación.
- [x] Exportación a PDF (`GET /api/export/programa`, `GET /api/export/grilla`,
      ambos `?showId=`), con `pdfkit`. Usa Barlow Condensed y Barlow
      embebidas (`src/assets/fonts/`, bajadas del repo oficial de Google
      Fonts, licencia OFL incluida), igual que la interfaz.
- [x] Profesores (`profesores.html`, solo admin): crear, renombrar y
      activar/desactivar. Es la pantalla para reemplazar "Profesor 1"..
      "Profesor 7" por los nombres reales.
- [x] Accesos (`accesos.html`, solo admin): crear accesos (usuario,
      contraseña inicial, etiqueta, rol), resetear contraseña y
      activar/desactivar. Protegido contra desactivar la propia cuenta (ya
      lo hacía el backend, ahora la interfaz lo respeta). Al crear un
      acceso con rol "profesor" ya no se elige el profesor vinculado a
      mano: el backend crea sola la fila en `muestra_profesores` con el
      mismo nombre y la deja vinculada (`profesor_id`), que es lo que usa
      el interruptor `profes_pueden_editar_horarios` para saber cuáles son
      los horarios propios de cada profesor. Si un acceso de profesor
      quedó sin vincular (datos previos a este cambio), la fila lo avisa
      ("Sin profesor vinculado…") y ofrece un botón "Vincular profesor"
      que crea y liga la fila faltante sin perder el acceso existente.
- [x] Configuración (`config.html`, solo admin): los dos interruptores de
      `muestra_config` con explicación de una línea cada uno (arrancan
      apagados, no se tocaron) y el link a la carpeta madre de Drive.
- [x] Asignar horarios (`asignar-horarios.html`): pantalla dedicada a cargar
      los horarios después de una importación masiva (los 122 alumnos
      importados por CSV entraron sin horario). Lista de alumnos
      **pendientes** (sin clase) con buscador por nombre en vivo y contador
      "Faltan N de M". Toggle "Mostrar también asignados" para encontrar a
      un alumno ya asignado (mismo buscador) y quitarlo con un botón —
      corrige errores de carga sin tener que ir a la grilla.
      Flujo de asignación por alumno (pensado para repetirse 100+ veces
      seguidas): un solo panel inline con día (Lu-Sa) + hora de inicio
      (mismo desplegable 14:00-21:30 cada 15 min que Carga rápida). Si ya
      existe una clase de ese profesor en ese día y hora, el panel lo
      detecta solo y ofrece sumarse a esa clase con un clic (avisa si pasa
      de 3 alumnos, no bloquea); si no existe, pide duración (botones
      "1 h" / "1 h 15", igual que Carga rápida) y crea la clase. Después de
      guardar, el foco vuelve al buscador para encadenar el siguiente
      alumno sin tocar el mouse.
      Permisos: administración ve y asigna los alumnos de todos los
      profesores con un filtro por profesor; un profesor ve y asigna
      únicamente los suyos — filtrado en el backend
      (`GET /api/alumnos/horarios`, que fuerza el profesorId propio para
      cualquier acceso no-admin sin importar qué mande la query), no solo
      en la interfaz. También se cerró un agujero que ya existía en
      `POST /api/clases` y `POST /api/clases/:id/alumnos`: nada impedía
      antes que un profesor sumara a su propio bloque un `alumnoId` de
      otro profesor (la interfaz nunca lo ofrecía, pero la API lo permitía).
      Ahora ambos endpoints verifican que cada alumno sea del profesor
      dueño de la clase cuando quien pide no es admin.
      El acceso de un profesor a esta pantalla (para escribir, no para
      leer) depende de `profes_pueden_editar_horarios`: con el interruptor
      apagado ve su lista en modo lectura, con un aviso arriba, en vez de
      un error — administración nunca depende de este interruptor.
- [ ] Deploy a Hostinger

## Pendiente de datos

- [x] Son 8 profesores, no 7. Nombres reales ya cargados en
  `muestra_profesores` y en la etiqueta de cada acceso: Ariel, Juanjo,
  Jere, Laly, Martín, Javy, Juan Cruz y Barby (`profe1`..`profe8`, en ese
  orden). El acceso `profe8` se creó copiando el hash de `profe1` (misma
  contraseña provisoria, `debe_cambiar = true`) — nunca se leyó ni se
  escribió en texto plano. `scripts/seed-produccion.js` ahora contempla los
  8 accesos para el caso de tener que resetear contraseñas
  (`SEED_PASSWORD_PROFESORES`, nunca en el repo).
- [x] Listado de alumnos: 122 alumnos importados con el importador CSV
  (instrumento `Sin asignar` para todos salvo los de Barby, que entraron
  con `Iniciación musical`), repartidos en las tres muestras según el CSV.
  Como personas separadas, sin fusionar por nombre repetido entre
  profesores/muestras. Sigue pendiente pasar por `alumnos.html` con el
  filtro "sin instrumento asignado" para asignarle a cada uno su
  instrumento real, y por `asignar-horarios.html` (pantalla nueva, ver
  "Estado actual") para ubicarlos en la grilla — los 122 entraron sin
  horario, así que la grilla semanal sigue vacía hasta que se haga esa
  carga.
- [x] Columna `pais` en `muestra_canciones` (`db/muestra_schema.sql` es la
  fuente de verdad, pero el proyecto no tiene forma automatizada de correr
  DDL contra Supabase — no hay `pg` ni Supabase CLI en el repo, el cliente
  de `@supabase/supabase-js` con la service key solo hace CRUD vía REST. Un
  `ALTER TABLE` como este hay que correrlo a mano en el SQL editor de
  Supabase cada vez que el esquema cambia de forma; los inserts de datos
  (una fila nueva en `muestra_shows` o `muestra_instrumentos`, por ejemplo)
  sí se pueden hacer con la service key sin pasar por ahí).
- [x] Repertorio: 22 canciones cargadas en la muestra "Sin asignar" con el
  formato título/artista/país/tonalidad (`tonalidad = "Original"` donde no
  hay una tonalidad distinta a la del original), vía `POST /api/canciones`
  real — así se generaron también los slots automáticos de cada una. Quedan
  ahí hasta que administración las reclasifique con el selector "Mover a"
  en `canciones.html`. Ojo: la fila "Back to Black" vino con artista AC/DC
  y país Austria tal como se pasó — no lo corregí porque no me consta cuál
  de los dos datos está mal (podría ser el título, el artista o el país);
  conviene revisarlo a mano.
- Fechas de las tres muestras
- La carga real que ya estaba en curso en la muestra Niños (Dario, Ruben,
  la canción "La Vida") se dejó intacta.
