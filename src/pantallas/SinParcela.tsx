/**
 * Sin parcela — la hoja en blanco del almanaque.
 *
 * Las tarjetas dicen «No disponible» y QUÉ FALTA. Nunca ceros: sin coordenada
 * no hay serie meteorológica, y sin serie no hay número que enseñar.
 */
"use client";

import { Cabecera, FOTOS } from "@/componentes/Fotos";
import { Rotulo, Vacio } from "@/componentes/Avisos";

export function SinParcela({ nombre, alConfigurar }: { nombre: string; alConfigurar: () => void }) {
  return (
    <>
      <Cabecera foto={FOTOS.cafetal} titulo={`Bienvenida, ${nombre}.`} />

      <div className="pliego">
        <section className="tarjeta entra entra-1" style={{ position: "relative", zIndex: 2 }}>
          <p style={{ fontSize: 16, margin: "0 0 16px", color: "var(--hoja-honda)" }}>
            Ubiquemos su parcela para calcular el clima y el riesgo de su cultivo.
          </p>
          <button type="button" className="boton" onClick={alConfigurar}>
            Configurar mi parcela
          </button>
        </section>

      <section className="seccion">
        <Rotulo>Lo que todavía no podemos decirle</Rotulo>
        <div style={{ display: "grid", gap: 10 }}>
          <Vacio que="Riesgo de plaga" falta="Falta ubicar la parcela." />
          <Vacio que="Ventana de aplicación" falta="Falta ubicar la parcela." />
          <Vacio que="Clima de la finca" falta="Falta ubicar la parcela." />
        </div>
      </section>

      <div className="nota" style={{ marginTop: 18 }}>
        <span className="nota__signo" aria-hidden="true">
          ◈
        </span>
        <span>
          Sin coordenada no hay pronóstico, y sin pronóstico no hay número. Preferimos
          decir <b>No disponible</b> a enseñarle un cero.
        </span>
      </div>
      </div>
    </>
  );
}
