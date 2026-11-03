import { Link } from 'react-router';
import { Cartao, EstadoDaCarga, SeloDeStatus, Titulo } from '../../components/admin/Pecas.tsx';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarPainel, type Painel as DadosDoPainel, type StatusDaProposta } from '../../services/api.ts';
import { formatarDataEHora, formatarNumero } from '../../utils/formatar.ts';

const ROTULO_DA_IMPORTACAO = { executando: 'Rodando agora', sucesso: 'Sucesso', sem_alteracao: 'Sem alteração', erro: 'Erro' } as const;

function Contagem({ rotulo, valor, caminho }: { rotulo: string; valor: number; caminho: string }) {
  return (
    <Link to={caminho} className="block rounded-md border border-border bg-white p-5 hover:border-brand-blue sm:p-6">
      <span className="block text-sm font-semibold text-muted-foreground">{rotulo}</span>
      <span className="mt-2 block font-heading text-3xl font-medium text-brand-blue tabular-nums">{formatarNumero(valor)}</span>
    </Link>
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
      {!ok && <p className="mt-2 text-sm font-semibold text-red-800">Confira a tela de importações antes de gerar propostas.</p>}
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
      <Titulo sobre="Área do administrador">Olá, {usuario?.nome}.</Titulo>
      <EstadoDaCarga carregando={carregando && !painel} erro={erro} aoTentarDeNovo={recarregar} />
      {painel && (
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Contagem rotulo="Clientes" valor={painel.clientes} caminho="/admin/clientes" />
            <Contagem rotulo="Simulações" valor={painel.simulacoes} caminho="/admin/clientes" />
            <Contagem rotulo="Simulações com pedido de proposta" valor={painel.simulacoesComPedido} caminho="/admin/clientes" />
          </div>
          <Cartao>
            <h2 className="font-heading text-lg font-medium text-brand-blue">Propostas por status</h2>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {(Object.keys(painel.propostasPorStatus) as StatusDaProposta[]).map((status) => (
                <li key={status}>
                  <Link to={`/admin/propostas?status=${status}`} className="inline-flex min-h-11 items-center gap-3">
                    <SeloDeStatus status={status} />
                    <span className="font-heading text-2xl font-medium text-brand-blue tabular-nums">{painel.propostasPorStatus[status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
          <UltimaImportacao painel={painel} />
        </div>
      )}
    </>
  );
}
