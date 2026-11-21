/**
 * Pantalla 6 · Resultado — riesgo, ¿por qué? y costos orientativos.
 *
 * El «¿por qué?» no es una explicación generada: son las mismas condiciones
 * que el motor usó para disparar, leídas de la respuesta de la API.
 *
 * Los costos van VACÍOS. El branding los dibuja como `Q[___]` y eso es
 * deliberado: no sabemos cuánto cuesta un jornal en su municipio, así que lo
 * escribe usted. Un número puesto por nosotros sería inventado.
 */
"use client";

import { useMemo, useState } from "react";
import { AvisoSinConexion, Procedencia_ } from "@/componentes/Avisos";
import { pintaDeNivel } from "@/lib/ui/riesgo";
import { fechaCompleta, fechaCorta, fechaLarga } from "@/lib/ui/fechas";
import { agregarSeguimiento, guardarCostos, type Costos, type Parcela } from "@/lib/ui/almacen";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado as ResultadoRed } from "@/lib/ui/red";

export function Resultado({
  parcela,
  resultado,
  costosGuardados,
  alVolver,
}: {
  parcela: Parcela;
  resultado: ResultadoRed<RespuestaPrevencion>;
  costosGuardados: Costos | null;
  alVolver: () => void;
}) {
  const d = resultado.datos;
  const ventana = d.ventanaDeAccion;
  const pinta = pintaDeNivel(ventana?.nivel ?? d.curva[0]?.nivel);

  const [costos, setCostos] = useState<Costos>(
    costosGuardados ?? { inspeccionQ: null, prevencionQ: null },
  );
  const [guardado, setGuardado] = useState(false);

  /** El día que manda dentro de la ventana: el de mayor índice. */
  const pico = useMemo(() => {
    const dentro = ventana
      ? d.curva.filter((x) => x.dia >= ventana.inicio && x.dia <= ventana.fin)
      : d.curva;
    return dentro.length ? dentro.reduce((a, b) => (b.indice > a.indice ? b : a)) : null;
  }, [d.curva, ventana]);

  const total =
    costos.inspeccionQ == null && costos.prevencionQ == null
      ? null
      : (costos.inspeccionQ ?? 0) + (costos.prevencionQ ?? 0);

  const textoWhatsApp = useMemo(() => {
    const extra =
      total != null ? `\n\nCosto orientativo que anoté: Q${total.toLocaleString("es-GT")}.` : "";
    return `${d.aviso.texto}${extra}\n\n— Sereno · ${d.procedencia.fuente}, consultado ${new Date(
      resultado.recibidoEn,
    ).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}`;
  }, [d.aviso.texto, d.procedencia.fuente, resultado.recibidoEn, total]);

  async function compartir() {
    const datos = { text: textoWhatsApp };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(datos);
        return;
      } catch {
        /* el usuario canceló: caemos al enlace de WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`, "_blank", "noopener");
  }

  function guardar() {
    guardarCostos(costos);
    agregarSeguimiento({
      guardadoEn: new Date().toISOString(),
      parcela: parcela.nombre,
      nivel: ventana?.nivel ?? d.curva[0]?.nivel ?? "poco_favorable",
      ventana: ventana
        ? { inicio: ventana.inicio, fin: ventana.fin, aplicarAntesDe: ventana.aplicarAntesDe }
        : null,
      costoTotalQ: total,
      texto: d.aviso.texto,
    });
    setGuardado(true);
  }

  return (
    <div className="pantalla">
      <div style={{ padding: "2px 0 10px" }}>
        <h1 style={{ fontSize: 27, color: "var(--niebla-profunda)" }}>Resultado</h1>
        <p style={{ fontSize: 13, color: "var(--tinta-suave)", marginTop: 2 }}>
          {parcela.nombre} · {parcela.lugar || "sin lugar"} · café{" "}
          {parcela.variedad.toLowerCase()} · {parcela.areaHa} ha
        </p>
      </div>

      <AvisoSinConexion
        origen={resultado.origen}
        recibidoEn={resultado.recibidoEn}
        motivo={resultado.motivoCaida}
      />

      {/* --- El riesgo ------------------------------------------------ */}
      <div className="tarjeta">
        <div className="tarjeta__rotulo">Riesgo de infección de roya</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
          <span className={pinta.claseInsignia} style={{ marginTop: 0 }}>
            {pinta.corta} · {pinta.palabra}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 15, color: "var(--tinta-suave)" }}>
            índice {(ventana?.indiceMaximo ?? d.curva[0]?.indice ?? 0).toFixed(2)} de 1
          </span>
        </div>
        {ventana ? (
          <>
            <p style={{ fontSize: 14.5, marginTop: 10, marginBottom: 0 }}>
              Ventana de riesgo del <b>{fechaCorta(ventana.inicio)}</b> al{" "}
              <b>{fechaCorta(ventana.fin)}</b>. Aplique antes del{" "}
              <b>{fechaCompleta(ventana.aplicarAntesDe)}</b>.
            </p>
            {/* El motor puede poner la fecha límite en el pasado si la ventana
                ya empezó. No se maquilla la fecha: se explica. */}
            {ventana.aplicarAntesDe < d.hoy && (
              <div className="aviso aviso--cedro" style={{ marginTop: 10 }}>
                <span aria-hidden="true">!</span>
                <span>
                  <b>La ventana ya empezó.</b> La fecha límite que calcula el motor cayó antes
                  de hoy, así que no hay días de anticipación que ganar: lo que queda es
                  revisar el cultivo y hablar con su técnico hoy mismo.
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 14.5, marginTop: 10, marginBottom: 0 }}>
            El pronóstico de {d.curva.length} días no junta condiciones de infección. No hace
            falta aplicar por este motivo.
          </p>
        )}
      </div>

      {/* --- ¿Por qué? ------------------------------------------------ */}
      <div className="tarjeta seccion">
        <h2 style={{ fontSize: 22 }}>¿Por qué?</h2>
        <div className="porque">
          {pico && (
            <>
              <div className="porque__linea">
                <span aria-hidden="true">◍</span>
                <span>
                  Hoja mojada:{" "}
                  <b className="porque__num">{pico.horasMojadas} h</b> seguidas y el modelo pide{" "}
                  <b className="porque__num">
                    {pico.horasRequeridas != null ? `${Math.round(pico.horasRequeridas)} h` : "—"}
                  </b>{" "}
                  a esa temperatura.
                </span>
              </div>
              <div className="porque__linea">
                <span aria-hidden="true">◐</span>
                <span>
                  Temperatura media de la racha:{" "}
                  <b className="porque__num">
                    {pico.temperaturaMedia != null ? `${pico.temperaturaMedia.toFixed(1)} °C` : "—"}
                  </b>
                  , dentro del rango de infección (15 – 28 °C, óptimo 22).
                </span>
              </div>
              <div className="porque__linea">
                <span aria-hidden="true">◇</span>
                <span>
                  Lluvia de ese día: <b className="porque__num">{pico.lluviaMm.toFixed(1)} mm</b>.
                  {pico.lavadoPorLluvia
                    ? " Pasa de 10 mm: la lluvia lava la espora al suelo y el índice ya va castigado."
                    : pico.lluviaMm >= 5
                      ? " Arriba de 5 mm: es el óptimo de infección."
                      : " Por debajo del umbral de lavado."}
                </span>
              </div>
            </>
          )}
          <div className="porque__linea">
            <span aria-hidden="true">◷</span>
            <span>
              Si hoy hay infección, las manchas{" "}
              {d.sintomasSiHoyHayInfeccion ? (
                <>
                  se verían entre el{" "}
                  <b className="porque__num">
                    {fechaLarga(d.sintomasSiHoyHayInfeccion.desde)}
                  </b>{" "}
                  y el{" "}
                  <b className="porque__num">{fechaLarga(d.sintomasSiHoyHayInfeccion.hasta)}</b>
                </>
              ) : (
                <>tardarían {d.incubacionDias[0]} a {d.incubacionDias[1]} días en verse</>
              )}
              . Cuando las vea, la infección ya ocurrió.
            </span>
          </div>
          {d.cobertura.diasDesdeUltimaAplicacion != null && (
            <div className="porque__linea">
              <span aria-hidden="true">◎</span>
              <span>
                Hace <b className="porque__num">{d.cobertura.diasDesdeUltimaAplicacion} días</b> de
                la última aplicación.{" "}
                {d.cobertura.ultimoEventoCubierto === true
                  ? "El último evento quedó cubierto."
                  : d.cobertura.ultimoEventoCubierto === false
                    ? "El último evento NO quedó cubierto."
                    : ""}
              </span>
            </div>
          )}
        </div>

        <div className="aviso aviso--niebla" style={{ marginTop: 12 }}>
          <span aria-hidden="true">▤</span>
          <span>
            Esto lo decide <b>aritmética</b>, no un modelo de lenguaje: umbrales de Magarey
            et al. (2005) sobre el pronóstico horario. {d.aviso.soporte.eventosConfirmados} evento
            {d.aviso.soporte.eventosConfirmados === 1 ? "" : "s"} de infección confirmado
            {d.aviso.soporte.eventosConfirmados === 1 ? "" : "s"} en el pronóstico.
          </span>
        </div>

        <Procedencia_ procedencia={d.procedencia} recibidoEn={resultado.recibidoEn} />
      </div>

      {/* --- Costos --------------------------------------------------- */}
      <div className="tarjeta seccion">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22 }}>Costos sugeridos</h2>
          <span style={{ fontSize: 11, color: "var(--tinta-tenue)" }}>GTQ · toque para editar</span>
        </div>

        <div style={{ marginTop: 6 }}>
          <LineaCosto
            nombre="Inspección"
            base={`${parcela.areaHa} ha · 1 jornal/ha`}
            valor={costos.inspeccionQ}
            alCambiar={(v) => {
              setCostos({ ...costos, inspeccionQ: v });
              setGuardado(false);
            }}
          />
          <LineaCosto
            nombre="Prevención"
            base="3 meses · 2 jornales"
            valor={costos.prevencionQ}
            alCambiar={(v) => {
              setCostos({ ...costos, prevencionQ: v });
              setGuardado(false);
            }}
          />
        </div>

        <div className="costos__total">
          <span style={{ fontSize: 13, color: "var(--tinta-suave)" }}>Total orientativo</span>
          <b>{total == null ? "Q —" : `Q${total.toLocaleString("es-GT")}`}</b>
        </div>

        <p className="nota-procedencia">
          Los montos los pone usted: no sabemos cuánto vale el jornal en su municipio y no
          vamos a inventarlo. <b>No es una recomendación automática</b> de aplicar fungicida ni
          plaguicida. Consulte a su técnico.
        </p>
      </div>

      {/* --- Acciones -------------------------------------------------- */}
      <div className="botones-par seccion">
        <button type="button" className="boton boton--oscuro" onClick={guardar}>
          {guardado ? "✓ Guardado" : "Guardar"}
        </button>
        <button type="button" className="boton boton--whatsapp" onClick={compartir}>
          ⇗ WhatsApp
        </button>
      </div>

      <details className="tarjeta seccion">
        <summary style={{ fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Ver el mensaje que se va a enviar
        </summary>
        <p
          style={{
            fontSize: 13,
            whiteSpace: "pre-wrap",
            color: "var(--tinta-suave)",
            marginBottom: 0,
          }}
        >
          {textoWhatsApp}
        </p>
      </details>

      <button type="button" className="boton boton--contorno seccion" onClick={alVolver}>
        Volver a Hoy
      </button>
    </div>
  );
}

function LineaCosto({
  nombre,
  base,
  valor,
  alCambiar,
}: {
  nombre: string;
  base: string;
  valor: number | null;
  alCambiar: (v: number | null) => void;
}) {
  return (
    <div className="costos__linea">
      <div className="costos__texto">
        <div className="costos__nombre">{nombre}</div>
        <div className="costos__base">{base}</div>
      </div>
      <label className="costos__campo">
        <span aria-hidden="true">Q</span>
        <input
          inputMode="numeric"
          placeholder="—"
          aria-label={`Costo de ${nombre} en quetzales`}
          value={valor ?? ""}
          onChange={(e) => {
            const n = e.target.value.replace(/[^\d]/g, "");
            alCambiar(n === "" ? null : Number(n));
          }}
        />
      </label>
    </div>
  );
}
