/**
 * Clientes de Supabase. SOLO SERVIDOR.
 *
 * El backend es el unico que habla con las APIs externas y con la llave de
 * servicio. El frontend usa el anon key y RLS lo limita a sus propias parcelas.
 *
 * Si las variables no estan puestas, estas funciones devuelven null en vez de
 * tirar el proceso: el resto del backend (clima, prevencion, mercado,
 * historico) funciona sin base de datos.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface EstadoSupabase {
  configurado: boolean;
  faltan: string[];
}

export function estadoSupabase(): EstadoSupabase {
  const faltan: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) faltan.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) faltan.push("SUPABASE_SERVICE_ROLE_KEY");
  return { configurado: faltan.length === 0, faltan };
}

/** Cliente con la llave de servicio: SALTA RLS. Nunca exportarlo al navegador. */
export function clienteServicio(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) return null;
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente con el anon key, para operar en nombre del usuario (respeta RLS). */
export function clienteAnonimo(tokenDeAcceso?: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !llave) return null;
  return createClient(url, llave, {
    auth: { persistSession: false },
    global: tokenDeAcceso
      ? { headers: { Authorization: `Bearer ${tokenDeAcceso}` } }
      : undefined,
  });
}
