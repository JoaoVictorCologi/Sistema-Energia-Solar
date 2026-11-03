import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { GerarProposta } from '../../components/admin/GerarProposta.tsx';
import { Cartao, classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, SeloDeStatus, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { NOMES_DA_LIGACAO } from '../../components/simulador/BlocosDoResultado.tsx';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarCliente, type DetalheDoCliente as Detalhe, type SimulacaoDoCliente } from '../../services/api.ts';
import { formatarData, formatarDataEHora, formatarDiaDoInstante, formatarNumero, formatarReais } from '../../utils/formatar.ts';

export function DetalheDoCliente() {
  const id = Number(useParams().id);
  const { dados, erro, carregando, recarregar } = useCarregar(() => buscarCliente(id), String(id));
  useTituloDaPagina(`${dados?.cliente.nome ?? 'Cliente'} — Solar Gestão`);

  return (
    <>
      <Link to="/admin/clientes" className="site-link mb-2">← Clientes</Link>
      <EstadoDaCarga carregando={carregando && !dados} erro={erro} aoTentarDeNovo={recarregar} />
      {dados && (
        <>
          <Titulo sobre="Cliente">{dados.cliente.nome}</Titulo>
          <div className="flex flex-col gap-8">
            <Contato cliente={dados.cliente} />
            <Simulacoes simulacoes={dados.simulacoes} />
            <Propostas propostas={dados.propostas} />
          </div>
        </>
      )}
    </>
  );
}

function Contato({ cliente }: { cliente: Detalhe['cliente'] }) {
  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Contato</h2>
      <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-muted-foreground">E-mail</dt><dd className="mt-1 font-medium"><a href={`mailto:${cliente.email}`} className="underline underline-offset-4">{cliente.email}</a></dd></div>
        <div><dt className="text-muted-foreground">Telefone</dt><dd className="mt-1 font-medium">{cliente.telefone}</dd></div>
        <div><dt className="text-muted-foreground">CEP</dt><dd className="mt-1 font-medium">{cliente.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}</dd></div>
        <div><dt className="text-muted-foreground">Pedido em</dt><dd className="mt-1 font-medium">{formatarDiaDoInstante(cliente.criadoEm)}</dd></div>
        <div><dt className="text-muted-foreground">Aceite do uso dos dados (LGPD)</dt><dd className="mt-1 font-medium">{formatarDataEHora(cliente.aceiteEm)}</dd></div>
      </dl>
    </Cartao>
  );
}

function Simulacao({ simulacao }: { simulacao: SimulacaoDoCliente }) {
  const [gerando, setGerando] = useState(false);
  return (
    <li className="rounded-md border border-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-medium text-brand-blue">
            {formatarNumero(simulacao.kwpInstalado, 2)} kWp · {simulacao.cidade}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatarNumero(simulacao.consumoMedioKwh)} kWh/mês, ligação {NOMES_DA_LIGACAO[simulacao.tipoLigacao]} ·
            economia de {formatarReais(simulacao.economiaMensalMedia)}/mês · investimento estimado {formatarReais(simulacao.investimentoEstimado, true)} ·
            simulada em {formatarDiaDoInstante(simulacao.criadaEm)}
          </p>
        </div>
        {!gerando && <button type="button" onClick={() => setGerando(true)} className={classeDoBotaoSecundario}>Gerar proposta</button>}
      </div>
      {gerando && <div className="mt-5 border-t border-border pt-5"><GerarProposta codigoDaSimulacao={simulacao.codigo} /></div>}
    </li>
  );
}

function Simulacoes({ simulacoes }: { simulacoes: SimulacaoDoCliente[] }) {
  return (
    <section aria-labelledby="titulo-simulacoes">
      <h2 id="titulo-simulacoes" className="mb-4 font-heading text-xl font-medium text-brand-blue">Simulações</h2>
      {simulacoes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma simulação ligada a este cliente.</p> : (
        <ul className="flex flex-col gap-4">{simulacoes.map((simulacao) => <Simulacao key={simulacao.codigo} simulacao={simulacao} />)}</ul>
      )}
    </section>
  );
}

function Propostas({ propostas }: { propostas: Detalhe['propostas'] }) {
  return (
    <section aria-labelledby="titulo-propostas">
      <h2 id="titulo-propostas" className="mb-4 font-heading text-xl font-medium text-brand-blue">Propostas</h2>
      {propostas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma proposta gerada ainda.</p> : (
        <Tabela legenda="Propostas do cliente">
          <thead className={classeDoCabecalho}><tr><th scope="col">Proposta</th><th scope="col">Status</th><th scope="col">Investimento</th><th scope="col">Válida até</th><th scope="col">Gerada em</th></tr></thead>
          <tbody>
            {propostas.map((proposta) => (
              <tr key={proposta.id} className={classeDaLinha}>
                <td><Link to={`/admin/propostas/${proposta.id}`} className="font-semibold text-brand-blue underline-offset-4 hover:underline">Nº {proposta.id}</Link></td>
                <td><SeloDeStatus status={proposta.status} vencida={proposta.vencida} /></td>
                <td className="tabular-nums">{formatarReais(proposta.investimento)}</td>
                <td>{formatarData(proposta.validaAte)}</td>
                <td>{formatarDiaDoInstante(proposta.criadoEm)}</td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </section>
  );
}
