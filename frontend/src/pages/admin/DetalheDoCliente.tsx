import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { GerarProposta } from '../../components/admin/GerarProposta.tsx';
import { Cartao, classeDaLinha, classeDoBotaoSecundario, classeDoCabecalho, EstadoDaCarga, SeloDeStatus, Tabela, Titulo } from '../../components/admin/Pecas.tsx';
import { RespostasDoCliente } from '../../components/admin/RespostasDoCliente.tsx';
import { NOMES_DA_LIGACAO } from '../../components/simulador/BlocosDoResultado.tsx';
import { NOMES_DO_CONTATO, NOMES_DO_HORARIO } from '../../dados/perguntasDoSimulador.ts';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarCliente, type DetalheDoCliente as Detalhe, type SimulacaoDoCliente } from '../../services/api.ts';
import { formatarData, formatarDataEHora, formatarDiaDoInstante, formatarNumero, formatarReais } from '../../utils/formatar.ts';

// Reúne o necessário para orçar: contato, endereço, respostas de cada simulação e orçamentos.
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

function descreverEndereco(endereco: Detalhe['cliente']['endereco']): string {
  if (!endereco) return 'Não informado';
  const { logradouro, numero, complemento, bairro } = endereco;
  return [[logradouro, numero].filter(Boolean).join(', '), complemento, bairro].filter(Boolean).join(' · ');
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
        <div className="sm:col-span-2 lg:col-span-3"><dt className="text-muted-foreground">Endereço da instalação</dt><dd className="mt-1 font-medium">{descreverEndereco(cliente.endereco)}</dd></div>
        <div><dt className="text-muted-foreground">Contato preferido</dt><dd className="mt-1 font-medium">{cliente.contatoPreferido ? NOMES_DO_CONTATO[cliente.contatoPreferido] : 'Não informado'}</dd></div>
        <div><dt className="text-muted-foreground">Melhor horário</dt><dd className="mt-1 font-medium">{cliente.melhorHorario ? NOMES_DO_HORARIO[cliente.melhorHorario] : 'Não informado'}</dd></div>
        <div><dt className="text-muted-foreground">Autoriza uso para calibração</dt><dd className="mt-1 font-medium">{cliente.autorizaUsoParaCalibracao ? 'Sim' : 'Não'}</dd></div>
      </dl>
    </Cartao>
  );
}

// Uma simulação, com as respostas do cliente e a criação do orçamento a partir dela.
function Simulacao({ simulacao }: { simulacao: SimulacaoDoCliente }) {
  const [gerando, setGerando] = useState(false);
  return (
    <li className="rounded-md border border-border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-medium text-brand-blue">
            {formatarNumero(simulacao.kwpInstalado, 2)} kWp · {simulacao.cidade}{simulacao.distribuidora && ` · ${simulacao.distribuidora}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatarNumero(simulacao.consumoMedioKwh)} kWh/mês, ligação {NOMES_DA_LIGACAO[simulacao.tipoLigacao]} ·
            economia de {formatarReais(simulacao.economiaMensalMedia)}/mês · investimento estimado {formatarReais(simulacao.investimentoEstimado, true)} ·
            simulada em {formatarDiaDoInstante(simulacao.criadaEm)}
          </p>
        </div>
        {!gerando && <button type="button" onClick={() => setGerando(true)} className={classeDoBotaoSecundario}>Criar orçamento</button>}
      </div>
      <h4 className="mt-4 text-sm font-semibold text-brand-ink">Respostas do cliente</h4>
      <RespostasDoCliente respostas={simulacao.respostas} />
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
      <h2 id="titulo-propostas" className="mb-4 font-heading text-xl font-medium text-brand-blue">Orçamentos</h2>
      {propostas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum orçamento criado ainda.</p> : (
        <Tabela legenda="Orçamentos do cliente">
          <thead className={classeDoCabecalho}><tr><th scope="col">Orçamento</th><th scope="col">Status</th><th scope="col">Valor final</th><th scope="col">Válido até</th><th scope="col">Criado em</th></tr></thead>
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
