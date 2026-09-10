// Edge Function "keepalive"
// Hace una consulta REAL a la base de datos (no solo un ping) para que
// Supabase la registre como actividad y no pause el proyecto por inactividad.
//
// El nombre de la tabla a consultar se lee de la variable de entorno
// KEEPALIVE_TABLE, así el MISMO código sirve para cualquier proyecto:
// solo cambia esa variable al desplegarlo (ver instrucciones).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const tableName = Deno.env.get('KEEPALIVE_TABLE') || 'profiles'

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Consulta real: cuenta filas de la tabla indicada.
    // head:true evita traer los datos, solo pide el conteo (rápido y liviano).
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: error.message, table: tableName }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        table: tableName,
        count,
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
