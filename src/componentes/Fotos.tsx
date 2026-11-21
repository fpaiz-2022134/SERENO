/**
 * Las fotografías de la app.
 *
 * REGLA DE HONESTIDAD, y es la razón de que este archivo exista en vez de
 * meter `<img>` sueltos por ahí:
 *
 *   Ninguna de estas imágenes es una foto de la parcela del productor.
 *   Son imágenes de referencia, generadas, y cada una lo dice en pantalla.
 *
 * Una foto que parece de su finca y no lo es sería un dato inventado con otra
 * cara. Por eso la cabecera lleva su etiqueta y las fotos de hoja llevan su
 * pie. Si algún día hay fotos reales de la parcela, se cambia el `credito`.
 */

export const FOTOS = {
  cafetal: {
    src: "/fotos/cafetal.jpg",
    alt: "Cafetal bajo árboles de sombra, con neblina y un volcán al fondo",
    credito: "Imagen de referencia",
  },
  parcela: {
    src: "/fotos/parcela.jpg",
    alt: "Vista de una ladera con surcos de café entre árboles de sombra",
    credito: "Imagen de referencia",
  },
  roya: {
    src: "/fotos/roya.jpg",
    alt:
      "Envés de una hoja de café con pústulas anaranjadas de roya, algunas con el centro café",
    credito: "Imagen de referencia, no es una foto de su parcela",
  },
  sana: {
    src: "/fotos/sana.jpg",
    alt: "Envés de una hoja de café sana, verde pálido y sin manchas",
    credito: "Imagen de referencia, no es una foto de su parcela",
  },
} as const;

/**
 * Cabecera con foto: el saludo encima y la primera tarjeta montada sobre ella.
 * El `credito` va arriba a la derecha, siempre visible.
 */
export function Cabecera({
  foto,
  encima,
  titulo,
  children,
}: {
  foto: { src: string; alt: string; credito: string };
  encima?: React.ReactNode;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="portada-foto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto.src} alt={foto.alt} />
      <span className="portada-foto__credito">{foto.credito}</span>
      <div className="portada-foto__texto">
        {encima && <div className="portada-foto__fecha">{encima}</div>}
        <h1 className="portada-foto__titulo">{titulo}</h1>
        {children}
      </div>
    </div>
  );
}

/** Una foto de referencia con su explicación al lado y su pie honesto. */
export function Referencia({
  foto,
  children,
}: {
  foto: { src: string; alt: string; credito: string };
  children: React.ReactNode;
}) {
  return (
    <div className="referencia">
      <div className="referencia__foto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.src} alt={foto.alt} loading="lazy" />
      </div>
      <div className="referencia__texto">
        {children}
        <span className="referencia__pie">{foto.credito}</span>
      </div>
    </div>
  );
}
