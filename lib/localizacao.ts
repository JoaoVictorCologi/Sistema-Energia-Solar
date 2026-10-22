import { siteConfig } from "@/lib/site-config";

// Consulta pelo endereço confirmado; sem coordenadas ou place ID presumidos.
const endereco = `${siteConfig.endereco.linha1}, ${siteConfig.endereco.linha2}, Brasil`;
const query = encodeURIComponent(endereco);
export const localizacao = {
  endereco,
  rotaUrl: `https://www.google.com/maps/dir/?api=1&destination=${query}`,
  mapaUrl: `https://maps.google.com/maps?q=${query}&output=embed&hl=pt-BR`,
} as const;
