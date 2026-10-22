import type { MetadataRoute } from "next";
import { perfisSolares } from "@/lib/perfis-solares";
import { PRIVACIDADE_ATUALIZADA_EM, SITE_URL } from "@/lib/site-config";

export const dynamic = "force-static";
const E2_ATUALIZADA_EM = new Date("2026-10-20");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL + "/", lastModified: E2_ATUALIZADA_EM, changeFrequency: "monthly", priority: 1 },
    { url: SITE_URL + "/servicos/", lastModified: E2_ATUALIZADA_EM, changeFrequency: "monthly", priority: 0.8 },
    ...perfisSolares.map((perfil) => ({ url: `${SITE_URL}/servicos/${perfil.slug}/`, lastModified: E2_ATUALIZADA_EM, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: SITE_URL + "/obras/", lastModified: new Date("2026-10-20"), changeFrequency: "monthly", priority: 0.8 },
    { url: SITE_URL + "/simulador/", lastModified: new Date("2026-10-20"), changeFrequency: "monthly", priority: 0.7 },
    { url: SITE_URL + "/contato/", lastModified: E2_ATUALIZADA_EM, changeFrequency: "monthly", priority: 0.7 },
    { url: SITE_URL + "/privacidade/", lastModified: PRIVACIDADE_ATUALIZADA_EM, changeFrequency: "yearly", priority: 0.3 },
  ];
}
