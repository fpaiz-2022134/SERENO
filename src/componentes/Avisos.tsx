/**
 * Los avisos de honestidad del branding, como componentes para que no se
 * olvide ninguno y digan siempre lo mismo.
 */
import { marcaDeTiempo } from "@/lib/ui/fechas";
import type { Procedencia } from "@/lib/ui/tipos";
import type { Origen } from "@/lib/ui/red";

/**
 * «Sin conexión. Viendo el reporte del sáb 21 nov, 11:30.»
 * El reporte viejo SIEMPRE con su fecha. Si la fecha falta, no se muestra
 * el reporte como si fuera de ahora.
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
    <div className="aviso aviso--niebla" role="status">
      <span aria-hidden="true">▣</span>
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
    <div className="aviso aviso--roble">
      <span aria-hidden="true">◈</span>
      <span>
        <b>Estimación meteorológica.</b> No es una medición en su finca.
      </span>
    </div>
  );
}

/** «Open-Meteo para su municipio · no medido en la finca», con la hora real. */
export function Procedencia_({
  procedencia,
  recibidoEn,
}: {
  procedencia: Procedencia | null | undefined;
  recibidoEn?: string;
}) {
  if (!procedencia) return null;
  return (
    <p className="nota-procedencia">
      {procedencia.fuente.replace(/\s*\(.*\)/, "")} para su municipio · no medido en la finca.
      {" "}Consultado {marcaDeTiempo(recibidoEn ?? procedencia.ultimaConsulta)}.
      {procedencia.altitudMetros != null && ` Celda a ${Math.round(procedencia.altitudMetros)} m.`}
      {procedencia.avisos?.map((a) => ` ${a}`)}
    </p>
  );
}

/** Estado vacío honesto: "No disponible" y QUÉ FALTA. Nunca un cero. */
export function DatoVacio({ titulo, falta }: { titulo: string; falta: string }) {
  return (
    <div className="dato dato--vacio">
      <div className="dato__titulo">{titulo}</div>
      <div className="dato__valor">No disponible</div>
      <div className="dato__pie">{falta}</div>
    </div>
  );
}
