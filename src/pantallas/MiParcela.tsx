/**
 * Mi parcela — cinco datos, nada más, y ahora guardados en Postgres.
 *
 * 1 ubicación · 2 altitud · 3 cultivo y variedad · 4 área · 5 estado.
 *
 * La altitud NO se pregunta: la devuelve Open-Meteo para la celda de la
 * coordenada. Pedir a mano un dato que ya está medido le hace perder el tiempo
 * al productor y abre la puerta a un error.
 *
 * El guardado va a `/api/parcelas`, que escribe con el rol al que SÍ se le
 * aplica el RLS. Si la pantalla está en modo copia (sin conexión con el
 * servidor), los campos quedan de solo lectura en vez de fingir que guardan.
 */
"use client";

import { useEffect, useState } from "react";
import { MapaParcela } from "@/componentes/MapaParcela";
import { BuscarLugar, type Lugar } from "@/componentes/BuscarLugar";
import { Cabecera, FOTOS } from "@/componentes/Fotos";
import { Rotulo } from "@/componentes/Avisos";
import { Mira } from "@/componentes/Iconos";
import {
  CULTIVOS,
  ESTADOS_CULTIVO,
  VARIEDADES,
  bandaDeAltitud,
  type EstadoCultivo,
  type Parcela,
  type ParcelaNueva,
} from "@/lib/ui/cuenta";

