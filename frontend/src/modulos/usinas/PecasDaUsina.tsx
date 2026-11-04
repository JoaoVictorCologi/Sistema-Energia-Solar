// Peças comuns às telas de usinas: nomes, selo de situação, confirmação e tratamento de erro.
import { CircleCheck, CircleOff } from 'lucide-react';
import type { Carga } from '../../hooks/useCarregar.ts';
import { ErroDaApi } from '../../services/api.ts';
import { formatarData } from '../../utils/formatar.ts';
import type { RegimeDaUsina, StatusDaUsina } from './tipos.ts';

// Só o nome de exibição: quem define o regime é o backend.
export const NOMES_DO_REGIME: Record<RegimeDaUsina, string> = { GD_I: 'GD I', GD_II: 'GD II' };

// Ícone e texto junto da cor: a situação não depende só dela.
const SITUACOES = {
  ativa: { rotulo: 'Ativa', Icone: CircleCheck, classe: 'border-green-700/40 text-green-800' },
  desativada: { rotulo: 'Desativada', Icone: CircleOff, classe: 'border-border text-brand-ink' },
} as const;

export function SeloDaSituacao({ status }: { status: StatusDaUsina }) {
  const { rotulo, Icone, classe } = SITUACOES[status];
  return (
    <span className={'inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold ' + classe}>
      <Icone aria-hidden="true" className="size-3.5" /> {rotulo}
    </span>
  );
}

// A região existe desde o início, vazia: o leitor de tela só anuncia o que muda dentro dela.
export function Confirmacao({ texto, className = '' }: { texto: string | null; className?: string }) {
  return (
    <div role="status">
      {texto && (
        <p className={'flex items-start gap-2 rounded-sm border border-green-700/40 bg-green-50 px-3 py-2 text-sm text-green-900 ' + className}>
          <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{texto}</span>
        </p>
      )}
    </div>
  );
}

// Vencimento nulo (garantia de desempenho que não existe) aparece como traço.
export function formatarDataOuTraco(texto: string | null): string {
  return texto === null ? '—' : formatarData(texto);
}

// useCarregar mantém os dados antigos enquanto recarrega e quando há erro: a tela só os mostra sem nenhum dos dois.
export function dadosProntos<Dados>(carga: Carga<Dados>): Dados | null {
  return carga.carregando || carga.erro ? null : carga.dados;
}

// Falha inesperada vira o mesmo tipo de erro, para as telas tratarem tudo igual.
export function comoErroDaApi(falha: unknown): ErroDaApi {
  return falha instanceof ErroDaApi ? falha : new ErroDaApi(0, 'ERRO_INTERNO', 'Algo deu errado. Tente de novo.');
}

// Um campo que a API pode recusar e como achá-lo no formulário. As listas ficam na ordem da tela.
export interface CampoNaTela {
  campo: string;
  seletor: string;
}

// Erro de campo sem lugar na tela (fields.corpo, por exemplo) só tem esta mensagem para aparecer.
export function mensagemGeralDoErro(erro: ErroDaApi, camposVisiveis: CampoNaTela[]): string {
  const visiveis = camposVisiveis.map(({ campo }) => campo);
  const semLugar = Object.entries(erro.campos).filter(([campo]) => !visiveis.includes(campo)).map(([, mensagem]) => mensagem);
  return semLugar.length > 0 ? semLugar.join(' ') : erro.message;
}

// O botão de salvar fica no fim da página: sem isto, o erro poderia ficar fora da vista.
export function focarPrimeiroInvalido(erro: ErroDaApi, camposVisiveis: CampoNaTela[], formulario: HTMLElement | null, blocoDoErro: HTMLElement | null): void {
  const primeiro = camposVisiveis.find(({ campo }) => erro.campos[campo]);
  const campo = primeiro ? formulario?.querySelector<HTMLElement>(primeiro.seletor) : null;
  (campo ?? blocoDoErro)?.focus();
}
