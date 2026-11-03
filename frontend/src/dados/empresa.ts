// Dados públicos da empresa, herdados do site Don Energy (branch legado/site-don-energy, lib/site-config.ts).
export const empresa = {
  nome: 'Don Energy',
  telefoneExibicao: '(19) 99627-4747',
  telefoneInternacional: '+5519996274747',
  whatsapp: '5519996274747',
  endereco: {
    linha1: 'Rua Bernardino de Campos, 329',
    linha2: 'Brás, Mococa - SP, 13735-030',
  },
  horarios: [
    { dias: 'Segunda a sexta', horario: '08:00 – 18:00' },
    { dias: 'Sábado', horario: '09:30 – 12:00' },
  ],
  // Assinatura sem "Energia solar" embaixo; letras brancas, só sobre fundo escuro.
  logo: { src: '/logo/don-energy-marca-sem-microtexto-834x558.webp', largura: 834, altura: 558 },
} as const;

const MENSAGEM_PADRAO = 'Olá! Vim pelo site da Don Energy e gostaria de saber mais sobre os serviços de energia solar.';

// Consulta pelo endereço confirmado, sem coordenadas presumidas. O mapa só carrega se o visitante pedir.
const enderecoParaMapa = encodeURIComponent(`${empresa.endereco.linha1}, ${empresa.endereco.linha2}, Brasil`);
export const linkDaRota = `https://www.google.com/maps/dir/?api=1&destination=${enderecoParaMapa}`;
export const linkDoMapaIncorporado = `https://maps.google.com/maps?q=${enderecoParaMapa}&output=embed&hl=pt-BR`;

export function linkDoWhatsApp(mensagem: string = MENSAGEM_PADRAO): string {
  return `https://wa.me/${empresa.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}
