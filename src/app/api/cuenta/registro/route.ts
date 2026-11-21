/**
 * POST /api/cuenta/registro — crear una cuenta de verdad.
 *
 * Crea el `usuario` (con la contraseña hasheada) y su `productor` en UNA
 * transacción con el rol de servicio: si algo falla, no queda un usuario
 * huérfano sin productor, que luego rompería el RLS (`mi_productor_id()`
 * devolvería null y el productor no vería ni sus propias parcelas).
 *
 * NO hay verificación de correo porque no hay proveedor de correo configurado.
 * Se dice en el README y la pantalla no finge un paso que no existe: la cuenta
 * queda usable de una vez. Cuando haya proveedor, se agrega el paso de verdad.
 */
import { errorJson, json } from "@/lib/api";
import { conexionServicio, estadoBase } from "@/lib/db";
import {
  cookieDeSesion,
  correoValido,
  crearSesion,
  hashearClave,
  normalizarCorreo,
  revisarClave,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(peticion: Request) {
  if (!estadoBase().configurada) {
    return errorJson("La base de datos no está configurada en el servidor.", 503);
  }

  let cuerpo: { correo?: string; clave?: string; nombre?: string; telefono?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return errorJson("El cuerpo de la petición no es JSON válido.");
  }

  const correo = normalizarCorreo(cuerpo.correo ?? "");
  const clave = cuerpo.clave ?? "";
  const nombre = (cuerpo.nombre ?? "").trim().slice(0, 80) || null;
  const telefono = (cuerpo.telefono ?? "").trim().slice(0, 30) || null;

  if (!correoValido(correo)) return errorJson("Escriba un correo electrónico válido.");
  const malaClave = revisarClave(clave);
  if (malaClave) return errorJson(malaClave);

  const pool = conexionServicio();
  if (!pool) return errorJson("La base de datos no está configurada en el servidor.", 503);

  const hash = await hashearClave(clave);
  const cliente = await pool.connect();
  let usuarioId: string;
  let productorId: string;

  try {
    await cliente.query("begin");

    const yaEsta = await cliente.query("select 1 from public.usuarios where lower(correo) = $1", [
      correo,
    ]);
    if (yaEsta.rowCount && yaEsta.rowCount > 0) {
      await cliente.query("rollback");
      return errorJson("Ya hay una cuenta con ese correo. Entre con su contraseña.", 409);
    }

    const u = await cliente.query(
      `insert into public.usuarios (correo, contrasena_hash)
       values ($1, $2) returning id`,
      [correo, hash],
    );
    usuarioId = u.rows[0].id as string;

    const p = await cliente.query(
      `insert into public.productores (usuario_id, nombre, telefono_whatsapp)
       values ($1, $2, $3) returning id`,
      [usuarioId, nombre, telefono],
    );
    productorId = p.rows[0].id as string;

    await cliente.query("commit");
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    // El índice único de lower(correo) puede saltar aquí si dos peticiones
    // llegan a la vez. Es el mismo caso de arriba, con otra carrera.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("usuarios_correo_unico_sin_mayusculas") || msg.includes("usuarios_correo_key")) {
      return errorJson("Ya hay una cuenta con ese correo. Entre con su contraseña.", 409);
    }
    console.error("registro:", e);
    return errorJson("No se pudo crear la cuenta.", 500);
  } finally {
    cliente.release();
  }

  const token = await crearSesion(usuarioId, peticion.headers.get("user-agent"));

  return new Response(
    JSON.stringify({
      ok: true,
      // El productor se creo en la misma transaccion: se devuelve su id, no
      // null, para que la app no crea que falta y lo vuelva a pedir.
      sesion: { correo, nombre, productorId },
      parcelas: [],
    }),
    {
      status: 201,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": cookieDeSesion(token),
      },
    },
  );
}
