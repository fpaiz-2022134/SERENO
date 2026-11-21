/**
 * Pantalla 5 · Mi parcela — cinco datos, nada más.
 *
 * 1 ubicación en mapa · 2 altitud · 3 cultivo y variedad · 4 área ·
 * 5 estado del cultivo.
 *
 * La altitud NO se pide: la devuelve Open-Meteo para la celda de la coordenada
 * y aquí solo se muestra cuál de las bandas del branding le toca. Pedirla a
 * mano sería pedir un dato que ya tenemos medido.
 */
"use client";

import { useEffect, useState } from "react";
import { MapaParcela } from "@/componentes/MapaParcela";
import {
  CULTIVOS,
  ESTADOS_CULTIVO,
  VARIEDADES_CAFE,
  bandaDeAltitud,
  type EstadoCultivo,
  type Parcela,
} from "@/lib/ui/almacen";

/** El punto verificado del demo: 912 m, dentro del rango que recomienda la investigación. */
export const PARCELA_DEMO: Parcela = {
  nombre: "Finca El Sereno",
  lugar: "Piedemonte de Suchitepéquez",
  latitud: 14.5,
  longitud: -91.15,
  altitudMetros: null,
  cultivo: "cafe",
  variedad: "Caturra",
  areaHa: 2,
  estadoCultivo: "sin_sintomas",
  ultimaAplicacion: null,
};

const AREAS = [
  { etiqueta: "< 1 ha", valor: 0.5 },
  { etiqueta: "1 – 2 ha", valor: 2 },
  { etiqueta: "2 – 5 ha", valor: 4 },
  { etiqueta: "> 5 ha", valor: 8 },
];

