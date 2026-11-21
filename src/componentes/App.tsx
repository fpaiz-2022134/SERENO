/**
 * El armazón de la PWA.
 *
 * Una sola página con las pantallas en estado del cliente, a propósito: así el
 * service worker cachea UN documento y la app abre completa sin conexión.
 *
 * LA CUENTA VIVE EN EL SERVIDOR. Al abrir se pregunta `/api/cuenta`; si la
 * petición falla POR RED se usa la instantánea guardada en el teléfono y la
 * app sigue funcionando en modo lectura, con la fecha a la vista. Si el
 * servidor responde que no hay sesión, manda el servidor.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gota } from "@/componentes/Iconos";
import { Navegacion, type Vista } from "@/componentes/Navegacion";
import { Acceso } from "@/pantallas/Acceso";
import { SinParcela } from "@/pantallas/SinParcela";
import { Hoy } from "@/pantallas/Hoy";
import { MiParcela } from "@/pantallas/MiParcela";
import { Resultado } from "@/pantallas/Resultado";
import { Alertas } from "@/pantallas/Alertas";
import { Perfil } from "@/pantallas/Perfil";
import { Vacio } from "@/componentes/Avisos";
import { marcaDeTiempo } from "@/lib/ui/fechas";
import { pinta } from "@/lib/ui/paleta";
import {
  borrarTodoLoLocal,
  guardarAccionesHechas,
  guardarInstantanea,
  leerAccionesHechas,
  leerCostos,
  leerInstantanea,
  type Costos,
} from "@/lib/ui/almacen";
import {
  guardarParcela,
  guardarParcelaNueva,
  leerCuenta,
  nombreDePila,
  salir as salirDeLaCuenta,
  type EstadoCuenta,
  type Parcela,
  type ParcelaNueva,
  type Sesion,
} from "@/lib/ui/cuenta";
import {
  SinDatos,
  clavePrevencion,
  pedirConRespaldo,
  rutaPrevencion,
  type Resultado as Res,
} from "@/lib/ui/red";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";

type Paso = "cargando" | "acceso" | "app";

export function App() {
  const [paso, setPaso] = useState<Paso>("cargando");
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [baseConfigurada, setBaseConfigurada] = useState(true);
  /** true = la cuenta se leyó de la copia del teléfono, no del servidor. */
  const [cuentaDeCache, setCuentaDeCache] = useState(false);
  const [vista, setVista] = useState<Vista>("hoy");

  const [reporte, setReporte] = useState<Res<RespuestaPrevencion> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const [labores, setLabores] = useState<string[]>([]);
  const [costos, setCostos] = useState<Costos | null>(null);
  const [enLinea, setEnLinea] = useState(true);

  const parcela = parcelas[0] ?? null;

  /* --- arranque ------------------------------------------------------ */
  useEffect(() => {
    setLabores(leerAccionesHechas());
    setCostos(leerCostos());
    setEnLinea(navigator.onLine);

    const sube = () => setEnLinea(true);
    const baja = () => setEnLinea(false);
    window.addEventListener("online", sube);
    window.addEventListener("offline", baja);

    (async () => {
      try {
        const estado = await leerCuenta();
        setBaseConfigurada(estado.baseConfigurada);
        setCuentaDeCache(false);
        if (estado.sesion) {
          setSesion(estado.sesion);
          setParcelas(estado.parcelas);
          guardarInstantanea(estado.sesion, estado.parcelas);
          setPaso("app");
        } else {
          // El servidor manda: si dice que no hay sesión, no hay sesión.
          setPaso("acceso");
        }
      } catch {
        // Falló por red. Si hay copia en el teléfono, se abre con ella.
        const copia = leerInstantanea<Sesion, Parcela>();
        if (copia?.sesion) {
          setSesion(copia.sesion);
          setParcelas(copia.parcelas);
          setCuentaDeCache(true);
          setPaso("app");
        } else {
          setPaso("acceso");
        }
      }
    })();

    return () => {
      window.removeEventListener("online", sube);
      window.removeEventListener("offline", baja);
    };
  }, []);

  /* --- service worker ------------------------------------------------- */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin service worker la app sigue andando, solo que sin modo avión */
      });
    }
  }, []);

  /* --- el color del riesgo, una vez, en el documento ------------------- */
  const nivel = reporte?.datos.ventanaDeAccion?.nivel ?? reporte?.datos.curva?.[0]?.nivel ?? null;

  useEffect(() => {
    const raiz = document.documentElement;
    if (nivel) raiz.setAttribute("data-riesgo", nivel);
    else raiz.removeAttribute("data-riesgo");
  }, [nivel]);

  /* --- pronóstico ------------------------------------------------------ */
  const consultar = useCallback(async (p: Parcela) => {
    setCargando(true);
    setErrorReporte(null);
    try {
      const r = await pedirConRespaldo<RespuestaPrevencion>(
        clavePrevencion(p.latitud, p.longitud),
        rutaPrevencion({
          latitud: p.latitud,
          longitud: p.longitud,
          nombre: p.nombre,
          ultimaAplicacion: p.ultimaAplicacion,
        }),
      );
      setReporte(r);

      // La altitud la mide la fuente. Si cambió, se guarda en la parcela, en
      // el servidor — no solo en la pantalla.
      const alt = r.datos.punto?.altitudMetros ?? null;
      if (r.origen === "red" && alt != null && alt !== p.altitudMetros) {
        try {
          const actualizada = await guardarParcela(p.id, { ...p, altitudMetros: alt });
          setParcelas((xs) => xs.map((x) => (x.id === p.id ? actualizada : x)));
        } catch {
          /* si no se pudo guardar, la pantalla sigue usando la medida de hoy */
        }
      }
    } catch (e) {
      setErrorReporte(e instanceof SinDatos ? e.message : "No se pudo consultar el pronóstico.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (paso === "app" && parcela) void consultar(parcela);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, parcela?.id, parcela?.latitud, parcela?.longitud, parcela?.ultimaAplicacion]);

  const nombre = useMemo(() => (sesion ? nombreDePila(sesion) : "productor"), [sesion]);

  /* --- cuenta ---------------------------------------------------------- */
  function entrar(estado: EstadoCuenta) {
    setSesion(estado.sesion);
    setParcelas(estado.parcelas);
    setCuentaDeCache(false);
    if (estado.sesion) guardarInstantanea(estado.sesion, estado.parcelas);
    setPaso("app");
    setVista("hoy");
  }

  async function salir() {
    await salirDeLaCuenta();
    // Se borra TODO lo del teléfono: el reporte de la parcela de alguien no
    // tiene por qué quedarse para el siguiente que entre.
    borrarTodoLoLocal();
    setSesion(null);
    setParcelas([]);
    setReporte(null);
    setLabores([]);
    setCostos(null);
    setPaso("acceso");
  }

  /* --- parcela --------------------------------------------------------- */
  const [guardandoParcela, setGuardandoParcela] = useState(false);
  const [errorParcela, setErrorParcela] = useState<string | null>(null);

  async function guardar(datos: ParcelaNueva, id: string | null): Promise<boolean> {
    setGuardandoParcela(true);
    setErrorParcela(null);
    try {
      const p = id ? await guardarParcela(id, datos) : await guardarParcelaNueva(datos);
      const nuevas = id ? parcelas.map((x) => (x.id === id ? p : x)) : [...parcelas, p];
      setParcelas(nuevas);
      if (sesion) guardarInstantanea(sesion, nuevas);
      setCuentaDeCache(false);
      return true;
    } catch (e) {
      setErrorParcela(e instanceof Error ? e.message : "No se pudo guardar la parcela.");
      return false;
    } finally {
      setGuardandoParcela(false);
    }
  }

  function marcarLabor(id: string) {
    const nuevas = labores.includes(id) ? labores.filter((x) => x !== id) : [...labores, id];
    setLabores(nuevas);
    guardarAccionesHechas(nuevas);
  }

  /* --- render ---------------------------------------------------------- */
  if (paso === "cargando") {
    return (
      <div className="cargando" style={{ minHeight: "100dvh" }}>
        <span className="cargando__brote" aria-hidden="true" />
        <p>Abriendo Sereno…</p>
      </div>
    );
  }

  if (paso === "acceso" || !sesion) {
    return <Acceso alEntrar={entrar} baseConfigurada={baseConfigurada} />;
  }

  const cuerpo = (() => {
    if (vista === "parcela") {
      return (
        <MiParcela
          parcela={parcela}
          altitudMedida={reporte?.datos.punto?.altitudMetros ?? null}
          guardando={guardandoParcela}
          error={errorParcela}
          soloLectura={cuentaDeCache}
          alGuardar={guardar}
          alCalcular={() => setVista("resultado")}
        />
      );
    }

    if (vista === "perfil") {
      return (
        <Perfil
          sesion={sesion}
          parcela={parcela}
          resultado={reporte}
          sinConexion={cuentaDeCache}
          alSalir={salir}
        />
      );
    }

    if (vista === "alertas") return <Alertas resultado={reporte} />;

    if (!parcela) {
      return <SinParcela nombre={nombre} alConfigurar={() => setVista("parcela")} />;
    }

    if (!reporte && !errorReporte) {
      return (
        <div className="cargando">
          <span className="cargando__brote" aria-hidden="true" />
          <p>Consultando el pronóstico de su parcela…</p>
        </div>
      );
    }

    if (errorReporte || !reporte) {
      return (
        <div className="pliego">
          <div className="saludo">
            <div className="saludo__fecha">{parcela.nombre}</div>
            <h1 className="saludo__titulo">Sin reporte</h1>
          </div>
          <section className="seccion">
            <Vacio
              que="Riesgo de plaga"
              falta={`${errorReporte ?? "No hay reporte."} Tampoco hay ninguno guardado en este teléfono para esta coordenada, así que no hay nada que mostrar todavía.`}
            />
            <button
              type="button"
              className="boton"
              style={{ marginTop: 14 }}
              onClick={() => void consultar(parcela)}
            >
              Reintentar
            </button>
          </section>
        </div>
      );
    }

    if (vista === "resultado") {
      return (
        <Resultado
          parcela={parcela}
          resultado={reporte}
          costosGuardados={costos}
          alVolver={() => setVista("hoy")}
        />
      );
    }

    return (
      <Hoy
        nombre={nombre}
        parcela={parcela}
        resultado={reporte}
        laboresHechas={labores}
        alMarcarLabor={marcarLabor}
        alVerResultado={() => setVista("resultado")}
        alIrAParcela={() => setVista("parcela")}
      />
    );
  })();

  const p = pinta(nivel);

  return (
    <div className="hoja">
      <header className="membrete">
        <div className="membrete__marca">
          <Gota tam={21} />
          Sereno
        </div>
        <div className="membrete__estado">
          <span
            className={`membrete__punto${enLinea ? "" : " membrete__punto--frio"}`}
            aria-hidden="true"
          />
          {cargando && reporte
            ? "Actualizando…"
            : reporte
              ? `${reporte.origen === "red" ? "Actualizado" : "Guardado"} ${marcaDeTiempo(reporte.recibidoEn)}`
              : enLinea
                ? "En línea"
                : "Sin conexión"}
        </div>
      </header>

      {cuentaDeCache && (
        <div className="pliego" style={{ paddingBottom: 0 }}>
          <div className="nota" role="status">
            <span className="nota__signo" aria-hidden="true">
              ◇
            </span>
            <span>
              <b>Sin conexión con el servidor.</b> Está viendo la copia de su cuenta que
              quedó en este teléfono. Para cambiar la parcela hace falta señal.
            </span>
          </div>
        </div>
      )}

      {cuerpo}

      <span className="sr" aria-live="polite">
        {nivel ? `Riesgo actual: ${p.corta}, ${p.palabra}` : "Riesgo no disponible"}
      </span>

      <Navegacion
        vista={vista}
        ir={setVista}
        alCalcular={() => setVista(parcela ? "resultado" : "parcela")}
      />
    </div>
  );
}
