"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { perfisSolares, type PerfilSolarId } from "@/lib/perfis-solares";
import { contextoParaContato, estadosBrasileiros, ligacoes, nomePerfil, type ContextoSimulador } from "@/lib/simulador-contexto";
import type { DadosSimulador } from "@/lib/simulador-schema";

const FormularioContato = dynamic(() => import("./formulario-contato").then(m => m.FormularioContato), {
  ssr: false,
  loading: () => <p role="status" className="p-6">Carregando formulário de contato…</p>,
});
const resolverSimulador: Resolver<DadosSimulador> = async (values, context, options) => {
  const [{ zodResolver }, { simuladorSchema }] = await Promise.all([import("@hookform/resolvers/zod"), import("@/lib/simulador-schema")]);
  return zodResolver(simuladorSchema)(values, context, options);
};

const subscribeInterativo = () => () => {};
const classeSelect = "min-h-11 w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm text-brand-ink shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue";

export function SimuladorSolar({ explicacao }: { explicacao: ReactNode }) {
  const interativo = useSyncExternalStore(subscribeInterativo, () => true, () => false);
  const { register, handleSubmit, control, setValue, clearErrors, setFocus, formState: { errors, isSubmitting } } = useForm<DadosSimulador>({
    resolver: resolverSimulador,
    defaultValues: { perfil: "" as PerfilSolarId, cidade: "", uf: "" as DadosSimulador["uf"], tipoDado: "nao-sei", valor: "", ligacao: "nao-sei" },
  });
  const perfil = useWatch({ control, name: "perfil" });
  const tipoDado = useWatch({ control, name: "tipoDado" });
  const [revisao, setRevisao] = useState<DadosSimulador | null>(null);
  const [contextoContato, setContextoContato] = useState<ContextoSimulador | null>(null);
  const [mostrarContato, setMostrarContato] = useState(false);
  const resumo = useRef<HTMLHeadingElement>(null);
  const destinoContato = useRef<HTMLDivElement>(null);
  const contexto = revisao ? contextoParaContato(revisao) : null;
  const contextoMudou = contexto && contextoContato && JSON.stringify(contexto) !== JSON.stringify(contextoContato);

  useEffect(() => { if (revisao) { resumo.current?.scrollIntoView({ block: "start", behavior: "instant" }); resumo.current?.focus({ preventScroll: true }); } }, [revisao]);
  useEffect(() => { if (mostrarContato) { destinoContato.current?.scrollIntoView({ block: "start", behavior: "instant" }); destinoContato.current?.focus({ preventScroll: true }); } }, [mostrarContato, contextoContato]);

  function invalidarRevisao() {
    if (revisao) setRevisao(null);
  }
  function abrirContato() {
    if (!contexto) return;
    if (!contextoContato || contextoMudou) setContextoContato(contexto);
    setMostrarContato(true);
    destinoContato.current?.scrollIntoView({ block: "start", behavior: "instant" });
    destinoContato.current?.focus({ preventScroll: true });
  }

  return <>
    <section aria-label="Preparação dos dados" className="site-shell grid items-start gap-8 pb-20 lg:grid-cols-2 lg:gap-12">
      <div className="min-w-0 rounded-md border border-border bg-white p-6 sm:p-8 lg:p-10">
        <p className="site-eyebrow">Seu contexto</p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-brand-blue">Conte o que você já sabe.</h2>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">Os dados podem apoiar uma conversa sobre o projeto. Para revisar, não é preciso informar nome ou telefone.</p>
        <noscript><p className="mt-6 border-l-4 border-brand-blue bg-brand-soft p-4 text-sm">Ative o JavaScript para revisar os campos. Você também pode <a className="underline" href="/contato/">ir diretamente ao contato</a>.</p></noscript>
        <form noValidate onSubmit={handleSubmit(dados => setRevisao(dados))} onChangeCapture={invalidarRevisao} className="mt-8"><fieldset disabled={!interativo} className="space-y-6"><legend className="sr-only">Dados para preparar a conversa sobre o projeto</legend>
          <Field data-invalid={!!errors.perfil}><FieldLabel htmlFor="sim-perfil">Perfil do projeto</FieldLabel><select id="sim-perfil" className={classeSelect} aria-invalid={!!errors.perfil} aria-describedby={errors.perfil ? "sim-erro-perfil" : undefined} {...register("perfil", { onChange: e => { if (e.target.value === "usina") { setValue("tipoDado", "nao-sei"); setValue("valor", ""); setValue("ligacao", "nao-sei"); clearErrors(["valor", "ligacao"]); } } })}><option value="">Selecione o perfil</option>{perfisSolares.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}</select><FieldError id="sim-erro-perfil" errors={[errors.perfil]} /></Field>
          <div className="grid min-w-0 gap-5 sm:grid-cols-[1fr_6rem]">
            <Field data-invalid={!!errors.cidade}><FieldLabel htmlFor="sim-cidade">Cidade do projeto</FieldLabel><Input id="sim-cidade" className="min-h-11" autoComplete="address-level2" maxLength={100} aria-invalid={!!errors.cidade} aria-describedby={errors.cidade ? "sim-erro-cidade" : undefined} {...register("cidade")} /><FieldError id="sim-erro-cidade" errors={[errors.cidade]} /></Field>
            <Field data-invalid={!!errors.uf}><FieldLabel htmlFor="sim-uf">UF</FieldLabel><select id="sim-uf" className={classeSelect} autoComplete="address-level1" aria-invalid={!!errors.uf} aria-describedby={errors.uf ? "sim-erro-uf" : undefined} {...register("uf")}><option value="">UF</option>{estadosBrasileiros.map(uf => <option key={uf}>{uf}</option>)}</select><FieldError id="sim-erro-uf" errors={[errors.uf]} /></Field>
          </div>
          {perfil === "usina" ? <div className="rounded-sm bg-brand-soft p-5"><h3 className="font-heading text-base font-medium text-brand-blue">Usina de investimento: uma análise própria.</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Vamos organizar seu interesse para o atendimento. Não aplicamos uma projeção de consumo residencial a esse perfil e não calculamos investimento ou retorno.</p><Link prefetch={false} href="/servicos/usina-de-investimento/" className="site-link mt-3">Conheça esse perfil ↗</Link></div> : <>
            <Field><FieldLabel htmlFor="sim-tipo-dado">Qual dado você tem em mãos?</FieldLabel><select id="sim-tipo-dado" className={classeSelect} {...register("tipoDado", { onChange: () => { setValue("valor", ""); clearErrors("valor"); } })}><option value="nao-sei">Não tenho esse dado agora</option><option value="consumo">Consumo mensal em kWh</option><option value="conta">Valor mensal da conta em reais</option></select></Field>
            {tipoDado !== "nao-sei" && <Field data-invalid={!!errors.valor}><FieldLabel htmlFor="sim-valor">{tipoDado === "conta" ? "Valor informado da conta (R$/mês)" : "Consumo informado (kWh/mês)"}</FieldLabel><Input id="sim-valor" className="min-h-11" inputMode="decimal" maxLength={30} aria-invalid={!!errors.valor} aria-describedby={"sim-ajuda-valor" + (errors.valor ? " sim-erro-valor" : "")} {...register("valor")} /><p id="sim-ajuda-valor" className="text-xs leading-relaxed text-muted-foreground">Use números e vírgula decimal, sem pontos, símbolos ou unidades. Informe o dado como aparece na sua conta; não fazemos conversão nem cálculo.</p><FieldError id="sim-erro-valor" errors={[errors.valor]} /></Field>}
            <Field><FieldLabel htmlFor="sim-ligacao">Tipo de ligação informado</FieldLabel><select id="sim-ligacao" className={classeSelect} aria-describedby="sim-ajuda-ligacao" {...register("ligacao")}>{ligacoes.map(l => <option key={l.id} value={l.id}>{l.titulo}</option>)}</select><p id="sim-ajuda-ligacao" className="text-xs leading-relaxed text-muted-foreground">Se não souber, mantenha “Não sei”. A revisão não confirma a elegibilidade técnica do imóvel.</p></Field>
          </>}
          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="site-button w-full">Revisar dados <span aria-hidden="true">↗</span></button>
          <p className="text-xs leading-relaxed text-muted-foreground">Cálculo em preparação. Esta ação apenas revisa o preenchimento. <Link prefetch={false} href="/contato/" className="underline underline-offset-4">Você também pode ir direto ao contato.</Link></p>
        </fieldset></form>
      </div>
      {contexto && revisao ? <section aria-labelledby="sim-resumo-titulo" className="min-w-0 rounded-md bg-brand-soft p-6 sm:p-8 lg:p-10">
        <p className="site-eyebrow">Dados informados por você</p>
        <h2 id="sim-resumo-titulo" ref={resumo} tabIndex={-1} className="scroll-mt-[calc(var(--header-height)+1rem)] font-heading text-2xl font-medium tracking-tight text-brand-blue">Revise antes de conversar.</h2>
        <p role="status" className="mt-4 text-sm leading-relaxed text-muted-foreground">Preenchimento revisado. Não há estimativa calculada ou confirmação de viabilidade.</p>
        <dl className="mt-8 space-y-6 border-y border-border py-7 text-sm">
          <div><dt className="text-muted-foreground">Perfil informado</dt><dd className="mt-2 font-semibold text-brand-blue">{nomePerfil(revisao.perfil)}</dd></div>
          <div><dt className="text-muted-foreground">Local informado</dt><dd className="mt-2 font-semibold text-brand-blue">{contexto.cidade}</dd></div>
          <div><dt className="text-muted-foreground">{revisao.perfil === "usina" ? "Encaminhamento" : "Consumo ou conta"}</dt><dd className="mt-2 font-semibold text-brand-blue">{revisao.perfil === "usina" ? "Atendimento específico para usina de investimento" : contexto.consumoOuConta}</dd></div>
          {revisao.perfil !== "usina" && <div><dt className="text-muted-foreground">Ligação informada</dt><dd className="mt-2 font-semibold text-brand-blue">{contexto.ligacao}</dd></div>}
        </dl>
        <button type="button" onClick={() => { setRevisao(null); setFocus("perfil"); }} className="site-link mt-5">Editar dados</button>
        <div className="mt-7 border-t border-border pt-7"><h3 className="font-heading text-lg font-medium text-brand-blue">Quer dar o próximo passo?</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Se quiser, complete o contato para preparar uma mensagem no WhatsApp. O envio será feito por você.</p>
          {contextoMudou ? <><p role="status" className="mt-4 text-sm leading-relaxed">Seu rascunho de contato foi preservado. A atualização abaixo substitui somente perfil, cidade, consumo/conta e ligação pelos dados desta revisão.</p><button type="button" onClick={abrirContato} className="site-button mt-5 w-full">Atualizar contexto no contato</button></> : <button type="button" onClick={abrirContato} className="site-button mt-5 w-full">{mostrarContato ? "Voltar ao contato" : "Conversar sobre meu projeto"}</button>}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Cálculo pendente de aprovação técnica. Não são apresentados potência, geração, economia ou retorno.</p>
        </div>
      </section> : explicacao}
    </section>
    {contextoContato && <div ref={destinoContato} tabIndex={-1} hidden={!mostrarContato || !revisao || !!contextoMudou} className="site-shell min-h-[850px] scroll-mt-[calc(var(--header-height)+1rem)] pb-20" aria-label="Contato a partir dos dados revisados">
      <div className="mb-5 max-w-3xl text-sm leading-relaxed text-muted-foreground"><p>Dados de preparação, sem estimativa calculada. Confira os campos antes de preparar sua mensagem. Nome, telefone e consentimento ficam neste contato opcional.</p></div>
      <FormularioContato contextoInicial={contextoContato} sectionId="contato-simulador" compacto />
    </div>}
  </>;
}
