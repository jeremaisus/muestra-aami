-- ============================================================
-- MUESTRA AAMI - Esquema de base de datos
-- Prefijo de tablas: muestra_
-- Proyecto Supabase compartido GIZA
-- ============================================================

-- ------------------------------------------------------------
-- 1. MUESTRAS (niños / adolescentes / adultos)
-- ------------------------------------------------------------
create table muestra_shows (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique,
  fecha        date,
  orden        smallint,
  creado_en    timestamptz not null default now()
);

insert into muestra_shows (nombre, orden) values
  ('Niños', 1), ('Adolescentes', 2), ('Adultos', 3);


-- ------------------------------------------------------------
-- 2. INSTRUMENTOS (catálogo con color)
-- ------------------------------------------------------------
create table muestra_instrumentos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null unique,
  color            text not null,          -- hex, ej. '#E8603C'
  es_personalizado boolean not null default false,
  activo           boolean not null default true,
  orden            smallint
);

insert into muestra_instrumentos (nombre, color, orden) values
  ('Canto',              '#E8603C', 1),
  ('Guitarra',           '#2F8F6B', 2),
  ('Bajo',               '#3B6FB5', 3),
  ('Batería',            '#C2A03A', 4),
  ('Piano',              '#8B5FBF', 5),
  ('Iniciación musical', '#5A9FA8', 6),
  ('Sin asignar',        '#8A908C', 7);


-- ------------------------------------------------------------
-- 3. PROFESORES
-- ------------------------------------------------------------
create table muestra_profesores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);


-- ------------------------------------------------------------
-- 4. PERSONAS (la identidad real del alumno)
--    Renata es UNA persona aunque estudie canto y piano.
--    Una persona pertenece a UNA sola muestra.
-- ------------------------------------------------------------
create table muestra_personas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  show_id       uuid not null references muestra_shows(id) on delete restrict,
  participa     boolean not null default true,   -- false = no va a la muestra (informativo)
  observaciones text,
  creado_en     timestamptz not null default now()
);

create index on muestra_personas (show_id);


-- ------------------------------------------------------------
-- 5. ALUMNOS (persona + instrumento + profesor)
--    "Renata - Canto" y "Renata - Piano" son dos filas acá,
--    pero una sola en muestra_personas.
-- ------------------------------------------------------------
create table muestra_alumnos (
  id             uuid primary key default gen_random_uuid(),
  persona_id     uuid not null references muestra_personas(id) on delete cascade,
  instrumento_id uuid not null references muestra_instrumentos(id) on delete restrict,
  profesor_id    uuid not null references muestra_profesores(id) on delete restrict,
  creado_en      timestamptz not null default now(),
  unique (persona_id, instrumento_id)
);

create index on muestra_alumnos (profesor_id);
create index on muestra_alumnos (persona_id);


-- ------------------------------------------------------------
-- 6. CLASES (bloques horarios semanales)
--    14:00 a 21:30, en pasos de 15 minutos.
--    Duración sugerida por la UI: 1 alumno = 60min, 2-3 = 75min.
--    No se fuerza por constraint: siempre hay excepciones.
-- ------------------------------------------------------------
create table muestra_clases (
  id          uuid primary key default gen_random_uuid(),
  profesor_id uuid not null references muestra_profesores(id) on delete cascade,
  dia         smallint not null check (dia between 1 and 6),  -- 1 = lunes
  hora_inicio time not null,
  hora_fin    time not null,
  creado_en   timestamptz not null default now(),
  constraint muestra_clases_rango       check (hora_fin > hora_inicio),
  constraint muestra_clases_ventana     check (hora_inicio >= time '14:00' and hora_fin <= time '21:30'),
  constraint muestra_clases_paso_inicio check (extract(minute from hora_inicio)::int % 15 = 0),
  constraint muestra_clases_paso_fin    check (extract(minute from hora_fin)::int % 15 = 0)
);

create index on muestra_clases (profesor_id, dia, hora_inicio);


-- ------------------------------------------------------------
-- 7. ALUMNOS POR CLASE (1 a 3 alumnos por bloque)
--    El tope de 3 se valida en la aplicación, con aviso
--    en vez de bloqueo duro.
-- ------------------------------------------------------------
create table muestra_clase_alumnos (
  clase_id  uuid not null references muestra_clases(id) on delete cascade,
  alumno_id uuid not null references muestra_alumnos(id) on delete cascade,
  primary key (clase_id, alumno_id)
);

create index on muestra_clase_alumnos (alumno_id);


