import { CircleCheck, CircleMinus, CircleX, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Aviso, Cartao, classeDoBotaoSecundario, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { ErroDaApi, listarImportacoes, rodarImportacao, type Importacao, type StatusDaImportacao } from '../../services/api.ts';
import { formatarDataEHora, formatarNumero } from '../../utils/formatar.ts';

const STATUS: Record<StatusDaImportacao, { rotulo: string; Icone: typeof CircleCheck; classe: string }> = {
  sucesso: { rotulo: 'Sucesso', Icone: CircleCheck, classe: 'text-green-800' },
  sem_alteracao: { rotulo: 'Sem alteração na fonte', Icone: CircleMinus, classe: 'text-brand-blue' },
  executando: { rotulo: 'Rodando', Icone: LoaderCircle, classe: 'text-brand-blue' },
  erro: { rotulo: 'Erro', Icone: CircleX, classe: 'text-red-800' },
};

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Agenda do node-cron (horário de São Paulo) em texto: "0 6 * * *" → "Todo dia às 06:00".
function descreverAgenda(agenda: string): string {
  const [minuto, hora, diaDoMes, mes, diaDaSemana] = agenda.split(' ');
  if (![minuto, hora].every((parte) => /^\d+$/.test(parte)) || diaDoMes !== '*' || mes !== '*') return agenda;
  const horario = `${hora.padStart(2, '0')}:${minuto.padStart(2, '0')}`;
  if (diaDaSemana === '*') return `Todo dia às ${horario}`;
  return /^\d$/.test(diaDaSemana) ? `Todo ${DIAS[Number(diaDaSemana)]} às ${horario}` : agenda;
}

export function Importacoes() {
  useTituloDaPagina('Importações — Solar Gestão');
  const carga = useCarregar(listarImportacoes, 'importacoes');

  return (
    <>
      <Titulo sobre="Dados oficiais usados na simulação">Importações</Titulo>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Rodam sozinhas no horário de cada uma. Se a fonte estiver fora do ar, a simulação continua com os últimos dados importados.
      </p>
      <EstadoDaCarga carregando={carga.carregando && !carga.dados} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      {carga.dados && (
        <ul className="flex flex-col gap-4">
          {carga.dados.map((importacao) => <CartaoDaImportacao key={importacao.tipo} inicial={importacao} aoTerminar={carga.recarregar} />)}
        </ul>
      )}
    </>
  );
}

// A mensagem lista o que a importação descartou e pode ter centenas de itens: mostra o começo e o resto sob demanda.
function Mensagem({ texto }: { texto: string }) {
  if (texto.length <= 240) return <>{texto}</>;
  return (
    <details>
      <summary className="cursor-pointer">{texto.slice(0, 240)}… <span className="font-semibold text-brand-blue underline underline-offset-4">ver tudo</span></summary>
      <p className="mt-2">{texto}</p>
    </details>
  );
}

function CartaoDaImportacao({ inicial, aoTerminar }: { inicial: Importacao; aoTerminar: () => void }) {
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { descricao, agenda, ultimaExecucao, ultimoSucessoEm, desatualizada } = inicial;

  async function rodar() {
    setRodando(true);
    setErro(null);
    try {
      await rodarImportacao(inicial.tipo);
      aoTerminar();
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível rodar a importação.');
    } finally {
      setRodando(false);
    }
  }

  const status = ultimaExecucao && STATUS[ultimaExecucao.status];
  return (
    <li>
      <Cartao className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-medium text-brand-blue">{descricao}</h2>
            <p className="text-sm text-muted-foreground">{descreverAgenda(agenda)} · <code className="text-xs">{inicial.tipo}</code></p>
          </div>
          <button type="button" onClick={rodar} disabled={rodando} className={classeDoBotaoSecundario}>
            <RefreshCw aria-hidden="true" className={'size-4' + (rodando ? ' animate-spin motion-reduce:animate-none' : '')} />
            {rodando ? 'Atualizando… pode levar alguns segundos' : 'Atualizar agora'}
          </button>
        </div>
        {desatualizada && (
          <p className="flex items-start gap-2 text-sm font-semibold text-red-800">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {ultimoSucessoEm ? `Desatualizada: o último sucesso foi em ${formatarDataEHora(ultimoSucessoEm)}, há mais de 2 dias.` : 'Desatualizada: nunca rodou com sucesso.'}
          </p>
        )}
        {ultimaExecucao && status ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Última execução</dt>
              <dd className={'mt-1 inline-flex items-center gap-1.5 font-semibold ' + status.classe}><status.Icone aria-hidden="true" className="size-4" /> {status.rotulo}</dd></div>
            <div><dt className="text-muted-foreground">Terminou em</dt><dd className="mt-1">{formatarDataEHora(ultimaExecucao.finalizadaEm ?? ultimaExecucao.iniciadaEm)}</dd></div>
            <div><dt className="text-muted-foreground">Linhas gravadas</dt><dd className="mt-1 tabular-nums">{formatarNumero(ultimaExecucao.linhasGravadas ?? 0)}</dd></div>
            {ultimaExecucao.mensagem && <div className="sm:col-span-3"><dt className="text-muted-foreground">Mensagem</dt><dd className="mt-1 break-words"><Mensagem texto={ultimaExecucao.mensagem} /></dd></div>}
          </dl>
        ) : <p className="text-sm text-muted-foreground">Ainda não rodou.</p>}
        {erro && <Aviso>{erro}</Aviso>}
      </Cartao>
    </li>
  );
}
