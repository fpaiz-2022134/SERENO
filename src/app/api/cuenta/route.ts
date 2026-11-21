/**
 * GET /api/cuenta — quién está adentro.
 *
 * Es lo primero que llama la app al abrir. Devuelve `sesion: null` si no hay
 * nadie, sin que eso sea un error: así la PWA sabe si pintar el acceso o el
 * panel sin tener que adivinar leyendo localStorage.
 */
import { json } from "@/lib/api";
import { estadoBase } from "@/lib/db";
import { tokenDePeticion, usuarioDeSesion } from "@/lib/auth";
import { parcelasDe } from "@/lib/parcelas";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  if (!estadoBase().configurada) {
    // Sin base de datos no hay cuentas. Se dice, no se finge.
    return json(
      {
        ok: true,
        sesion: null,
        base: { configurada: false, faltan: estadoBase().faltan },
      },
      200,
    );
  }

  const sesion = await usuarioDeSesion(tokenDePeticion(peticion));
  if (!sesion) return json({ ok: true, sesion: null, base: { configurada: true } });

  const parcelas = sesion.productorId ? await parcelasDe(sesion.usuarioId) : [];

  return json({
    ok: true,
    base: { configurada: true },
    sesion: {
      correo: sesion.correo,
      nombre: sesion.nombre,
      productorId: sesion.productorId,
    },
    parcelas,
  });
}
