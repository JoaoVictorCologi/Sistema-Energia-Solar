export function ExplicacaoSimulador() {
  return <aside aria-labelledby="preparacao-titulo" className="rounded-md bg-brand-soft p-6 sm:p-8 lg:p-10">
    <p className="site-eyebrow">Uma conversa mais clara</p>
    <h2 id="preparacao-titulo" className="font-heading text-2xl leading-snug font-medium tracking-tight text-brand-blue">Comece pelo contexto.<br />O projeto vem depois.</h2>
    <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Saber onde será o projeto e como a energia é usada ajuda a organizar o primeiro contato. Você também pode conversar sem ter uma conta em mãos.</p>
    <div className="mt-8 space-y-7 border-t border-border pt-7">
      <div><h3 className="font-heading text-base font-medium text-brand-blue">O que você verá agora</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Um resumo dos dados que você informou, com as unidades identificadas. Você pode editar antes de continuar.</p></div>
      <div><h3 className="font-heading text-base font-medium text-brand-blue">Por que ainda não há números</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Potência, geração e economia dependem de um modelo técnico aprovado. Esta página ainda não calcula essas informações nem confirma a viabilidade do projeto.</p></div>
      <div><h3 className="font-heading text-base font-medium text-brand-blue">Conta e consumo são dados diferentes</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">O consumo é medido em kWh. A conta é um valor em reais. Aqui, um dado não é convertido no outro.</p></div>
    </div>
  </aside>;
}
