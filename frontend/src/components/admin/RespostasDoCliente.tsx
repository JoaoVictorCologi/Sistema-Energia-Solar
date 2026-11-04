import { NOMES_DA_INCLINACAO, NOMES_DA_ORIENTACAO, NOMES_DAS_HORAS, NOMES_DO_PAGAMENTO, NOMES_DO_PERFIL, NOMES_DO_TELHADO, NOMES_DOS_MESES } from '../../dados/perguntasDoSimulador.ts';
import type { RespostasGravadas } from '../../services/api.ts';
import { formatarData, formatarNumero, formatarReais } from '../../utils/formatar.ts';

// Os números vêm do JSON gravado na simulação e podem chegar como texto.
const reais = (valor: number | string) => formatarReais(Number(valor));
const kwh = (valor: number | string) => `${formatarNumero(Number(valor))} kWh`;

function respostasDaConta({ conta }: RespostasGravadas): [string, string][] {
  if (!conta) return [];
  const iluminacao = conta.iluminacaoPublicaReais === undefined ? '' : `, iluminação pública ${reais(conta.iluminacaoPublicaReais)}`;
  return [['Última conta', `${reais(conta.valorReais)} por ${kwh(conta.consumoKwh)}${iluminacao}`]];
}

function respostasDoTelhado({ telhado }: RespostasGravadas): [string, string][] {
  if (!telhado) return [];
  const itens: [string, string | undefined][] = [
    ['Sol direto no telhado', telhado.horasDeSol && NOMES_DAS_HORAS[telhado.horasDeSol]],
    ['Direção do telhado', telhado.orientacao && NOMES_DA_ORIENTACAO[telhado.orientacao]],
    ['Inclinação', telhado.inclinacao && NOMES_DA_INCLINACAO[telhado.inclinacao]],
    ['Local dos módulos', telhado.tipo && NOMES_DO_TELHADO[telhado.tipo]],
    ['Área livre', telhado.areaM2 === undefined ? undefined : `${formatarNumero(Number(telhado.areaM2))} m²`],
  ];
  return itens.filter((item): item is [string, string] => Boolean(item[1]));
}

function listarRespostas(respostas: RespostasGravadas): [string, string][] {
  const { consumoMensalKwh, perfilDeConsumo, solarExistente, aumentoPrevistoKwh, pagamentoPreferido } = respostas;
  return [
    ...respostasDaConta(respostas),
    ...(perfilDeConsumo ? [['Horário de consumo', NOMES_DO_PERFIL[perfilDeConsumo]] as [string, string]] : []),
    ...respostasDoTelhado(respostas),
    ...(solarExistente ? [['Pedido de ligação da energia solar que já tem', formatarData(solarExistente.protocoloEm)] as [string, string]] : []),
    ...(aumentoPrevistoKwh !== undefined ? [['Aumento previsto de consumo', `${kwh(aumentoPrevistoKwh)} por mês`] as [string, string]] : []),
    ...(pagamentoPreferido ? [['Forma de pagamento preferida', NOMES_DO_PAGAMENTO[pagamentoPreferido]] as [string, string]] : []),
    ...(consumoMensalKwh ? [['Consumo de 12 meses', consumoMensalKwh.map((mes, indice) => `${NOMES_DOS_MESES[indice].slice(0, 3).toLowerCase()} ${formatarNumero(Number(mes))}`).join(' · ')] as [string, string]] : []),
  ];
}

// Base do orçamento: tudo o que o cliente respondeu nas perguntas do simulador.
export function RespostasDoCliente({ respostas }: { respostas: RespostasGravadas | null }) {
  const itens = respostas ? listarRespostas(respostas) : [];
  if (itens.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Sem respostas sobre a casa: o cálculo usou os valores típicos.</p>;
  return (
    <dl className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
      {itens.map(([termo, valor]) => (
        <div key={termo}><dt className="text-muted-foreground">{termo}</dt><dd className="mt-0.5 font-medium">{valor}</dd></div>
      ))}
    </dl>
  );
}
