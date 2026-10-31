import { Link } from 'react-router';
import { useTituloDaPagina } from '../../hooks/useTituloDaPagina.ts';

// As fontes já estão definidas (docs/arquitetura/fontes-de-dados.md); as premissas do cálculo entram na tarefa 10.
const fontes = [
  { nome: 'ANEEL — Dados Abertos', uso: 'Tarifa de energia (TE e TUSD) e Fio B da distribuidora, com a vigência de cada resolução.' },
  { nome: 'INPE — Atlas Brasileiro de Energia Solar', uso: 'Irradiação solar média de cada mês, por município.' },
  { nome: 'IBGE — Localidades', uso: 'Lista de municípios e código de cada um.' },
  { nome: 'Banco Central — SGS', uso: 'IPCA e Selic, usados no reajuste da tarifa e na taxa de desconto do retorno.' },
  { nome: 'ViaCEP', uso: 'Cidade e UF a partir do CEP informado.' },
];

export function Metodologia() {
  useTituloDaPagina('Metodologia do simulador — Don Energy');

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <p className="site-eyebrow">Simulador solar</p>
      <h1 className="font-heading text-3xl font-medium tracking-tight text-brand-blue sm:text-4xl">Metodologia e fontes</h1>
      <p className="mt-6 leading-relaxed text-muted-foreground">
        O simulador usa dados públicos oficiais e as regras de compensação de energia da Lei 14.300/2022.
        As premissas do cálculo serão detalhadas nesta página junto com o simulador.
      </p>
      <h2 className="mt-12 font-heading text-xl font-semibold text-foreground">Fontes dos dados</h2>
      <dl className="mt-4 divide-y divide-border border-y border-border">
        {fontes.map((fonte) => (
          <div key={fonte.nome} className="py-4">
            <dt className="font-semibold text-brand-blue">{fonte.nome}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{fonte.uso}</dd>
          </div>
        ))}
      </dl>
      <Link to="/simulador" className="site-link mt-8">Voltar ao simulador</Link>
    </article>
  );
}
