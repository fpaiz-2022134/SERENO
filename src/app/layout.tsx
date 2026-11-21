import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import "./globales.css";

/** Las tres tipografías del branding, servidas desde el propio dominio. */
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--fuente-display",
  display: "swap",
});

const texto = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-texto",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-mono",
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
  themeColor: "#2f6585",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-GT" className={`${display.variable} ${texto.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
