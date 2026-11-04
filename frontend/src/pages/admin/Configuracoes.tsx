import { CircleCheck, CircleMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { FormularioDaForma } from '../../components/admin/FormularioDaForma.tsx';
import { Aviso, Cartao, classeDoBotaoSecundario, EstadoDaCarga, Titulo } from '../../components/admin/Pecas.tsx';
import { CampoDeTexto } from '../../components/formulario/Campos.tsx';
import { NOMES_DO_PAGAMENTO } from '../../dados/perguntasDoSimulador.ts';
import { mensagemGeral, useAcao } from '../../hooks/useAcao.ts';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { alterarConfiguracao, buscarConfiguracao, listarFormas, type ConfiguracaoComercial, type FormaDePagamento } from '../../services/api.ts';
import { formatarDataEHora, formatarNumero, formatarPercentual } from '../../utils/formatar.ts';
import { fracaoParaCampo, lerNumero, percentualParaFracao } from '../../utils/numeros.ts';

// Valores comerciais editados pela gestão. Cada alteração vale para os próximos cálculos.
export function Configuracoes() {
  useTituloDaPagina('Configurações — Solar Gestão');
  const configuracao = useCarregar(buscarConfiguracao, 'configuracao');

  return (
    <>
      <Titulo sobre="Valores comerciais, sem mexer no código">Configurações</Titulo>
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">Valem para os próximos cálculos. Orçamento já enviado guarda os valores que usou.</p>
      <div className="flex flex-col gap-8">
        <EstadoDaCarga carregando={configuracao.carregando && !configuracao.dados} erro={configuracao.erro} aoTentarDeNovo={configuracao.recarregar} />
        {configuracao.dados && <FormularioComercial key={configuracao.dados.alteradoEm} inicial={configuracao.dados} aoSalvar={configuracao.recarregar} />}
        <FormasDePagamento />
      </div>
    </>
  );
}

// Frações e valores da API no formato dos campos da tela.
function camposDaConfiguracao(configuracao: ConfiguracaoComercial) {
  return {
    margem: fracaoParaCampo(configuracao.margem),
    instalacaoPorKwp: formatarNumero(configuracao.instalacaoPorKwp, 2),
    custoReferenciaPorKwp: formatarNumero(configuracao.custoReferenciaPorKwp, 2),
    validadeDias: String(configuracao.validadeDias),
    limiteDesconto: fracaoParaCampo(configuracao.limiteDesconto),
  };
}

function FormularioComercial({ inicial, aoSalvar }: { inicial: ConfiguracaoComercial; aoSalvar: () => void }) {
  const [campos, setCampos] = useState(() => camposDaConfiguracao(inicial));
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<typeof campos>) => setCampos((atual) => ({ ...atual, ...mudanca }));

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const salva = await executar(() => alterarConfiguracao({
      margem: percentualParaFracao(lerNumero(campos.margem)),
      instalacaoPorKwp: lerNumero(campos.instalacaoPorKwp),
      custoReferenciaPorKwp: lerNumero(campos.custoReferenciaPorKwp),
      validadeDias: lerNumero(campos.validadeDias),
      limiteDesconto: percentualParaFracao(lerNumero(campos.limiteDesconto)),
    }));
    if (salva) aoSalvar();
  }

  return (
    <Cartao>
      <h2 className="font-heading text-lg font-medium text-brand-blue">Configuração comercial</h2>
      <p className="mt-1 text-sm text-muted-foreground">Última alteração: {formatarDataEHora(inicial.alteradoEm)}.</p>
      <form onSubmit={salvar} noValidate className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoDeTexto id="config-margem" rotulo="Margem (%)" inputMode="decimal" value={campos.margem} erro={erro?.campos.margem} onChange={(evento) => mudar({ margem: evento.target.value })} />
          <CampoDeTexto id="config-instalacao" rotulo="Instalação por kWp (R$)" inputMode="decimal" value={campos.instalacaoPorKwp} erro={erro?.campos.instalacaoPorKwp} onChange={(evento) => mudar({ instalacaoPorKwp: evento.target.value })} />
          <CampoDeTexto id="config-custo" rotulo="Custo de referência por kWp (R$)" inputMode="decimal" value={campos.custoReferenciaPorKwp} erro={erro?.campos.custoReferenciaPorKwp}
            ajuda="O investimento estimado no simulador público." onChange={(evento) => mudar({ custoReferenciaPorKwp: evento.target.value })} />
          <CampoDeTexto id="config-validade" rotulo="Validade do orçamento (dias)" inputMode="numeric" value={campos.validadeDias} erro={erro?.campos.validadeDias} onChange={(evento) => mudar({ validadeDias: evento.target.value })} />
          <CampoDeTexto id="config-limite" rotulo="Desconto sem justificativa, até (%)" inputMode="decimal" value={campos.limiteDesconto} erro={erro?.campos.limiteDesconto} onChange={(evento) => mudar({ limiteDesconto: evento.target.value })} />
        </div>
        {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
        <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Salvando…' : 'Salvar configuração'}</button>
      </form>
    </Cartao>
  );
}

