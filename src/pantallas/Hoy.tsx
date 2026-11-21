/**
 * Hoy en mi finca.
 *
 * El orden es el de la decisión, no el del clima:
 *
 *   1. EL VEREDICTO    el medidor de bandas, la palabra y los días para aplicar
 *   2. LA CURVA        los 16 días con los umbrales del motor rotulados
 *   3. LA BALANZA      horas de hoja mojada contra las que pide el modelo
 *   4. LA INCUBACIÓN   con la foto de la mancha: cuando se ve, ya pasó
 *   5. LAS LABORES     qué hacer hoy
 *   6. EL CLIMA        temperatura, humedad y lluvia
 *
 * NOTA DE DISEÑO (tensión declarada): SERENO-investigacion.md §0A sostiene que
 * temperatura, humedad y lluvia crudas NO deberían ir en el panel porque «son
 * insumos, no decisiones». El branding sí las pide. Van, pero de últimas.
 */
"use client";

import { useMemo, useState } from "react";
import { Balanza, Grafica } from "@/componentes/Grafica";
import { Medidor } from "@/componentes/Medidor";
import { Cabecera, FOTOS, Referencia } from "@/componentes/Fotos";
import { AvisoEstimacion, AvisoSinConexion, Imprenta, Rotulo, Vacio } from "@/componentes/Avisos";
import { Flecha, Gota, Hoja, Regla } from "@/componentes/Iconos";
import { diasEntre, pinta } from "@/lib/ui/paleta";
import { fechaCorta, fechaDeHoy } from "@/lib/ui/fechas";
import type { Parcela } from "@/lib/ui/cuenta";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado } from "@/lib/ui/red";

const LABORES = [
  { id: "revisar", titulo: "Revisar el envés de las hojas", pie: "Roya, antes de la ventana", cuando: "Hoy" },
  { id: "preparar", titulo: "Preparar la prevención", pie: "Plan de manejo con su técnico", cuando: "Esta semana" },
  { id: "anotar", titulo: "Anotar lo que hizo", pie: "Inspección o aplicación", cuando: "Al terminar" },
];