export function MiParcela({
  parcela,
  altitudMedida,
  alGuardar,
  alCalcular,
}: {
  parcela: Parcela | null;
  altitudMedida: number | null;
  alGuardar: (p: Parcela) => void;
  alCalcular: () => void;
}) {
  const [b, setB] = useState<Parcela>(parcela ?? PARCELA_DEMO);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  useEffect(() => {
    if (parcela) setB(parcela);
  }, [parcela]);

  const altitud = altitudMedida ?? b.altitudMetros;
  const cultivoElegido = CULTIVOS.find((c) => c.id === b.cultivo);

  function ubicarme() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorGps("Este teléfono no permite ubicación automática. Escriba la coordenada.");
      return;
    }
    setBuscandoGps(true);
    setErrorGps(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoGps(false);
        setB((x) => ({
          ...x,
          latitud: Number(pos.coords.latitude.toFixed(5)),
          longitud: Number(pos.coords.longitude.toFixed(5)),
          altitudMetros: null,
        }));
      },
      () => {
        setBuscandoGps(false);
        setErrorGps("No se pudo leer la ubicación. Escriba la coordenada a mano.");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  return (
    <div className="pantalla">
      <div style={{ padding: "2px 0 10px" }}>
        <h1 style={{ fontSize: 27, color: "var(--niebla-profunda)" }}>Mi parcela</h1>
        <p style={{ fontSize: 13, color: "var(--tinta-suave)", marginTop: 2 }}>
          Cinco datos, nada más.
        </p>
      </div>

      {/* 1 · Ubicación ------------------------------------------------ */}
      <div className="tarjeta">
        <div className="tarjeta__rotulo">1 · Ubicación</div>
        <div style={{ marginTop: 8 }}>
          <MapaParcela latitud={b.latitud} longitud={b.longitud} lugar={b.lugar} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="campo">
            <span className="campo__rotulo">Nombre de la parcela</span>
            <input
              value={b.nombre}
              onChange={(e) => setB({ ...b, nombre: e.target.value })}
              placeholder="Finca El Sereno"
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Lugar</span>
            <input
              value={b.lugar}
              onChange={(e) => setB({ ...b, lugar: e.target.value })}
              placeholder="Chiantla, Huehuetenango"
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="campo">
              <span className="campo__rotulo">Latitud</span>
              <input
                inputMode="decimal"
                value={b.latitud}
                onChange={(e) =>
                  setB({ ...b, latitud: Number(e.target.value), altitudMetros: null })
                }
              />
            </label>
            <label className="campo">
              <span className="campo__rotulo">Longitud</span>
              <input
                inputMode="decimal"
                value={b.longitud}
                onChange={(e) =>
                  setB({ ...b, longitud: Number(e.target.value), altitudMetros: null })
                }
              />
            </label>
          </div>
          <button type="button" className="boton boton--contorno" onClick={ubicarme} disabled={buscandoGps}>
            {buscandoGps ? "Buscando…" : "◎ Usar mi ubicación"}
          </button>
          {errorGps && (
            <p className="nota-procedencia" style={{ color: "var(--cedro)" }}>
              {errorGps}
            </p>
          )}
        </div>
      </div>

      {/* 2 · Altitud -------------------------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">2 · Altitud</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {["< 900 m", "900 – 1,500 m", "1,500 – 1,800 m", "> 1,800 m"].map((banda) => (
            <button
              key={banda}
              type="button"
              className="chip"
              aria-pressed={bandaDeAltitud(altitud) === banda}
              disabled
              style={{ cursor: "default" }}
            >
              {banda}
            </button>
          ))}
        </div>
        <p className="nota-procedencia">
          {altitud != null ? (
            <>
              <b style={{ fontFamily: "var(--mono)", color: "var(--ebano)" }}>
                {Math.round(altitud)} m
              </b>{" "}
              — la devuelve Open-Meteo para la celda de esta coordenada, no la escribe usted.
              {altitud > 1700 &&
                " Ojo: arriba de 1,700 m la celda sale fría y el motor exige rachas muy largas."}
            </>
          ) : (
            "No disponible hasta la primera consulta del pronóstico para esta coordenada."
          )}
        </p>
      </div>

      {/* 3 · Cultivo y variedad --------------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">3 · Cultivo y variedad</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {CULTIVOS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              aria-pressed={b.cultivo === c.id}
              disabled={!c.conMotor}
              onClick={() => c.conMotor && setB({ ...b, cultivo: c.id })}
            >
              {c.nombre}
              {!c.conMotor && <span className="chip__nota">próximamente</span>}
            </button>
          ))}
        </div>

        {cultivoElegido?.conMotor && (
          <div className="chips" style={{ marginTop: 10 }}>
            {VARIEDADES_CAFE.map((v) => (
              <button
                key={v}
                type="button"
                className="chip"
                aria-pressed={b.variedad === v}
                onClick={() => setB({ ...b, variedad: v })}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <p className="nota-procedencia">
          Hoy solo la <b>roya del café</b> tiene umbrales verificados en literatura primaria
          (Magarey et al. 2005 · APS · Kushalappa 1983). Para maíz, frijol, cardamomo y
          hortalizas no los tenemos, así que no calculamos un riesgo que no podríamos
          defender.
        </p>
      </div>

      {/* 4 · Área ----------------------------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">4 · Área cultivada</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {AREAS.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              className="chip"
              aria-pressed={b.areaHa === a.valor}
              onClick={() => setB({ ...b, areaHa: a.valor })}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* 5 · Estado del cultivo --------------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">5 · Estado del cultivo</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {ESTADOS_CULTIVO.map((e) => (
            <button
              key={e.id}
              type="button"
              className="chip"
              aria-pressed={b.estadoCultivo === e.id}
              onClick={() => setB({ ...b, estadoCultivo: e.id as EstadoCultivo })}
            >
              {e.nombre}
            </button>
          ))}
        </div>
        <label className="campo" style={{ marginTop: 12 }}>
          <span className="campo__rotulo">Última aplicación (opcional)</span>
          <input
            type="date"
            value={b.ultimaAplicacion ?? ""}
            onChange={(e) => setB({ ...b, ultimaAplicacion: e.target.value || null })}
          />
        </label>
        <p className="nota-procedencia">
          El índice vale <b>asumiendo que hay inóculo en la parcela</b>. El clima solo no
          explica un brote: este dato lo pone usted.
        </p>
      </div>

      <div className="botones-par seccion">
        <button
          type="button"
          className="boton boton--oscuro"
          onClick={() => alGuardar({ ...b, altitudMetros: altitud })}
        >
          Guardar
        </button>
        <button
          type="button"
          className="boton boton--principal"
          onClick={() => {
            alGuardar({ ...b, altitudMetros: altitud });
            alCalcular();
          }}
        >
          Calcular riesgo
        </button>
      </div>
    </div>
  );
}
