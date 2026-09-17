const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const env = require('./env');

// No usamos suscripciones realtime, pero supabase-js igual instancia un
// RealtimeClient en el constructor. En Node 18 (sin WebSocket nativo) eso
// tira si no se le inyecta un transport.
const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});

module.exports = supabase;
