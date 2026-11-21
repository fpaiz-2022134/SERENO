/**
 * Pantalla 4 · Hoy en mi finca — 5 datos y 3 acciones.
 *
 * Dato 1 es el riesgo de plaga con su ventana, y el logo se vuelve el medidor
 * de 3 anillos (hoy, 3 días, 7 días).
 *
 * NOTA DE DISEÑO (tensión declarada): SERENO-investigacion.md §0A sostiene que
 * temperatura, humedad y lluvia crudas NO deberían ir en el panel porque «son
 * insumos, no decisiones». El branding sí las pide como datos 2, 3 y 4, y es
 * la decisión más nueva del equipo, así que aquí van — pero rotuladas como
 * estimación y debajo del dato que sí cambia una decisión.
 */
"use client";

import { useMemo } from "react";
import { Medidor } from "@/componentes/Logo";
import { AvisoEstimacion, AvisoSinConexion, DatoVacio, Procedencia_ } from "@/componentes/Avisos";
import { pintaDeNivel } from "@/lib/ui/riesgo";
import { diaSemana, diaSemanaCorto, fechaCorta, fechaDeHoy } from "@/lib/ui/fechas";
import type { Parcela } from "@/lib/ui/almacen";
import type { DiaCurva, RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado } from "@/lib/ui/red";

/** Máximo índice del tramo [desde, hasta) de la curva. null si no hay días. */
function picoDeTramo(curva: DiaCurva[], desde: number, hasta: number): DiaCurva | null {
  const tramo = curva.slice(desde, hasta);
  if (tramo.length === 0) return null;
  return tramo.reduce((a, b) => (b.indice > a.indice ? b : a));
}

const ACCIONES = [
  {
    id: "revisar",
    titulo: "Revisar el envés de las hojas",
    pie: "Roya antes de la ventana de riesgo",
    cuando: "Hoy",
  },
  {
    id: "preparar",
    titulo: "Preparar prevención",
    pie: "Plan de manejo con su técnico",
    cuando: "Esta semana",
  },
  {
    id: "anotar",
    titulo: "Anotar lo que hizo",
    pie: "Inspección o aplicación",
    cuando: "Al terminar",
  },
];

