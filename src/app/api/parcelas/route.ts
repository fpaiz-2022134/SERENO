/**
 * GET  /api/parcelas — las parcelas del productor que está adentro.
 * POST /api/parcelas — crear una.
 *
 * Las dos pasan por `comoProductor()`, o sea por el rol al que SÍ se le aplica
 * el RLS. Ninguna petición de usuario toca la conexión de servicio.
 *
 * Si no hay sesión: 401. No se devuelve una lista vacía fingiendo que el
 * productor no tiene parcelas, porque son dos cosas distintas y la pantalla
 * tiene que poder diferenciarlas.
 */
import { errorJson, json } from "@/lib/api";
import { estadoBase } from "@/lib/db";
import { tokenDePeticion, usuarioDeSesion } from "@/lib/auth";
import {
  crearParcela,
  parcelasDe,
  revisarParcela,
  type ParcelaEntrante,
} from "@/lib/parcelas";

export const dynamic = "force-dynamic";

async function quienEs(peticion: Request) {
  if (!estadoBase().configurada) return { error: errorJson("La base de datos no está configurada en el servidor.", 503) };
  const sesion = await usuarioDeSesion(tokenDePeticion(peticion));
  if (!sesion) return { error: errorJson("Entre a su cuenta para ver sus parcelas.", 401) };
  return { sesion };
}

export async function GET(peticion: Request) {
  const r = await quienEs(peticion);
  if (r.error) return r.error;
  try {
    return json({ ok: true, parcelas: await parcelasDe(r.sesion!.usuarioId) });
  } catch (e) {
    console.error("GET /api/parcelas:", e);
    return errorJson("No se pudieron leer las parcelas.", 500);
  }
}

export async function POST(peticion: Request) {
  const r = await quienEs(peticion);
  if (r.error) return r.error;

  let cuerpo: ParcelaEntrante;
  try {
    cuerpo = await peticion.json();
  } catch {
    return errorJson("El cuerpo de la petición no es JSON válido.");
  }

  const malo = revisarParcela(cuerpo);
  if (malo) return errorJson(malo);

  try {
    return json({ ok: true, parcela: await crearParcela(r.sesion!.usuarioId, cuerpo) }, 201);
  } catch (e) {
    console.error("POST /api/parcelas:", e);
    return errorJson("No se pudo guardar la parcela.", 500);
  }
}
