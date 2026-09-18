// Carga los accesos reales de los 8 profesores (nombres provisorios, se
// renombran después en muestra_profesores) y confirma/crea el acceso admin.
//
// Las contraseñas NUNCA se hardcodean acá: se leen de variables de entorno
// en el momento de correr el script y se hashean antes de guardarse. No
// quedan en texto plano en ningún archivo del repo.
//
// Uso:
//   SEED_PASSWORD_PROFESORES="..." SEED_PASSWORD_ADMIN="..." node scripts/seed-produccion.js
//
// SEED_PASSWORD_ADMIN solo hace falta si todavía no existe un acceso
// "admin" (si ya existe, se deja como está y no se toca su contraseña).

const bcrypt = require('bcrypt');
const supabase = require('../src/config/supabase');

const SALT_ROUNDS = 10;
const CANTIDAD_PROFESORES = 8;

const PASSWORD_PROFESORES = process.env.SEED_PASSWORD_PROFESORES;
const PASSWORD_ADMIN = process.env.SEED_PASSWORD_ADMIN;

const PROFESORES = Array.from({ length: CANTIDAD_PROFESORES }, (_, i) => ({
  nombre: `Profesor ${i + 1}`,
  usuario: `profe${i + 1}`,
}));

// muestra_profesores no tiene columna única por nombre, así que para que el
// seed sea idempotente buscamos por nombre antes de insertar.
async function idOCreaProfesor(nombre) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('muestra_profesores')
    .select('id')
    .eq('nombre', nombre)
    .maybeSingle();

  if (errorBusqueda) throw errorBusqueda;
  if (existente) return existente.id;

  const { data: creado, error: errorInsert } = await supabase
    .from('muestra_profesores')
    .insert({ nombre })
    .select('id')
    .single();

  if (errorInsert) throw errorInsert;
  return creado.id;
}

async function aseguraAdmin() {
  const { data: existente, error } = await supabase
    .from('muestra_accesos')
    .select('id, usuario, activo')
    .eq('usuario', 'admin')
    .maybeSingle();

  if (error) throw error;

  if (existente) {
    console.log(`Acceso "admin" ya existe (activo: ${existente.activo}). No se toca.`);
    return;
  }

  if (!PASSWORD_ADMIN) {
    console.error('No existe un acceso "admin" y falta SEED_PASSWORD_ADMIN para crearlo.');
    process.exitCode = 1;
    return;
  }

  const password_hash = await bcrypt.hash(PASSWORD_ADMIN, SALT_ROUNDS);
  const { error: errorInsert } = await supabase.from('muestra_accesos').insert({
    usuario: 'admin',
    password_hash,
    etiqueta: 'Administración',
    rol: 'admin',
    profesor_id: null,
    activo: true,
    debe_cambiar: true,
  });

  if (errorInsert) throw errorInsert;
  console.log('Acceso "admin" creado.');
}

async function seedProfesores() {
  if (!PASSWORD_PROFESORES) {
    console.error('Falta la variable de entorno SEED_PASSWORD_PROFESORES.');
    process.exitCode = 1;
    return;
  }

  const password_hash = await bcrypt.hash(PASSWORD_PROFESORES, SALT_ROUNDS);

  for (const { nombre, usuario } of PROFESORES) {
    const profesorId = await idOCreaProfesor(nombre);

    const { error } = await supabase.from('muestra_accesos').upsert(
      {
        usuario,
        password_hash,
        etiqueta: nombre,
        rol: 'profesor',
        profesor_id: profesorId,
        activo: true,
        debe_cambiar: true,
      },
      { onConflict: 'usuario' }
    );

    if (error) {
      console.error(`Error al crear acceso "${usuario}":`, error.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`Profesor listo: ${nombre} -> usuario "${usuario}" (profesorId ${profesorId})`);
  }
}

async function seed() {
  await aseguraAdmin();
  await seedProfesores();
}

seed();
