/**
 * Pantalla 1 · Acceso — solo correo y contraseña. «La parcela se agrega después.»
 *
 * HONESTIDAD: no hay servidor de identidad detrás. La sesión se guarda solo en
 * este teléfono y la pantalla lo dice en letra visible, porque simularla como
 * si validara contra un servidor sería exactamente la clase de mentira que el
 * equipo acordó no hacer. Ver README § Autenticación.
 */
"use client";

import { useState } from "react";
import { Gota } from "@/componentes/Logo";

export function Acceso({ alEntrar }: { alEntrar: (correo: string) => void }) {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) && clave.length >= 6;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!valido) {
      setError(
        correo.includes("@")
          ? "La contraseña necesita al menos 6 caracteres."
          : "Escriba un correo electrónico válido.",
      );
      return;
    }
    setError(null);
    alEntrar(correo.trim().toLowerCase());
  }

  return (
    <div className="acceso">
      <div className="acceso__tapa">
        <div>
          <Gota tam={64} color="rgba(255,255,255,0.92)" />
          <div className="acceso__marca">Sereno</div>
          <div className="acceso__lema">Clima para el agricultor</div>
          <div className="acceso__promesa">Sepa antes. Decida usted.</div>
        </div>
      </div>

      <form className="acceso__hoja" onSubmit={enviar} noValidate>
        <label className="campo">
          <span className="campo__rotulo">Correo electrónico</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ana.ramirez@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>

        <label className="campo">
          <span className="campo__rotulo">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>

        {error && (
          <div className="aviso aviso--cedro" role="alert">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="boton boton--principal" style={{ marginTop: 12 }}>
          Entrar
        </button>

        <p className="acceso__pie">Solo correo y contraseña. Su parcela se agrega después.</p>

        <div className="aviso aviso--roble" style={{ marginTop: 14 }}>
          <span aria-hidden="true">◈</span>
          <span>
            <b>Esta pantalla no valida contra un servidor.</b> En esta versión la sesión se
            guarda solo en este teléfono: no hay cuentas en la nube ni se envía ningún
            correo. Lo decimos en lugar de simularlo.
          </span>
        </div>
      </form>
    </div>
  );
}
