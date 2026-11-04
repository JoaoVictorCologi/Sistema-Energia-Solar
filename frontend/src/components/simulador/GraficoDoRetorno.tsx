import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Simulacao } from '../../services/api.ts';
import { formatarReais, formatarReaisCurto } from '../../utils/formatar.ts';

// Uma única série (saldo acumulado): o cinza marca os anos em que o investimento ainda está sendo pago,
// e o azul da marca, os anos de ganho. A posição abaixo ou acima do zero já indica isso, e a cor apenas reforça.
// O cinza tem contraste baixo com o fundo (2,5:1); por isso, a tabela ano a ano oferece uma leitura alternativa.
const COR_DO_GANHO = '#384C96';
const COR_DO_INVESTIMENTO = '#9AA3B5';

type ResumoDoAno = Simulacao['resumoAnual'][number];

export function GraficoDoRetorno({ anos }: { anos: ResumoDoAno[] }) {
  return (
    <figure>
      <div className="h-80 w-full" role="img" aria-label="Gráfico de barras com o saldo acumulado de cada ano: negativo enquanto o investimento se paga e positivo depois. Os mesmos números estão na tabela ano a ano abaixo.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={anos} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#D9DDE6" />
            <XAxis dataKey="ano" tickLine={false} axisLine={false} tick={{ fill: '#535C6D', fontSize: 12 }}
              tickFormatter={(ano: number) => `${ano}º`} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={72} tick={{ fill: '#535C6D', fontSize: 12 }}
              tickFormatter={(valor: number) => formatarReaisCurto(valor)} />
            <ReferenceLine y={0} stroke="#535C6D" />
            <Tooltip
              cursor={{ fill: '#F5F6FA' }}
              labelFormatter={(ano) => `${ano}º ano`}
              formatter={(valor) => [formatarReais(Number(valor), true), 'Saldo acumulado']}
              contentStyle={{ borderRadius: 8, borderColor: '#D9DDE6', color: '#171F32' }}
            />
            <Bar dataKey="fluxoAcumulado" name="Saldo acumulado" radius={[4, 4, 0, 0]} maxBarSize={18}>
              {anos.map((ano) => <Cell key={ano.ano} fill={ano.fluxoAcumulado < 0 ? COR_DO_INVESTIMENTO : COR_DO_GANHO} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs leading-relaxed text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[2px]" style={{ background: COR_DO_INVESTIMENTO }} /> Investimento sendo pago</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-[2px]" style={{ background: COR_DO_GANHO }} /> Economia que fica com você</span>
        <span>Já descontados o investimento, a manutenção e a troca do inversor.</span>
      </figcaption>
    </figure>
  );
}

// Mesmos números do gráfico, como leitura alternativa.
export function TabelaAnoAAno({ anos }: { anos: ResumoDoAno[] }) {
  return (
    <details className="mt-6 rounded-md border border-border bg-white">
      <summary className="min-h-12 cursor-pointer rounded-sm px-4 py-3 text-sm font-semibold text-brand-blue">Ver ano a ano</summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[420px] text-right text-sm">
          <caption className="sr-only">Economia e saldo acumulado de cada ano</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 text-left font-medium">Ano</th>
              <th scope="col" className="py-2 font-medium">Economia na conta</th>
              <th scope="col" className="py-2 font-medium">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {anos.map((ano) => (
              <tr key={ano.ano} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 text-left font-medium">{ano.ano}º</th>
                <td className="py-2">{formatarReais(ano.economia)}</td>
                <td className="py-2">{formatarReais(ano.fluxoAcumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
