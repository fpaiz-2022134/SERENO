/**
 * Alertas — la curva entera, día por día, y lo que ya quedó guardado.
 *
 * No hay notificaciones push en esta versión y la pantalla lo dice: el canal
 * real del producto es WhatsApp, y ese mensaje sale desde «Resultado».
 */
"use client";

import { AvisoSinConexion, Rotulo, Vacio } from "@/componentes/Avisos";
import { pinta } from "@/lib/ui/paleta";
import { fechaCorta, marcaDeTiempo } from "@/lib/ui/fechas";
import { leerSeguimientos } from "@/lib/ui/almacen";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";
import type { Resultado } from "@/lib/ui/red";

export function Alertas({ resultado }: { resultado: Resultado<RespuestaPrevencion> | null }) {
  const seguimientos = leerSeguimientos();

  return (
    <div className="pliego">
      <div className="saludo entra entra-1">
        <div className="saludo__fecha">
          {resultado ? `${resultado.datos.curva.length} días de pronóstico` : "Sin reporte"}
        </div>
        <h1 className="saludo__titulo">Día por día</h1>
      </div>

      {resultado ? (
        <>
          <AvisoSinConexion
            origen={resultado.origen}
            recibidoEn={resultado.recibidoEn}
            motivo={resultado.motivoCaida}
          />

          <section className="tarjeta seccion entra entra-2">
            {resultado.datos.curva.map((x, i) => {
              const p = pinta(x.nivel);
              return (
                <div key={x.dia} className="renglon">
                  <span className="renglon__dia">{fechaCorta(x.dia)}</span>
                  <span className="renglon__riel" aria-hidden="true">
                    <span
                      className="renglon__lleno"
                      style={{
                        width: `${Math.round(x.indice * 100)}%`,
                        background: p.color,
                        animationDelay: `${Math.min(i * 28, 420)}ms`,
                      }}
                    />
                  </span>
                  <span className="renglon__ind">{x.indice.toFixed(2)}</span>
                  <span className="renglon__pal" style={{ color: p.color }}>
                    {p.palabra}
                  </span>
                </div>
              );
            })}
            <p className="imprenta">
              Cada barra es el índice del motor para ese día, con su palabra al lado. Un día
              con <b>lavado por lluvia</b> ya viene castigado en el número.
            </p>
          </section>
        </>
      ) : (
        <Vacio
          que="Curva de riesgo"
          falta="Falta configurar la parcela o conseguir el pronóstico."
        />
      )}

      <section className="tarjeta seccion">
        <Rotulo>Seguimientos guardados</Rotulo>
        {seguimientos.length === 0 ? (
          <p style={{ fontSize: 14, color: "var(--tinta-2)", margin: 0 }}>
            Todavía no ha guardado ninguno. Se guardan desde «Resultado».
          </p>
        ) : (
          seguimientos.map((s) => {
            const p = pinta(s.nivel);
            return (
              <div key={s.guardadoEn} className="enlace">
                <span className="enlace__titulo">
                  {s.parcela} ·{" "}
                  <span style={{ color: p.color }}>
                    {p.corta} · {p.palabra}
                  </span>
                </span>
                <span className="enlace__pie">
                  {marcaDeTiempo(s.guardadoEn)}
                  {s.ventana
                    ? ` · ventana ${fechaCorta(s.ventana.inicio)} – ${fechaCorta(s.ventana.fin)}`
                    : " · sin ventana"}
                  {s.costoTotalQ != null ? ` · Q${s.costoTotalQ.toLocaleString("es-GT")}` : ""}
                </span>
              </div>
            );
          })
        )}
      </section>

      <div className="nota" style={{ marginTop: 18 }}>
        <span className="nota__signo" aria-hidden="true">
          ◈
        </span>
        <span>
          <b>Esta versión no manda notificaciones.</b> El canal del aviso es WhatsApp y el
          mensaje se envía desde «Resultado», con el texto que ya redactó el motor.
        </span>
      </div>
    </div>
  );
}