-- ------------------------------------------------------------
-- 8. CANCIONES
--    titulo_norm lo normaliza la app (minúsculas, sin tildes,
--    sin espacios dobles) para detectar duplicados.
-- ------------------------------------------------------------
create table muestra_canciones (
  id             uuid primary key default gen_random_uuid(),
  show_id        uuid not null references muestra_shows(id) on delete restrict,
  titulo         text not null,
  titulo_norm    text not null,
  artista        text,
  tonalidad      text,                    -- tonalidad en la que se hace, si difiere del original
  observaciones  text,                    -- ej. 'sin el estribillo final'
  estado         text not null default 'incompleta'
                 check (estado in ('incompleta', 'completa')),
  orden_programa smallint,
  creado_en      timestamptz not null default now(),
  unique (show_id, titulo_norm)
);

create index on muestra_canciones (show_id, orden_programa);


-- ------------------------------------------------------------
-- 8b. LINKS DE CANCIÓN
--     El material vive en Google Drive: la app solo apunta.
--     Varios por canción: pista, audio de referencia, partitura,
--     letra, la versión en la tonalidad que se toca.
-- ------------------------------------------------------------
create table muestra_cancion_links (
  id         uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references muestra_canciones(id) on delete cascade,
  etiqueta   text not null,               -- 'Pista', 'Partitura', 'Referencia'
  url        text not null,
  orden      smallint not null default 1,
  creado_en  timestamptz not null default now(),
  constraint muestra_links_url_valida check (url ~* '^https?://')
);

create index on muestra_cancion_links (cancion_id, orden);


-- ------------------------------------------------------------
-- 9. SLOTS (la banda de cada canción)
--    Un slot = canción + instrumento + número.
--    Guitarra 1 / Guitarra 2 son slots distintos.
--    Lo ocupa un alumno O un profesor O nadie (se_busca).
--    persona_id se mantiene sincronizado por trigger para
--    impedir que la misma persona toque dos slots en una canción.
-- ------------------------------------------------------------
create table muestra_slots (
  id             uuid primary key default gen_random_uuid(),
  cancion_id     uuid not null references muestra_canciones(id) on delete cascade,
  instrumento_id uuid not null references muestra_instrumentos(id) on delete restrict,
  numero         smallint not null default 1 check (numero >= 1),
  etiqueta       text,                    -- opcional: 'voz principal', 'coros'
  alumno_id      uuid references muestra_alumnos(id) on delete set null,
  profesor_id    uuid references muestra_profesores(id) on delete set null,
  persona_id     uuid references muestra_personas(id) on delete set null,
  se_busca       boolean not null default false,
  creado_en      timestamptz not null default now(),
  constraint muestra_slots_un_ocupante check (num_nonnulls(alumno_id, profesor_id) <= 1),
  unique (cancion_id, instrumento_id, numero)
);

create index on muestra_slots (cancion_id);
create index on muestra_slots (alumno_id);


-- ------------------------------------------------------------
-- 9b. INTERÉS EN SLOTS VACÍOS
--     Un profesor puede levantar la mano para cubrir un slot
--     (se_busca = true) sin que eso lo ocupe. Administración ve
--     quién se ofreció y decide. Independiente del interruptor
--     profes_pueden_ocupar_slots: registrar interés nunca
--     modifica el slot, solo lo señala.
-- ------------------------------------------------------------
create table muestra_slot_interes (
  id        uuid primary key default gen_random_uuid(),
  slot_id   uuid not null references muestra_slots(id) on delete cascade,
  acceso_id uuid not null references muestra_accesos(id) on delete cascade,
  creado_en timestamptz not null default now(),
  unique (slot_id, acceso_id)
);

create index on muestra_slot_interes (slot_id);

-- Una misma persona no puede ocupar dos slots de la misma canción
-- (Renata no canta y toca piano en el mismo tema).
create unique index muestra_slots_persona_unica
  on muestra_slots (cancion_id, persona_id)
  where persona_id is not null;

-- Mantener persona_id en sincronía con alumno_id
create or replace function muestra_sync_persona()
returns trigger language plpgsql as $$
begin
  if new.alumno_id is null then
    new.persona_id := null;
  else
    select persona_id into new.persona_id
    from muestra_alumnos where id = new.alumno_id;
  end if;
  return new;
end;
$$;

create trigger muestra_slots_sync_persona
  before insert or update of alumno_id on muestra_slots
  for each row execute function muestra_sync_persona();


