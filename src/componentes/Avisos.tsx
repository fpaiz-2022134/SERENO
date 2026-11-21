/**
 * Las reglas de honestidad, como componentes, para que digan siempre lo mismo
 * y no se le olvide ninguna a nadie.
 */
import { marcaDeTiempo } from "@/lib/ui/fechas";
import type { Procedencia } from "@/lib/ui/tipos";
import type { Origen } from "@/lib/ui/red";

/**
 * «Sin conexión. Viendo el reporte del sáb 21 nov, 12:57.»
 * Un reporte viejo se muestra SIEMPRE con su fecha, nunca disfrazado de fresco.
 */
export function AvisoSinConexion({
  origen,
  recibidoEn,
  motivo,
}: {
  origen: Origen;
  recibidoEn: string;
  motivo: string | null;
}) {
  if (origen !== "cache") return null;
  return (
    <div className="nota" role="status" style={{ marginTop: 16 }}>
      <span className="nota__signo" aria-hidden="true">
        ◇
      </span>
      <span>
        <b>{motivo === "Sin conexión." ? "Sin conexión." : "No se pudo actualizar."}</b>{" "}
        Viendo el reporte del {marcaDeTiempo(recibidoEn)}.
      </span>
    </div>
  );
}

/** «Estimación meteorológica. No es una medición en su finca.» */
export function AvisoEstimacion() {
  return (
    <div className="nota">
      <span className="nota__signo" aria-hidden="true">
        ◈
      </span>
      <span>
        <b>Estimación meteorológica.</b> No es una medición en su finca.
      </span>
    </div>
  );
}

/** De dónde salió el dato: fuente, hora exacta de consulta y altitud de la celda. */
export function Imprenta({
  procedencia,
  recibidoEn,
}: {
  procedencia: Procedencia | null | undefined;
  recibidoEn?: string;
}) {
  if (!procedencia) return null;
  const fuente = procedencia.fuente.replace(/\s*\(.*\)/, "");
  return (
    <p className="imprenta">
      <b>{fuente}</b> para su municipio · no medido en la finca
      <br />
      Consultado {marcaDeTiempo(recibidoEn ?? procedencia.ultimaConsulta)}
      {procedencia.altitudMetros != null &&
        ` · celda a ${Math.round(procedencia.altitudMetros)} m`}
      {procedencia.avisos?.map((a) => (
        <span key={a}>
          <br />
          {a}
        </span>
      ))}
    </p>
  );
}

/** Estado vacío honesto: «No disponible» Y qué falta. Nunca un cero. */
export function Vacio({ que, falta }: { que: string; falta: string }) {
  return (
    <div className="vacio">
      <div className="vacio__que">{que}</div>
      <div className="vacio__val">No disponible</div>
      <div className="vacio__falta">{falta}</div>
    </div>
  );
}

/** Las tres reglas con dos barras y un título de sección. */
export function Rotulo({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <div className="rotulo">
      {n != null && <span className="rotulo__n">{n}</span>}
      {children}
    </div>
  );
}
