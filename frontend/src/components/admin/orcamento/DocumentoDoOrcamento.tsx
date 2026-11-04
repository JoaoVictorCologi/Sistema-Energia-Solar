import { Alertas, Cartao, descreverSistema, ListaDePremissas } from '../../simulador/BlocosDoResultado.tsx';
import { GraficoConsumoGeracao, TabelaMesAMes } from '../../simulador/GraficoConsumoGeracao.tsx';
import { empresa } from '../../../dados/empresa.ts';
import type { Proposta } from '../../../services/api.ts';
import { formatarAnos, formatarData, formatarNumero, formatarReais } from '../../../utils/formatar.ts';
import { descreverCondicao } from './Condicoes.tsx';

const classeDoTitulo = 'mb-4 font-heading text-xl font-medium text-brand-blue';

// Documento entregue ao cliente, impresso ou em PDF. Margem, justificativas e observações internas nunca entram aqui.
export function DocumentoDoOrcamento({ proposta }: { proposta: Proposta }) {
  return (
    <article className="flex flex-col gap-10 bg-white print:gap-6">
      <Cabecalho proposta={proposta} />
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <Cartao rotulo="Sistema" valor={`${formatarNumero(proposta.dimensionamento.kwpInstalado, 2)} kWp`}>{descreverSistema(proposta.dimensionamento)}</Cartao>
        <Cartao rotulo="Valor final" valor={formatarReais(proposta.investimento, true)}>Equipamentos e instalação. Válido até {formatarData(proposta.validaAte)}.</Cartao>
        <Cartao rotulo="Economia por mês" valor={formatarReais(proposta.indicadores.economiaMensalMedia)}>Média do primeiro ano.</Cartao>
        <Cartao rotulo="Retorno do investimento" valor={formatarAnos(proposta.indicadores.paybackSimplesAnos)}>
          Economia de {formatarReais(proposta.indicadores.economiaTotal, true)} em 25 anos.
        </Cartao>
      </dl>
      <Equipamentos proposta={proposta} />
      <ValorFinal proposta={proposta} />
      <CondicoesDePagamento proposta={proposta} />
      <EstimadoVersusOrcamento proposta={proposta} />
      <section className="break-inside-avoid">
        <h2 className={classeDoTitulo}>Consumo × geração no primeiro ano</h2>
        <GraficoConsumoGeracao meses={proposta.primeiroAno} pedido={proposta.pedido} />
        <div className="print:hidden"><TabelaMesAMes meses={proposta.primeiroAno} /></div>
      </section>
      <section className="break-inside-avoid">
        <h2 className={classeDoTitulo}>Premissas do cálculo</h2>
        <ListaDePremissas premissas={proposta.premissas} indicadores={proposta.indicadores} />
        <div className="print:hidden"><Alertas alertas={proposta.alertas} todos /></div>
      </section>
      <Rodape proposta={proposta} />
    </article>
  );
}

function Cabecalho({ proposta }: { proposta: Proposta }) {
  const { cliente, local, premissas } = proposta;
  return (
    <header className="flex flex-col gap-6">
      {proposta.status === 'rascunho' && (
        <p className="rounded-sm border border-brand-orange/50 bg-brand-orange/10 px-4 py-2 text-sm font-semibold text-brand-ink">Prévia de um rascunho: os valores ainda podem mudar até o envio.</p>
      )}
      {/* print-color-adjust mantém o fundo azul na impressão, porque a logo tem letras brancas. */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-brand-deep px-6 py-4 text-white [print-color-adjust:exact]">
        <img src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura} className="h-14 w-auto" />
        <div className="text-right text-sm">
          <p className="font-heading text-lg font-medium">Orçamento nº {proposta.id}{proposta.versao > 1 && ` · versão ${proposta.versao}`}</p>
          <p className="text-white/90">Emitido em {formatarData(proposta.emitidaEm)} · válido até {formatarData(proposta.validaAte)}</p>
        </div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <div><dt className="text-muted-foreground">Cliente</dt><dd className="mt-1 font-semibold">{cliente.nome}</dd></div>
        <div><dt className="text-muted-foreground">Contato</dt><dd className="mt-1 break-words">{cliente.email}<br />{cliente.telefone}</dd></div>
        <div><dt className="text-muted-foreground">Local</dt><dd className="mt-1">{local.cidade} / {local.uf} · CEP {cliente.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}</dd></div>
        <div><dt className="text-muted-foreground">Distribuidora</dt><dd className="mt-1">{premissas.distribuidora}</dd></div>
      </dl>
    </header>
  );
}

