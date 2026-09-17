const bcrypt = require('bcrypt');
const supabase = require('../src/config/supabase');

const SALT_ROUNDS = 10;
const NOMBRE_PROFESOR_PRUEBA = 'Profesor de prueba';

const ACCESOS_PRUEBA = [
  { usuario: 'admin', password: 'admin123', etiqueta: 'Administración', rol: 'admin' },
  { usuario: 'profesor', password: 'profesor-aami', etiqueta: 'Profesor de prueba', rol: 'profesor' },
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
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const profesor_id = rol === 'profesor' ? profesorId : null;

    const { error } = await supabase
      .from('muestra_accesos')
      .upsert(
        { usuario, password_hash, etiqueta, rol, profesor_id, activo: true, debe_cambiar: true },
        { onConflict: 'usuario' }
      );

    if (error) {
      console.error(`Error al crear acceso "${usuario}":`, error.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`Acceso listo: ${usuario} / ${password} (${rol})`);
  }
}

seed();
