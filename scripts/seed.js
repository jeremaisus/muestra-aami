// Seed de accesos de prueba para desarrollo local. Las contraseñas NUNCA
// se hardcodean acá: se leen de variables de entorno en el momento de
// correr el script. No toca la contraseña de un acceso que ya exista
// (evita pisar la contraseña real de "admin" si el script se corre por
// error contra una base con datos reales).
//
// Uso:
//   SEED_TEST_PASSWORD_ADMIN="..." SEED_TEST_PASSWORD_PROFESOR="..." node scripts/seed.js

const bcrypt = require('bcrypt');
const supabase = require('../src/config/supabase');

const SALT_ROUNDS = 10;
const NOMBRE_PROFESOR_PRUEBA = 'Profesor de prueba';

const PASSWORD_ADMIN = process.env.SEED_TEST_PASSWORD_ADMIN;
const PASSWORD_PROFESOR = process.env.SEED_TEST_PASSWORD_PROFESOR;

if (!PASSWORD_ADMIN || !PASSWORD_PROFESOR) {
  console.error(
    'Faltan variables de entorno: SEED_TEST_PASSWORD_ADMIN y SEED_TEST_PASSWORD_PROFESOR son requeridas.'
  );
  process.exit(1);
}

const ACCESOS_PRUEBA = [
  { usuario: 'admin', password: PASSWORD_ADMIN, etiqueta: 'Administración', rol: 'admin' },
  { usuario: 'profesor', password: PASSWORD_PROFESOR, etiqueta: 'Profesor de prueba', rol: 'profesor' },
];

// muestra_profesores no tiene columna única por nombre, así que para que el
// seed sea idempotente buscamos por nombre antes de insertar.
async function idProfesorDePrueba() {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('muestra_profesores')
    .select('id')
    .eq('nombre', NOMBRE_PROFESOR_PRUEBA)
    .maybeSingle();

  if (errorBusqueda) throw errorBusqueda;
  if (existente) return existente.id;

  const { data: creado, error: errorInsert } = await supabase
    .from('muestra_profesores')
    .insert({ nombre: NOMBRE_PROFESOR_PRUEBA })
    .select('id')
    .single();

  if (errorInsert) throw errorInsert;
  return creado.id;
}

async function seed() {
  const profesorId = await idProfesorDePrueba();
  console.log(`Profesor de prueba listo: ${profesorId}`);

  for (const { usuario, password, etiqueta, rol } of ACCESOS_PRUEBA) {
    const { data: existente, error: errorBusqueda } = await supabase
      .from('muestra_accesos')
      .select('id')
      .eq('usuario', usuario)
      .maybeSingle();

    if (errorBusqueda) {
      console.error(`Error al buscar acceso "${usuario}":`, errorBusqueda.message);
      process.exitCode = 1;
      continue;
    }

    if (existente) {
      console.log(`Acceso "${usuario}" ya existe. No se toca su contraseña.`);
      continue;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const profesor_id = rol === 'profesor' ? profesorId : null;

    const { error } = await supabase
      .from('muestra_accesos')
      .insert({ usuario, password_hash, etiqueta, rol, profesor_id, activo: true, debe_cambiar: true });

    if (error) {
      console.error(`Error al crear acceso "${usuario}":`, error.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`Acceso creado: ${usuario} (${rol})`);
  }
}

seed();
