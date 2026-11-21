/**
 * LA LÍNEA DE INCUBACIÓN.
 *
 * Es la idea entera del producto, dibujada: lo que se infecta hoy no se ve
 * hasta dentro de 25 a 30 días. Cuando el productor ve la mancha, el dinero
 * del fungicida ya está perdido.
 *
 * v1 lo decía en una viñeta de texto. Aquí es una línea con un punto que la
 * recorre, para que se entienda sin leer. Las dos fechas de los extremos las
 * calcula el motor (`sintomasVisiblesDesde/Hasta`), no esta función.
 */
"use client";

import { fechaCorta } from "@/lib/ui/fechas";
import { diasEntre } from "@/lib/ui/paleta";

export function Incubacion({
  hoy,
  desde,
  hasta,
}: {
  hoy: string;
  desde: string;
  hasta: string;
}) {
  const dias = diasEntre(hoy, desde);

  return (
    <div>
      <div className="rotulo">Si hoy se infecta</div>

      <div className="incuba__via" aria-hidden="true">
        <span className="incuba__hito" style={{ left: "0%" }} />
        <span className="incuba__hito incuba__hito--fin" style={{ left: "100%" }} />
        <span className="incuba__viaje" />
      </div>

      <div className="incuba__pie">
        <span>
          Hoy
          <b>{fechaCorta(hoy)}</b>
        </span>
        <span>
          {dias > 0 ? `${dias} días después` : "Después"}
          <b>
            {fechaCorta(desde)} – {fechaCorta(hasta)}
          </b>
        </span>
      </div>

      <p style={{ fontSize: 14.5, color: "var(--hoja-honda)", margin: "14px 0 0", lineHeight: 1.45 }}>
        Ahí recién se verían las manchas en el envés de la hoja. Para entonces la
        infección tiene {dias > 0 ? `${dias} días` : "casi un mes"} de haber ocurrido:
        aplicar en ese momento es dinero tirado.
      </p>
    </div>
  );
}
