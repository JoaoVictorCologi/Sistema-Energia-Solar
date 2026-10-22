// Fotografias autorizadas do acervo. Cada arquivo não representa, por si, uma obra.
const registros = [
  { id: "foto-01", numero: "01", largura: 1920, altura: 1080, alt: "Módulos solares sobre uma cobertura, com portões laranja na fachada" },
  { id: "foto-02", numero: "02", largura: 1920, altura: 1080, alt: "Vista aérea de módulos solares em coberturas próximas a uma esquina" },
  { id: "foto-03", numero: "03", largura: 1920, altura: 1080, alt: "Dois conjuntos de módulos solares sobre telhas" },
  { id: "foto-04", numero: "04", largura: 1920, altura: 1080, alt: "Vista aérea de módulos solares sobre uma cobertura" },
  { id: "foto-05", numero: "05", largura: 1920, altura: 1080, alt: "Módulos solares distribuídos sobre uma cobertura, vistos de cima" },
  { id: "foto-06", numero: "06", largura: 1920, altura: 1080, alt: "Fileiras de módulos solares sobre uma cobertura" },
  { id: "foto-07", numero: "07", largura: 1920, altura: 1080, alt: "Vista aérea de módulos solares, com piscina e quadra ao fundo" },
  { id: "foto-08", numero: "08", largura: 1920, altura: 1080, alt: "Módulos solares sobre telhas, com piscina ao fundo" },
  { id: "foto-09", numero: "09", largura: 1440, altura: 1920, alt: "Vista aérea vertical de uma cobertura com módulos solares e áreas externas" },
  { id: "foto-10", numero: "10", largura: 1920, altura: 1080, alt: "Vista aérea de uma instalação de módulos solares sobre cobertura" },
  { id: "foto-11", numero: "11", largura: 1920, altura: 1080, alt: "Módulos solares sobre uma cobertura cercada por áreas abertas" },
] as const;

export type FotoId = (typeof registros)[number]["id"];
export const fotosAcervo = registros.map(foto => ({
  ...foto,
  original: "/obras/obra-" + foto.numero + ".webp",
  legenda: "Instalação solar · Acervo Don Energy",
  miniatura: "/obras/portfolio/" + foto.id + "-480.webp",
  ampliacao: "/obras/portfolio/" + foto.id + "-1440.webp",
  srcSet: [480, 960, 1440].map(largura => "/obras/portfolio/" + foto.id + "-" + largura + ".webp " + largura + "w").join(", "),
}));
export type Foto = (typeof fotosAcervo)[number];

export function fotoPorId(id: FotoId): Foto {
  const foto = fotosAcervo.find(item => item.id === id);
  if (!foto) throw new Error("Fotografia não encontrada: " + id);
  return foto;
}

// Destaque editorial de fotografias; não é contagem nem classificação de projetos.
export const fotosDestaque = (["foto-09", "foto-01", "foto-11"] as const).map(fotoPorId);
