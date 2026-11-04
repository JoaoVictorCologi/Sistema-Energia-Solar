import { Link, NavLink, useSearchParams } from 'react-router';
import { classeDaLinha, classeDoCabecalho, EstadoDaCarga, Paginacao, ROTULOS_DO_STATUS, SeloDeStatus, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { listarPropostas, type FiltroDeStatus } from '../../services/api.ts';
import { formatarData, formatarDiaDoInstante, formatarReais } from '../../utils/formatar.ts';

const ROTULOS_DO_FILTRO: Record<FiltroDeStatus, string> = { ...ROTULOS_DO_STATUS, vencida: 'Vencida' };
const FILTROS = Object.keys(ROTULOS_DO_FILTRO) as FiltroDeStatus[];

function lerStatus(texto: string | null): FiltroDeStatus | undefined {
  return FILTROS.find((filtro) => filtro === texto);
}

// Lista de orçamentos, nome usado na interface para o que a API chama de proposta. Status e página ficam na URL.
export function Propostas() {
  useTituloDaPagina('Orçamentos — Solar Gestão');
  const [parametros] = useSearchParams();
  const status = lerStatus(parametros.get('status'));
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const { dados, erro, carregando, recarregar } = useCarregar(() => listarPropostas({ status, pagina }), `${status}|${pagina}`);
  const linkDaPagina = (numero: number) => `?${new URLSearchParams({ ...(status ? { status } : {}), pagina: String(numero) })}`;

  return (
    <>
      <Titulo sobre="Criados a partir das simulações dos clientes">Orçamentos</Titulo>
      <p className="mb-6 text-sm text-muted-foreground">
        Para criar um orçamento, abra o cliente em <Link to="/admin/clientes" className="font-semibold underline underline-offset-4">Clientes</Link> e escolha a simulação.
      </p>
      <nav aria-label="Filtrar por status" className="mb-6 flex flex-wrap gap-2">
        {[undefined, ...FILTROS].map((filtro) => (
          <NavLink key={filtro ?? 'todas'} to={filtro ? `?status=${filtro}` : '?'} aria-current={filtro === status ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-sm border border-border bg-white px-4 text-sm font-medium aria-[current=page]:border-brand-blue aria-[current=page]:font-semibold aria-[current=page]:text-brand-blue">
            {filtro ? ROTULOS_DO_FILTRO[filtro] : 'Todos'}
          </NavLink>
        ))}
      </nav>

      <EstadoDaCarga carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} />
      {dados && !carregando && (dados.propostas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum orçamento {status ? `com status “${ROTULOS_DO_FILTRO[status].toLowerCase()}”` : 'criado ainda'}.</p> : (
        <>
          <Tabela legenda="Orçamentos">
            <thead className={classeDoCabecalho}>
              <tr><th scope="col">Orçamento</th><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col">Valor final</th><th scope="col">Válido até</th><th scope="col">Criado em</th></tr>
            </thead>
            <tbody>
              {dados.propostas.map((proposta) => (
                <tr key={proposta.id} className={classeDaLinha}>
                  <td><Link to={`/admin/propostas/${proposta.id}`} className="font-semibold text-brand-blue underline-offset-4 hover:underline">Nº {proposta.id}{proposta.versao > 1 && ` · v${proposta.versao}`}</Link></td>
                  <td><Link to={`/admin/clientes/${proposta.clienteId}`} className="underline-offset-4 hover:underline">{proposta.clienteNome}</Link></td>
                  <td><SeloDeStatus status={proposta.status} vencida={proposta.vencida} /></td>
                  <td className="tabular-nums">{formatarReais(proposta.investimento)}</td>
                  <td>{formatarData(proposta.validaAte)}</td>
                  <td>{formatarDiaDoInstante(proposta.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} linkDaPagina={linkDaPagina} />
        </>
      ))}
    </>
  );
}
