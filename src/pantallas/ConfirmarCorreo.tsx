/**
 * Pantalla 2 · Confirmar correo — código de 6 números.
 *
 * HONESTIDAD: no se manda ningún correo porque no hay servidor de identidad.
 * El paso existe porque está en el flujo del branding, pero la pantalla dice
 * qué número aceptar y por qué, en lugar de fingir que llegó un mensaje.
 */
"use client";

import { useRef, useState } from "react";

/** El código de demostración. Está escrito en pantalla: no es un secreto. */
export const CODIGO_DEMO = "482100";

export function ConfirmarCorreo({
  correo,
  alConfirmar,
  alVolver,
}: {
  correo: string;
  alConfirmar: () => void;
  alVolver: () => void;
}) {
  const [digitos, setDigitos] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string | null>(null);
  const campos = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Acepta un dígito, varios de golpe (pegar el código) o tecleo rápido.
   * El estado se actualiza en forma funcional: si llegan dos teclas antes de
   * que React repinte, no se pierde ninguna.
   */
  function escribir(i: number, v: string, anterior = "") {
    let limpio = v.replace(/\D/g, "");
    // El campo no tiene maxLength: si el tecleo es mas rapido que el repintado,
    // los digitos de mas llegan juntos aqui y se reparten en las casillas
    // siguientes en vez de perderse. Lo mismo pasa al pegar el codigo.
    if (limpio.length > 1 && anterior && limpio.startsWith(anterior)) {
      limpio = limpio.slice(anterior.length);
      i = Math.min(i + 1, 5);
    }
    if (!limpio) {
      setDigitos((prev) => prev.map((d, j) => (j === i ? "" : d)));
      return;
    }
    setDigitos((prev) => {
      const nuevos = [...prev];
      for (let k = 0; k < limpio.length && i + k < 6; k++) nuevos[i + k] = limpio[k];
      return nuevos;
    });
    setError(null);
    const siguiente = Math.min(i + limpio.length, 5);
    campos.current[siguiente]?.focus();
  }

  function retroceder(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digitos[i] && i > 0) campos.current[i - 1]?.focus();
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const codigo = digitos.join("");
    if (codigo.length < 6) {
      setError("Faltan números del código.");
      return;
    }
    if (codigo !== CODIGO_DEMO) {
      setError("El código no coincide.");
      return;
    }
    alConfirmar();
  }

  return (
    <div className="pantalla pantalla--plena" style={{ paddingTop: 26 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: "var(--niebla)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 20,
        }}
        aria-hidden="true"
      >
        ✉
      </div>

      <h1 style={{ fontSize: 28, marginTop: 14 }}>Revise su correo</h1>
      <p style={{ fontSize: 14, color: "var(--tinta-suave)", marginTop: 6 }}>
        Le mandamos un código de 6 números a <b style={{ color: "var(--ebano)" }}>{correo}</b>.
      </p>

      <form onSubmit={enviar}>
        <div className="codigo">
          {digitos.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                campos.current[i] = el;
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={d}
              aria-label={`Número ${i + 1} de 6`}
              onChange={(e) => escribir(i, e.target.value, d)}
              onKeyDown={(e) => retroceder(i, e)}
              onPaste={(e) => {
                e.preventDefault();
                escribir(i, e.clipboardData.getData("text"));
              }}
            />
          ))}
        </div>

        {error && (
          <div className="aviso aviso--cedro" role="alert" style={{ marginBottom: 12 }}>
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="boton boton--principal">
          Confirmar
        </button>
      </form>

      <button type="button" className="boton boton--texto" onClick={alVolver} style={{ marginTop: 10 }}>
        ← Cambiar de correo
      </button>

      <div className="aviso aviso--roble" style={{ marginTop: 18 }}>
        <span aria-hidden="true">◈</span>
        <span>
          <b>No se envió ningún correo.</b> Esta versión no tiene servidor de identidad.
          Para seguir, escriba <b style={{ fontFamily: "var(--mono)" }}>{CODIGO_DEMO}</b>.
        </span>
      </div>
    </div>
  );
}
