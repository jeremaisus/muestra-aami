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

Escala: ~100 alumnos, 7 profesores, 3 muestras.

---

## Reglas de negocio

### Muestras
Son tres: **Niños**, **Adolescentes**, **Adultos**. Cada una tiene su propia grilla,
su propio catálogo de canciones y su propio orden de programa.

- Un **alumno** pertenece a una sola muestra.
- Un **profesor** puede participar en varias.

### Personas vs. alumnos
Un alumno que estudia dos instrumentos (ej. Renata: canto y piano) es:
- **una** fila en `muestra_personas`
- **dos** filas en `muestra_alumnos` (una por instrumento)

En la interfaz siempre se muestra como `Renata — Canto` / `Renata — Piano`.

### Instrumentos
Catálogo cerrado + opción personalizada:
canto, guitarra, bajo, batería, piano, iniciación musical, otro.

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
- Acceso de prueba `profesor` / `profesor-aami`: desactivado, ya hay accesos
  reales (`profe1`..`profe7`, ver `scripts/seed-produccion.js`).
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
3. **Detalle de canción** — título, artista, tonalidad, observaciones de arreglo,
   **lista de links de Drive con etiqueta**, slots de la banda y panel de notas
   al costado (abajo en mobile). Los links se abren en pestaña nueva.
4. **Alumnos** — listado, filtro "sin canción asignada", contador `faltan N de M`.
5. **Canciones** — catálogo por muestra, con aviso de duplicados y acceso directo
   a la carpeta madre de Drive desde el encabezado.
6. **Dashboard de faltantes** — vista `muestra_v_faltantes`. Qué bandas necesitan
   qué instrumento. Es la pantalla que más van a usar los profesores.
7. **Orden del programa** — reordenar los números de cada muestra.
8. **Exportar / imprimir** — PDF del programa y de la grilla. Imprescindible:
   el día de la muestra alguien va a tener una hoja en la mano.

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

El material de referencia no es un dashboard: es la **hoja de ruta de escenario**
y la planilla de ensayo. Denso, legible a un metro de distancia, sin decoración.
Lo memorable es una sola cosa: el color de instrumento como barra de canal.

### Brief para el skill de diseño

Pegar esto tal cual antes de generar el primer componente:

> Escuela de música en Bariloche, muestra de fin de año. La usan siete profesores
> desde el celular entre clase y clase, y una persona de administración desde un
> iPad. El trabajo de la interfaz es que se vea de un vistazo quién toca qué, a
> qué hora, y qué instrumento falta en cada banda.
>
> Referencia visual: planilla de ensayo y hoja de escenario, no panel de analytics.
> Densidad alta, jerarquía por peso tipográfico y no por tarjetas.
>
> **Color.** Base neutra fría y clara (papel de fotocopia, no crema cálido):
> `#F2F3F1` fondo, `#FFFFFF` superficies, `#1C1E1D` texto, `#8A908C` texto
> secundario, `#DDE0DD` líneas. Los únicos acentos son los seis colores de
> instrumento, ya definidos en la base de datos. Naranja `#D98324` y verde
> `#3F8F5C` quedan reservados en exclusiva para el estado de banda: no aparecen
> en ningún otro lugar de la interfaz.
>
> **Tipografía.** Barlow Condensed para nombres, horarios y encabezados de grilla
> — la condensada es funcional acá, entra más dato por línea y remite al cartel de
> escenario. Barlow normal para texto corrido y notas. Nada de Inter. Nada de
> mayúsculas sostenidas en etiquetas. Nada de monoespaciada para datos chicos.
>
> **Estructura.** Cada alumno, slot y bloque horario lleva una barra vertical de
> 3px con el color de su instrumento sobre el borde izquierdo. Eso reemplaza a
> íconos, badges y rellenos de color. Sin sombras. Radio de borde 2px o ninguno.
> Separación por líneas de 1px y espacio en blanco, no por contenedores.
>
> **Prohibido:** tarjetas redondeadas idénticas, gradientes, etiquetas en
> mayúsculas sobre cada título, flechas `→` en los botones, cadenas con puntos
> medios, animaciones de entrada por sección.
>
> **Movimiento:** solo como respuesta a una acción del usuario — abrir el panel de
> notas, confirmar una asignación, mostrar el aviso de instrumento duplicado.

### Cómo trabajarlo con el skill

- Pedir **primero el plan de diseño** (tokens de color, tipografía, wireframe en
  ASCII de la grilla en 380px y en iPad) y revisarlo antes de que escriba código.
- Después, **un componente por vez**, en este orden: grilla semanal → ficha de
  canción con slots → panel de notas → formulario de carga rápida → dashboard de
  faltantes.
- Revisar cada uno en el ancho real antes de seguir con el siguiente.

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
      archivo de ejemplo (3 alumnos, profesores e instrumentos distintos)
      con los encabezados exactos que espera el importador. Alumnos
      (`alumnos.html`): catálogo con filtro
      "sin canción asignada", contador "Faltan N de M" y un popup por fila
      ("Acciones") para ver el profesor, marcar/desmarcar `participa`
      (admin), y asignar/quitar de una banda sin cambiar de pantalla.
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
- [x] Canciones: catálogo por muestra con alta + aviso de duplicado, y
      ahora también tonalidad y observaciones visibles directo en el
      listado (`canciones.html`). Al crear una canción se generan
      automáticamente los slots vacíos de todos los instrumentos activos
      del catálogo (salvo Iniciación musical), listos para asignar. Ficha
      de detalle (`cancion.html`): tonalidad, observaciones, links de
      Drive, banda con aviso de instrumento repetido, selector de alumno
      ya filtrado por el instrumento del slot (menos pasos para asignar),
      `se_busca`, toggle de interés para profesores y — para admin — quién
      se ofreció por cada slot vacío ("Se ofrecieron: ..."), más panel de
      notas embebido (según ESTADO.md, no como pantalla aparte; edición de
      la nota propia dentro de los 15 minutos). Un profesor solo puede
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
- [ ] Deploy a Hostinger

## Pendiente de datos

- Nombres reales de los 7 profesores: los accesos ya existen
  (`profe1`..`profe7`, contraseña provisoria `aami2026`, `debe_cambiar =
  true`) vinculados 1 a 1 con "Profesor 1".."Profesor 7" — falta
  renombrarlos desde `profesores.html` cuando estén los nombres reales.
- Fechas de las tres muestras
- Listado de alumnos (CSV o transcripción de los papeles) — ya hay carga
  real en curso en la muestra Niños (Dario, Ruben, la canción "La Vida").