export function Hoy({
  nombre,
  parcela,
  resultado,
  laboresHechas,
  alMarcarLabor,
  alVerResultado,
  alIrAParcela,
}: {
  nombre: string;
  parcela: Parcela;
  resultado: Resultado<RespuestaPrevencion>;
  laboresHechas: string[];
  alMarcarLabor: (id: string) => void;
  alVerResultado: () => void;
  alIrAParcela: () => void;
}) {
  const d = resultado.datos;
  const curva = d.curva ?? [];
  const ventana = d.ventanaDeAccion;
  // El esquema de parcelas es de cafe (variedades de cafe, roya) y el motor
  // tambien. Mientras no haya umbrales verificados de otro cultivo, no hay
  // parcela que pueda estar en otro cultivo.
  const conMotor = true;

  const [diaElegido, setDiaElegido] = useState(d.hoy);
  const dia = useMemo(
    () => curva.find((x) => x.dia === diaElegido) ?? curva[0] ?? null,
    [curva, diaElegido],
  );

  const indice = ventana?.indiceMaximo ?? curva[0]?.indice ?? 0;
  const p = pinta(ventana?.nivel ?? curva[0]?.nivel);
  const pDia = pinta(dia?.nivel);

  /** Días que faltan para la fecha límite. ≤ 0 = la ventana ya empezó. */
  const plazo = ventana ? diasEntre(d.hoy, ventana.aplicarAntesDe) : null;

  return (
    <>
      <Cabecera
        foto={FOTOS.cafetal}
        encima={<>{fechaDeHoy(d.hoy)}</>}
        titulo={`Buenos días, ${nombre}.`}
      >
        <div className="pastillas" style={{ marginTop: 10 }}>
          <span className="pastilla pastilla--clara">{parcela.nombre}</span>
          <span className="pastilla pastilla--clara">{parcela.areaHa} ha</span>
          {parcela.altitudMetros != null && (
            <span className="pastilla pastilla--clara">
              {Math.round(parcela.altitudMetros)} m
            </span>
          )}
        </div>
      </Cabecera>

      <div className="pliego">
        <AvisoSinConexion
          origen={resultado.origen}
          recibidoEn={resultado.recibidoEn}
          motivo={resultado.motivoCaida}
        />

        {/* ---------- 1 · EL VEREDICTO ---------- */}
        {conMotor ? (
          <>
            <section className="veredicto entra entra-1">
              <div className="veredicto__plaga">Roya del café</div>
              <Medidor indice={indice} nivel={ventana?.nivel ?? curva[0]?.nivel ?? null} />

              <strong className="veredicto__palabra" style={{ textAlign: "center" }}>
                {p.palabra}
              </strong>

              <p className="veredicto__frase" style={{ textAlign: "center" }}>
                {ventana ? (
                  ventana.inicio === ventana.fin ? (
                    <>
                      Las condiciones de infección se juntan el{" "}
                      <b>{fechaCorta(ventana.inicio)}</b>.
                    </>
                  ) : (
                    <>
                      Las condiciones se juntan del <b>{fechaCorta(ventana.inicio)}</b> al{" "}
                      <b>{fechaCorta(ventana.fin)}</b>.
                    </>
                  )
                ) : (
                  <>El pronóstico de {curva.length} días no junta condiciones de infección.</>
                )}
              </p>

              {plazo != null && (
                <div className="veredicto__pie">
                  <div className="dial">
                    <div className="dial__que">Aplicar antes del</div>
                    <div
                      className="dial__val"
                      style={{ fontFamily: "var(--sans)", fontSize: 17, letterSpacing: 0 }}
                    >
                      {fechaCorta(ventana!.aplicarAntesDe)}
                    </div>
                  </div>
                  <div className="dial">
                    <div className="dial__que">{plazo > 0 ? "Le quedan" : "Estado"}</div>
                    <div className="dial__val" style={{ color: p.color }}>
                      {plazo > 0 ? (
                        <>
                          {plazo}
                          <small> {plazo === 1 ? "día" : "días"}</small>
                        </>
                      ) : (
                        <span style={{ fontFamily: "var(--sans)", fontSize: 17, letterSpacing: 0 }}>
                          ya empezó
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <button
              type="button"
              className="boton boton--riesgo entra entra-2"
              style={{ marginTop: 14 }}
              onClick={alVerResultado}
            >
              Ver por qué y los costos
              <Flecha tam={18} />
            </button>

            {/* ---------- 2 · LA CURVA ---------- */}
            <section className="tarjeta seccion entra entra-3">
              <Rotulo>Los próximos {curva.length} días</Rotulo>
              <Grafica
                curva={curva}
                hoy={d.hoy}
                ventana={ventana}
                elegido={diaElegido}
                alElegir={setDiaElegido}
              />

              {dia && (
                <>
                  <div className="lectura">
                    <div className="lectura__celda">
                      <span className="lectura__que">Índice</span>
                      <span className="lectura__val" style={{ color: pDia.color }}>
                        {dia.indice.toFixed(2)}
                        <small> / 1</small>
                      </span>
                    </div>
                    <div className="lectura__celda">
                      <span className="lectura__que">Mojado</span>
                      <span className="lectura__val">
                        {dia.horasMojadas}
                        <small> h</small>
                      </span>
                    </div>
                    <div className="lectura__celda">
                      <span className="lectura__que">Lluvia</span>
                      <span className="lectura__val">
                        {dia.lluviaMm.toFixed(dia.lluviaMm < 10 ? 1 : 0)}
                        <small> mm</small>
                      </span>
                    </div>
                  </div>

                  <p className="explica">
                    {dia.dia === d.hoy ? "Hoy" : fechaCorta(dia.dia)} el índice llega a{" "}
                    <b>{dia.indice.toFixed(2)}</b>, que es banda <b>{pDia.palabra}</b>.{" "}
                    {dia.hayEvento
                      ? "Ese día se cierra un evento de infección: las horas de hoja mojada alcanzaron lo que pide el modelo."
                      : dia.lavadoPorLluvia
                        ? "Llovió más de 10 mm, así que la lluvia lava la espora al suelo y el índice ya va castigado."
                        : "No se cierra ningún evento ese día."}
                  </p>
                </>
              )}
            </section>

            {/* ---------- 3 · LA BALANZA ---------- */}
            {dia && (
              <section className="tarjeta seccion">
                <Rotulo>Por qué ese índice</Rotulo>
                <Balanza
                  horas={dia.horasMojadas}
                  requeridas={dia.horasRequeridas}
                  temperatura={dia.temperaturaMedia}
                  color={pDia.color}
                />
              </section>
            )}

            {/* ---------- 4 · LA INCUBACIÓN ---------- */}
            {d.sintomasSiHoyHayInfeccion && (
              <section className="tarjeta seccion">
                <Rotulo>Si hoy se infecta</Rotulo>

                <div className="incuba__via" aria-hidden="true">
                  <span className="incuba__hito" style={{ left: "0%" }} />
                  <span className="incuba__hito incuba__hito--fin" style={{ left: "100%" }} />
                  <span className="incuba__viaje" />
                </div>

                <div className="incuba__pie">
                  <span>
                    Hoy
                    <b>{fechaCorta(d.hoy)}</b>
                  </span>
                  <span>
                    {diasEntre(d.hoy, d.sintomasSiHoyHayInfeccion.desde)} días después
                    <b>
                      {fechaCorta(d.sintomasSiHoyHayInfeccion.desde)} –{" "}
                      {fechaCorta(d.sintomasSiHoyHayInfeccion.hasta)}
                    </b>
                  </span>
                </div>

                <Referencia foto={FOTOS.roya}>
                  Hasta entonces no se ve nada. Lo que aparece son estas pústulas
                  anaranjadas en el <b>envés</b> de la hoja — y para ese momento la
                  infección ya tiene{" "}
                  {diasEntre(d.hoy, d.sintomasSiHoyHayInfeccion.desde)} días. Aplicar ahí es
                  dinero tirado.
                </Referencia>
              </section>
            )}
          </>
        ) : (
          <section className="seccion">
            <Vacio
              que="Riesgo de plaga"
              falta="El motor solo tiene umbrales verificados para roya del café. Para este cultivo no hay umbrales en fuente primaria y no vamos a inventarlos."
            />
            <button
              type="button"
              className="boton boton--nube"
              style={{ marginTop: 14 }}
              onClick={alIrAParcela}
            >
              Cambiar el cultivo de la parcela
            </button>
          </section>
        )}

        {/* ---------- 5 · LAS LABORES ---------- */}
        <section className="seccion">
          <Rotulo>
            Para hoy{" "}
            <span className="rotulo__n">
              {laboresHechas.length} de {LABORES.length}
            </span>
          </Rotulo>
          {LABORES.map((l) => {
            const hecha = laboresHechas.includes(l.id);
            return (
              <button
                key={l.id}
                type="button"
                className="labor"
                aria-pressed={hecha}
                onClick={() => alMarcarLabor(l.id)}
              >
                <span className="labor__caja" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="m2.6 7.4 2.8 2.8 6-6.4" />
                  </svg>
                </span>
                <span className="labor__texto">
                  <span className="labor__titulo">{l.titulo}</span>
                  <span className="labor__pie">{l.pie}</span>
                </span>
                <span className="labor__cuando">{hecha ? "Hecho" : l.cuando}</span>
              </button>
            );
          })}
        </section>

        {/* ---------- 6 · EL CLIMA ---------- */}
        <section className="seccion">
          <Rotulo>El clima de esta hora</Rotulo>
          <div className="datos">
            <Datito
              icono={<Regla tam={15} />}
              que="Temperatura"
              valor={d.ahora?.temperaturaC != null ? Math.round(d.ahora.temperaturaC) : null}
              unidad="°C"
            />
            <Datito
              icono={<Hoja tam={15} />}
              que="Humedad"
              valor={d.ahora?.humedadPct != null ? Math.round(d.ahora.humedadPct) : null}
              unidad="%"
            />
            <Datito
              icono={<Gota tam={15} trazo={1.6} />}
              que="Lluvia 24 h"
              valor={
                d.ahora?.lluvia24hMm != null
                  ? Number(d.ahora.lluvia24hMm.toFixed(d.ahora.lluvia24hMm < 10 ? 1 : 0))
                  : null
              }
              unidad="mm"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <AvisoEstimacion />
          </div>
          <Imprenta procedencia={d.procedencia} recibidoEn={resultado.recibidoEn} />
        </section>

        {/* ---------- Lo que el motor NO dice ---------- */}
        <section className="seccion">
          <div className="nota">
            <span className="nota__signo" aria-hidden="true">
              ◈
            </span>
            <span>{d.advertencia}</span>
          </div>
        </section>

        {d.boletinesAnacafe?.documentos?.length > 0 && (
          <section className="tarjeta seccion">
            <Rotulo>Anacafé · boletines de roya</Rotulo>
            {d.boletinesAnacafe.documentos.slice(0, 3).map((b) => (
              <a
                key={b.urlDocumento}
                className="enlace"
                href={b.urlDocumento}
                target="_blank"
                rel="noreferrer"
              >
                <span className="enlace__titulo">{b.titulo}</span>
                <span className="enlace__pie">{b.periodo ?? "sin fecha"} · PDF en anacafe.org</span>
              </a>
            ))}
            <p className="imprenta">
              Documentos públicos de Anacafé · {d.boletinesAnacafe.origen}. No los alojamos ni
              los resumimos: el enlace va al PDF oficial.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

/** Tarjetita de dato: icono, nombre y número grande. Vacía dice qué falta. */
function Datito({
  icono,
  que,
  valor,
  unidad,
}: {
  icono: React.ReactNode;
  que: string;
  valor: number | null;
  unidad: string;
}) {
  return (
    <div className="datito">
      <div className="datito__cabeza">
        <span style={{ color: "var(--hoja-clara)" }} aria-hidden="true">
          {icono}
        </span>
        {que}
      </div>
      {valor != null ? (
        <div className="datito__valor">
          {valor}
          <small> {unidad}</small>
        </div>
      ) : (
        <div className="datito__valor datito__valor--vacio">No disponible</div>
      )}
    </div>
  );
}
