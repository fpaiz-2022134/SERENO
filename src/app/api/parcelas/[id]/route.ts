/**
 * PATCH  /api/parcelas/:id — cambiar una parcela.
 * DELETE /api/parcelas/:id — borrarla.
 *
 * Ninguna de las dos lleva `where productor_id = ...`: el RLS ya lo pone. Si
 * la parcela es de otro productor, la sentencia afecta cero filas y aquí sale
 * un 404 — que es lo correcto, porque un 403 confirmaría que esa parcela
 * existe y es de alguien.
 */
import { errorJson, json } from "@/lib/api";
import { estadoBase } from "@/lib/db";
import { tokenDePeticion, usuarioDeSesion } from "@/lib/auth";
import { actualizarParcela, borrarParcela, revisarParcela, type ParcelaEntrante } from "@/lib/parcelas";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function quienEs(peticion: Request) {
  if (!estadoBase().configurada) {
    return { error: errorJson("La base de datos no está configurada en el servidor.", 503) };
  }
  const sesion = await usuarioDeSesion(tokenDePeticion(peticion));
  if (!sesion) return { error: errorJson("Entre a su cuenta.", 401) };
  return { sesion };
}

export async function PATCH(peticion: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return errorJson("Identificador de parcela inválido.");

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
    const parcela = await actualizarParcela(r.sesion!.usuarioId, id, cuerpo);
    if (!parcela) return errorJson("Esa parcela no existe.", 404);
    return json({ ok: true, parcela });
  } catch (e) {
    console.error("PATCH /api/parcelas:", e);
    return errorJson("No se pudo guardar la parcela.", 500);
  }
}

export async function DELETE(peticion: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return errorJson("Identificador de parcela inválido.");

  const r = await quienEs(peticion);
  if (r.error) return r.error;

  try {
    const borrada = await borrarParcela(r.sesion!.usuarioId, id);
    if (!borrada) return errorJson("Esa parcela no existe.", 404);
    return json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/parcelas:", e);
    return errorJson("No se pudo borrar la parcela.", 500);
  }
}
