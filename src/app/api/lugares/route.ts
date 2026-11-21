/**
 * GET /api/lugares?q=Chiantla — buscar un lugar por nombre.
 *
 * Para que nadie tenga que escribir una coordenada. Usa el geocodificador de
 * Open-Meteo, que es la MISMA casa que da el pronóstico: no se agrega una
 * fuente nueva ni una llave nueva, y el nombre que sale aquí es el nombre con
 * que esa fuente conoce el punto.
 *
 * Como toda llamada externa del proyecto, sale del servidor: el navegador del
 * productor nunca habla con una API de terceros.
 *
 * Devuelve también la altitud que reporta el geocodificador, pero OJO: esa es
 * la del pueblo, no la de la celda del pronóstico. La que manda para el motor
 * es la que devuelve `/api/prevencion`, y es la que se guarda en la parcela.
 */
import { errorJson, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** 24 h: los pueblos no se mueven. */
export const revalidate = 86400;

interface Resultado {
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  admin1?: string;
  admin2?: string;
  country_code?: string;
}

export async function GET(peticion: Request) {
  const q = (new URL(peticion.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ ok: true, lugares: [] });
  if (q.length > 80) return errorJson("La búsqueda es demasiado larga.");

  const url =
    "https://geocoding-api.open-meteo.com/v1/search?" +
    new URLSearchParams({
      name: q,
      count: "8",
      language: "es",
      // Guatemala primero; si no hay nada, se vuelve a pedir sin filtrar.
      countryCode: "GT",
      format: "json",
    });

  try {
    let datos = await traer(url);
    if (datos.length === 0) {
      datos = await traer(
        "https://geocoding-api.open-meteo.com/v1/search?" +
          new URLSearchParams({ name: q, count: "8", language: "es", format: "json" }),
      );
    }

    return json({
      ok: true,
      lugares: datos.map((r) => ({
        nombre: r.name,
        // "Chiantla, Huehuetenango" — como lo escribiría el productor. El
        // geocodificador suele repetir el nombre en admin2 y escribir
        // "Departamento de X"; las dos cosas sobran en pantalla.
        detalle: detalleDe(r),
        latitud: r.latitude,
        longitud: r.longitude,
        altitudMetros: r.elevation ?? null,
      })),
      procedencia: {
        fuente: "Open-Meteo (geocoding)",
        url: "https://geocoding-api.open-meteo.com/v1/search",
      },
    });
  } catch (e) {
    console.error("GET /api/lugares:", e);
    return errorJson("No se pudo buscar el lugar. Pruebe de nuevo o mueva el mapa a mano.", 502);
  }
}

function detalleDe(r: Resultado): string {
  // El geocodificador escribe "Departamento de X" y "Municipio de X"; en
  // pantalla sobra el prefijo y lo que importa es el nombre.
  const limpiar = (t?: string) =>
    t?.replace(/^(Departamento|Municipio)\s+de\s+/i, "").trim();
  const partes = [limpiar(r.admin2), limpiar(r.admin1)]
    .filter((t): t is string => Boolean(t) && t !== r.name)
    .filter((t, i, xs) => xs.indexOf(t) === i);
  if (r.country_code && r.country_code !== "GT") partes.push(r.country_code);
  return partes.join(", ");
}

async function traer(url: string): Promise<Resultado[]> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { "user-agent": "SERENO/1.0 (https://github.com/fpaiz-2022134/SERENO)" },
  });
  if (!r.ok) throw new Error(`geocoding respondió ${r.status}`);
  const j = (await r.json()) as { results?: Resultado[] };
  return j.results ?? [];
}
