import type { HorasDeSol, Orientacao } from '../../services/api.ts';

// Ilustrações das perguntas sobre o telhado: apoiam a resposta, que continua em texto no grupo de opções.

// Horário de sol direto de cada resposta, usado apenas no desenho; o cálculo usa o fator do backend.
const SOL_DIRETO: Record<HorasDeSol, [number, number]> = { diaTodo: [6, 18], de6a8: [8.5, 15.5], de4a6: [9.5, 14.5], menosDe4: [10.5, 13.5] };

const CENTRO_X = 160;
const BASE_Y = 136;
const RAIO = 112;

// Posição do sol no arco: 6 h à esquerda, meio-dia no topo e 18 h à direita.
function pontoDoSol(hora: number): { x: number; y: number } {
  const angulo = Math.PI - ((hora - 6) / 12) * Math.PI;
  return { x: CENTRO_X + RAIO * Math.cos(angulo), y: BASE_Y - RAIO * Math.sin(angulo) };
}

function arcoDoSol(inicio: number, fim: number): string {
  const de = pontoDoSol(inicio);
  const ate = pontoDoSol(fim);
  return `M ${de.x} ${de.y} A ${RAIO} ${RAIO} 0 0 1 ${ate.x} ${ate.y}`;
}

function Casa() {
  return (
    <g className="text-brand-blue" fill="currentColor">
      <path d="M128 112 160 88l32 24z" />
      <rect x="136" y="112" width="48" height="24" />
    </g>
  );
}

// Árvore e prédio: obstáculos que tiram o sol da manhã e da tarde.
function Obstaculos() {
  return (
    <g fill="#9AA3B5">
      <circle cx="74" cy="96" r="20" />
      <rect x="70" y="110" width="8" height="26" />
      <rect x="236" y="84" width="34" height="52" />
    </g>
  );
}

export function IlustracaoHorasDeSol({ opcao }: { opcao: HorasDeSol | '' }) {
  const intervalo = opcao ? SOL_DIRETO[opcao] : null;
  const sol = pontoDoSol(intervalo ? (intervalo[0] + intervalo[1]) / 2 : 12);
  return (
    <svg viewBox="0 0 320 160" role="img" aria-label="O sol passa de manhã para a tarde sobre a casa. Árvores e prédios próximos tiram as horas de sol direto no telhado." className="w-full max-w-sm text-muted-foreground">
      <path d={arcoDoSol(6, 18)} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
      {intervalo && <path d={arcoDoSol(intervalo[0], intervalo[1])} fill="none" stroke="#D88739" strokeWidth="6" strokeLinecap="round" />}
      <circle cx={sol.x} cy={sol.y} r="11" fill="#D88739" />
      {opcao && opcao !== 'diaTodo' && <Obstaculos />}
      <Casa />
      <line x1="16" y1="136" x2="304" y2="136" stroke="currentColor" strokeWidth="2" />
      <g fill="currentColor" fontSize="12">
        <text x="16" y="154">Manhã</text>
        <text x="160" y="154" textAnchor="middle">Meio-dia</text>
        <text x="304" y="154" textAnchor="end">Tarde</text>
      </g>
    </svg>
  );
}

const DIRECOES: { opcao: Orientacao; sigla: string; angulo: number }[] = [
  { opcao: 'norte', sigla: 'N', angulo: 0 }, { opcao: 'nordeste', sigla: 'NE', angulo: 45 }, { opcao: 'leste', sigla: 'L', angulo: 90 },
  { opcao: 'sudeste', sigla: 'SE', angulo: 135 }, { opcao: 'sul', sigla: 'S', angulo: 180 }, { opcao: 'sudoeste', sigla: 'SO', angulo: 225 },
  { opcao: 'oeste', sigla: 'O', angulo: 270 }, { opcao: 'noroeste', sigla: 'NO', angulo: 315 },
];

const CENTRO_DA_BUSSOLA = 110;

// Coordenadas polares com o ângulo zero no norte.
function pontoDaBussola(angulo: number, raio: number): string {
  const radianos = ((angulo - 90) * Math.PI) / 180;
  return `${CENTRO_DA_BUSSOLA + raio * Math.cos(radianos)} ${CENTRO_DA_BUSSOLA + raio * Math.sin(radianos)}`;
}

// Setor de 45° da bússola, em torno do centro.
function fatia(angulo: number): string {
  const [inicio, fim] = [angulo - 22.5, angulo + 22.5];
  return `M ${pontoDaBussola(inicio, 34)} L ${pontoDaBussola(inicio, 92)} A 92 92 0 0 1 ${pontoDaBussola(fim, 92)} L ${pontoDaBussola(fim, 34)} A 34 34 0 0 0 ${pontoDaBussola(inicio, 34)} Z`;
}

export function IlustracaoOrientacao({ opcao }: { opcao: Orientacao | '' }) {
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="Bússola com as oito direções. No Brasil, o telhado voltado para o norte é o que recebe mais sol." className="w-full max-w-[15rem]">
      {DIRECOES.map((direcao) => {
        const [x, y] = pontoDaBussola(direcao.angulo, 63).split(' ');
        const escolhida = direcao.opcao === opcao;
        return (
          <g key={direcao.opcao}>
            <path d={fatia(direcao.angulo)} fill={escolhida ? '#D88739' : '#F5F6FA'} stroke="#9AA3B5" strokeWidth="1.5" />
            <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize="14" fontWeight="600" fill="#171F32">{direcao.sigla}</text>
          </g>
        );
      })}
      <circle cx={CENTRO_DA_BUSSOLA} cy={CENTRO_DA_BUSSOLA} r="30" fill={opcao === 'plano' ? '#D88739' : '#FFFFFF'} stroke="#9AA3B5" strokeWidth="1.5" />
      <text x={CENTRO_DA_BUSSOLA} y={CENTRO_DA_BUSSOLA} dy="0.35em" textAnchor="middle" fontSize="12" fontWeight="600" fill="#171F32">Laje</text>
      {/* Sol ao norte: no hemisfério sul, é por esse lado que ele passa a maior parte do ano. */}
      <circle cx={CENTRO_DA_BUSSOLA} cy="9" r="7" fill="#D88739" />
    </svg>
  );
}
