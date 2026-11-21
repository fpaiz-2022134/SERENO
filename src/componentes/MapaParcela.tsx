/**
 * EL MAPA DE LA PARCELA · se arrastra con el dedo.
 *
 * Escribir una latitud y una longitud a mano es inusable en el campo. Aquí el
 * productor mueve el mapa y la mira se queda fija en el centro: lo que hay
 * debajo de la mira es su parcela. Es el patrón que usa cualquier app de
 * mapas en el teléfono, y es mejor que «tocar el punto» porque el dedo no
 * tapa justo lo que se quiere apuntar.
 *
 * SIN LIBRERÍA DE MAPA. Son teselas de OpenStreetMap colocadas a mano y un
 * puñado de cuentas: eso es un «slippy map». Leaflet pesa 40 KB para un
 * productor con señal intermitente; esto pesa lo que pesan las imágenes, que
 * además el service worker cachea.
 *
 * Sin conexión las teselas no cargan y queda el fondo de musgo con la
 * coordenada escrita. Una coordenada dice más que un recuadro gris.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TESELA = 256;
const ZOOM_MIN = 6;
const ZOOM_MAX = 17;

/* --- Mercator: grados ↔ píxeles del mundo a un zoom dado ------------- */

const mundoX = (lon: number, z: number) => ((lon + 180) / 360) * TESELA * 2 ** z;

function mundoY(lat: number, z: number) {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TESELA * 2 ** z;
}

const aLon = (x: number, z: number) => (x / (TESELA * 2 ** z)) * 360 - 180;

function aLat(y: number, z: number) {
  const n = Math.PI - 2 * Math.PI * (y / (TESELA * 2 ** z));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const redondear = (v: number) => Number(v.toFixed(5));

export function MapaParcela({
  latitud,
  longitud,
  alMover,
}: {
  latitud: number;
  longitud: number;
  /** Si no viene, el mapa es solo para mirar. */
  alMover?: (lat: number, lon: number) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ ancho: 320, alto: 230 });
  const [zoom, setZoom] = useState(13);
  const [fallo, setFallo] = useState(false);

  /** Centro mientras se arrastra. Null = el centro es el de las props. */
  const [arrastre, setArrastre] = useState<{ lat: number; lon: number } | null>(null);
  const gesto = useRef<{ x: number; y: number; wx: number; wy: number } | null>(null);

  const lat = arrastre?.lat ?? latitud;
  const lon = arrastre?.lon ?? longitud;
  const editable = Boolean(alMover);

  /* --- el tamaño real del recuadro ---------------------------------- */
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () =>
      setTam({ ancho: el.clientWidth || 320, alto: el.clientHeight || 230 });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* --- arrastre ------------------------------------------------------ */

  const empezar = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      gesto.current = {
        x: e.clientX,
        y: e.clientY,
        wx: mundoX(lon, zoom),
        wy: mundoY(lat, zoom),
      };
    },
    [editable, lat, lon, zoom],
  );

  const mover = useCallback(
    (e: React.PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      e.preventDefault();
      // Se arrastra el mapa, así que el centro va al revés que el dedo.
      const nx = g.wx - (e.clientX - g.x);
      const ny = g.wy - (e.clientY - g.y);
      setArrastre({ lat: aLat(ny, zoom), lon: aLon(nx, zoom) });
    },
    [zoom],
  );

  const soltar = useCallback(() => {
    if (!gesto.current) return;
    gesto.current = null;
    if (arrastre && alMover) {
      alMover(redondear(arrastre.lat), redondear(arrastre.lon));
    }
    setArrastre(null);
  }, [arrastre, alMover]);

  /* --- zoom ----------------------------------------------------------- */
  function cambiarZoom(delta: number) {
    setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)));
  }

  /* --- las teselas que tocan ------------------------------------------ */
  const cx = mundoX(lon, zoom);
  const cy = mundoY(lat, zoom);
  const izq = cx - tam.ancho / 2;
  const arr = cy - tam.alto / 2;

  const x0 = Math.floor(izq / TESELA);
  const y0 = Math.floor(arr / TESELA);
  const x1 = Math.floor((izq + tam.ancho) / TESELA);
  const y1 = Math.floor((arr + tam.alto) / TESELA);
  const max = 2 ** zoom;

  const teselas: { x: number; y: number; izq: number; arr: number }[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    if (ty < 0 || ty >= max) continue;
    for (let tx = x0; tx <= x1; tx++) {
      // El mundo da la vuelta en horizontal, así que la x se envuelve.
      const envuelta = ((tx % max) + max) % max;
      teselas.push({ x: envuelta, y: ty, izq: tx * TESELA - izq, arr: ty * TESELA - arr });
    }
  }

  return (
    <div className="mapa" ref={caja} data-editable={editable ? "si" : undefined}>
      {!fallo && (
        <div
          className="mapa__lienzo"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          role={editable ? "application" : undefined}
          aria-label={
            editable
              ? "Mapa de la parcela. Arrastre para mover el punto."
              : `Mapa en ${latitud}, ${longitud}`
          }
        >
          {teselas.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${zoom}-${t.x}-${t.y}`}
              src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
              alt=""
              width={TESELA}
              height={TESELA}
              draggable={false}
              style={{ left: t.izq, top: t.arr }}
              onError={() => setFallo(true)}
            />
          ))}
        </div>
      )}

      {/* La mira: fija en el centro. Lo que esté debajo es la parcela. */}
      <span className="mapa__mira" aria-hidden="true">
        <span className="mapa__mira-punto" />
      </span>

      {editable && (
        <div className="mapa__zoom">
          <button
            type="button"
            onClick={() => cambiarZoom(1)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Acercar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => cambiarZoom(-1)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Alejar"
          >
            −
          </button>
        </div>
      )}

      {/* Solo la coordenada: el nombre del lugar tiene su propio campo abajo
          y aquí lo único que taparía es el dato que no se puede ver de otra
          forma. */}
      <span className="mapa__coord">
        {lat.toFixed(4)}, {lon.toFixed(4)}
        {fallo && " · mapa no disponible sin conexión"}
      </span>

      {editable && !fallo && (
        <span className="mapa__pista">Arrastre el mapa hasta su parcela</span>
      )}
    </div>
  );
}
