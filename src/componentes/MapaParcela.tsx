/**
 * Mapa de la parcela.
 *
 * Son teselas de OpenStreetMap puestas a mano: sin librería de mapa, sin
 * llave y sin JavaScript de terceros. Pesa lo que pesan 6 imágenes.
 *
 * SIN CONEXIÓN las teselas no cargan y se ve el patrón de curvas de nivel con
 * la coordenada escrita. Eso es a propósito: un mapa en blanco no dice nada,
 * una coordenada sí.
 */
"use client";

import { useState } from "react";

const ZOOM = 13;
const TESELA = 256;
const COLS = 3;
const FILAS = 2;

function aTeselaX(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}

function aTeselaY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

export function MapaParcela({
  latitud,
  longitud,
  lugar,
}: {
  latitud: number;
  longitud: number;
  lugar?: string;
}) {
  const [fallo, setFallo] = useState(false);

  const tx = aTeselaX(longitud, ZOOM);
  const ty = aTeselaY(latitud, ZOOM);
  const x0 = Math.floor(tx) - 1;
  const y0 = Math.floor(ty) - 1;

  const anchoTotal = COLS * TESELA;
  const altoTotal = FILAS * TESELA;
  // Posición del punto dentro de la rejilla de teselas, en píxeles.
  const px = (tx - x0) * TESELA;
  const py = (ty - y0) * TESELA;

  return (
    <div className="mapa" aria-label={`Mapa de la parcela en ${latitud}, ${longitud}`}>
      {!fallo && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: anchoTotal,
              height: altoTotal,
              // El punto de la parcela queda en el centro del recuadro visible.
              left: "50%",
              top: "50%",
              transform: `translate(${-px}px, ${-py}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${TESELA}px)`,
              opacity: 0.92,
            }}
          >
            {Array.from({ length: COLS * FILAS }, (_, i) => {
              const cx = x0 + (i % COLS);
              const cy = y0 + Math.floor(i / COLS);
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${cx}-${cy}`}
                  src={`https://tile.openstreetmap.org/${ZOOM}/${cx}/${cy}.png`}
                  alt=""
                  width={TESELA}
                  height={TESELA}
                  onError={() => setFallo(true)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="mapa__pin" style={{ position: "relative", zIndex: 2 }} aria-hidden="true" />

      <div className="mapa__nota">
        {lugar ? `${lugar} · ` : ""}
        <span style={{ fontFamily: "var(--mono)" }}>
          {latitud.toFixed(4)}, {longitud.toFixed(4)}
        </span>
        {fallo && " · mapa no disponible sin conexión"}
      </div>
    </div>
  );
}
