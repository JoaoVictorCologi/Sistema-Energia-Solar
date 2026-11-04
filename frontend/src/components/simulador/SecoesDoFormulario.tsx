import { useEffect, useState, type ReactNode } from 'react';
import { comoOpcoes, NOMES_DA_INCLINACAO, NOMES_DA_ORIENTACAO, NOMES_DAS_HORAS, NOMES_DO_PAGAMENTO, NOMES_DO_PERFIL, NOMES_DO_TELHADO, NOMES_DOS_MESES } from '../../dados/perguntasDoSimulador.ts';
import { listarFormasPublicas, type LocalDoCep, type Subgrupo, type TipoDePagamento, type TipoLigacao } from '../../services/api.ts';
import { CampoDeTexto, GrupoDeOpcoes, MensagemDeErro } from '../formulario/Campos.tsx';
import { NAO_SEI, type DadosDaSimulacao, type ErrosDaSimulacao } from './dadosDaSimulacao.ts';
import { IlustracaoHorasDeSol, IlustracaoOrientacao } from './IlustracoesDoTelhado.tsx';

// Partes do formulário único, na ordem do atendimento: imóvel, conta de luz, uso da energia, telhado e fechamento.
// Cada dado é pedido uma única vez.

export interface PropriedadesDaSecao {
  dados: DadosDaSimulacao;
  mudar: (mudanca: Partial<DadosDaSimulacao>) => void;
  erros: ErrosDaSimulacao;
}

const OPCOES_DE_IMOVEL: { valor: Subgrupo; rotulo: string }[] = [
  { valor: 'B1', rotulo: 'Residencial' },
  { valor: 'B3', rotulo: 'Comercial' },
  { valor: 'B2', rotulo: 'Rural' },
];

const OPCOES_DE_LIGACAO: { valor: TipoLigacao; rotulo: string }[] = [
  { valor: 'monofasico', rotulo: 'Monofásica' },
  { valor: 'bifasico', rotulo: 'Bifásica' },
  { valor: 'trifasico', rotulo: 'Trifásica' },
];

// Acrescenta "Não sei" às opções de uma pergunta de múltipla escolha.
const comNaoSei = <Valor extends string>(nomes: Record<Valor, string>) => [...comoOpcoes(nomes), { valor: NAO_SEI as typeof NAO_SEI, rotulo: 'Não sei' }];

function Secao({ numero, titulo, explicacao, children }: { numero: number; titulo: string; explicacao?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`secao-${numero}`} className="flex flex-col gap-6 rounded-md border border-border bg-background p-6 sm:p-8">
      <div>
        <h2 id={`secao-${numero}`} className="font-heading text-2xl font-medium tracking-tight text-brand-blue">
          <span className="text-muted-foreground">{numero}.</span> {titulo}
        </h2>
        {explicacao && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{explicacao}</p>}
      </div>
      {children}
    </section>
  );
}

function descreverLocal(local: LocalDoCep): string {
  const cidade = `${local.cidade} / ${local.uf}`;
  if (!local.atendido) return `${cidade} — ainda sem tarifa de distribuidora`;
  return local.distribuidoras.length === 1 ? `${cidade} · ${local.distribuidoras[0].sigla}` : cidade;
}

// Município com mais de uma distribuidora (ou sem vínculo na ANEEL): o cliente confirma a da conta de luz.
function EscolhaDeDistribuidora({ local, valor, aoMudar, erro }: { local: LocalDoCep; valor: string; aoMudar: (cnpj: string) => void; erro?: string }) {
  const temSugerida = local.distribuidoras.some((opcao) => opcao.sugerida);
  return (
    <div>
      <GrupoDeOpcoes nome="distribuidora" legenda="Distribuidora da sua conta de luz" valor={valor} aoMudar={aoMudar} erro={erro}
        opcoes={local.distribuidoras.map((opcao) => ({ valor: opcao.cnpj, rotulo: opcao.sugerida ? `${opcao.sigla} (mais comum aqui)` : opcao.sigla }))} />
      <p className="mt-2 text-sm text-muted-foreground">
        {temSugerida
          ? `${local.cidade} é atendida por mais de uma distribuidora. Deixamos marcada a mais comum; confira na sua conta.`
          : `Não encontramos na ANEEL a distribuidora de ${local.cidade}: escolha a da sua conta entre as de ${local.uf}.`}
      </p>
    </div>
  );
}

export function SecaoDoImovel({ dados, mudar, erros, consulta }: PropriedadesDaSecao & { consulta: { local: LocalDoCep | null; erro?: string; buscando: boolean } }) {
  const { local } = consulta;
  const ajuda = consulta.buscando ? 'Buscando a cidade…' : local ? descreverLocal(local) : undefined;
  return (
    <Secao numero={1} titulo="Onde fica o imóvel">
      <CampoDeTexto id="cep" rotulo="CEP do imóvel" inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" maxLength={9}
        value={dados.cep} onChange={(evento) => mudar({ cep: evento.target.value })} erro={erros.cep ?? consulta.erro}
        ajuda={<span role="status">{ajuda}</span>} />
      {local?.escolhaNecessaria && (
        <EscolhaDeDistribuidora local={local} valor={dados.distribuidora} aoMudar={(distribuidora) => mudar({ distribuidora })} erro={erros.distribuidora} />
      )}
      <GrupoDeOpcoes nome="subgrupo" legenda="Tipo de imóvel" opcoes={OPCOES_DE_IMOVEL} valor={dados.subgrupo} aoMudar={(subgrupo) => mudar({ subgrupo })} />
    </Secao>
  );
}

