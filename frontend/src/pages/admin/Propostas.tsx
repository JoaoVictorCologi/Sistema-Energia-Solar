import { Link, NavLink, useSearchParams } from 'react-router';
import { classeDaLinha, classeDoCabecalho, EstadoDaCarga, Paginacao, ROTULOS_DO_STATUS, SeloDeStatus, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { listarPropostas, type StatusDaProposta } from '../../services/api.ts';
import { formatarData, formatarDiaDoInstante, formatarReais } from '../../utils/formatar.ts';

const FILTROS: (StatusDaProposta | undefined)[] = [undefined, 'enviada', 'aceita', 'recusada'];

function lerStatus(texto: string | null): StatusDaProposta | undefined {
  return texto === 'enviada' || texto === 'aceita' || texto === 'recusada' ? texto : undefined;
}

export function Propostas() {
  useTituloDaPagina('Propostas — Solar Gestão');
  const [parametros] = useSearchParams();
  const status = lerStatus(parametros.get('status'));
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const { dados, erro, carregando, recarregar } = useCarregar(() => listarPropostas({ status, pagina }), `${status}|${pagina}`);
  const linkDaPagina = (numero: number) => `?${new URLSearchParams({ ...(status ? { status } : {}), pagina: String(numero) })}`;

  return (
    <>
      <Titulo sobre="Geradas a partir das simulações dos clientes">Propostas</Titulo>
      <p className="mb-6 text-sm text-muted-foreground">
        Para gerar uma proposta, abra o cliente em <Link to="/admin/clientes" className="font-semibold underline underline-offset-4">Clientes</Link> e escolha a simulação.
      </p>
      <nav aria-label="Filtrar por status" className="mb-6 flex flex-wrap gap-2">
        {FILTROS.map((filtro) => (
          <NavLink key={filtro ?? 'todas'} to={filtro ? `?status=${filtro}` : '?'} aria-current={filtro === status ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-sm border border-border bg-white px-4 text-sm font-medium aria-[current=page]:border-brand-blue aria-[current=page]:font-semibold aria-[current=page]:text-brand-blue">
            {filtro ? ROTULOS_DO_STATUS[filtro] : 'Todas'}
          </NavLink>
        ))}
      </nav>

      <EstadoDaCarga carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} />
      {dados && !carregando && (dados.propostas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma proposta {status ? `com status “${ROTULOS_DO_STATUS[status].toLowerCase()}”` : 'gerada ainda'}.</p> : (
        <>
          <Tabela legenda="Propostas">
            <thead className={classeDoCabecalho}>
              <tr><th scope="col">Proposta</th><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col">Investimento</th><th scope="col">Válida até</th><th scope="col">Gerada em</th></tr>
            </thead>
            <tbody>
              {dados.propostas.map((proposta) => (
                <tr key={proposta.id} className={classeDaLinha}>
                  <td><Link to={`/admin/propostas/${proposta.id}`} className="font-semibold text-brand-blue underline-offset-4 hover:underline">Nº {proposta.id}</Link></td>
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
