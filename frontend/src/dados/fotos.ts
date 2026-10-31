// Fotografias do acervo Don Energy (frontend/public/fotos). 11 fotos não são 11 obras:
// não atribuir cidade, potência ou tipo de cliente sem dado confirmado.

export interface Foto {
  numero: string;
  largura: number;
  altura: number;
  alt: string;
}

export const LEGENDA_DO_ACERVO = 'Instalação solar · Acervo Don Energy';

export const fotosDoAcervo: Foto[] = [
  { numero: '01', largura: 1920, altura: 1080, alt: 'Módulos solares sobre uma cobertura, com portões laranja na fachada' },
  { numero: '02', largura: 1920, altura: 1080, alt: 'Vista aérea de módulos solares em coberturas próximas a uma esquina' },
  { numero: '03', largura: 1920, altura: 1080, alt: 'Dois conjuntos de módulos solares sobre telhas' },
  { numero: '04', largura: 1920, altura: 1080, alt: 'Vista aérea de módulos solares sobre uma cobertura' },
  { numero: '05', largura: 1920, altura: 1080, alt: 'Módulos solares distribuídos sobre uma cobertura, vistos de cima' },
  { numero: '06', largura: 1920, altura: 1080, alt: 'Fileiras de módulos solares sobre uma cobertura' },
  { numero: '07', largura: 1920, altura: 1080, alt: 'Vista aérea de módulos solares, com piscina e quadra ao fundo' },
  { numero: '08', largura: 1920, altura: 1080, alt: 'Módulos solares sobre telhas, com piscina ao fundo' },
  { numero: '09', largura: 1440, altura: 1920, alt: 'Vista aérea vertical de uma cobertura com módulos solares e áreas externas' },
  { numero: '10', largura: 1920, altura: 1080, alt: 'Vista aérea de uma instalação de módulos solares sobre cobertura' },
  { numero: '11', largura: 1920, altura: 1080, alt: 'Módulos solares sobre uma cobertura cercada por áreas abertas' },
];

export function fotoPorNumero(numero: string): Foto {
  const foto = fotosDoAcervo.find((item) => item.numero === numero);
  if (!foto) throw new Error('Fotografia do acervo não encontrada: ' + numero);
  return foto;
}

// Variantes de 480, 960 e 1440 px geradas a partir das originais (que ficam na branch legado/site-don-energy).
export function caminhoDoPortfolio(foto: Foto, largura: 480 | 960 | 1440): string {
  return `/fotos/portfolio/foto-${foto.numero}-${largura}.webp`;
}

export function srcSetDoPortfolio(foto: Foto): string {
  return ([480, 960, 1440] as const).map((largura) => `${caminhoDoPortfolio(foto, largura)} ${largura}w`).join(', ');
}
