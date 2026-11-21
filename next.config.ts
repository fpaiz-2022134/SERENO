import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El backend de SERENO no necesita imagenes remotas ni rewrites por ahora.
  // Las llamadas a APIs externas salen SIEMPRE del servidor (route handlers),
  // nunca del navegador: ver src/lib/fuentes/*.
  experimental: {},
};

export default nextConfig;
