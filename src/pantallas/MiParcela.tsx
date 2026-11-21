/**
 * Mi parcela — cinco datos, nada más.
 *
 * 1 ubicación · 2 altitud · 3 cultivo y variedad · 4 área · 5 estado.
 *
 * La altitud NO se pregunta: la devuelve Open-Meteo para la celda de la
 * coordenada. Pedir a mano un dato que ya está medido es hacerle perder el
 * tiempo al productor y abrir la puerta a un error.
 */
"use client";

import { useEffect, useState } from "react";
import { MapaParcela } from "@/componentes/MapaParcela";
import { Cabecera, FOTOS } from "@/componentes/Fotos";
import { Rotulo } from "@/componentes/Avisos";
import { Mira } from "@/componentes/Iconos";
import {
  CULTIVOS,
  ESTADOS_CULTIVO,
  VARIEDADES_CAFE,
  bandaDeAltitud,
  type EstadoCultivo,
  type Parcela,
} from "@/lib/ui/almacen";

/** El punto verificado del demo: 912 m, dentro del rango de la investigación. */
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

const BANDAS = ["< 900 m", "900 – 1,500 m", "1,500 – 1,800 m", "> 1,800 m"];

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
  const [buscando, setBuscando] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);

  useEffect(() => {
    if (parcela) setB(parcela);
  }, [parcela]);

  const altitud = altitudMedida ?? b.altitudMetros;
  const esCafe = CULTIVOS.find((c) => c.id === b.cultivo)?.conMotor ?? false;

  function ubicarme() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorGps("Este teléfono no permite ubicación automática. Escriba la coordenada.");
      return;
    }
    setBuscando(true);
    setErrorGps(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscando(false);
        setB((x) => ({
          ...x,
          latitud: Number(pos.coords.latitude.toFixed(5)),
          longitud: Number(pos.coords.longitude.toFixed(5)),
          altitudMetros: null,
        }));
      },
      () => {
        setBuscando(false);
        setErrorGps("No se pudo leer la ubicación. Escriba la coordenada a mano.");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  return (
    <>
      <Cabecera foto={FOTOS.parcela} encima={<>Cinco datos, nada más</>} titulo="Mi parcela" />

      <div className="pliego">

      {/* 1 · Ubicación */}
      <section className="tarjeta entra entra-1" style={{ position: "relative", zIndex: 2 }}>
        <Rotulo n={1}>Ubicación</Rotulo>
        <MapaParcela latitud={b.latitud} longitud={b.longitud} lugar={b.lugar} />

        <div style={{ marginTop: 13 }}>
          <label className="campo">
            <span className="campo__que">Nombre de la parcela</span>
            <input
              value={b.nombre}
              onChange={(e) => setB({ ...b, nombre: e.target.value })}
              placeholder="Finca El Sereno"
            />
          </label>
          <label className="campo">
            <span className="campo__que">Lugar</span>
            <input
              value={b.lugar}
              onChange={(e) => setB({ ...b, lugar: e.target.value })}
              placeholder="Chiantla, Huehuetenango"
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
            <label className="campo">
              <span className="campo__que">Latitud</span>
              <input
                inputMode="decimal"
                value={b.latitud}
                onChange={(e) => setB({ ...b, latitud: Number(e.target.value), altitudMetros: null })}
              />
            </label>
            <label className="campo">
              <span className="campo__que">Longitud</span>
              <input
                inputMode="decimal"
                value={b.longitud}
                onChange={(e) => setB({ ...b, longitud: Number(e.target.value), altitudMetros: null })}
              />
            </label>
          </div>
          <button type="button" className="boton boton--musgo" onClick={ubicarme} disabled={buscando}>
            <Mira tam={18} />
            {buscando ? "Buscando…" : "Usar mi ubicación"}
          </button>
          {errorGps && (
            <div className="nota nota--alta" style={{ marginTop: 11 }}>
              <span className="nota__signo" aria-hidden="true">
                !
              </span>
              <span>{errorGps}</span>
            </div>
          )}
        </div>
      </section>

      {/* 2 · Altitud */}
      <section className="tarjeta seccion">
        <Rotulo n={2}>Altitud</Rotulo>
        {altitud != null && (
          <div
            style={{
              fontFamily: "var(--serif)",
              fontVariationSettings: '"SOFT" 70, "opsz" 48',
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              marginBottom: 12,
              color: "var(--hoja-honda)",
            }}
          >
            {Math.round(altitud)}
            <span style={{ fontSize: 15, color: "var(--tinta-2)" }}> m s. n. m.</span>
          </div>
        )}
        <div className="fichas">
          {BANDAS.map((banda) => (
            <button
              key={banda}
              type="button"
              className="ficha"
              aria-pressed={bandaDeAltitud(altitud) === banda}
              disabled
              style={{ cursor: "default" }}
            >
              {banda}
            </button>
          ))}
        </div>
        <p className="imprenta">
          {altitud != null ? (
            <>
              La mide <b>Open-Meteo</b> para la celda de esta coordenada; no la escribe usted.
              {altitud > 1700 &&
                " Ojo: arriba de 1,700 m la celda sale fría y el motor exige rachas larguísimas."}
            </>
          ) : (
            "No disponible hasta la primera consulta del pronóstico para esta coordenada."
          )}
        </p>
      </section>

      {/* 3 · Cultivo y variedad */}
      <section className="tarjeta seccion">
        <Rotulo n={3}>Cultivo y variedad</Rotulo>
        <div className="fichas">
          {CULTIVOS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ficha"
              aria-pressed={b.cultivo === c.id}
              disabled={!c.conMotor}
              onClick={() => c.conMotor && setB({ ...b, cultivo: c.id })}
            >
              {c.nombre}
              {!c.conMotor && <span className="ficha__nota">pronto</span>}
            </button>
          ))}
        </div>

        {esCafe && (
          <div className="fichas" style={{ marginTop: 10 }}>
            {VARIEDADES_CAFE.map((v) => (
              <button
                key={v}
                type="button"
                className="ficha"
                aria-pressed={b.variedad === v}
                onClick={() => setB({ ...b, variedad: v })}
              >
                {v}
              </button>
            ))}
          </div>
        )}

        <p className="imprenta">
          Hoy solo la <b>roya del café</b> tiene umbrales verificados en literatura primaria
          (Magarey et al. 2005 · APS · Kushalappa 1983). Para maíz, frijol, cardamomo y
          hortalizas no los tenemos, así que no calculamos un riesgo que no podríamos
          defender frente a nadie.
        </p>
      </section>

      {/* 4 · Área */}
      <section className="tarjeta seccion">
        <Rotulo n={4}>Área cultivada</Rotulo>
        <div className="fichas">
          {AREAS.map((a) => (
            <button
              key={a.etiqueta}
              type="button"
              className="ficha"
              aria-pressed={b.areaHa === a.valor}
              onClick={() => setB({ ...b, areaHa: a.valor })}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      </section>

      {/* 5 · Estado del cultivo */}
      <section className="tarjeta seccion">
        <Rotulo n={5}>Estado del cultivo</Rotulo>
        <div className="fichas">
          {ESTADOS_CULTIVO.map((e) => (
            <button
              key={e.id}
              type="button"
              className="ficha"
              aria-pressed={b.estadoCultivo === e.id}
              onClick={() => setB({ ...b, estadoCultivo: e.id as EstadoCultivo })}
            >
              {e.nombre}
            </button>
          ))}
        </div>
        <label className="campo" style={{ marginTop: 13 }}>
          <span className="campo__que">Última aplicación (opcional)</span>
          <input
            type="date"
            value={b.ultimaAplicacion ?? ""}
            onChange={(e) => setB({ ...b, ultimaAplicacion: e.target.value || null })}
          />
        </label>
        <p className="imprenta">
          El índice vale <b>asumiendo que hay inóculo en la parcela</b>. El clima solo no
          explica un brote: este dato lo pone usted.
        </p>
      </section>

      <div className="par" style={{ marginTop: 22 }}>
        <button
          type="button"
          className="boton boton--nube"
          onClick={() => alGuardar({ ...b, altitudMetros: altitud })}
        >
          Guardar
        </button>
        <button
          type="button"
          className="boton"
          onClick={() => {
            alGuardar({ ...b, altitudMetros: altitud });
            alCalcular();
          }}
        >
          Calcular
        </button>
        </div>
      </div>
    </>
  );
}