// Recolhido por padrão; fica aberto quando já tem dados ou quando há erro.
function HistoricoDe12Meses({ dados, mudar, erros }: PropriedadesDaSecao) {
  const erro = erros.consumoMensalKwh;
  const [aberto, setAberto] = useState(() => dados.meses.some((mes) => mes.trim() !== ''));

  function mudarMes(indice: number, valor: string) {
    mudar({ meses: dados.meses.map((mes, posicao) => (posicao === indice ? valor : mes)) });
  }

  return (
    <details open={aberto || Boolean(erro)} onToggle={(evento) => setAberto(evento.currentTarget.open)} className="rounded-md border border-border">
      <summary className="min-h-12 cursor-pointer rounded-sm px-4 py-3 text-sm font-semibold text-brand-blue">Tenho o consumo dos últimos 12 meses</summary>
      <div className="border-t border-border p-4">
        <p className="mb-4 text-sm text-muted-foreground">O histórico costuma vir na própria conta. Com ele, o cálculo acompanha os meses de maior consumo.</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {NOMES_DOS_MESES.map((nome, indice) => (
            <CampoDeTexto key={nome} id={`mes-${indice}`} rotulo={nome} inputMode="decimal" value={dados.meses[indice]}
              onChange={(evento) => mudarMes(indice, evento.target.value)} aria-invalid={Boolean(erro)} />
          ))}
        </div>
        <MensagemDeErro id="erro-historico" texto={erro} />
      </div>
    </details>
  );
}

export function SecaoDaConta(propriedades: PropriedadesDaSecao) {
  const { dados, mudar, erros } = propriedades;
  return (
    <Secao numero={2} titulo="Sua conta de luz" explicacao="Tenha a última conta em mãos. Com ela usamos a tarifa que você paga de verdade, com todos os impostos.">
      <GrupoDeOpcoes nome="tipoLigacao" legenda="Tipo de ligação (está na conta)" opcoes={OPCOES_DE_LIGACAO} valor={dados.tipoLigacao} aoMudar={(tipoLigacao) => mudar({ tipoLigacao })} erro={erros.tipoLigacao} />
      <div className="grid gap-5 sm:grid-cols-2">
        <CampoDeTexto id="consumoMedioKwh" rotulo="Consumo da última conta (kWh)" inputMode="decimal" placeholder="Ex.: 400" value={dados.consumo}
          onChange={(evento) => mudar({ consumo: evento.target.value })} erro={erros.consumoMedioKwh ?? erros['conta.consumoKwh']} ajuda="Aparece na conta como consumo do mês." />
        <CampoDeTexto id="conta-valor" rotulo="Valor total dessa conta (R$)" inputMode="decimal" placeholder="Ex.: 420,50" value={dados.valorDaConta}
          onChange={(evento) => mudar({ valorDaConta: evento.target.value })} erro={erros['conta.valorReais']} ajuda="Não sabe? Deixe em branco e usamos a tarifa oficial com os impostos do estado." />
        <CampoDeTexto id="conta-iluminacao" rotulo="Iluminação pública (R$), se houver" inputMode="decimal" placeholder="Ex.: 25,00" value={dados.iluminacao}
          onChange={(evento) => mudar({ iluminacao: evento.target.value })} erro={erros['conta.iluminacaoPublicaReais']} ajuda="Aparece como CIP ou COSIP. Não é energia, por isso sai da conta." />
      </div>
      <HistoricoDe12Meses {...propriedades} />
    </Secao>
  );
}

export function SecaoDoUso({ dados, mudar, erros }: PropriedadesDaSecao) {
  return (
    <Secao numero={3} titulo="Como você usa a energia" explicacao="A energia usada enquanto o sol brilha vale mais, porque não paga Fio B.">
      <GrupoDeOpcoes nome="perfil" legenda="Quando a casa mais usa energia?" opcoes={comNaoSei(NOMES_DO_PERFIL)} valor={dados.perfil} aoMudar={(perfil) => mudar({ perfil })} erro={erros.perfilDeConsumo} />
      <CampoDeTexto id="aumento" rotulo="Se pretende aumentar o consumo, quantos kWh a mais por mês?" inputMode="decimal" value={dados.aumento}
        onChange={(evento) => mudar({ aumento: evento.target.value })} erro={erros.aumentoPrevistoKwh}
        ajuda="Carro elétrico, ar-condicionado, piscina. O valor é somado ao consumo da sua conta. Deixe em branco se não pretende ou não sabe." />
    </Secao>
  );
}

