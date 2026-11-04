import { useState, type FormEvent } from 'react';
import { comoOpcoes, NOMES_DO_PAGAMENTO } from '../../dados/perguntasDoSimulador.ts';
import { mensagemGeral, useAcao } from '../../hooks/useAcao.ts';
import { alterarForma, cadastrarForma, type DadosDaForma, type FormaDePagamento, type TipoDePagamento } from '../../services/api.ts';
import { fracaoParaCampo, lerNumero, lerNumeroOpcional, percentualParaFracao } from '../../utils/numeros.ts';
import { CaixaDeAceite, CampoDeTexto, GrupoDeOpcoes } from '../formulario/Campos.tsx';
import { Aviso, classeDoBotaoSecundario } from './Pecas.tsx';

// Valores iniciais dos campos, como texto no formato da tela.
function camposIniciais(forma?: FormaDePagamento) {
  return {
    tipo: (forma?.tipo ?? 'financiado') as TipoDePagamento,
    nome: forma?.nome ?? '',
    taxaMensal: fracaoParaCampo(forma?.taxaMensal),
    parcelasMinimas: String(forma?.parcelasMinimas ?? 1),
    parcelasMaximas: String(forma?.parcelasMaximas ?? 1),
    entradaMinima: fracaoParaCampo(forma?.entradaMinima ?? 0),
    carenciaMaximaDias: String(forma?.carenciaMaximaDias ?? 0),
    descontoAvista: fracaoParaCampo(forma?.descontoAvista ?? 0),
    ativa: forma?.ativa ?? false,
  };
}

type Campos = ReturnType<typeof camposIniciais>;

// Converte os percentuais digitados em frações. À vista não tem taxa nem entrada, e a API recusa mais de uma parcela.
function montarDados(campos: Campos): DadosDaForma {
  const avista = campos.tipo === 'avista';
  const taxa = lerNumeroOpcional(campos.taxaMensal);
  return {
    nome: campos.nome.trim(),
    taxaMensal: taxa === undefined || avista ? null : percentualParaFracao(taxa),
    parcelasMinimas: avista ? 1 : lerNumero(campos.parcelasMinimas),
    parcelasMaximas: avista ? 1 : lerNumero(campos.parcelasMaximas),
    entradaMinima: avista ? 0 : percentualParaFracao(lerNumero(campos.entradaMinima)),
    carenciaMaximaDias: avista ? 0 : lerNumero(campos.carenciaMaximaDias),
    descontoAvista: avista ? percentualParaFracao(lerNumero(campos.descontoAvista)) : 0,
    ativa: campos.ativa,
  };
}

// Cadastro (sem `forma`) e edição de uma forma de pagamento. O tipo não muda depois de criado.
export function FormularioDaForma({ forma, aoSalvar }: { forma?: FormaDePagamento; aoSalvar: () => void }) {
  const [campos, setCampos] = useState(() => camposIniciais(forma));
  const { executar, ocupado, erro } = useAcao();
  const mudar = (mudanca: Partial<Campos>) => setCampos((atual) => ({ ...atual, ...mudanca }));
  const avista = campos.tipo === 'avista';
  const prefixo = forma ? `forma-${forma.id}` : 'forma-nova';

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = montarDados(campos);
    const salva = await executar(() => (forma ? alterarForma(forma.id, dados) : cadastrarForma({ ...dados, tipo: campos.tipo })));
    if (salva) aoSalvar();
  }

  return (
    <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
      {!forma && <GrupoDeOpcoes nome={`${prefixo}-tipo`} legenda="Tipo" opcoes={comoOpcoes(NOMES_DO_PAGAMENTO)} valor={campos.tipo} aoMudar={(tipo) => mudar({ tipo })} erro={erro?.campos.tipo} />}
      <CampoDeTexto id={`${prefixo}-nome`} rotulo="Nome" value={campos.nome} erro={erro?.campos.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />
      {avista ? (
        <CampoDeTexto id={`${prefixo}-desconto`} rotulo="Desconto à vista (%)" inputMode="decimal" value={campos.descontoAvista} erro={erro?.campos.descontoAvista} onChange={(evento) => mudar({ descontoAvista: evento.target.value })} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoDeTexto id={`${prefixo}-taxa`} rotulo="Taxa ao mês (%)" inputMode="decimal" value={campos.taxaMensal} erro={erro?.campos.taxaMensal} ajuda="Zero para sem juros. Vazia, a forma não pode ficar ativa." onChange={(evento) => mudar({ taxaMensal: evento.target.value })} />
          <CampoDeTexto id={`${prefixo}-parcelas-min`} rotulo="Parcelas mínimas" inputMode="numeric" value={campos.parcelasMinimas} erro={erro?.campos.parcelasMinimas} onChange={(evento) => mudar({ parcelasMinimas: evento.target.value })} />
          <CampoDeTexto id={`${prefixo}-parcelas-max`} rotulo="Parcelas máximas" inputMode="numeric" value={campos.parcelasMaximas} erro={erro?.campos.parcelasMaximas} onChange={(evento) => mudar({ parcelasMaximas: evento.target.value })} />
          <CampoDeTexto id={`${prefixo}-entrada`} rotulo="Entrada mínima (%)" inputMode="decimal" value={campos.entradaMinima} erro={erro?.campos.entradaMinima} onChange={(evento) => mudar({ entradaMinima: evento.target.value })} />
          <CampoDeTexto id={`${prefixo}-carencia`} rotulo="Carência máxima (dias)" inputMode="numeric" value={campos.carenciaMaximaDias} erro={erro?.campos.carenciaMaximaDias} onChange={(evento) => mudar({ carenciaMaximaDias: evento.target.value })} />
        </div>
      )}
      <CaixaDeAceite id={`${prefixo}-ativa`} marcado={campos.ativa} aoMudar={(ativa) => mudar({ ativa })} erro={erro?.campos.ativa}>Ativa: aparece no simulador e nos orçamentos</CaixaDeAceite>
      {mensagemGeral(erro) && <Aviso>{mensagemGeral(erro)}</Aviso>}
      <button type="submit" disabled={ocupado} className={classeDoBotaoSecundario + ' self-start'}>{ocupado ? 'Salvando…' : forma ? 'Salvar forma' : 'Cadastrar forma'}</button>
    </form>
  );
}
