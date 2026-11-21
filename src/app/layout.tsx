import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globales.css";

/**
 * v2 «Luz de cafetal».
 *
 * Fraunces para los números y los títulos: es variable en los ejes SOFT y
 * WONK, así que se le puede pedir que sea redonda y un poco irregular, como
 * algo que creció y no como algo que se imprimió. Figtree para leer: geométrica
 * pero cálida, muy legible en pantalla pequeña y al sol.
 *
 * Nada de monoespaciada: es lo que le daba cara de terminal a la versión
 * anterior. Los números se alinean con `font-variant-numeric: tabular-nums`.
 */
const serif = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  style: ["normal", "italic"],
  variable: "--fuente-serif",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--fuente-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sereno · clima para el agricultor",
  description:
    "Aviso de ventana de infección de roya del café, por parcela, con días de anticipación. Motor determinista: umbrales aritméticos, no IA.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sereno", statusBarStyle: "default" },
  icons: { icon: "/icono.svg", apple: "/icono-180.png" },
};

export const viewport: Viewport = {
  themeColor: "#f5f8f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-GT" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
