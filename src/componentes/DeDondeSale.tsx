/**
 * DE DÓNDE SALE ESTE NÚMERO.
 *
 * Va pegado al veredicto, no al final del scroll. Esa es toda la idea.
 *
 * El productor preguntó, con sus palabras: «no entiendo dónde me está diciendo
 * qué haga y por qué, no entiendo dónde están consumiendo las APIs, data real,
 * y dándome predicciones, y cómo».
 *
 * La app sí tenía la respuesta, pero en el sitio equivocado: la procedencia
 * vivía dentro del bloque «El clima de esta hora», penúltimo de la pantalla y
 * justo el de los datos que NO deciden nada. El índice, el medidor y la
 * ventana —lo que el productor mira— no tenían ninguna al lado. Si buscó de
 * dónde salía el número mirando cerca del número, no había nada que encontrar.
 *
 * Esto no explica el modelo entero: eso está en «Ver por qué y los costos».
 * Lo que hace es encadenar, en una frase y con los números de hoy, el camino
 * completo: QUÉ FUENTE → QUÉ MIDIÓ → CONTRA QUÉ UMBRAL → QUÉ ÍNDICE → QUÉ
 * BANDA. Y dice la hora exacta en que se consultó, porque un pronóstico sin
 * su hora no se puede juzgar.
 */
"use client";

import { fechaCorta, marcaDeTiempo } from "@/lib/ui/fechas";
import type { DiaCurva, Procedencia } from "@/lib/ui/tipos";

export function DeDondeSale({
  procedencia,
  recibidoEn,
  dias,
  pico,
  indice,
  palabra,
  color,
}: {
  procedencia: Procedencia;
  recibidoEn: string;
  /** Cuántos días trae el pronóstico. */
  dias: number;
  /** El día que manda en la ventana: de él salen las horas y la temperatura. */
  pico: DiaCurva | null;
  indice: number;
  palabra: string;
  color: string;
}) {
  // El nombre de la fuente sin el paréntesis técnico: "Open-Meteo (forecast)"
  // no le dice nada a nadie en una finca.
  const fuente = procedencia.fuente.replace(/\s*\(.*\)/, "");
  const pide =
    pico?.horasRequeridas != null && Number.isFinite(pico.horasRequeridas)
      ? Math.round(pico.horasRequeridas)
      : null;

  return (
    <details className="procedencia">
      <summary className="procedencia__abrir">
        <span className="procedencia__punto" style={{ background: color }} aria-hidden="true" />
        De dónde sale este número
        <span className="procedencia__flecha" aria-hidden="true">
          ›
        </span>
      </summary>

      <div className="procedencia__cuerpo">
        <ol className="cadena">
          <li>
            <b>{fuente}</b> dio el pronóstico por hora de los próximos {dias} días para la
            celda de su coordenada
            {procedencia.altitudMetros != null && ` (${Math.round(procedencia.altitudMetros)} m)`}.
          </li>
          {pico && (
            <li>
              El motor contó, el <b>{fechaCorta(pico.dia)}</b>,{" "}
              <b>{pico.horasMojadas} horas seguidas de hoja mojada</b>: horas con humedad
              sobre 90 % o con lluvia.
            </li>
          )}
          {pico && pide != null && (
            <li>
              A {pico.temperaturaMedia?.toFixed(1)} °C, Magarey (2005) pide{" "}
              <b>{pide} horas</b> para que la roya entre en la hoja.
            </li>
          )}
          <li>
            De comparar lo que hubo contra lo que pide el modelo sale el índice{" "}
            <b style={{ color }}>{indice.toFixed(2)}</b> de 1, que cae en la banda{" "}
            <b style={{ color }}>{palabra}</b>.
          </li>
        </ol>

        <p className="procedencia__pie">
          Consultado {marcaDeTiempo(recibidoEn)}. Es <b>aritmética</b>, no un modelo de
          lenguaje: con la misma serie el número sale siempre igual.{" "}
          {procedencia.esPronostico ? "Es pronóstico, no una medición en su finca." : ""}
        </p>
      </div>
    </details>
  );
}
