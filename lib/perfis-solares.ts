// Identificadores e rótulos compartilhados; textos longos ficam nos dados de página.
export const perfisSolares = [
  { id: "residencial", titulo: "Residencial", nome: "Energia solar residencial", slug: "solar-residencial", mensagem: "Olá! Tenho interesse em energia solar residencial e gostaria de mais informações." },
  { id: "comercial", titulo: "Comercial", nome: "Energia solar comercial", slug: "solar-comercial", mensagem: "Olá! Tenho interesse em energia solar comercial e gostaria de mais informações." },
  { id: "rural", titulo: "Rural", nome: "Energia solar rural", slug: "solar-rural", mensagem: "Olá! Tenho interesse em energia solar rural e gostaria de mais informações." },
  { id: "usina", titulo: "Usina de investimento", nome: "Usina de investimento em energia solar", slug: "usina-de-investimento", mensagem: "Olá! Tenho interesse em usina de investimento em energia solar e gostaria de mais informações." },
] as const;

export type PerfilSolarId = (typeof perfisSolares)[number]["id"];

export function perfilPorSlug(slug: string | null) {
  return perfisSolares.find((perfil) => perfil.slug === slug);
}