-- ------------------------------------------------------------
-- 10. NOTAS (por canción, visibles para todos, solo-agregar)
--     El profesor puede editar la propia dentro de 15 minutos.
--     Borrar: solo administración.
-- ------------------------------------------------------------
create table muestra_notas (
  id         uuid primary key default gen_random_uuid(),
  cancion_id uuid not null references muestra_canciones(id) on delete cascade,
  slot_id    uuid references muestra_slots(id) on delete set null,
  acceso_id  uuid,                        -- quién la escribió
  autor      text not null,               -- nombre visible, congelado al crear
  texto      text not null,
  creada_en  timestamptz not null default now(),
  editada_en timestamptz
);

create index on muestra_notas (cancion_id, creada_en desc);


-- ------------------------------------------------------------
-- 11. ACCESOS (login con usuario + contraseña)
--     Ambos los crea y asigna administración. No hay autoregistro.
--     password_hash con bcrypt, nunca texto plano.
-- ------------------------------------------------------------
create table muestra_accesos (
  id             uuid primary key default gen_random_uuid(),
  usuario        text not null unique,
  password_hash  text not null,
  etiqueta       text not null,           -- 'Profe Jeremías', 'Administración'
  rol            text not null check (rol in ('admin', 'profesor')),
  profesor_id    uuid references muestra_profesores(id) on delete set null,
  debe_cambiar   boolean not null default true,  -- fuerza cambio en el primer ingreso
  activo         boolean not null default true,
  ultimo_acceso  timestamptz,
  creado_en      timestamptz not null default now()
);

create index on muestra_accesos (lower(usuario));

alter table muestra_notas
  add constraint muestra_notas_acceso_fk
  foreign key (acceso_id) references muestra_accesos(id) on delete set null;

-- Acceso inicial de prueba: usuario 'profesor'. El hash se genera con
-- bcrypt desde scripts/seed.js, con la contraseña por variable de entorno.


-- ------------------------------------------------------------
-- 11b. CONFIGURACIÓN GLOBAL (interruptores de administración)
--      Fila única. Administración abre y cierra permisos según
--      la etapa: apertura para cargar rápido, cierre para congelar.
-- ------------------------------------------------------------
create table muestra_config (
  id                              boolean primary key default true check (id),
  profes_pueden_ocupar_slots      boolean not null default false,
  profes_pueden_editar_horarios   boolean not null default false,
  drive_carpeta_url               text,   -- carpeta madre con todo el material
  actualizado_en                  timestamptz not null default now(),
  actualizado_por                 uuid references muestra_accesos(id) on delete set null
);

insert into muestra_config (id) values (true);


-- ------------------------------------------------------------
-- 12. LOG DE CAMBIOS
-- ------------------------------------------------------------
create table muestra_log (
  id         bigserial primary key,
  acceso_id  uuid references muestra_accesos(id) on delete set null,
  accion     text not null,               -- 'crear' | 'editar' | 'borrar' | 'asignar'
  entidad    text not null,               -- 'alumno' | 'cancion' | 'slot' | 'nota'
  entidad_id uuid,
  detalle    jsonb,
  creado_en  timestamptz not null default now()
);

create index on muestra_log (creado_en desc);


-- ------------------------------------------------------------
-- 13. VISTAS ÚTILES
-- ------------------------------------------------------------

-- Bandas con instrumentos faltantes (dashboard de profesores)
create view muestra_v_faltantes as
select
  c.id            as cancion_id,
  c.titulo,
  s_show.nombre   as muestra,
  c.estado,
  i.nombre        as instrumento,
  sl.numero,
  sl.id           as slot_id
from muestra_canciones c
join muestra_shows s_show   on s_show.id = c.show_id
join muestra_slots sl       on sl.cancion_id = c.id
join muestra_instrumentos i on i.id = sl.instrumento_id
where sl.alumno_id is null
  and sl.profesor_id is null;

-- Alumnos sin ninguna canción asignada
create view muestra_v_sin_asignar as
select
  a.id as alumno_id,
  p.nombre,
  i.nombre  as instrumento,
  pr.nombre as profesor,
  sh.nombre as muestra
from muestra_alumnos a
join muestra_personas p     on p.id = a.persona_id
join muestra_shows sh       on sh.id = p.show_id
join muestra_instrumentos i on i.id = a.instrumento_id
join muestra_profesores pr  on pr.id = a.profesor_id
where p.participa = true
  and not exists (select 1 from muestra_slots s where s.alumno_id = a.id);
