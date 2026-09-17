const supabase = require('../config/supabase');

async function contarSlotsPorInstrumento(cancionId, instrumentoId) {
  const { count, error } = await supabase
    .from('muestra_slots')
    .select('id', { count: 'exact', head: true })
    .eq('cancion_id', cancionId)
    .eq('instrumento_id', instrumentoId);

  if (error) throw error;
  return count || 0;
}

async function siguienteNumero(cancionId, instrumentoId) {
  const { data, error } = await supabase
    .from('muestra_slots')
    .select('numero')
    .eq('cancion_id', cancionId)
    .eq('instrumento_id', instrumentoId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.numero || 0) + 1;
}

// Insert-or-delete sobre muestra_slot_interes: toggle del interés propio.
async function toggleInteres(slotId, accesoId) {
  const { data: existente, error: errorBusqueda } = await supabase
    .from('muestra_slot_interes')
    .select('id')
    .eq('slot_id', slotId)
    .eq('acceso_id', accesoId)
    .maybeSingle();

  if (errorBusqueda) throw errorBusqueda;

  if (existente) {
    const { error } = await supabase.from('muestra_slot_interes').delete().eq('id', existente.id);
    if (error) throw error;
    return { interesado: false };
  }

  const { error } = await supabase
    .from('muestra_slot_interes')
    .insert({ slot_id: slotId, acceso_id: accesoId });
  if (error) throw error;
  return { interesado: true };
}

module.exports = { contarSlotsPorInstrumento, siguienteNumero, toggleInteres };
