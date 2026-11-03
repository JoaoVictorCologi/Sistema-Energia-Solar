import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MesDoPrimeiroAno } from '../../services/api.ts';
import { formatarNumero, formatarReais, rotuloDoMes } from '../../utils/formatar.ts';

// Cores da marca validadas para daltonismo (azul × laranja, ΔE 30). O laranja tem contraste 2,75:1 com o fundo,
// por isso a tabela mês a mês fica logo abaixo como leitura alternativa, e a legenda nomeia as duas séries.
const COR_DO_CONSUMO = '#384C96';
const COR_DA_GERACAO = '#D88739';

export function GraficoConsumoGeracao({ meses }: { meses: MesDoPrimeiroAno[] }) {
  const dados = meses.map((mes) => ({ rotulo: rotuloDoMes(mes.anoCivil, mes.mes), consumo: mes.consumoKwh, geracao: mes.geracaoKwh }));

  return (
    <figure>
      <div className="h-80 w-full" role="img" aria-label="Gráfico de barras com o consumo e a geração prevista de cada mês do primeiro ano, em kWh. Os mesmos números estão na tabela mês a mês abaixo.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} barGap={2} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#D9DDE6" />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: '#D9DDE6' }} tick={{ fill: '#535C6D', fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: '#535C6D', fontSize: 12 }}
              tickFormatter={(valor: number) => formatarNumero(valor)} />
            <Tooltip
              cursor={{ fill: '#F5F6FA' }}
              formatter={(valor, nome) => [`${formatarNumero(Number(valor), 1)} kWh`, nome]}
              contentStyle={{ borderRadius: 8, borderColor: '#D9DDE6', color: '#171F32' }}
            />
            {/* O quadrado leva a cor da série; o texto fica na cor de texto, legível sobre o branco. */}
            <Legend verticalAlign="top" align="left" height={36} iconType="square" wrapperStyle={{ fontSize: 14 }}
              formatter={(nome) => <span style={{ color: '#171F32' }}>{nome}</span>} />
            <Bar dataKey="consumo" name="Consumo" fill={COR_DO_CONSUMO} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="geracao" name="Geração prevista" fill={COR_DA_GERACAO} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
        A geração varia com o sol de cada mês; o que sobra vira crédito para os meses de menos sol (validade de 60 meses).
      </figcaption>
    </figure>
  );
}

export function TabelaMesAMes({ meses }: { meses: MesDoPrimeiroAno[] }) {
  return (
    <details className="mt-6 rounded-md border border-border bg-white">
      <summary className="min-h-12 cursor-pointer rounded-sm px-4 py-3 text-sm font-semibold text-brand-blue">Ver mês a mês</summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[560px] text-right text-sm">
          <caption className="sr-only">Consumo, geração e conta de energia de cada mês do primeiro ano</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 text-left font-medium">Mês</th>
              <th scope="col" className="py-2 font-medium">Consumo (kWh)</th>
              <th scope="col" className="py-2 font-medium">Geração (kWh)</th>
              <th scope="col" className="py-2 font-medium">Conta sem solar</th>
              <th scope="col" className="py-2 font-medium">Conta com solar</th>
              <th scope="col" className="py-2 font-medium">Economia</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {meses.map((mes) => (
              <tr key={`${mes.anoCivil}-${mes.mes}`} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 text-left font-medium">{rotuloDoMes(mes.anoCivil, mes.mes)}</th>
                <td className="py-2">{formatarNumero(mes.consumoKwh, 1)}</td>
                <td className="py-2">{formatarNumero(mes.geracaoKwh, 1)}</td>
                <td className="py-2">{formatarReais(mes.faturaSemSolar)}</td>
                <td className="py-2">{formatarReais(mes.faturaComSolar)}</td>
                <td className="py-2">{formatarReais(mes.economia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