function descreverForma(forma: FormaDePagamento): string {
  if (forma.tipo === 'avista') return `Desconto de ${formatarPercentual(forma.descontoAvista)}`;
  const taxa = forma.taxaMensal === null ? 'taxa não definida' : `${formatarPercentual(forma.taxaMensal)} ao mês`;
  return `${forma.parcelasMinimas} a ${forma.parcelasMaximas} parcelas · ${taxa} · entrada mínima de ${formatarPercentual(forma.entradaMinima)} · carência de até ${forma.carenciaMaximaDias} dias`;
}

function ItemDaForma({ forma, aoSalvar }: { forma: FormaDePagamento; aoSalvar: () => void }) {
  const Icone = forma.ativa ? CircleCheck : CircleMinus;
  return (
    <li>
      <details className="rounded-md border border-border bg-white">
        <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
          <span className="font-semibold text-brand-blue">{forma.nome}</span>
          <span className="text-muted-foreground">{NOMES_DO_PAGAMENTO[forma.tipo]}</span>
          <span className={'inline-flex items-center gap-1 font-semibold ' + (forma.ativa ? 'text-green-800' : 'text-muted-foreground')}><Icone aria-hidden="true" className="size-4" /> {forma.ativa ? 'Ativa' : 'Inativa'}</span>
          <span className="w-full text-muted-foreground">{descreverForma(forma)}</span>
        </summary>
        <div className="border-t border-border p-4"><FormularioDaForma forma={forma} aoSalvar={aoSalvar} /></div>
      </details>
    </li>
  );
}

function FormasDePagamento() {
  const formas = useCarregar(listarFormas, 'formas');
  // A chave muda a cada carga, e o formulário reabre com os valores gravados.
  const [versao, setVersao] = useState(0);
  const aoSalvar = () => { formas.recarregar(); setVersao((atual) => atual + 1); };

  return (
    <section aria-labelledby="titulo-formas" className="flex flex-col gap-4">
      <h2 id="titulo-formas" className="font-heading text-xl font-medium text-brand-blue">Formas de pagamento</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">Cartão e financiamento só ficam ativos com a taxa preenchida. As ativas aparecem no simulador e nos orçamentos.</p>
      <EstadoDaCarga carregando={formas.carregando && !formas.dados} erro={formas.erro} aoTentarDeNovo={formas.recarregar} />
      {formas.dados && <ul key={versao} className="flex flex-col gap-3">{formas.dados.map((forma) => <ItemDaForma key={forma.id} forma={forma} aoSalvar={aoSalvar} />)}</ul>}
      <details className="rounded-md border border-border bg-white">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-blue">Cadastrar nova forma</summary>
        <div className="border-t border-border p-4"><FormularioDaForma key={versao} aoSalvar={aoSalvar} /></div>
      </details>
    </section>
  );
}