export function Hoy({
  nombre,
  parcela,
  resultado,
  accionesHechas,
  alMarcarAccion,
  alVerResultado,
  alIrAParcela,
}: {
  nombre: string;
  parcela: Parcela;
  resultado: Resultado<RespuestaPrevencion>;
  accionesHechas: string[];
  alMarcarAccion: (id: string) => void;
  alVerResultado: () => void;
  alIrAParcela: () => void;
}) {
  const d = resultado.datos;
  const curva = d.curva ?? [];
  const ventana = d.ventanaDeAccion;
  const pinta = pintaDeNivel(ventana?.nivel ?? curva[0]?.nivel);

  const anillos = useMemo(
    () => [
      { nombre: "7 días", ...tramo(curva, 0, 7) },
      { nombre: "3 días", ...tramo(curva, 0, 3) },
      { nombre: "Hoy", ...tramo(curva, 0, 1) },
    ],
    [curva],
  );

  /** El primer día de la curva cuyo índice entra en banda de aviso, después de hoy. */
  const proxima = useMemo(() => {
    const siguiente = curva.slice(1).find((x) => x.indice >= 0.5);
    return siguiente ?? null;
  }, [curva]);

  const titularClima = useMemo(() => tituloDeLluvia(curva), [curva]);
  const cultivoConMotor = parcela.cultivo === "cafe";

  return (
    <div className="pantalla">
      <div style={{ padding: "2px 0 12px" }}>
        <div className="saludo__fecha">{fechaDeHoy(d.hoy)}</div>
        <h1 className="saludo__titulo">Buenos días, {nombre}.</h1>
      </div>

      <AvisoSinConexion
        origen={resultado.origen}
        recibidoEn={resultado.recibidoEn}
        motivo={resultado.motivoCaida}
      />

      {/* --- Pronóstico de 7 días ------------------------------------ */}
      <div className="tarjeta tarjeta--niebla seccion">
        <div className="tarjeta__rotulo">Pronóstico · 7 días</div>
        <h2 style={{ fontSize: 24, margin: "6px 0 12px", color: "#fff" }}>{titularClima}</h2>
        <div className="tira">
          {curva.slice(0, 7).map((x, i) => (
            <div key={x.dia} className={`tira__dia${i === 0 ? " tira__dia--hoy" : ""}`}>
              <div className="tira__nombre">{i === 0 ? "Hoy" : diaSemanaCorto(x.dia)}</div>
              <div
                className="tira__punto"
                style={{ background: pintaDeNivel(x.nivel).color }}
                title={pintaDeNivel(x.nivel).palabra}
              />
              <div className="tira__temp">
                {x.temperaturaMedia != null ? `${Math.round(x.temperaturaMedia)}°` : "—"}
              </div>
              <div className="tira__mm">{x.lluviaMm.toFixed(0)} mm</div>
            </div>
          ))}
        </div>
      </div>

      {/* --- Dato 1 · riesgo de plaga -------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">1 · Riesgo de plaga</div>
        {cultivoConMotor ? (
          <>
            <div className="riesgo" style={{ marginTop: 10 }}>
              <Medidor anillos={anillos} nivelPrincipal={ventana?.nivel ?? curva[0]?.nivel ?? null} />
              <div className="riesgo__texto">
                <div className="riesgo__cultivo">Roya del café</div>
                {ventana ? (
                  <div className="riesgo__ventana">
                    Ventana de riesgo{" "}
                    <b>
                      {fechaCorta(ventana.inicio)} – {fechaCorta(ventana.fin)}
                    </b>
                  </div>
                ) : (
                  <div className="riesgo__ventana">
                    Sin ventana de infección en los próximos {curva.length} días.
                  </div>
                )}
                <span className={pinta.claseInsignia}>
                  {pinta.corta} · {pinta.palabra}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 12,
                fontSize: 11,
                color: "var(--tinta-tenue)",
              }}
            >
              {anillos
                .slice()
                .reverse()
                .map((a) => (
                  <span key={a.nombre}>
                    <b style={{ color: a.nivel ? pintaDeNivel(a.nivel).color : "inherit" }}>●</b>{" "}
                    {a.nombre}: {a.nivel ? pintaDeNivel(a.nivel).palabra : "sin dato"}
                  </span>
                ))}
            </div>

            <button
              type="button"
              className="boton boton--principal"
              style={{ marginTop: 14 }}
              onClick={alVerResultado}
            >
              Ver por qué y los costos
            </button>
          </>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="dato dato--vacio" style={{ minHeight: 0 }}>
              <div className="dato__titulo">{parcela.cultivo}</div>
              <div className="dato__valor">No disponible</div>
              <div className="dato__pie">
                El motor solo tiene umbrales verificados para roya del café. Para este
                cultivo no hay umbrales en fuente primaria y no vamos a inventarlos.
              </div>
            </div>
            <button
              type="button"
              className="boton boton--contorno"
              style={{ marginTop: 12 }}
              onClick={alIrAParcela}
            >
              Cambiar el cultivo de la parcela
            </button>
          </div>
        )}
      </div>

      {/* --- Datos 2, 3, 4 y 5 --------------------------------------- */}
      <div className="datos">
        {d.ahora?.temperaturaC != null ? (
          <div className="dato dato--miel">
            <div className="dato__titulo">2 · Temperatura</div>
            <div className="dato__valor">
              {Math.round(d.ahora.temperaturaC)}
              <sup>°C</sup>
            </div>
            <div className="dato__pie">estimación meteorológica</div>
          </div>
        ) : (
          <DatoVacio titulo="2 · Temperatura" falta="La fuente no devolvió el dato de esta hora." />
        )}

        {d.ahora?.humedadPct != null ? (
          <div className="dato dato--niebla">
            <div className="dato__titulo">3 · Humedad</div>
            <div className="dato__valor">
              {Math.round(d.ahora.humedadPct)}
              <small>%</small>
            </div>
            <div className="dato__pie">estimación meteorológica</div>
          </div>
        ) : (
          <DatoVacio titulo="3 · Humedad" falta="La fuente no devolvió el dato de esta hora." />
        )}

        {d.ahora?.lluvia24hMm != null ? (
          <div className="dato dato--niebla-profunda">
            <div className="dato__titulo">4 · Lluvia 24 h</div>
            <div className="dato__valor">
              {d.ahora.lluvia24hMm.toFixed(d.ahora.lluvia24hMm < 10 ? 1 : 0)}
              <small> mm</small>
            </div>
            <div className="dato__pie">acumulado del pronóstico</div>
          </div>
        ) : (
          <DatoVacio titulo="4 · Lluvia 24 h" falta="La fuente no devolvió precipitación." />
        )}

        {proxima ? (
          <div className="dato dato--olivo">
            <div className="dato__titulo">5 · Próxima ventana</div>
            <div className="dato__valor" style={{ fontFamily: "var(--display)", fontSize: 21 }}>
              {diaSemanaCorto(proxima.dia)}
              <small> {fechaCorta(proxima.dia).split(" ").slice(1).join(" ")}</small>
            </div>
            <div className="dato__pie">
              {pintaDeNivel(proxima.nivel).palabra} · revisar el cultivo
            </div>
          </div>
        ) : (
          <DatoVacio
            titulo="5 · Próxima ventana"
            falta={`Ningún día de los próximos ${Math.max(curva.length - 1, 0)} entra en banda de aviso.`}
          />
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <AvisoEstimacion />
        <Procedencia_ procedencia={d.procedencia} recibidoEn={resultado.recibidoEn} />
      </div>

      {/* --- Las 3 acciones ------------------------------------------ */}
      <div className="seccion">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22 }}>Para hoy</h2>
          <span style={{ fontSize: 11.5, color: "var(--tinta-tenue)" }}>
            {accionesHechas.length} de {ACCIONES.length} hechas
          </span>
        </div>
        <div className="lista">
          {ACCIONES.map((a) => {
            const hecha = accionesHechas.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className={`accion${hecha ? " accion--hecha" : ""}`}
                aria-pressed={hecha}
                onClick={() => alMarcarAccion(a.id)}
              >
                <span className="accion__marca" aria-hidden="true">
                  {hecha ? "✓" : ""}
                </span>
                <span className="accion__texto">
                  <span className="accion__titulo">{a.titulo}</span>
                  <br />
                  <span className="accion__pie">{a.pie}</span>
                </span>
                <span className="accion__cuando">{hecha ? "Hecho" : a.cuando}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Lo que el motor NO hace --------------------------------- */}
      <div className="tarjeta seccion">
        <div className="tarjeta__rotulo">Lo que este número no dice</div>
        <p style={{ fontSize: 12.5, color: "var(--tinta-suave)", marginTop: 8, marginBottom: 0 }}>
          {d.advertencia}
        </p>
      </div>

      {d.boletinesAnacafe?.documentos?.length > 0 && (
        <div className="tarjeta seccion">
          <div className="tarjeta__rotulo">Anacafé · boletines de roya</div>
          <div style={{ marginTop: 4 }}>
            {d.boletinesAnacafe.documentos.slice(0, 3).map((b) => (
              <a
                key={b.urlDocumento}
                className="boletin"
                href={b.urlDocumento}
                target="_blank"
                rel="noreferrer"
              >
                <span className="boletin__titulo">{b.titulo}</span>
                <span className="boletin__pie">
                  {b.periodo ?? "sin fecha"} · PDF en anacafe.org
                </span>
              </a>
            ))}
          </div>
          <p className="nota-procedencia">
            Documentos públicos de Anacafé · {d.boletinesAnacafe.origen}. No los alojamos ni
            los resumimos: el enlace va al PDF oficial.
          </p>
        </div>
      )}
    </div>
  );
}

function tramo(curva: DiaCurva[], desde: number, hasta: number) {
  const pico = picoDeTramo(curva, desde, hasta);
  return { nivel: pico?.nivel ?? null, indice: pico?.indice ?? null };
}

/**
 * Un titular que sale de los números, no de un modelo de lenguaje: el primer
 * día de la semana cuya lluvia pasa el óptimo de infección (5 mm/día).
 */
function tituloDeLluvia(curva: DiaCurva[]): string {
  const i = curva.slice(0, 7).findIndex((x) => x.lluviaMm >= 5);
  if (i < 0) return "Semana sin lluvia fuerte.";
  if (i === 0) return "Viene agua hoy.";
  return `Viene agua el ${diaSemana(curva[i].dia)}.`;
}
