import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Cartao, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarPainel, type Painel as DadosDoPainel } from '../../services/api.ts';
import { formatarDataEHora, formatarNumero, formatarReais } from '../../utils/formatar.ts';
import { temAcesso } from '../../utils/papeis.ts';

const ROTULO_DA_IMPORTACAO = { executando: 'Rodando agora', sucesso: 'Sucesso', sem_alteracao: 'Sem alteração', erro: 'Erro' } as const;

function Contagem({ rotulo, valor, caminho, detalhe }: { rotulo: string; valor: string; caminho: string; detalhe?: string }) {
  return (
    <Link to={caminho} className="block h-full rounded-md border border-border bg-white p-5 hover:border-brand-blue sm:p-6">
      <span className="block text-sm font-semibold text-muted-foreground">{rotulo}</span>
      <span className="mt-2 block font-heading text-3xl font-medium text-brand-blue">{valor}</span>
      {detalhe && <span className="mt-1 block text-xs text-muted-foreground">{detalhe}</span>}
    </Link>
  );
}

// O caminho de um pedido até o orçamento aceito, na ordem do atendimento.
function Funil({ painel }: { painel: DadosDoPainel }) {
  const { propostasPorStatus: status, propostasVencidas } = painel;
  const etapas = [
    { rotulo: 'Pedidos novos', valor: painel.pedidosNovos, caminho: '/admin/simulacoes?comPedido=true', detalhe: 'Ainda sem orçamento' },
    { rotulo: 'Em rascunho', valor: status.rascunho, caminho: '/admin/propostas?status=rascunho' },
    { rotulo: 'Enviados', valor: status.enviada, caminho: '/admin/propostas?status=enviada', detalhe: propostasVencidas > 0 ? `Com a validade vencida: ${formatarNumero(propostasVencidas)}` : undefined },
    { rotulo: 'Aceitos', valor: status.aceita, caminho: '/admin/propostas?status=aceita', detalhe: status.recusada > 0 ? `Recusados: ${formatarNumero(status.recusada)}` : undefined },
  ];
  return (
    <section aria-labelledby="titulo-funil">
      <h2 id="titulo-funil" className="mb-4 font-heading text-xl font-medium text-brand-blue">Atendimento</h2>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {etapas.map((etapa, indice) => (
          <li key={etapa.rotulo} className="relative">
            <Contagem rotulo={etapa.rotulo} valor={formatarNumero(etapa.valor)} caminho={etapa.caminho} detalhe={etapa.detalhe} />
            {indice < etapas.length - 1 && <ChevronRight aria-hidden="true" className="absolute top-1/2 -right-4 z-10 hidden size-4 -translate-y-1/2 text-muted-foreground xl:block" />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function UltimaImportacao({ painel }: { painel: DadosDoPainel }) {
  const ultima = painel.ultimaImportacaoDeTarifas;
  const ok = ultima?.status === 'sucesso' || ultima?.status === 'sem_alteracao';
  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Tarifas da ANEEL</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {ultima ? `Última importação: ${ROTULO_DA_IMPORTACAO[ultima.status]}, em ${formatarDataEHora(ultima.finalizadaEm)}.` : 'Nenhuma importação registrada ainda.'}
      </p>
      {!ok && <p className="mt-2 text-sm font-semibold text-red-800">Confira a tela de importações antes de criar orçamentos.</p>}
      <Link to="/admin/importacoes" className="site-link mt-2">Ver importações</Link>
    </Cartao>
  );
}

export function Painel() {
  const { usuario } = useAuth();
  useTituloDaPagina('Painel — Solar Gestão');
  const { dados: painel, erro, carregando, recarregar } = useCarregar(buscarPainel, 'painel');

  return (
    <>
      <Titulo sobre="Área restrita">Olá, {usuario?.nome}.</Titulo>
      <EstadoDaCarga carregando={carregando && !painel} erro={erro} aoTentarDeNovo={recarregar} />
      {painel && (
        <div className="flex flex-col gap-8">
          <Funil painel={painel} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Contagem rotulo="Valor aceito no mês" valor={formatarReais(painel.valorAceitoNoMes, true)} caminho="/admin/propostas?status=aceita" />
            <Contagem rotulo="Clientes" valor={formatarNumero(painel.clientes)} caminho="/admin/clientes" />
            <Contagem rotulo="Simulações" valor={formatarNumero(painel.simulacoes)} caminho="/admin/simulacoes" />
            <Contagem rotulo="Com pedido de proposta" valor={formatarNumero(painel.simulacoesComPedido)} caminho="/admin/simulacoes?comPedido=true" />
          </div>
          {temAcesso(usuario?.papel, 'admin') && <UltimaImportacao painel={painel} />}
        </div>
      )}
    </>
  );
}