/** El punto verificado del demo: 912 m, dentro del rango de la investigación. */
export const PARCELA_SUGERIDA: ParcelaNueva = {
  nombre: "Mi parcela",
  lugar: "",
  latitud: 14.5,
  longitud: -91.15,
  altitudMetros: null,
  variedadId: "caturra",
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
  guardando,
  error,
  soloLectura,
  alGuardar,
  alCalcular,
}: {
  parcela: Parcela | null;
  altitudMedida: number | null;
  guardando: boolean;
  error: string | null;
  soloLectura: boolean;
  alGuardar: (datos: ParcelaNueva, id: string | null) => Promise<boolean>;
  alCalcular: () => void;
}) {
  const [b, setB] = useState<ParcelaNueva>(parcela ?? PARCELA_SUGERIDA);
  const [cultivo, setCultivo] = useState("cafe");
  const [buscando, setBuscando] = useState(false);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    if (parcela) setB(parcela);
  }, [parcela]);

  const altitud = altitudMedida ?? b.altitudMetros;
  const esCafe = CULTIVOS.find((c) => c.id === cultivo)?.conMotor ?? false;

  function cambiar(cambio: Partial<ParcelaNueva>) {
    setB((x) => ({ ...x, ...cambio }));
    setGuardado(false);
  }

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
        cambiar({
          latitud: Number(pos.coords.latitude.toFixed(5)),
          longitud: Number(pos.coords.longitude.toFixed(5)),
          altitudMetros: null,
        });
      },
      () => {
        setBuscando(false);
        setErrorGps("No se pudo leer la ubicación. Escriba la coordenada a mano.");
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  }

  async function guardar(yCalcular: boolean) {
    const ok = await alGuardar({ ...b, altitudMetros: altitud }, parcela?.id ?? null);
    if (!ok) return;
    setGuardado(true);
    if (yCalcular) alCalcular();
  }

  return (
    <>
      <Cabecera
        foto={FOTOS.parcela}
        encima={<>Cinco datos, nada más</>}
        titulo={parcela ? "Mi parcela" : "Nueva parcela"}
      />

      <div className="pliego">
        {soloLectura && (
          <div className="nota nota--alta" style={{ marginBottom: 14 }}>
            <span className="nota__signo" aria-hidden="true">
              !
            </span>
            <span>
              <b>Sin conexión con el servidor.</b> Puede ver su parcela, pero para
              cambiarla hace falta señal: los datos se guardan en la base, no en el
              teléfono.
            </span>
          </div>
        )}

        {/* 1 · Ubicación ------------------------------------------------
            Tres caminos al mismo punto, de más fácil a más preciso:
            buscar el municipio, usar el GPS del teléfono, o arrastrar el
            mapa. La coordenada escrita a mano queda escondida, para quien
            de verdad la tenga. */}
        <section className="tarjeta entra entra-1" style={{ position: "relative", zIndex: 2 }}>
          <Rotulo n={1}>Dónde está su parcela</Rotulo>

          <BuscarLugar
            deshabilitado={soloLectura}
            alElegir={(l: Lugar) => {
              cambiar({
                latitud: l.latitud,
                longitud: l.longitud,
                // La altitud del geocodificador es la del pueblo, no la de la
                // celda del pronóstico. Se descarta: la buena la trae
                // /api/prevencion y es la que se guarda.
                altitudMetros: null,
                lugar: b.lugar || [l.nombre, l.detalle].filter(Boolean).join(", "),
              });
            }}
          />

          <div style={{ marginTop: 12 }}>
            <MapaParcela
              latitud={b.latitud}
              longitud={b.longitud}
              alMover={
                soloLectura
                  ? undefined
                  : (lat, lon) => cambiar({ latitud: lat, longitud: lon, altitudMetros: null })
              }
            />
          </div>

          <button
            type="button"
            className="boton boton--musgo"
            style={{ marginTop: 12 }}
            onClick={ubicarme}
            disabled={buscando || soloLectura}
          >
            <Mira tam={18} />
            {buscando ? "Buscando su ubicación…" : "Estoy parado en mi parcela"}
          </button>

          {errorGps && (
            <div className="nota nota--alta" style={{ marginTop: 11 }}>
              <span className="nota__signo" aria-hidden="true">
                !
              </span>
              <span>{errorGps}</span>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <label className="campo">
              <span className="campo__que">Nombre de la parcela</span>
              <input
                value={b.nombre}
                disabled={soloLectura}
                onChange={(e) => cambiar({ nombre: e.target.value })}
                placeholder="Finca El Sereno"
              />
            </label>
            <label className="campo" style={{ marginBottom: 0 }}>
              <span className="campo__que">Lugar</span>
              <input
                value={b.lugar}
                disabled={soloLectura}
                onChange={(e) => cambiar({ lugar: e.target.value })}
                placeholder="Chiantla, Huehuetenango"
              />
            </label>
          </div>

          <details style={{ marginTop: 14 }}>
            <summary
              style={{
                fontSize: 13.5,
                color: "var(--tinta-2)",
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              Escribir la coordenada exacta
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginTop: 11 }}>
              <label className="campo" style={{ marginBottom: 0 }}>
                <span className="campo__que">Latitud</span>
                <input
                  inputMode="decimal"
                  value={b.latitud}
                  disabled={soloLectura}
                  onChange={(e) =>
                    cambiar({ latitud: Number(e.target.value), altitudMetros: null })
                  }
                />
              </label>
              <label className="campo" style={{ marginBottom: 0 }}>
                <span className="campo__que">Longitud</span>
                <input
                  inputMode="decimal"
                  value={b.longitud}
                  disabled={soloLectura}
                  onChange={(e) =>
                    cambiar({ longitud: Number(e.target.value), altitudMetros: null })
                  }
                />
              </label>
            </div>
          </details>
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
                La mide <b>Open-Meteo</b> para la celda de esta coordenada; no la escribe
                usted.
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
                aria-pressed={cultivo === c.id}
                disabled={!c.conMotor}
                onClick={() => c.conMotor && setCultivo(c.id)}
              >
                {c.nombre}
                {!c.conMotor && <span className="ficha__nota">pronto</span>}
              </button>
            ))}
          </div>

          {esCafe && (
            <div className="fichas" style={{ marginTop: 10 }}>
              {VARIEDADES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="ficha"
                  aria-pressed={b.variedadId === v.id}
                  disabled={soloLectura}
                  onClick={() => cambiar({ variedadId: v.id })}
                >
                  {v.nombre}
                </button>
              ))}
            </div>
          )}

          <p className="imprenta">
            Hoy solo la <b>roya del café</b> tiene umbrales verificados en literatura
            primaria (Magarey et al. 2005 · APS · Kushalappa 1983). Para maíz, frijol,
            cardamomo y hortalizas no los tenemos, así que no calculamos un riesgo que no
            podríamos defender frente a nadie.
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
                disabled={soloLectura}
                onClick={() => cambiar({ areaHa: a.valor })}
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
                disabled={soloLectura}
                onClick={() => cambiar({ estadoCultivo: e.id as EstadoCultivo })}
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
              disabled={soloLectura}
              onChange={(e) => cambiar({ ultimaAplicacion: e.target.value || null })}
            />
          </label>
          <p className="imprenta">
            El índice vale <b>asumiendo que hay inóculo en la parcela</b>. El clima solo no
            explica un brote: este dato lo pone usted, y queda guardado con su fecha.
          </p>
        </section>

        {error && (
          <div className="nota nota--alta" role="alert" style={{ marginTop: 16 }}>
            <span className="nota__signo" aria-hidden="true">
              !
            </span>
            <span>{error}</span>
          </div>
        )}

        <div className="par" style={{ marginTop: 22 }}>
          <button
            type="button"
            className="boton boton--nube"
            disabled={guardando || soloLectura}
            onClick={() => void guardar(false)}
          >
            {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar"}
          </button>
          <button
            type="button"
            className="boton"
            disabled={guardando || soloLectura}
            onClick={() => void guardar(true)}
          >
            Calcular
          </button>
        </div>
      </div>
    </>
  );
}
