export const metadata = {
  title: "SERENO",
  description:
    "Alerta de ventana de infeccion de roya del cafe, por parcela, con dias de anticipacion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-GT">
      <body>{children}</body>
    </html>
  );
}
