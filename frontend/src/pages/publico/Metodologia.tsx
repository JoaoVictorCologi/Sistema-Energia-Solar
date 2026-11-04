import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// Explicação do cálculo para o visitante. Os valores de cada simulação aparecem em "Premissas", no resultado.

const passos = [
  { titulo: 'Tarifa com impostos', texto: 'TE e TUSD da distribuidora, publicadas pela ANEEL, com ICMS, PIS e COFINS por dentro.' },
  { titulo: 'Dimensionamento', texto: 'Potência que gera em um ano o mesmo que você consome, com a irradiação do município e as perdas do sistema; arredondada para módulos inteiros, com o inversor de potência compatível.' },
  { titulo: 'Geração mês a mês', texto: 'Potência × sol médio de cada mês × dias do mês × aproveitamento do sistema, com a perda de rendimento dos módulos ano a ano.' },
  { titulo: 'Conta com e sem solar', texto: 'Parte da energia é usada na hora; o resto vai para a rede e vira crédito. A conta com solar paga o Fio B sobre a energia compensada e nunca fica abaixo do consumo mínimo da ligação.' },
  { titulo: 'Retorno do investimento', texto: '300 meses (25 anos) de economia, com reajuste da tarifa pelo IPCA, manutenção e troca do inversor; daí saem o tempo de retorno, a TIR e o valor presente pela Selic.' },
];

const fontes = [
  { nome: 'ANEEL — Dados Abertos', uso: 'Tarifa de energia (TE e TUSD) e Fio B da distribuidora, com a vigência de cada resolução.' },
  { nome: 'INPE — Atlas Brasileiro de Energia Solar (2ª edição)', uso: 'Irradiação solar média de cada mês, por município.' },
  { nome: 'ANEEL — Indicadores de qualidade (DEC e FEC)', uso: 'Quais distribuidoras atendem cada município, pelos conjuntos elétricos de cada uma.' },
  { nome: 'IBGE — Localidades', uso: 'Os 5.571 municípios do Brasil e o código de cada um.' },
  { nome: 'Banco Central — SGS', uso: 'IPCA acumulado em 12 meses (reajuste da tarifa) e Selic (taxa de desconto).' },
  { nome: 'ViaCEP', uso: 'Cidade e UF a partir do CEP informado.' },
];

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-heading text-xl font-semibold text-foreground">{titulo}</h2>
      <div className="mt-4 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function Metodologia() {
  useTituloDaPagina('Metodologia do simulador — Don Energy');

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="site-eyebrow">Simulador solar</p>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue sm:text-4xl">Metodologia e fontes</h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        O simulador usa dados públicos oficiais e as regras de compensação de energia da Lei 14.300/2022. O cálculo é mensal, por 25 anos,
        e todo número do resultado vem do servidor; os valores usados em cada simulação aparecem em “Premissas”, na tela do resultado.
      </p>

      <Secao titulo="Como o cálculo é feito">
        <ol className="divide-y divide-border border-y border-border">
          {passos.map((passo, posicao) => (
            <li key={passo.titulo} className="flex gap-5 py-4">
              <span aria-hidden="true" className="w-6 shrink-0 pt-0.5 text-xs font-semibold text-brand-blue">0{posicao + 1}</span>
              <div>
                <h3 className="font-semibold text-brand-blue">{passo.titulo}</h3>
                <p className="mt-1 text-sm">{passo.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Secao>

      <Secao titulo="Cobertura nacional">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>O simulador funciona em qualquer município do Brasil, com a tarifa da distribuidora do local e o ICMS do estado.</li>
          <li>Pelo CEP, buscamos as distribuidoras do município nos dados da ANEEL. Se houver mais de uma, você escolhe a da sua conta de luz; deixamos marcada a que atende mais conjuntos da cidade.</li>
          <li>Se a ANEEL não liga o município a nenhuma distribuidora, você escolhe entre as que atendem o estado.</li>
          <li>Quando a ANEEL ainda não publicou o Fio B da tarifa atual, usamos o último publicado, corrigido pela variação da TUSD, e o resultado avisa.</li>
        </ul>
      </Secao>

      <Secao titulo="Regras da Lei 14.300 consideradas">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>Sistemas novos entram na regra de transição (GD II): pagam uma parte crescente do Fio B sobre a energia compensada — 60% em 2026, 75% em 2027 e 90% em 2028 (art. 27).</li>
          <li>De 2029 em diante, a regra depende da valoração da ANEEL, ainda não publicada; o simulador usa o cenário conservador, de 100%.</li>
          <li>A conta nunca fica abaixo do consumo mínimo da ligação: 30, 50 ou 100 kWh (monofásica, bifásica ou trifásica), conforme a REN ANEEL 1.000/2021.</li>
          <li>Os créditos de energia valem por 60 meses; o que vence sem uso é descartado.</li>
        </ul>
      </Secao>

      <Secao titulo="Fontes dos dados">
        <dl className="divide-y divide-border border-y border-border">
          {fontes.map((fonte) => (
            <div key={fonte.nome} className="py-4">
              <dt className="font-semibold text-brand-blue">{fonte.nome}</dt>
              <dd className="mt-1 text-sm">{fonte.uso}</dd>
            </div>
          ))}
        </dl>
      </Secao>

      <Secao titulo="Limites da estimativa">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>O investimento é estimado pela potência; o valor final vem na proposta, com os equipamentos e a avaliação do local.</li>
          <li>O Atlas é uma média de longo prazo, com o telhado voltado para o norte e inclinado na latitude: um ano específico, sombras e outra orientação mudam a geração.</li>
          <li>O aproveitamento do sistema e o consumo no mesmo horário da geração são premissas típicas, que variam com o telhado e os hábitos de cada casa.</li>
          <li>Essas premissas ainda são valores típicos, sem calibração com contas reais, e a tela avisa. Por isso o resultado é uma estimativa em qualquer região, e o valor final vem no orçamento dos especialistas.</li>
          <li>Nas perguntas do simulador, você troca valores típicos pelos da sua casa: conta de luz, consumo de 12 meses, horários de consumo, sol e direção do telhado. Em todas há “não sei”, e o resultado mostra o que foi informado e o que foi estimado.</li>
          <li>Com telhado menos favorável, o sistema cresce para manter a geração: são mais módulos, investimento maior e retorno mais longo. A geração só cai quando a área informada limita os módulos.</li>
          <li>O ICMS usa a alíquota geral de cada estado (e as faixas residenciais onde existem); PIS e COFINS usam uma média nacional.</li>
          <li>O cálculo usa a bandeira verde, sem adicional. A contribuição de iluminação pública fica fora, porque é igual com e sem solar.</li>
        </ul>
      </Secao>

      <Link to="/simulador" className="site-link mt-10">Fazer uma simulação <span aria-hidden="true">↗</span></Link>
    </article>
  );
}