function ComIlustracao({ ilustracao, children }: { ilustracao: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3">{children}</div>
      <div className="flex justify-center rounded-md bg-brand-soft p-4">{ilustracao}</div>
    </div>
  );
}

export function SecaoDoTelhado({ dados, mudar, erros }: PropriedadesDaSecao) {
  return (
    <Secao numero={4} titulo="Seu telhado" explicacao="Você conhece a sua casa melhor que ninguém. Telhado com menos sol pede mais módulos para gerar a mesma energia.">
      <ComIlustracao ilustracao={<IlustracaoHorasDeSol opcao={dados.horasDeSol === NAO_SEI ? '' : dados.horasDeSol} />}>
        <GrupoDeOpcoes nome="horasDeSol" legenda="Num dia de sol, por quantas horas o sol bate direto no telhado?" opcoes={comNaoSei(NOMES_DAS_HORAS)}
          valor={dados.horasDeSol} aoMudar={(horasDeSol) => mudar({ horasDeSol })} erro={erros['telhado.horasDeSol']} />
        <p className="text-sm leading-relaxed text-muted-foreground">Pense em árvores, prédios e morros que fazem sombra de manhã ou à tarde.</p>
      </ComIlustracao>
      <ComIlustracao ilustracao={<IlustracaoOrientacao opcao={dados.orientacao === NAO_SEI ? '' : dados.orientacao} />}>
        <GrupoDeOpcoes nome="orientacao" legenda="Para onde o telhado está virado?" opcoes={comNaoSei(NOMES_DA_ORIENTACAO)}
          valor={dados.orientacao} aoMudar={(orientacao) => mudar({ orientacao })} erro={erros['telhado.orientacao']} />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Fique de costas para a parte mais alta do telhado, olhando para onde a água da chuva escorre, e veja na bússola do celular para que lado você está olhando.
          No Brasil, o norte recebe mais sol.
        </p>
      </ComIlustracao>
      <GrupoDeOpcoes nome="inclinacao" legenda="Qual a inclinação do telhado?" opcoes={comNaoSei(NOMES_DA_INCLINACAO)} valor={dados.inclinacao} aoMudar={(inclinacao) => mudar({ inclinacao })} erro={erros['telhado.inclinacao']} />
      <GrupoDeOpcoes nome="tipoDeTelhado" legenda="Onde os módulos seriam instalados?" opcoes={comNaoSei(NOMES_DO_TELHADO)} valor={dados.tipoDeTelhado} aoMudar={(tipoDeTelhado) => mudar({ tipoDeTelhado })} erro={erros['telhado.tipo']} />
      <CampoDeTexto id="telhado-area" rotulo="Área livre aproximada (m²)" inputMode="decimal" placeholder="Ex.: 30" value={dados.area}
        onChange={(evento) => mudar({ area: evento.target.value })} erro={erros['telhado.areaM2']}
        ajuda="Não sabe? Deixe em branco. Se a área for pequena, o sistema fica limitado ao que cabe e o resultado mostra quanto do consumo ele cobre." />
    </Secao>
  );
}

export function SecaoFinal({ dados, mudar, erros }: PropriedadesDaSecao) {
  const [formas, setFormas] = useState<{ nome: string; tipo: TipoDePagamento }[] | null>(null);
  // Usada apenas no aviso: sem resposta da API, a pergunta continua válida.
  useEffect(() => { listarFormasPublicas().then(setFormas).catch(() => setFormas(null)); }, []);
  const escolhido = dados.pagamento === NAO_SEI ? '' : dados.pagamento;
  const semForma = escolhido !== '' && formas !== null && !formas.some((forma) => forma.tipo === escolhido);
  return (
    <Secao numero={5} titulo="Para terminar">
      <GrupoDeOpcoes nome="jaTemSolar" legenda="Já tem energia solar neste imóvel?" valor={dados.jaTemSolar} aoMudar={(jaTemSolar) => mudar({ jaTemSolar })} erro={erros.jaTemSolar}
        opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Não' }, { valor: NAO_SEI, rotulo: 'Não sei' }]} />
      {dados.jaTemSolar === 'sim' && (
        <CampoDeTexto id="protocolo-em" rotulo="Quando pediu a ligação à distribuidora?" type="date" value={dados.protocoloEm}
          onChange={(evento) => mudar({ protocoloEm: evento.target.value })} erro={erros['solarExistente.protocoloEm']}
          ajuda="Pedidos até 07/01/2023 ficam na regra antiga da Lei 14.300, sem cobrança de Fio B." />
      )}
      <div>
        <GrupoDeOpcoes nome="pagamento" legenda="Como prefere pagar?" opcoes={comNaoSei(NOMES_DO_PAGAMENTO)} valor={dados.pagamento} aoMudar={(pagamento) => mudar({ pagamento })} erro={erros.pagamentoPreferido} />
        {semForma && <p className="mt-3 text-sm text-muted-foreground">A equipe confirma as condições dessa forma de pagamento na proposta.</p>}
      </div>
    </Secao>
  );
}