function Equipamentos({ proposta }: { proposta: Proposta }) {
  const { modulo, inversor } = proposta.equipamentos;
  const linhas = [
    { item: 'Módulo fotovoltaico', equipamento: modulo, potencia: `${formatarNumero(modulo.potenciaW)} W` },
    { item: 'Inversor', equipamento: inversor, potencia: `${formatarNumero(inversor.potenciaW / 1000, 1)} kW` },
  ];
  return (
    <section className="break-inside-avoid">
      <h2 className={classeDoTitulo}>Equipamentos</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground"><tr><th scope="col" className="py-2">Item</th><th scope="col" className="py-2">Fabricante e modelo</th><th scope="col" className="py-2">Potência</th><th scope="col" className="py-2 text-right">Quantidade</th></tr></thead>
          <tbody>
            {linhas.map(({ item, equipamento, potencia }) => (
              <tr key={item} className="border-b border-border">
                <td className="py-2">{item}</td><td className="py-2">{equipamento.fabricante} {equipamento.modelo}</td><td className="py-2">{potencia}</td>
                <td className="py-2 text-right tabular-nums">{equipamento.quantidade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Com ajustes, detalha do preço calculado até o valor final, sem a composição interna (margem).
function ValorFinal({ proposta }: { proposta: Proposta }) {
  const { precos, ajustes = [] } = proposta;
  if (ajustes.length === 0 || precos.calculado === undefined) return null;
  return (
    <section className="break-inside-avoid">
      <h2 className={classeDoTitulo}>Valor do orçamento</h2>
      <dl className="divide-y divide-border border-y border-border text-sm">
        <div className="flex justify-between gap-4 py-2"><dt>Sistema instalado</dt><dd className="tabular-nums">{formatarReais(precos.calculado)}</dd></div>
        {ajustes.map((ajuste) => (
          <div key={ajuste.id} className="flex justify-between gap-4 py-2"><dt>{ajuste.descricao}</dt><dd className="tabular-nums">{ajuste.valorEmReais > 0 ? '+ ' : ''}{formatarReais(ajuste.valorEmReais)}</dd></div>
        ))}
        <div className="flex justify-between gap-4 py-2 font-semibold"><dt>Valor final</dt><dd className="tabular-nums">{formatarReais(proposta.investimento)}</dd></div>
      </dl>
    </section>
  );
}

function CondicoesDePagamento({ proposta }: { proposta: Proposta }) {
  const condicoes = proposta.condicoes ?? [];
  if (condicoes.length === 0) return null;
  return (
    <section className="break-inside-avoid">
      <h2 className={classeDoTitulo}>Condições de pagamento</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr><th scope="col" className="py-2">Forma</th><th scope="col" className="py-2">Condição</th><th scope="col" className="py-2 text-right">Total</th><th scope="col" className="py-2 text-right">Economia mensal menos a parcela</th></tr>
          </thead>
          <tbody>
            {condicoes.map((condicao) => (
              <tr key={condicao.id} className="border-b border-border">
                <td className="py-2 font-medium">{condicao.nome}</td>
                <td className="py-2">{descreverCondicao(condicao)}{condicao.carenciaDias > 0 && ` · carência de ${condicao.carenciaDias} dias`}</td>
                <td className="py-2 text-right tabular-nums">{formatarReais(condicao.valorTotal)}</td>
                <td className="py-2 text-right tabular-nums">{condicao.economiaMensalMenosParcela === null ? '—' : formatarReais(condicao.economiaMensalMenosParcela)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Compara o que o simulador mostrou ao cliente com os valores finais do orçamento.
function EstimadoVersusOrcamento({ proposta }: { proposta: Proposta }) {
  const estimado = proposta.estimadoPeloSimulador;
  if (!estimado) return null;
  const { dimensionamento, indicadores, investimento } = proposta;
  const reaisOuTraco = (valor: number | null, semCentavos = false) => (valor === null ? '—' : formatarReais(valor, semCentavos));
  const linhas = [
    ['Sistema', estimado.kwpInstalado === null ? '—' : `${formatarNumero(estimado.kwpInstalado, 2)} kWp`, `${formatarNumero(dimensionamento.kwpInstalado, 2)} kWp`],
    ['Investimento', reaisOuTraco(estimado.investimento, true), formatarReais(investimento, true)],
    ['Economia por mês', reaisOuTraco(estimado.economiaMensalMedia), formatarReais(indicadores.economiaMensalMedia)],
    ['Retorno', formatarAnos(estimado.paybackSimplesAnos), formatarAnos(indicadores.paybackSimplesAnos)],
  ];
  return (
    <section className="break-inside-avoid">
      <h2 className={classeDoTitulo}>Estimado pelo simulador × este orçamento</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-right text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground"><tr><th scope="col" className="py-2 text-left font-medium">Item</th><th scope="col" className="py-2 font-medium">Simulador</th><th scope="col" className="py-2 font-medium">Orçamento</th></tr></thead>
          <tbody className="tabular-nums">
            {linhas.map(([item, doSimulador, doOrcamento]) => (
              <tr key={item} className="border-b border-border"><th scope="row" className="py-2 text-left font-medium">{item}</th><td className="py-2">{doSimulador}</td><td className="py-2 font-semibold">{doOrcamento}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Rodape({ proposta }: { proposta: Proposta }) {
  const { premissas } = proposta;
  return (
    <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground break-inside-avoid">
      <p>
        Cálculo pelas regras da Lei 14.300/2022 ({premissas.regime === 'GD_I' ? 'GD I' : 'GD II'}), com a tarifa da {premissas.distribuidora} publicada pela ANEEL, a irradiação do
        Atlas Brasileiro de Energia Solar (INPE) e os indicadores do Banco Central da data de emissão. A geração real depende do local, da
        orientação do telhado e do clima. Orçamento válido até {formatarData(proposta.validaAte)}; versão dos parâmetros {premissas.versaoParametros}.
      </p>
      <p className="mt-3">{empresa.nome} · {empresa.telefoneExibicao} · {empresa.endereco.linha1}, {empresa.endereco.linha2}</p>
    </footer>
  );
}
