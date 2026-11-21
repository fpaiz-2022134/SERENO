/**
 * POST /api/cuenta/salir — cerrar sesión.
 *
 * Borra la fila de `sesiones` además de limpiar la cookie. Si solo se borrara
 * la cookie, el token seguiría siendo válido para quien lo tuviera copiado.
 */
import { cerrarSesion, cookieBorrada, tokenDePeticion } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(peticion: Request) {
  await cerrarSesion(tokenDePeticion(peticion)).catch(() => {});
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": cookieBorrada(),
    },
  });
}
