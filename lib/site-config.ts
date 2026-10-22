// Dados confirmados pelo responsável em prompt.md. Uma única fonte para o site.
export const siteConfig = {
  nome: "Don Energy",
  url: "https://don-energy.vercel.app",
  descricao: "Soluções em energia solar para residências, comércios, propriedades rurais e usinas de investimento em Mococa-SP e região.",
  telefoneExibicao: "(19) 99627-4747",
  telefoneInternacional: "+5519996274747",
  whatsapp: "5519996274747",
  endereco: {
    linha1: "Rua Bernardino de Campos, 329",
    linha2: "Brás, Mococa - SP, 13735-030",
    logradouro: "Rua Bernardino de Campos, 329, Brás",
    cidade: "Mococa",
    estado: "SP",
    cep: "13735-030",
    pais: "BR",
  },
  horarios: [
    { dias: "Segunda a sexta", horario: "08:00 – 18:00", schemaDias: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], abre: "08:00", fecha: "18:00" },
    { dias: "Sábado", horario: "09:30 – 12:00", schemaDias: ["Saturday"], abre: "09:30", fecha: "12:00" },
  ],
  // Assinatura sem slogan aprovada em D25; derivação nativa, original preservado.
  logo: { src: "/logo/don-energy-marca-sem-microtexto-834x558.webp", width: 834, height: 558 },
  imagemSocial: { src: "/og-image.png", width: 1200, height: 630, alt: "Don Energy — Energia Solar" },
  numeros: {
    obrasRealizadas: "<<PREENCHER>>",
    potenciaInstaladaKwp: "<<PREENCHER>>",
    anosDeAtuacao: "<<PREENCHER>>",
  },
} as const;

export const SITE_URL = siteConfig.url;
// Atualizar apenas quando houver alteração real da política.
export const PRIVACIDADE_ATUALIZADA_EM = new Date("2026-10-21");

export const localBusiness = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": SITE_URL + "/#empresa",
  name: siteConfig.nome,
  url: SITE_URL + "/",
  description: siteConfig.descricao,
  telephone: siteConfig.telefoneInternacional,
  logo: SITE_URL + siteConfig.logo.src,
  image: SITE_URL + siteConfig.imagemSocial.src,
  address: {
    "@type": "PostalAddress",
    streetAddress: siteConfig.endereco.logradouro,
    addressLocality: siteConfig.endereco.cidade,
    addressRegion: siteConfig.endereco.estado,
    postalCode: siteConfig.endereco.cep,
    addressCountry: siteConfig.endereco.pais,
  },
  openingHoursSpecification: siteConfig.horarios.map((h) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: h.schemaDias.map((dia) => "https://schema.org/" + dia),
    opens: h.abre,
    closes: h.fecha,
  })),
};
