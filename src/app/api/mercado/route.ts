/**
 * PANEL DE MERCADO
 *
 * GET /api/mercado?noticias=1
 *
 * Precios del MAGA (CKAN) + noticias de GDELT.
 *
 * Dos reglas que este endpoint cumple de forma explicita:
 *  - El cafe NO tiene cotizacion nacional en los CSV del MAGA. Se devuelve
 *    `cafe.disponible: false` con el motivo, no un numero inventado.
 *  - Las noticias de precios viajan con `noEsCotizacion: true`: son noticias,
 *    no una cotizacion. Y ningun titular dispara una alerta de brote.
 */
import { json } from "@/lib/api";
import { preciosMasRecientes } from "@/lib/fuentes/maga-precios";
import { noticiasAgro } from "@/lib/fuentes/gdelt";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const conNoticias = new URL(peticion.url).searchParams.get("noticias") !== "0";

  const precios = await preciosMasRecientes();

  const noticias = conNoticias
    ? await noticiasAgro(["roya", "precio_cafe", "exportaciones"], {
        meses: 12,
        maximoPorTema: 15,
      })
    : { noticias: [], errores: [], consultas: [] };

  return json({
    ok: true,
    precios: precios.ok
      ? {
          dataset: {
            titulo: precios.datos.dataset.titulo,
            organizacion: precios.datos.dataset.organizacion,
            licencia: precios.datos.dataset.licencia,
            recursoCsv: precios.datos.recurso,
          },
          filas: precios.datos.filas.length,
          cafe: precios.datos.cafe,
          cacao: precios.datos.cacao,
          nota:
            "Precio MAYORISTA en mercados terminales. No es precio al productor en finca " +
            "y no se convierte un precio internacional en nacional.",
          procedencia: precios.procedencia,
        }
      : { error: precios.error, procedencia: precios.procedencia },
    noticias: {
      total: noticias.noticias.length,
      articulos: noticias.noticias,
      errores: noticias.errores,
      consultas: noticias.consultas,
      nota:
        "Contexto, nunca veredicto. Un titular no confirma un brote. Las noticias de " +
        "precios se muestran como noticias, no como cotizacion.",
    },
  });
}
