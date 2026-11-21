/**
 * Mapa de la parcela.
 *
 * Teselas de OpenStreetMap puestas a mano: sin librería de mapa, sin llave y
 * sin JavaScript de terceros. Pesa lo que pesan seis imágenes.
 *
 * Sin conexión no cargan y queda el fondo de musgo con la coordenada escrita.
 * Una coordenada dice más que un recuadro gris.
 */
"use client";

import { useState } from "react";

const ZOOM = 13;
const TESELA = 256;
const COLS = 3;
const FILAS = 2;

const aTeselaX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;

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
  const px = (tx - x0) * TESELA;
  const py = (ty - y0) * TESELA;

  return (
    <div className="mapa" aria-label={`Mapa de la parcela en ${latitud}, ${longitud}`}>
      {!fallo && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              width: COLS * TESELA,
              height: FILAS * TESELA,
              left: "50%",
              top: "50%",
              transform: `translate(${-px}px, ${-py}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${TESELA}px)`,
              opacity: 0.88,
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

      <span className="mapa__pin" aria-hidden="true" />

      <span className="mapa__coord">
        {lugar ? `${lugar} · ` : ""}
        {latitud.toFixed(4)}, {longitud.toFixed(4)}
        {fallo && " · mapa no disponible sin conexión"}
      </span>
    </div>
  );
}
