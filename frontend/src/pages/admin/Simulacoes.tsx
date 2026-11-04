import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, Paginacao, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { NOMES_DA_LIGACAO } from '../../components/simulador/BlocosDoResultado.tsx';
import { CampoDeSelecao, CampoDeTexto } from '../../components/formulario/Campos.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { listarSimulacoes, type FiltroDeSimulacoes, type SimulacaoDaLista } from '../../services/api.ts';
import { formatarDiaDoInstante, formatarNumero, formatarReais } from '../../utils/formatar.ts';

type Filtros = Omit<FiltroDeSimulacoes, 'pagina'>;

const comPedidoValido = (texto: string | null) => (texto === 'true' || texto === 'false' ? texto : undefined);

function lerFiltros(parametros: URLSearchParams): Filtros {
  return {
    de: parametros.get('de') ?? undefined,
    ate: parametros.get('ate') ?? undefined,
    cidade: parametros.get('cidade') ?? undefined,
    comPedido: comPedidoValido(parametros.get('comPedido')),
  };
}

// Filtros na URL: é possível voltar, recarregar e abrir a lista pelos atalhos do painel.
function paraUrl(filtros: Filtros, pagina = 1): URLSearchParams {
  const preenchidos = Object.entries({ ...filtros, pagina: pagina > 1 ? String(pagina) : undefined }).filter(([, valor]) => valor);
  return new URLSearchParams(preenchidos as [string, string][]);
}

function FormularioDeFiltros({ filtros, aoFiltrar }: { filtros: Filtros; aoFiltrar: (filtros: Filtros) => void }) {
  const [rascunho, setRascunho] = useState(filtros);
  const mudar = (mudanca: Partial<Filtros>) => setRascunho((atual) => ({ ...atual, ...mudanca }));

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    aoFiltrar(rascunho);
  }

  return (
    <form onSubmit={enviar} className="mb-6 grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr_1.2fr_auto]">
      <CampoDeTexto id="filtro-de" rotulo="De" type="date" value={rascunho.de ?? ''} onChange={(evento) => mudar({ de: evento.target.value || undefined })} />
      <CampoDeTexto id="filtro-ate" rotulo="Até" type="date" value={rascunho.ate ?? ''} onChange={(evento) => mudar({ ate: evento.target.value || undefined })} />
      <CampoDeTexto id="filtro-cidade" rotulo="Cidade" value={rascunho.cidade ?? ''} onChange={(evento) => mudar({ cidade: evento.target.value || undefined })} />
      <CampoDeSelecao id="filtro-pedido" rotulo="Pedido de proposta" value={rascunho.comPedido ?? ''} onChange={(evento) => mudar({ comPedido: comPedidoValido(evento.target.value) })}>
        <option value="">Todas</option>
        <option value="true">Com pedido</option>
        <option value="false">Sem pedido</option>
      </CampoDeSelecao>
      <button type="submit" className={classeDoBotaoSecundario + ' self-end xl:min-h-12'}>Filtrar</button>
    </form>
  );
}

function LinhaDaSimulacao({ simulacao }: { simulacao: SimulacaoDaLista }) {
  return (
    <tr className={classeDaLinha}>
      <td>{formatarDiaDoInstante(simulacao.criadaEm)}</td>
      <td>{simulacao.cidade} / {simulacao.uf}<br /><span className="text-xs text-muted-foreground">{simulacao.distribuidora}</span></td>
      <td className="tabular-nums">{formatarNumero(simulacao.consumoMedioKwh)} kWh<br /><span className="text-xs text-muted-foreground">{NOMES_DA_LIGACAO[simulacao.tipoLigacao]}</span></td>
      <td className="tabular-nums">{formatarNumero(simulacao.kwpInstalado, 2)} kWp</td>
      <td className="tabular-nums">{formatarReais(simulacao.economiaMensalMedia, true)}/mês</td>
      <td className="tabular-nums">{formatarReais(simulacao.investimentoEstimado, true)}</td>
      <td>
        {simulacao.cliente
          ? <Link to={`/admin/clientes/${simulacao.cliente.id}`} className="font-semibold text-brand-blue underline-offset-4 hover:underline">{simulacao.cliente.nome}</Link>
          : <span className="text-muted-foreground">Sem pedido</span>}
      </td>
    </tr>
  );
}

export function Simulacoes() {
  useTituloDaPagina('Simulações — Solar Gestão');
  const [parametros, setParametros] = useSearchParams();
  const filtros = lerFiltros(parametros);
  const pagina = Math.max(1, Number(parametros.get('pagina')) || 1);
  const { dados, erro, carregando, recarregar } = useCarregar(() => listarSimulacoes({ ...filtros, pagina }), parametros.toString());

  return (
    <>
      <Titulo sobre="Tudo o que passou pelo simulador">Simulações</Titulo>
      <FormularioDeFiltros filtros={filtros} aoFiltrar={(novos) => setParametros(paraUrl(novos))} />
      <EstadoDaCarga carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} />
      {dados && !carregando && (dados.simulacoes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma simulação com esses filtros.</p> : (
        <>
          <Tabela legenda="Simulações">
            <thead className={classeDoCabecalho}>
              <tr><th scope="col">Data</th><th scope="col">Local</th><th scope="col">Consumo</th><th scope="col">Sistema</th><th scope="col">Economia</th><th scope="col">Investimento estimado</th><th scope="col">Cliente</th></tr>
            </thead>
            <tbody>{dados.simulacoes.map((simulacao) => <LinhaDaSimulacao key={simulacao.codigo} simulacao={simulacao} />)}</tbody>
          </Tabela>
          <Paginacao pagina={dados.pagina} porPagina={dados.porPagina} total={dados.total} linkDaPagina={(numero) => `?${paraUrl(filtros, numero)}`} />
        </>
      ))}
    </>
  );
}
