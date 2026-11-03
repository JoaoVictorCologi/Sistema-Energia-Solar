import { Printer } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Aviso, Cartao as Caixa, classeDoBotaoSecundario, EstadoDaCarga, ROTULOS_DO_STATUS, SeloDeStatus } from '../../components/admin/Pecas.tsx';
import { Alertas, Cartao, descreverSistema, ListaDePremissas } from '../../components/simulador/BlocosDoResultado.tsx';
import { GraficoConsumoGeracao, TabelaMesAMes } from '../../components/simulador/GraficoConsumoGeracao.tsx';
import { empresa } from '../../dados/empresa.ts';
import { useCarregar } from '../../hooks/useCarregar.ts';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';
import { buscarProposta, ErroDaApi, mudarStatusDaProposta, type Proposta, type StatusDaProposta } from '../../services/api.ts';
import { formatarAnos, formatarData, formatarNumero, formatarReais } from '../../utils/formatar.ts';

// Lê só o snapshot gravado: reabrir a proposta nunca recalcula (mudança de tarifa ou preço não a altera).
export function DetalheDaProposta() {
  const id = Number(useParams().id);
  const carga = useCarregar(() => buscarProposta(id), String(id));
  const [atualizada, setAtualizada] = useState<Proposta | null>(null);
  const proposta = atualizada?.id === id ? atualizada : carga.dados;
  useTituloDaPagina(`Proposta nº ${id} — Solar Gestão`);

  return (
    <>
      <div className="print:hidden"><Link to="/admin/propostas" className="site-link mb-2">← Propostas</Link></div>
      <EstadoDaCarga carregando={carga.carregando && !proposta} erro={carga.erro} aoTentarDeNovo={carga.recarregar} />
      {proposta && (
        <>
          <Acoes proposta={proposta} aoAtualizar={setAtualizada} />
          <Documento proposta={proposta} />
        </>
      )}
    </>
  );
}

function Acoes({ proposta, aoAtualizar }: { proposta: Proposta; aoAtualizar: (proposta: Proposta) => void }) {
  const [mudando, setMudando] = useState<StatusDaProposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function mudar(status: StatusDaProposta) {
    setMudando(status);
    setErro(null);
    try {
      aoAtualizar(await mudarStatusDaProposta(proposta.id, status));
    } catch (falha) {
      setErro(falha instanceof ErroDaApi ? falha.message : 'Não foi possível mudar o status.');
    } finally {
      setMudando(null);
    }
  }

  const outros = (['enviada', 'aceita', 'recusada'] as const).filter((status) => status !== proposta.status);
  return (
    <Caixa className="mb-8 flex flex-col gap-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Status:</span> <SeloDeStatus status={proposta.status} />
        <span className="flex flex-wrap gap-2 sm:ml-auto">
          {outros.map((status) => (
            <button key={status} type="button" onClick={() => mudar(status)} disabled={mudando !== null} className={classeDoBotaoSecundario}>
              {mudando === status ? 'Salvando…' : `Marcar como ${ROTULOS_DO_STATUS[status].toLowerCase()}`}
            </button>
          ))}
          <button type="button" onClick={() => window.print()} className="site-button min-h-11"><Printer aria-hidden="true" className="size-4" /> Imprimir ou salvar PDF</button>
        </span>
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      <ComposicaoDoPreco proposta={proposta} />
    </Caixa>
  );
}

// Interno: a margem não vai para a versão impressa entregue ao cliente.
function ComposicaoDoPreco({ proposta }: { proposta: Proposta }) {
  const { precos } = proposta;
  const itens = [['Módulos', precos.modulos], ['Inversor', precos.inversor], ['Instalação', precos.instalacao], ['Margem', precos.margem]] as const;
  return (
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-brand-blue">Composição do preço (uso interno)</summary>
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-5">
        {itens.map(([rotulo, valor]) => <div key={rotulo}><dt className="text-muted-foreground">{rotulo}</dt><dd className="font-medium tabular-nums">{formatarReais(valor)}</dd></div>)}
        <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold tabular-nums">{formatarReais(precos.investimento)}</dd></div>
      </dl>
    </details>
  );
}

function Documento({ proposta }: { proposta: Proposta }) {
  return (
    <article className="flex flex-col gap-10 bg-white print:gap-6">
      <Cabecalho proposta={proposta} />
      <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <Cartao rotulo="Sistema" valor={`${formatarNumero(proposta.dimensionamento.kwpInstalado, 2)} kWp`}>{descreverSistema(proposta.dimensionamento)}</Cartao>
        <Cartao rotulo="Investimento" valor={formatarReais(proposta.investimento, true)}>Equipamentos e instalação. Válido até {formatarData(proposta.validaAte)}.</Cartao>
        <Cartao rotulo="Economia por mês" valor={formatarReais(proposta.indicadores.economiaMensalMedia)}>Média do primeiro ano.</Cartao>
        <Cartao rotulo="Retorno do investimento" valor={formatarAnos(proposta.indicadores.paybackSimplesAnos)}>
          Economia de {formatarReais(proposta.indicadores.economiaTotal, true)} em 25 anos.
        </Cartao>
      </dl>
      <Equipamentos proposta={proposta} />
      <section className="break-inside-avoid">
        <h2 className="mb-4 font-heading text-xl font-medium text-brand-blue">Consumo × geração no primeiro ano</h2>
        <GraficoConsumoGeracao meses={proposta.primeiroAno} />
        <div className="print:hidden"><TabelaMesAMes meses={proposta.primeiroAno} /></div>
      </section>
      <section className="break-inside-avoid">
        <h2 className="mb-4 font-heading text-xl font-medium text-brand-blue">Premissas do cálculo</h2>
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
      {/* print-color-adjust: o fundo azul sai na impressão (a logo tem letras brancas). */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-brand-deep px-6 py-4 text-white [print-color-adjust:exact]">
        <img src={empresa.logo.src} alt="Don Energy" width={empresa.logo.largura} height={empresa.logo.altura} className="h-14 w-auto" />
        <div className="text-right text-sm">
          <p className="font-heading text-lg font-medium">Proposta comercial nº {proposta.id}</p>
          <p className="text-white/90">Emitida em {formatarData(proposta.emitidaEm)} · válida até {formatarData(proposta.validaAte)}</p>
        </div>
      </div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
        <div><dt className="text-muted-foreground">Cliente</dt><dd className="mt-1 font-semibold">{cliente.nome}</dd></div>
        <div><dt className="text-muted-foreground">Contato</dt><dd className="mt-1">{cliente.email}<br />{cliente.telefone}</dd></div>
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
      <h2 className="mb-4 font-heading text-xl font-medium text-brand-blue">Equipamentos</h2>
      <table className="w-full text-left text-sm">
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
    </section>
  );
}

function Rodape({ proposta }: { proposta: Proposta }) {
  return (
    <footer className="border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground break-inside-avoid">
      <p>
        Cálculo pelas regras da Lei 14.300/2022 (GD II), com a tarifa da {proposta.premissas.distribuidora} publicada pela ANEEL, a irradiação do
        Atlas Brasileiro de Energia Solar (INPE) e os indicadores do Banco Central da data de emissão. A geração real depende do local, da
        orientação do telhado e do clima. Proposta válida até {formatarData(proposta.validaAte)}; versão dos parâmetros {proposta.premissas.versaoParametros}.
      </p>
      <p className="mt-3">{empresa.nome} · {empresa.telefoneExibicao} · {empresa.endereco.linha1}, {empresa.endereco.linha2}</p>
    </footer>
  );
}
