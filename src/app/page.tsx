/**
 * Pagina minima. El frontend (mapa, curva de 10 dias, el aviso) lo construye
 * el equipo de interfaz; esto solo deja el backend navegable.
 */
const ENDPOINTS = [
  ["/api/clima?lat=14.50&lon=-91.15", "Panel climatico: pronostico 16 d, curva de riesgo, eventos"],
  ["/api/prevencion?lat=14.50&lon=-91.15", "Panel de prevencion: ventana de accion, aviso, boletines"],
  ["/api/mercado", "Panel de mercado: precios del MAGA y noticias"],
  ["/api/historico?lat=14.50&lon=-91.15&anio=2012", "La corrida hacia atras sobre la temporada del brote"],
  ["/api/fuentes", "Estado de las seis fuentes"],
];

export default function Pagina() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 32, maxWidth: 760 }}>
      <h1>SERENO · backend</h1>
      <p>
        Motor de riesgo determinista de roya del cafe (<i>Hemileia vastatrix</i>) sobre
        series meteorologicas horarias. El riesgo es aritmetica, no un modelo de lenguaje.
      </p>
      <p>
        <b>No predice brotes.</b> Predice ventanas en que las condiciones meteorologicas
        son favorables a la infeccion. El inoculo lo reporta el productor.
      </p>
      <ul>
        {ENDPOINTS.map(([url, que]) => (
          <li key={url} style={{ marginBottom: 8 }}>
            <a href={url}>
              <code>{url}</code>
            </a>
            <br />
            <small>{que}</small>
          </li>
        ))}
      </ul>
    </main>
  );
}
