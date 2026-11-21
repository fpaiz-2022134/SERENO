/**
 * Resultado — riesgo, ¿por qué? y costos orientativos.
 *
 * El «¿por qué?» no es una explicación generada: son las mismas condiciones
 * que el motor usó para disparar, leídas de la respuesta de la API y puestas
 * como renglones de cuaderno, cada uno con su número.
 *
 * Los costos van VACÍOS a propósito. No sabemos cuánto cuesta un jornal en su
 * municipio; un número puesto por nosotros sería inventado.
 */
"use client";

import { useMemo, useState } from "react";
import { AvisoSinConexion, Imprenta, Rotulo } from "@/componentes/Avisos";
import { Compartir, Guardar } from "@/componentes/Iconos";
import { diasEntre, pinta } from "@/lib/ui/paleta";
import { fechaCompleta, fechaCorta, fechaLarga } from "@/lib/ui/fechas";
import { agregarSeguimiento, guardarCostos, type Costos } from "@/lib/ui/almacen";
import { nombreDeVariedad, type Parcela } from "@/lib/ui/cuenta";
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
  const p = pinta(ventana?.nivel ?? d.curva[0]?.nivel);

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

  const texto = useMemo(() => {
    const extra =
      total != null ? `\n\nCosto orientativo que anoté: Q${total.toLocaleString("es-GT")}.` : "";
    return `${d.aviso.texto}${extra}\n\n— Sereno · ${d.procedencia.fuente}, consultado ${new Date(
      resultado.recibidoEn,
    ).toLocaleString("es-GT", { timeZone: "America/Guatemala" })}`;
  }, [d.aviso.texto, d.procedencia.fuente, resultado.recibidoEn, total]);

  async function compartir() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        /* el usuario canceló: caemos al enlace de WhatsApp */
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
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

  const plazo = ventana ? diasEntre(d.hoy, ventana.aplicarAntesDe) : null;

  return (
    <div className="pliego">
      <div className="saludo entra entra-1">
        <div className="saludo__fecha">
          {parcela.nombre} · café {nombreDeVariedad(parcela.variedadId).toLowerCase()} · {parcela.areaHa} ha
        </div>
        <h1 className="saludo__titulo">Resultado</h1>
      </div>

      <AvisoSinConexion
        origen={resultado.origen}
        recibidoEn={resultado.recibidoEn}
        motivo={resultado.motivoCaida}
      />

      {/* --- El veredicto --- */}
      <section className="veredicto entra entra-1">
        <div className="veredicto__plaga">Roya del café</div>
        <strong className="veredicto__palabra">{p.palabra}</strong>
        <div className="veredicto__pie">
          <div className="dial">
            <div className="dial__que">Índice</div>
            <div className="dial__val" style={{ color: p.color }}>
              {(ventana?.indiceMaximo ?? d.curva[0]?.indice ?? 0).toFixed(2)}
              <small> / 1</small>
            </div>
          </div>
          <div className="dial">
            <div className="dial__que">Banda del motor</div>
            <div style={{ marginTop: 6 }}>
              <span className="insignia">
                {p.corta} · {p.palabra}
              </span>
            </div>
          </div>
        </div>
      </section>

      {ventana ? (
        <>
          <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 16 }}>
            {ventana.inicio === ventana.fin ? (
              <>
                Ventana de riesgo: <b>{fechaCorta(ventana.inicio)}</b>.
              </>
            ) : (
              <>
                Ventana de riesgo del <b>{fechaCorta(ventana.inicio)}</b> al{" "}
                <b>{fechaCorta(ventana.fin)}</b>.
              </>
            )}{" "}
            Aplique antes del <b>{fechaCompleta(ventana.aplicarAntesDe)}</b>.
          </p>
          {/* El motor puede poner la fecha límite en el pasado si la ventana
              ya empezó. No se maquilla la fecha: se explica. */}
          {plazo != null && plazo <= 0 && (
            <div className="nota nota--alta" style={{ marginTop: 12 }}>
              <span className="nota__signo" aria-hidden="true">
                !
              </span>
              <span>
                <b>La ventana ya empezó.</b> La fecha límite que calcula el motor cayó antes
                de hoy, así que no hay días de anticipación que ganar: lo que queda es
                revisar el cultivo y hablar con su técnico hoy mismo.
              </span>
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 16, lineHeight: 1.4, marginTop: 16 }}>
          El pronóstico de {d.curva.length} días no junta condiciones de infección. No hace
          falta aplicar por este motivo.
        </p>
      )}

      {/* --- ¿Por qué? --- */}
      <section className="tarjeta seccion">
        <h2 style={{ fontSize: 30, marginBottom: 16 }}>¿Por qué?</h2>

        {pico && (
          <>
            <Renglon
              que="Hoja mojada"
              valor={`${pico.horasMojadas} h`}
              de={pico.horasRequeridas != null ? `el modelo pide ${Math.round(pico.horasRequeridas)} h` : "sin umbral calculable"}
              lleno={pico.horasRequeridas ? Math.min(1, pico.horasMojadas / pico.horasRequeridas) : 0}
              color={p.color}
            />
            <Renglon
              que="Temperatura de la racha"
              valor={pico.temperaturaMedia != null ? `${pico.temperaturaMedia.toFixed(1)} °C` : "—"}
              de="rango de infección 15 – 28 °C, óptimo 22"
              lleno={
                pico.temperaturaMedia != null
                  ? Math.max(0, Math.min(1, (pico.temperaturaMedia - 15) / 13))
                  : 0
              }
              color={p.color}
            />
            <Renglon
              que="Lluvia de ese día"
              valor={`${pico.lluviaMm.toFixed(1)} mm`}
              de={
                pico.lavadoPorLluvia
                  ? "pasa de 10 mm: lava la espora, el índice ya va castigado"
                  : pico.lluviaMm >= 5
                    ? "arriba de 5 mm: es el óptimo de infección"
                    : "por debajo del umbral de lavado"
              }
              lleno={Math.min(1, pico.lluviaMm / 20)}
              color={p.color}
            />
          </>
        )}

        {d.cobertura.diasDesdeUltimaAplicacion != null && (
          <Renglon
            que="Desde la última aplicación"
            valor={`${d.cobertura.diasDesdeUltimaAplicacion} días`}
            de={
              d.cobertura.ultimoEventoCubierto === true
                ? "el último evento quedó cubierto"
                : d.cobertura.ultimoEventoCubierto === false
                  ? "el último evento NO quedó cubierto"
                  : "sin evento que comparar"
            }
            lleno={0}
            color={p.color}
          />
        )}

        <div className="nota" style={{ marginTop: 16 }}>
          <span className="nota__signo" aria-hidden="true">
            ▦
          </span>
          <span>
            Esto lo decide <b>aritmética</b>, no un modelo de lenguaje: umbrales de Magarey
            et al. (2005) sobre el pronóstico horario.{" "}
            {d.aviso.soporte.eventosConfirmados} evento
            {d.aviso.soporte.eventosConfirmados === 1 ? "" : "s"} de infección confirmado
            {d.aviso.soporte.eventosConfirmados === 1 ? "" : "s"}.
          </span>
        </div>

        <Imprenta procedencia={d.procedencia} recibidoEn={resultado.recibidoEn} />
      </section>

      {/* --- Cuándo se verían las manchas --- */}
      {d.sintomasSiHoyHayInfeccion && (
        <section className="tarjeta seccion">
          <Rotulo>Cuándo se verían las manchas</Rotulo>
          <p style={{ fontSize: 15.5, lineHeight: 1.4, margin: 0 }}>
            Entre el <b>{fechaLarga(d.sintomasSiHoyHayInfeccion.desde)}</b> y el{" "}
            <b>{fechaLarga(d.sintomasSiHoyHayInfeccion.hasta)}</b>. Cuando las vea, la
            infección ya ocurrió hace {d.incubacionDias[0]} a {d.incubacionDias[1]} días.
          </p>
        </section>
      )}

      {/* --- Costos --- */}
      <section className="tarjeta seccion">
        <Rotulo>Costos orientativos · GTQ</Rotulo>
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

        <div className="total">
          <span style={{ fontSize: 14.5, color: "var(--tinta-2)" }}>Total orientativo</span>
          <b>{total == null ? "Q —" : `Q${total.toLocaleString("es-GT")}`}</b>
        </div>

        <p className="imprenta">
          Los montos los pone usted: no sabemos cuánto vale el jornal en su municipio y no
          vamos a inventarlo. <b>No es una recomendación automática</b> de aplicar fungicida
          ni plaguicida. Consulte a su técnico.
        </p>
      </section>

      <div className="par">
        <button type="button" className="boton boton--nube" onClick={guardar}>
          <Guardar tam={18} />
          {guardado ? "Guardado" : "Guardar"}
        </button>
        <button type="button" className="boton boton--riesgo" onClick={compartir}>
          <Compartir tam={18} />
          WhatsApp
        </button>
      </div>

      <details className="tarjeta seccion">
        <summary style={{ fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
          Ver el mensaje que se va a enviar
        </summary>
        <p
          style={{
            fontSize: 13.5,
            whiteSpace: "pre-wrap",
            color: "var(--tinta-2)",
            margin: "12px 0 0",
            lineHeight: 1.45,
          }}
        >
          {texto}
        </p>
      </details>

      <button type="button" className="boton boton--musgo" style={{ marginTop: 14 }} onClick={alVolver}>
        Volver a Hoy
      </button>
    </div>
  );
}

/** Un renglón del «¿por qué?»: el número, contra qué se compara, y su barra. */
function Renglon({
  que,
  valor,
  de,
  lleno,
  color,
}: {
  que: string;
  valor: string;
  de: string;
  lleno: number;
  color: string;
}) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--hilo)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--tinta-2)",
          }}
        >
          {que}
        </span>
        <b
          style={{
            fontFamily: "var(--serif)",
            fontVariationSettings: '"SOFT" 70, "opsz" 32',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {valor}
        </b>
      </div>
      {lleno > 0 && (
        <span
          style={{
            display: "block",
            height: 8,
            background: "var(--musgo)",
            borderRadius: 999,
            margin: "9px 0 7px",
            position: "relative",
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          <span
            className="renglon__lleno"
            style={{ width: `${Math.round(lleno * 100)}%`, background: color }}
          />
        </span>
      )}
      <span style={{ fontSize: 13, color: "var(--tinta-2)" }}>{de}</span>
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
    <div className="costo">
      <div className="costo__texto">
        <div className="costo__nombre">{nombre}</div>
        <div className="costo__base">{base}</div>
      </div>
      <label className="costo__campo">
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
